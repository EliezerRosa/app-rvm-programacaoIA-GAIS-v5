import { GoogleGenAI, Type } from "@google/genai";
import { Publisher, Participation, Rule, Workbook, ParticipationType, AiScheduleResult, SpecialEvent, EventTemplate } from '../types';
import { validateAssignment } from './inferenceEngine';
import { parseScheduleFromPdf } from './pdfParser';
import { calculatePartDate, PAIRABLE_PART_TYPES, validatePairing } from './utils';

let ai: GoogleGenAI | null = null;
const isPublisherActive = (publisher: Publisher) => publisher.isServing ?? true;

function getAiInstance(): GoogleGenAI {
    if (!ai) {
        if (!process.env.API_KEY) throw new Error("A chave da API do Google GenAI não está configurada.");
        ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    }
    return ai;
}

const getPartsFromWorkbook = async (
    workbook: Workbook,
    specialEvents: SpecialEvent[],
    eventTemplates: EventTemplate[],
    week: string
): Promise<{ partTitle: string; type: ParticipationType; duration?: number; assignedTo?: string }[]> => {
    let baseParts: { partTitle: string; type: ParticipationType; duration?: number }[];
    try {
        baseParts = await parseScheduleFromPdf(workbook.fileData);
    } catch (error) {
        console.error(`Falha ao analisar o PDF "${workbook.name}". Usando dados simulados.`, error);
        baseParts = [ /* ... fallback data ... */ ];
    }
    
    const event = specialEvents.find(e => e.week === week);
    const template = event ? eventTemplates.find(t => t.id === event.templateId) : null;

    if (event && template) {
        const { impact } = template;
        let finalParts: { partTitle: string; type: ParticipationType; duration?: number; assignedTo?: string }[] = [...baseParts];

        if (impact.action === 'REPLACE_PART' || impact.action === 'REPLACE_SECTION') {
            const targetTypes = new Set(Array.isArray(impact.targetType) ? impact.targetType : [impact.targetType]);
            finalParts = baseParts.filter(p => !targetTypes.has(p.type));
        }

        finalParts.push({ partTitle: event.theme, type: ParticipationType.VIDA_CRISTA, duration: event.duration, assignedTo: event.assignedTo });
        return finalParts;
    }
    return baseParts;
};

const responseSchema = {
    type: Type.ARRAY,
    items: {
        type: Type.OBJECT,
        properties: {
            partTitle: {
                type: Type.STRING,
                description: "O título exato da parte a ser designada, conforme fornecido no prompt."
            },
            studentName: {
                type: Type.STRING,
                description: "O nome completo do publicador designado para a parte (ou como estudante se for uma parte com par)."
            },
            helperName: {
                type: Type.STRING,
                description: "O nome completo do ajudante, se a parte exigir um par. Caso contrário, use 'N/A'."
            }
        },
        required: ["partTitle", "studentName", "helperName"]
    }
};

export async function generateAiSchedule(
    workbook: Workbook,
    week: string,
    publishers: Publisher[],
    history: Participation[],
    rules: Rule[],
    specialEvents: SpecialEvent[],
    eventTemplates: EventTemplate[]
): Promise<AiScheduleResult[]> {
    try {
        const ai = getAiInstance();
        const partsToFill = await getPartsFromWorkbook(workbook, specialEvents, eventTemplates, week);
        const meetingDate = calculatePartDate(week).split('T')[0];

        const availablePublishers = publishers.filter(p => {
            if (!isPublisherActive(p)) return false;
            if (p.availability.mode === 'always') return !p.availability.exceptionDates.includes(meetingDate);
            return p.availability.exceptionDates.includes(meetingDate);
        });

        const publishersWithHistory = availablePublishers.map(p => {
            const lastAssignment = history.filter(h => h.publisherName === p.name).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())[0];
            return { ...p, lastAssignmentDate: lastAssignment ? lastAssignment.week : 'nunca' };
        });

        const activeRulesText = rules.filter(r => r.isActive).map(r => `- ${r.description}`).join('\n');

        const prompt = `
            Você é um assistente especialista em criar pautas de reuniões. Sua tarefa é preencher a pauta para a semana de "${week}", que ocorrerá em ${meetingDate}.
            
            **1. Designações a Serem Preenchidas:**
            ${partsToFill.map(p => {
                const isPair = PAIRABLE_PART_TYPES.includes(p.type) && !p.partTitle.toLowerCase().includes('discurso');
                const rule = p.assignedTo ? `(Regra Especial: Designar ${p.assignedTo})` : '';
                return `- Título: "${p.partTitle}", Tipo: ${p.type} ${isPair ? '(Requer Par)' : ''} ${rule}`;
            }).join('\n')}

            **2. Publicadores Disponíveis:**
            ${publishersWithHistory.map(p => `- Nome: ${p.name}, ID: ${p.id}, Condição: ${p.condition}, Gênero: ${p.gender}, Faixa Etária: ${p.ageGroup}, ...`).join('\n')}

            **3. Instruções Críticas:**
            - **Rodízio:** Dê preferência a quem está há mais tempo sem designação.
            - **Regras Adicionais:** ${activeRulesText}
            - ... (outras instruções)

            **4. Formato da Resposta:** JSON array com partTitle, studentName, helperName.
        `;
        
        const response = await ai.models.generateContent({ model: 'gemini-2.5-flash', contents: prompt, config: { responseMimeType: "application/json", responseSchema } });
        const suggestedAssignments: { partTitle: string; studentName: string; helperName: string; }[] = JSON.parse(response.text.trim());

        const validatedAssignments: AiScheduleResult[] = [];
        for (const assignment of suggestedAssignments) {
            // ... (Lógica de validação robusta)
            const student = publishers.find(p => p.name === assignment.studentName);
            const part = partsToFill.find(p => p.partTitle === assignment.partTitle);
            if (!student || !part) continue;

            const studentValidation = validateAssignment({ publisher: student, partType: part.type, partTitle: part.partTitle, meetingDate }, rules);
            if (!studentValidation.isValid) continue;
            
            const reason = `Última parte em ${publishersWithHistory.find(p => p.name === student.name)?.lastAssignmentDate || 'nunca'}.`;
            validatedAssignments.push({ ...assignment, helperName: (assignment.helperName && assignment.helperName !== 'N/A') ? assignment.helperName : null, reason });
        }
        return validatedAssignments;
    } catch (error) {
        console.error("Erro ao gerar pauta com IA:", error);
        throw new Error("Não foi possível gerar a pauta.");
    }
}