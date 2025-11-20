// @ts-nocheck
import { HistoricalData } from '../components/HistoricalDataModal';
import { standardizeWeekDate } from './utils';

declare const pdfjsLib: any;

const b64toUint8Array = (b64: string) => {
    const binStr = atob(b64.split(',')[1] || b64);
    const len = binStr.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
        bytes[i] = binStr.charCodeAt(i);
    }
    return bytes;
};

// Agrupa itens que estão visualmente na mesma linha (tolerância Y)
const groupItemsByLines = (items: any[]) => {
    const lines: { y: number; text: string; textWithSpaces: string; items: any[] }[] = [];
    if (!items.length) return lines;

    // Ordena por Y (topo para baixo) e depois por X (esquerda para direita)
    const sortedItems = [...items].sort((a, b) => {
        const yDiff = b.transform[5] - a.transform[5];
        if (Math.abs(yDiff) > 5) return yDiff; // Tolerância de 5px para considerar linhas diferentes
        return a.transform[4] - b.transform[4]; 
    });

    let currentLine = { y: sortedItems[0].transform[5], items: [sortedItems[0]] };

    for (let i = 1; i < sortedItems.length; i++) {
        const item = sortedItems[i];
        if (Math.abs(item.transform[5] - currentLine.y) < 5) {
            currentLine.items.push(item);
        } else {
            // Fecha a linha anterior
            currentLine.items.sort((a, b) => a.transform[4] - b.transform[4]);
            lines.push({
                y: currentLine.y,
                text: currentLine.items.map(i => i.str).join('').trim(),
                textWithSpaces: currentLine.items.map(i => i.str).join(' ').trim(),
                items: currentLine.items
            });
            currentLine = { y: item.transform[5], items: [item] };
        }
    }
    if (currentLine.items.length > 0) {
        currentLine.items.sort((a, b) => a.transform[4] - b.transform[4]);
        lines.push({
            y: currentLine.y,
            text: currentLine.items.map(i => i.str).join('').trim(),
            textWithSpaces: currentLine.items.map(i => i.str).join(' ').trim(),
            items: currentLine.items
        });
    }

    return lines;
};

// Separa nomes que estão na mesma linha (Estudante / Ajudante) baseado no espaço entre eles
const splitNamesByGap = (textItems: any[], startX: number): string[] => {
    const candidates = textItems.filter(i => i.transform[4] >= startX && i.str.trim().length > 0);
    if (candidates.length === 0) return [];

    const names: string[] = [];
    let currentNameParts: string[] = [candidates[0].str];
    let lastX = candidates[0].transform[4] + candidates[0].width;

    for (let i = 1; i < candidates.length; i++) {
        const item = candidates[i];
        const gap = item.transform[4] - lastX;

        // Se o espaço for maior que 40px, considera como uma nova coluna (Ajudante)
        if (gap > 40) {
            names.push(currentNameParts.join(' ').trim());
            currentNameParts = [item.str];
        } else {
            currentNameParts.push(item.str);
        }
        lastX = item.transform[4] + item.width;
    }
    names.push(currentNameParts.join(' ').trim());

    // Limpeza final
    return names
        .map(n => n.replace(/^(Estudante|Ajudante|Leitor|Dirigente):?\s*/i, '').trim())
        .filter(n => n.length > 2 && !/^\d+$/.test(n));
};

export const parseHistoricPdf = async (file: File): Promise<HistoricalData[]> => {
    if (typeof pdfjsLib === 'undefined') {
        throw new Error('A biblioteca pdf.js não está carregada.');
    }

    let detectedYear = '';
    const filenameMatch = file.name.match(/20\d{2}/);
    if (filenameMatch) detectedYear = filenameMatch[0];

    const fileReader = new FileReader();
    const pdfData = await new Promise<string>((resolve, reject) => {
        fileReader.onload = (e) => resolve(e.target.result as string);
        fileReader.onerror = reject;
        fileReader.readAsDataURL(file);
    });
    
    const uint8array = b64toUint8Array(pdfData);
    const doc = await pdfjsLib.getDocument({ data: uint8array }).promise;
    
    if (!detectedYear) {
         try {
             const page1 = await doc.getPage(1);
             const content = await page1.getTextContent();
             const text = content.items.map((i: any) => i.str).join(' ');
             const contentMatch = text.match(/20\d{2}/);
             if (contentMatch) detectedYear = contentMatch[0];
         } catch (e) { console.warn("Ano não detectado na pág 1"); }
    }
    if (!detectedYear) detectedYear = new Date().getFullYear().toString();
    const yearContext = parseInt(detectedYear, 10);

    const allWeeksData: HistoricalData[] = [];

    for (let i = 1; i <= doc.numPages; i++) {
        const page = await doc.getPage(i);
        const textContent = await page.getTextContent();
        const lines = groupItemsByLines(textContent.items);

        let weeklyBlocks = [];
        let currentBlock = [];
        
        for (const line of lines) {
            // Detecta início de semana
            const isWeekStart = line.textWithSpaces.toUpperCase().includes('SEMANA') || 
                                /^\d{1,2}.*\d{1,2}\s+DE\s+[A-ZÇ]+/i.test(line.textWithSpaces);
            
            if (isWeekStart) {
                if (currentBlock.length > 0) weeklyBlocks.push(currentBlock);
                currentBlock = [line];
            } else {
                currentBlock.push(line);
            }
        }
        if (currentBlock.length > 0) weeklyBlocks.push(currentBlock);

        for (const block of weeklyBlocks) {
            if (block.length < 3) continue;

            const weekLine = block[0].textWithSpaces;
            const normalizedWeek = standardizeWeekDate(weekLine, yearContext);
            const participations: { partTitle: string; publisherName: string }[] = [];

            for (let l = 0; l < block.length; l++) {
                const line = block[l];
                const text = line.textWithSpaces;
                const upperText = text.toUpperCase();

                // 1. Presidente e Oração
                if (upperText.includes('PRESIDENTE:')) {
                    const parts = text.split(/Presidente:/i);
                    if (parts[1]) participations.push({ partTitle: 'Presidente', publisherName: parts[1].trim() });
                    continue;
                }
                if (upperText.includes('ORAÇÃO:')) {
                    const type = l < block.length / 2 ? 'Oração Inicial' : 'Oração Final';
                    const parts = text.split(/Oração:/i);
                    if (parts[1]) participations.push({ partTitle: type, publisherName: parts[1].trim() });
                    continue;
                }

                // 2. Partes Numeradas e com Tempo (Ancoragem por Duração)
                // Procura por padrão: "1. Título (10 min)" ou variações
                const partMatch = text.match(/^.*?(\d+)\.\s+(.*?)\((\d+)\s*min.*?\)/i);
                
                if (partMatch) {
                    const rawTitle = partMatch[2].trim();
                    const partTitle = rawTitle; 
                    
                    // Encontra onde termina a duração visualmente
                    let anchorX = 0;
                    const durationItem = line.items.find(item => item.str.includes(')'));
                    
                    if (durationItem) {
                        anchorX = durationItem.transform[4] + durationItem.width;
                    } else {
                        // Fallback: estimativa
                        anchorX = 300; 
                    }

                    // Extrai nomes à direita da âncora
                    let names = splitNamesByGap(line.items, anchorX + 5);

                    // Se não achou na mesma linha, verifica a próxima (quebra de linha)
                    if (names.length === 0 && l + 1 < block.length) {
                        const nextLine = block[l + 1];
                        // Verifica se a próxima linha não é outra parte numerada
                        if (!nextLine.textWithSpaces.match(/^\d+\./)) {
                            names = splitNamesByGap(nextLine.items, 250); 
                        }
                    }

                    if (names.length > 0) {
                        if (names.length === 1) {
                            participations.push({ partTitle, publisherName: names[0] });
                        } else {
                            // Assume Estudante (0) e Ajudante (1)
                            participations.push({ partTitle, publisherName: names[0] });
                            participations.push({ partTitle: 'Ajudante', publisherName: names[1] });
                        }
                    }
                    continue;
                }

                // 3. Estudo Bíblico de Congregação
                if (upperText.includes('DIRIGENTE:') || upperText.includes('LEITOR:')) {
                    const dirMatch = text.match(/Dirigente:\s*([^Leitor]+)/i);
                    if (dirMatch) {
                        participations.push({ partTitle: 'Estudo bíblico de congregação', publisherName: dirMatch[1].trim() });
                    }
                    const leitMatch = text.match(/Leitor:\s*(.+)/i);
                    if (leitMatch) {
                         participations.push({ partTitle: 'Leitor do EBC', publisherName: leitMatch[1].trim() });
                    }
                }
            }
            
            if (participations.length > 0) {
                allWeeksData.push({ week: normalizedWeek, participations });
            }
        }
    }

    return allWeeksData;
};