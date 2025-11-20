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

const partNeedsHelper = (title: string): boolean => {
    const normalized = title.toLowerCase();
    if (normalized.includes('discurso') || normalized.includes('necessidades locais') || normalized.includes('coment')) return false;
    if (normalized.includes('estudo bíblico de congregação') || normalized.includes('estudo biblico de congregacao')) return false;
    return (
        normalized.includes('iniciando') ||
        normalized.includes('cultivando') ||
        normalized.includes('fazendo') ||
        normalized.includes('revisita') ||
        normalized.includes('demonstra') ||
        normalized.includes('explicando') ||
        normalized.includes('estudo bíblico') ||
        normalized.includes('estudo biblico') ||
        normalized.includes('conversas')
    );
};

const isTimeMarker = (text: string): boolean => /\b\d{1,2}:\d{2}\b/.test(text);
const isWeekHeading = (text: string): boolean => text.toUpperCase().includes('SEMANA');
const isPartHeading = (text: string): boolean => /^\d+\./.test(text.trim());
const STOP_WORDS = ['ACONSELHAMENTO', 'COMENTÁRIOS INICIAIS', 'COMENTARIOS INICIAIS', 'COMENTÁRIOS FINAIS', 'COMENTARIOS FINAIS'];

const isSectionBoundary = (text: string): boolean => {
    const upper = text.toUpperCase();
    return (
        isTimeMarker(text) ||
        isWeekHeading(text) ||
        isPartHeading(text) ||
        STOP_WORDS.includes(upper) ||
        upper.startsWith('CÂNTICO') ||
        upper.startsWith('CANTICO') ||
        upper.startsWith('COMENT') ||
        upper.startsWith('ORAÇÃO') ||
        upper.startsWith('ORACAO') ||
        upper.startsWith('PRESIDENTE') ||
        upper.startsWith('DIRIGENTE') ||
        upper.startsWith('LEITOR') ||
        upper.startsWith('S-')
    );
};

const isStudentHeaderLine = (text: string): boolean => /^ESTUDANTES?/i.test(text);
const isHelperHeaderLine = (text: string): boolean => /^AJUDANTES?/i.test(text);
const isLocationHeaderLine = (text: string): boolean => /(SAL[ÃA]O|SALA|AUDIT[ÓO]RIO)/i.test(text);

const stripColumnLabel = (text: string): string => text.replace(/^(Estudantes?|Ajudantes?|Estudante|Ajudante)[:\s-]*/i, '').trim();

const normalizeCandidateName = (name: string): string => name.replace(/\s+/g, ' ').trim();

const assignPendingNames = (
    names: string[],
    queue: { partTitle: string; partNumber?: number }[],
    participations: { partTitle: string; publisherName: string; order?: number; partNumber?: number }[],
    orderGenerator: () => number,
    isHelper = false
) => {
    if (!names.length || !queue.length) return;

    for (const rawName of names) {
        const normalized = normalizeCandidateName(rawName);
        if (!normalized) continue;
        const target = queue.shift();
        if (!target) break;

        participations.push({ partTitle: isHelper ? 'Ajudante' : target.partTitle, publisherName: normalized, order: orderGenerator(), partNumber: target.partNumber });
    }
};

const isStandaloneName = (text: string): boolean => {
    if (!text) return false;
    const trimmed = text.trim();
    if (!trimmed) return false;
    if (isSectionBoundary(trimmed) || isStudentHeaderLine(trimmed) || isHelperHeaderLine(trimmed) || isLocationHeaderLine(trimmed)) return false;
    if (/min\)/i.test(trimmed) || /^\d+$/.test(trimmed)) return false;
    const detectDirigenteOrLeitorFromColumns = (
        block: any[],
        startIndex: number,
        label: 'DIRIGENTE' | 'LEITOR',
        runningOrderRef: { value: number },
        participations: { partTitle: string; publisherName: string; order?: number }[],
        pendingStudentParts: { partTitle: string }[]
    ) => {
        if (pendingStudentParts.length > 0) return;
        const { names } = collectNamesAfterLine(block, startIndex, ['ESTUDANTE', 'ESTUDANTES', 'AJUDANTE', 'AJUDANTES', 'CÂNTICO', 'CANTICO']);
        const targetName = names.find(name => !isSectionBoundary(name));
        if (!targetName) return;
        if (label === 'DIRIGENTE') {
            participations.push({ partTitle: 'Estudo bíblico de congregação', publisherName: targetName, order: runningOrderRef.value++ });
        } else {
            participations.push({ partTitle: 'Leitor do EBC', publisherName: targetName, order: runningOrderRef.value++ });
        }
    };

    const mapPartNumberToType = (partNumber: number): 'TESOUROS' | 'MINISTERIO' | 'VIDA_CRISTA' => {
        if (partNumber <= 3) return 'TESOUROS';
        if (partNumber <= 6) return 'MINISTERIO';
        return 'VIDA_CRISTA';
    };
    return /[A-Za-zÀ-ÿ]/.test(trimmed);
};

const collectNamesAfterLine = (block: any[], startIndex: number, stopHeaders: string[] = []) => {
    const names: string[] = [];
    let idx = startIndex + 1;

    while (idx < block.length) {
        const candidate = block[idx].textWithSpaces.trim();
        if (!candidate) {
            idx++;
            continue;
        }

        const upper = candidate.toUpperCase();
        if (stopHeaders.some(header => upper.startsWith(header))) break;
        if (isSectionBoundary(candidate) || isLocationHeaderLine(candidate)) break;
        if (!isStandaloneName(candidate)) {
            idx++;
            continue;
        }

        names.push(candidate);
        idx++;
    }

    return { names, nextIndex: idx - 1 };
};

const findNextNameLine = (block: any[], startIndex: number, stopHeaders: string[] = []) => {
    let idx = startIndex + 1;
    while (idx < block.length) {
        const candidate = block[idx].textWithSpaces.trim();
        if (!candidate) {
            idx++;
            continue;
        }
        const upper = candidate.toUpperCase();
        if (stopHeaders.some(header => upper.startsWith(header))) break;
        if (isSectionBoundary(candidate) || isLocationHeaderLine(candidate)) break;
        if (isStandaloneName(candidate)) {
            return { name: candidate, index: idx };
        }
        idx++;
    }
    return null;
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
            const participations: { partTitle: string; publisherName: string; order?: number }[] = [];
            const pendingStudentParts: { partTitle: string; partNumber?: number }[] = [];
            const pendingHelperParts: { partTitle: string; partNumber?: number }[] = [];
            let presidentName = '';
            let runningOrder = 0;

            for (let l = 0; l < block.length; l++) {
                const line = block[l];
                const text = line.textWithSpaces;
                const upperText = text.toUpperCase();

                // 1. Presidente e Oração
                if (upperText.includes('PRESIDENTE:')) {
                    const parts = text.split(/Presidente:/i);
                    if (parts[1]) {
                        presidentName = parts[1].trim();
                        participations.push({ partTitle: 'Presidente', publisherName: presidentName, order: runningOrder++ });
                    }
                    continue;
                }
                if (upperText.includes('ORAÇÃO:')) {
                    const type = l < block.length / 2 ? 'Oração Inicial' : 'Oração Final';
                    const parts = text.split(/Oração:/i);
                    if (parts[1]) participations.push({ partTitle: type, publisherName: parts[1].trim(), order: runningOrder++ });
                    continue;
                }

                if (upperText.includes('CÂNTICO') || upperText.includes('CANTICO')) {
                    const canticoTitle = text.replace(/\s+/g, ' ').trim();
                    participations.push({ partTitle: canticoTitle, publisherName: '', order: runningOrder++ });
                    continue;
                }

                if (upperText.startsWith('COMENT')) {
                    const parts = text.split(/Comentários?\s*finais:?/i);
                    let commentOwner = parts[1]?.replace(/\(.*?\)/, '').trim();
                    if (!commentOwner) commentOwner = presidentName;
                    if (commentOwner) {
                        participations.push({ partTitle: 'Comentários Finais', publisherName: commentOwner, order: runningOrder++ });
                    }
                    continue;
                }

                // 2. Partes Numeradas e com Tempo (Ancoragem por Duração)
                // Procura por padrão: "1. Título (10 min)" ou variações
                const partMatch = text.match(/^.*?(\d+)\.\s+(.*?)\((\d+)\s*min.*?\)/i);
                
                if (partMatch) {
                    const rawTitle = partMatch[2].trim();
                    const partTitle = rawTitle; 
                    const partNumber = parseInt(partMatch[1], 10);
                    const needsHelper = partNeedsHelper(partTitle) || mapPartNumberToType(partNumber) === 'MINISTERIO';
                    
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

                    names = names.map(n => n.trim()).filter(Boolean);
                    if (names.length > 0) {
                        participations.push({ partTitle, publisherName: names[0], order: runningOrder++, partNumber });
                        if (needsHelper) {
                            if (names[1]) {
                                participations.push({ partTitle: 'Ajudante', publisherName: names[1], order: runningOrder++ });
                            } else {
                                pendingHelperParts.push({ partTitle, partNumber });
                            }
                        }
                    } else {
                        pendingStudentParts.push({ partTitle, partNumber });
                        if (needsHelper) pendingHelperParts.push({ partTitle, partNumber });
                    }
                    continue;
                }

                // 3. Estudo Bíblico de Congregação
                if (upperText.includes('DIRIGENTE:') || upperText.includes('LEITOR:')) {
                    const dirMatch = text.match(/Dirigente:\s*([^Leitor]+)/i);
                    if (dirMatch) {
                        participations.push({ partTitle: 'Estudo bíblico de congregação', publisherName: dirMatch[1].trim(), order: runningOrder++ });
                    }
                    const leitMatch = text.match(/Leitor:\s*(.+)/i);
                    if (leitMatch) {
                         participations.push({ partTitle: 'Leitor do EBC', publisherName: leitMatch[1].trim(), order: runningOrder++ });
                    }
                    continue;
                }

                if (upperText.startsWith('DIRIGENTE')) {
                    const roleName = findNextNameLine(block, l, ['LEITOR', 'ORAÇÃO', 'ORACAO', 'CÂNTICO', 'CANTICO']);
                    if (roleName) {
                        participations.push({ partTitle: 'Estudo bíblico de congregação', publisherName: roleName.name, order: runningOrder++ });
                        l = roleName.index;
                    } else {
                        const ref = { value: runningOrder };
                        detectDirigenteOrLeitorFromColumns(block, l, 'DIRIGENTE', ref, participations, pendingStudentParts);
                        runningOrder = ref.value;
                    }
                    continue;
                }

                if (upperText.startsWith('LEITOR')) {
                    const roleName = findNextNameLine(block, l, ['DIRIGENTE', 'ORAÇÃO', 'ORACAO', 'CÂNTICO', 'CANTICO']);
                    if (roleName) {
                        participations.push({ partTitle: 'Leitor do EBC', publisherName: roleName.name, order: runningOrder++ });
                        l = roleName.index;
                    } else {
                        const ref = { value: runningOrder };
                        detectDirigenteOrLeitorFromColumns(block, l, 'LEITOR', ref, participations, pendingStudentParts);
                        runningOrder = ref.value;
                    }
                    continue;
                }

                if (isStudentHeaderLine(text.trim())) {
                    const inlineName = stripColumnLabel(text);
                    const names: string[] = [];
                    if (inlineName && inlineName.toUpperCase() !== text.trim().toUpperCase()) names.push(inlineName);
                    const collected = collectNamesAfterLine(block, l, ['AJUDANTE', 'AJUDANTES', 'DIRIGENTE', 'LEITOR']);
                    names.push(...collected.names);
                    assignPendingNames(names, pendingStudentParts, participations, () => runningOrder++, false);
                    l = collected.nextIndex;
                    continue;
                }

                if (isHelperHeaderLine(text.trim())) {
                    const inlineName = stripColumnLabel(text);
                    const names: string[] = [];
                    if (inlineName && inlineName.toUpperCase() !== text.trim().toUpperCase()) names.push(inlineName);
                    const collected = collectNamesAfterLine(block, l, ['ESTUDANTE', 'ESTUDANTES', 'DIRIGENTE', 'LEITOR']);
                    names.push(...collected.names);
                    assignPendingNames(names, pendingHelperParts, participations, () => runningOrder++, true);
                    l = collected.nextIndex;
                    continue;
                }

                if (isLocationHeaderLine(text.trim()) && pendingStudentParts.length > 0) {
                    const collected = collectNamesAfterLine(block, l, ['ESTUDANTE', 'ESTUDANTES', 'AJUDANTE', 'AJUDANTES']);
                    assignPendingNames(collected.names, pendingStudentParts, participations, () => runningOrder++, false);
                    l = collected.nextIndex;
                    continue;
                }

                if (pendingStudentParts.length > 0 && isStandaloneName(text)) {
                    assignPendingNames([text], pendingStudentParts, participations, () => runningOrder++, false);
                    continue;
                }
            }
            
            if (participations.length > 0) {
                participations.sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
                allWeeksData.push({ week: normalizedWeek, participations });
            }
        }
    }

    return allWeeksData;
};