
import { ParticipationType, Publisher, ValidationResponse } from '../types';

// A simple UUID v4 generator. In a production app, a more robust library like `uuid` might be preferable.
export function generateUUID(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

const monthMap: { [key: string]: number } = {
    'JAN': 0, 'JANEIRO': 0,
    'FEV': 1, 'FEVEREIRO': 1,
    'MAR': 2, 'MARÇO': 2, 'MARCO': 2,
    'ABR': 3, 'ABRIL': 3,
    'MAI': 4, 'MAIO': 4,
    'JUN': 5, 'JUNHO': 5,
    'JUL': 6, 'JULHO': 6,
    'AGO': 7, 'AGOSTO': 7,
    'SET': 8, 'SETEMBRO': 8,
    'OUT': 9, 'OUTUBRO': 9,
    'NOV': 10, 'NOVEMBRO': 10,
    'DEZ': 11, 'DEZEMBRO': 11
};

const monthAbbrUpper: string[] = ['JAN', 'FEV', 'MAR', 'ABR', 'MAI', 'JUN', 'JUL', 'AGO', 'SET', 'OUT', 'NOV', 'DEZ'];

const monthFullToUpperAbbr: { [key: string]: string } = {
    'JANEIRO': 'JAN', 'FEVEREIRO': 'FEV', 'MARÇO': 'MAR', 'ABRIL': 'ABR', 'MAIO': 'MAI', 'JUNHO': 'JUN',
    'JULHO': 'JUL', 'AGOSTO': 'AGO', 'SETEMBRO': 'SET', 'OUTUBRO': 'OUT', 'NOVEMBRO': 'NOV', 'DEZEMBRO': 'DEZ'
};

/**
 * Padroniza uma string de semana (ex: "SEMANA DE 4-10 DE NOVEMBRO") para o formato do app ("4-10 de NOV, 2024").
 * @param rawWeek String extraída do PDF
 * @param yearContext Ano detectado do arquivo
 */
export function standardizeWeekDate(rawWeek: string, yearContext: number): string {
    if (!rawWeek) return `Semana Indefinida, ${yearContext}`;

    // Remove "SEMANA DE " e espaços extras, normaliza maiúsculas
    let cleaned = rawWeek.toUpperCase().replace(/^SEMANA\s+(DE\s+)?/i, '').trim();
    
    // Se já estiver no formato "dd-dd de MMM, YYYY" (já processado), retorna
    if (cleaned.match(/\d{4}/) && cleaned.includes(',')) return cleaned;

    // Substitui travessão por hífen
    cleaned = cleaned.replace(/–/g, '-');

    // Regex para "30 DE DEZEMBRO - 5 DE JANEIRO" (Virada de ano/mês)
    // Captura: Dia1, Mês1, Dia2, Mês2
    const splitMonthMatch = cleaned.match(/(\d+)\s+DE\s+([A-ZÇ]+)\s*-\s*(\d+)\s+DE\s+([A-ZÇ]+)/i);
    
    if (splitMonthMatch) {
        const [, day1, month1Full, day2, month2Full] = splitMonthMatch;
        const m1 = monthFullToUpperAbbr[month1Full.toUpperCase()] || month1Full.toUpperCase().substring(0, 3);
        const m2 = monthFullToUpperAbbr[month2Full.toUpperCase()] || month2Full.toUpperCase().substring(0, 3);
        
        // Se virou o ano (Dezembro para Janeiro)
        if (m1 === 'DEZ' && m2 === 'JAN') {
            return `${day1} de ${m1}, ${yearContext} - ${day2} de ${m2}, ${yearContext + 1}`;
        }
        return `${day1} de ${m1} - ${day2} de ${m2}, ${yearContext}`;
    }

    // Regex para "4-10 DE NOVEMBRO" ou "4-10 DE NOV" (Mesmo mês)
    // Aceita formatos: "4-10 DE NOVEMBRO", "4-10 NOVEMBRO", "4 A 10 DE NOVEMBRO"
    const singleMonthMatch = cleaned.match(/(\d+)\s*(?:-|A)\s*(\d+)\s+(?:DE\s+)?([A-ZÇ]+)/i);
    
    if (singleMonthMatch) {
        const [, day1, day2, monthFull] = singleMonthMatch;
        const m = monthFullToUpperAbbr[monthFull.toUpperCase()] || monthFull.toUpperCase().substring(0, 3);
        return `${day1}-${day2} de ${m}, ${yearContext}`;
    }

    // Fallback: se não conseguiu parsear mas parece uma data, apenas anexa o ano se não tiver
    if (!cleaned.includes(yearContext.toString())) {
        return `${cleaned}, ${yearContext}`;
    }

    return cleaned;
}

// Function to correctly parse Portuguese week strings into Date objects for sorting
export const parseWeekDate = (weekString: string): Date => {
    if (!weekString) return new Date(0);

    // Limpeza agressiva: remove vírgulas, traços extras se não forem separadores de dia
    const cleaned = weekString.replace(/,/g, ' ').toUpperCase();
    const parts = cleaned.split(/[\s-]+/); // Split by space or hyphen

    // Tenta encontrar o dia
    let day = 0;
    for (const part of parts) {
        const d = parseInt(part, 10);
        if (!isNaN(d) && d > 0 && d <= 31) {
            day = d;
            break;
        }
    }
    if (day === 0) return new Date(0);

    let month: number | undefined;
    let year: number | undefined;
    
    // Encontra o primeiro mês válido no mapa
    const firstMonthIndex = parts.findIndex(p => monthMap[p] !== undefined);
    
    if (firstMonthIndex === -1) return new Date(0); // No month found
    
    month = monthMap[parts[firstMonthIndex]];
    
    // Procura o ano (4 dígitos)
    for (const part of parts) {
        const y = parseInt(part, 10);
        if (!isNaN(y) && y > 2000 && y < 2100) {
            year = y;
            break;
        }
    }
    
    // Se não achou ano, tenta pegar o último token se for número
    if (year === undefined) {
       const lastToken = parseInt(parts[parts.length-1], 10);
       if (!isNaN(lastToken) && lastToken > 2000) year = lastToken;
    }

    if (month !== undefined && year !== undefined) {
        // Use UTC to prevent timezone-related date shifts
        return new Date(Date.UTC(year, month, day));
    }

    return new Date(0); // Fallback
};

/**
 * Calculates the specific meeting date (Wednesday or Thursday) based on the week string.
 * @param weekString The string representing the meeting week.
 * @returns An ISO date string for the calculated meeting day.
 */
export const calculatePartDate = (weekString: string): string => {
    try {
        const startDate = parseWeekDate(weekString);

        // Se a data base for inválida (epoch 0), retorna fallback seguro
        if (startDate.getTime() === 0 || isNaN(startDate.getTime())) { 
            return new Date(0).toISOString();
        }
        
        const year = startDate.getUTCFullYear();
        
        // The meeting is during the week that starts on Monday.
        // Wednesday is 3, Thursday is 4 (Sunday=0, Monday=1, ...)
        const targetDayOfWeek = year % 2 !== 0 ? 3 : 4; // Odd year -> Wednesday, Even year -> Thursday

        // Assuming the week always starts on Monday (day 1), we find the difference.
        const dayDifference = targetDayOfWeek - 1; 

        const meetingDate = new Date(startDate.getTime()); // Create a copy to avoid mutation
        meetingDate.setUTCDate(startDate.getUTCDate() + dayDifference);

        // CRÍTICO: Validação final antes do toISOString para evitar RangeError
        if (isNaN(meetingDate.getTime())) {
            return new Date(0).toISOString();
        }

        return meetingDate.toISOString();
    } catch (e) {
        console.error(`Erro ao calcular data para semana: ${weekString}`, e);
        return new Date(0).toISOString(); // Fallback seguro, nunca lança erro
    }
};


/**
 * Opens a new browser tab and writes the provided HTML content to it.
 * @param htmlContent The full HTML string to be displayed.
 */
export const openHtmlInNewTab = (htmlContent: string): void => {
    const newWindow = window.open("", "_blank");
    if (newWindow) {
        newWindow.document.write(htmlContent);
        newWindow.document.close();
    } else {
        alert("Não foi possível abrir a nova aba. Por favor, verifique se o seu navegador está bloqueando pop-ups.");
    }
};

// NOVO: Define os tipos de parte que exigem um par (estudante/ajudante).
export const PAIRABLE_PART_TYPES = [
    ParticipationType.MINISTERIO,
];

// NOVO: Valida as regras de segurança para pareamento, especialmente para crianças.
export const validatePairing = (student: Publisher, helper: Publisher): ValidationResponse => {
    if (student.ageGroup === 'Criança') {
        const isParent = student.parentIds.includes(helper.id);
        const isAdult = helper.ageGroup === 'Adulto';

        if (isParent) {
            return { isValid: true, reason: '' }; // Pareamento com pai/mãe é sempre válido.
        }

        if (student.canPairWithNonParent && isAdult) {
            return { isValid: true, reason: '' }; // Pareamento com adulto autorizado é válido.
        }

        if (!student.canPairWithNonParent) {
            return { isValid: false, reason: `Crianças só podem ter um dos pais como ajudante. Autorização para terceiros não concedida.` };
        }

        if (!isAdult) {
            return { isValid: false, reason: `O ajudante de uma criança deve ser um adulto.` };
        }
    }
    return { isValid: true, reason: '' }; // Para adultos e jovens, qualquer pareamento é válido.
};

function getFirstMonday(date: Date) {
    const day = date.getUTCDay();
    const diff = date.getUTCDate() - day + (day === 0 ? -6 : 1); // adjust when day is sunday
    return new Date(date.setUTCDate(diff));
}

function formatDateRange(startDate: Date): string {
    const endDate = new Date(startDate);
    endDate.setUTCDate(startDate.getUTCDate() + 6);

    const startDay = startDate.getUTCDate();
    const endDay = endDate.getUTCDate();
    const startMonth = monthAbbrUpper[startDate.getUTCMonth()];
    const endMonth = monthAbbrUpper[endDate.getUTCMonth()];
    const startYear = startDate.getUTCFullYear();
    const endYear = endDate.getUTCFullYear();

    if (startMonth === endMonth) {
        return `${startDay}-${endDay} de ${startMonth}, ${startYear}`;
    } else if (startYear === endYear) {
        return `${startDay} de ${startMonth} - ${endDay} de ${endMonth}, ${startYear}`;
    } else {
        return `${startDay} de ${startMonth}, ${startYear} - ${endDay} de ${endMonth}, ${endYear}`;
    }
}

export function generateWeeksForWorkbook(workbookName: string): string[] {
    const nameMatch = workbookName.match(/(\w+)\/(\w+)\s+(\d{4})/i);
    if (!nameMatch) return [];

    const [, startMonthStr, endMonthStr, yearStr] = nameMatch;
    const year = parseInt(yearStr, 10);
    const startMonthIndex = monthMap[startMonthStr.toUpperCase()];
    const endMonthIndex = monthMap[endMonthStr.toUpperCase()];

    if (startMonthIndex === undefined || endMonthIndex === undefined) return [];

    const startDate = new Date(Date.UTC(year, startMonthIndex, 1));
    const endDate = new Date(Date.UTC(year, endMonthIndex + 1, 0)); // Last day of end month

    const weeks: string[] = [];
    let currentMonday = getFirstMonday(startDate);

    while (currentMonday <= endDate) {
        weeks.push(formatDateRange(currentMonday));
        currentMonday.setUTCDate(currentMonday.getUTCDate() + 7);
    }

    return weeks;
}

export function inferParticipationType(partTitle: string): ParticipationType {
    const title = partTitle.toLowerCase();

    if (title.includes('presidente')) return ParticipationType.PRESIDENTE;
    if (title.includes('oração inicial')) return ParticipationType.ORACAO_INICIAL;
    if (title.includes('oração final')) return ParticipationType.ORACAO_FINAL;
    if (title.includes('cântico')) return ParticipationType.CANTICO;
    if (title.includes('comentários finais')) return ParticipationType.COMENTARIOS_FINAIS;
    if (title.includes('ajudante')) return ParticipationType.AJUDANTE;

    // Tesouros
    if (title.includes('leitura da bíblia') || title.includes('joias espirituais')) {
        return ParticipationType.TESOUROS;
    }
    
    // Ministério
    if (title.includes('iniciando conversas') || title.includes('cultivando o interesse') || title.includes('fazendo discípulos') || title.includes('explicando suas crenças') || title.includes('discurso')) {
        return ParticipationType.MINISTERIO;
    }

    // Vida Cristã
    if (title.includes('estudo bíblico de congregação')) {
        return ParticipationType.DIRIGENTE;
    }
    
    // Fallback based on keywords
    const treasuresKeywords = ['tesouros', 'pacto', 'salvador', 'agradeçam', 'rei jesus', 'retribuir', 'caminho', 'perseverar', 'sofrimento'];
    if (treasuresKeywords.some(kw => title.includes(kw))) {
        return ParticipationType.TESOUROS;
    }

    const lifeKeywords = ['amor', 'dinheiro', 'promessas', 'necessidades locais', 'organização', 'sofrer'];
    if (lifeKeywords.some(kw => title.includes(kw))) {
        return ParticipationType.VIDA_CRISTA;
    }
    
    // Default fallback
    return ParticipationType.VIDA_CRISTA;
}

export function normalizeName(name: string): string {
    if (!name) return '';
    return name
        .toLowerCase()
        .normalize("NFD") // Decompose accented characters into base characters and diacritics
        .replace(/[\u0300-\u036f]/g, ""); // Remove the diacritical marks
}
