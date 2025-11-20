import { ParticipationType } from '../types';

// pdfjsLib será injetado globalmente pela tag de script no index.html
declare const pdfjsLib: any;

type ParsedPart = { partTitle: string; type: ParticipationType; duration?: number };

/**
 * Converte uma string base64 para um Uint8Array.
 * @param b64 A string base64.
 * @returns O Uint8Array correspondente.
 */
function b64toUint8Array(b64: string): Uint8Array {
    const binStr = atob(b64);
    const len = binStr.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
        bytes[i] = binStr.charCodeAt(i);
    }
    return bytes;
}

/**
 * Agrupa itens de texto extraídos do PDF em linhas com base em sua coordenada Y.
 * @param items Array de itens de texto do pdf.js.
 * @returns Um array de strings, onde cada string representa uma linha de texto.
 */
function groupTextItemsIntoLines(items: any[]): string[] {
    if (!items || items.length === 0) return [];
    
    const sortedItems = [...items].sort((a, b) => {
        const y1 = a.transform[5];
        const y2 = b.transform[5];
        if (Math.abs(y1 - y2) > 2) return y2 - y1; // Ordena por Y (decrescente, do topo para baixo)
        
        const x1 = a.transform[4];
        const x2 = b.transform[4];
        return x1 - x2; // Ordena por X para a mesma linha
    });

    const lines: { text: string; y: number }[] = [];
    if (sortedItems.length === 0) return [];

    let currentLine: { items: any[] } = { items: [sortedItems[0]] };
    
    for (let i = 1; i < sortedItems.length; i++) {
        const prevItem = currentLine.items[currentLine.items.length - 1];
        const currentItem = sortedItems[i];
        
        if (Math.abs(prevItem.transform[5] - currentItem.transform[5]) < 5) { // Tolerância de 5px na vertical
            currentLine.items.push(currentItem);
        } else {
            lines.push({ text: currentLine.items.map(it => it.str).join(' '), y: prevItem.transform[5] });
            currentLine = { items: [currentItem] };
        }
    }
    lines.push({ text: currentLine.items.map(it => it.str).join(' '), y: currentLine.items[0].transform[5] });

    return lines.map(line => line.text.trim().replace(/\s+/g, ' '));
}

/**
 * Analisa o conteúdo de um PDF de apostila (em base64) para extrair a pauta da reunião.
 * @param base64Pdf A string base64 do arquivo PDF.
 * @returns Uma promessa que resolve para um array de partes da reunião estruturadas.
 */
export async function parseScheduleFromPdf(base64Pdf: string): Promise<ParsedPart[]> {
    if (typeof pdfjsLib === 'undefined') {
      throw new Error('A biblioteca pdf.js não está carregada.');
    }
    
    const uint8array = b64toUint8Array(base64Pdf);
    const doc = await pdfjsLib.getDocument({ data: uint8array }).promise;
    const page = await doc.getPage(1); // A pauta geralmente está na primeira página
    const textContent = await page.getTextContent();
    
    const lines = groupTextItemsIntoLines(textContent.items);

    const parts: ParsedPart[] = [];
    let currentSection: ParticipationType | null = null;
    
    const sectionHeaders: { [key: string]: ParticipationType } = {
        'TESOUROS DA PALAVRA DE DEUS': ParticipationType.TESOUROS,
        'FAÇA SEU MELHOR NO MINISTÉRIO': ParticipationType.MINISTERIO,
        'NOSSA VIDA CRISTÃ': ParticipationType.VIDA_CRISTA,
    };

    for (const line of lines) {
        const upperLine = line.toUpperCase();
        
        // Ignora as linhas de Presidente e Oração no loop principal; elas serão tratadas posicionalmente.
        if (upperLine.startsWith('ORAÇÃO:') || upperLine.startsWith('PRESIDENTE:')) {
            continue;
        }

        let isHeader = false;
        for (const header in sectionHeaders) {
            if (upperLine.includes(header)) {
                currentSection = sectionHeaders[header];
                isHeader = true;
                break;
            }
        }

        if (isHeader) {
            continue;
        }

        // Captura Cânticos e Comentários Finais
        if (line.match(/•\s*Cântico/i)) {
            parts.push({ partTitle: line.replace('•', '').trim(), type: ParticipationType.CANTICO });
            continue;
        }
        if (line.match(/•\s*Comentários iniciais/i)) {
             // Ignorado por enquanto, pois não é uma parte designável
            continue;
        }
        if (line.match(/•\s*Comentários finais/i)) {
            parts.push({ partTitle: 'Comentários Finais', type: ParticipationType.COMENTARIOS_FINAIS });
            continue;
        }
        
        if (!currentSection) {
            continue;
        }

        const durationMatch = line.match(/\((\d+)\s*min\.?\)/);
        const duration = durationMatch ? parseInt(durationMatch[1], 10) : undefined;
        let partTitle = line.replace(/\((\d+)\s*min\.?\)/, '').trim();
        partTitle = partTitle.replace(/^[\d\s•.-]+/, '').trim();

        if (partTitle) {
            let finalType = currentSection;
            if (partTitle.toLowerCase().includes('estudo bíblico de congregação')) {
                finalType = ParticipationType.DIRIGENTE;
            }

            parts.push({ partTitle, type: finalType, duration });
        }
    }
    
    // Lógica posicional para Presidente e Orações
    const presidentIndex = lines.findIndex(l => l.toUpperCase().startsWith('PRESIDENTE:'));
    
    const prayerIndices = lines
        .map((line, index) => ({ text: line, index }))
        .filter(item => item.text.toUpperCase().startsWith('ORAÇÃO:'));

    if (presidentIndex !== -1) {
        parts.push({ partTitle: 'Presidente', type: ParticipationType.PRESIDENTE });
        
        // A Oração Inicial é a primeira encontrada *após* a linha do Presidente.
        const initialPrayer = prayerIndices.find(p => p.index > presidentIndex);
        if (initialPrayer) {
            parts.push({ partTitle: 'Oração Inicial', type: ParticipationType.ORACAO_INICIAL });
        }
    }
    
    // A Oração Final é a última encontrada no documento.
    if (prayerIndices.length > 0) {
        const finalPrayer = prayerIndices[prayerIndices.length - 1];
        const initialPrayer = presidentIndex !== -1 ? prayerIndices.find(p => p.index > presidentIndex) : undefined;
        
        if (!initialPrayer || finalPrayer.index !== initialPrayer.index) {
             parts.push({ partTitle: 'Oração Final', type: ParticipationType.ORACAO_FINAL });
        }
    }
    
    if (parts.some(p => p.type === ParticipationType.DIRIGENTE)) {
         parts.push({ partTitle: 'Leitor do EBC', type: ParticipationType.LEITOR });
    }

    return parts;
}