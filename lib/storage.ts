import { db } from './db';
import { Publisher, Participation, Workbook, Rule, SpecialEvent, EventTemplate } from '../types';
import { initialPublishers } from './initialData';
import { initialParticipations } from './initialParticipations';
import { initialWorkbooks } from './initialWorkbooks';
import { initialRules } from './initialRules';
import { initialSpecialEvents } from './initialSpecialEvents';
import { initialEventTemplates } from './initialEventTemplates';
import { calculatePartDate, standardizeWeekDate } from './utils';
import { restoreMissingHistory } from './historyBackup';

// Função para reparar dados inconsistentes sem bloquear a abertura do banco
const repairDatabaseIntegrity = async () => {
    try {
        // Repara datas de participações
        const participations = await db.participations.toArray();
        const updates: Promise<any>[] = [];

        for (const p of participations) {
            let needsUpdate = false;
            let newDate = p.date;
            let newWeek = p.week;

            // Lógica inteligente para detectar o ano existente antes de forçar um padrão
            const existingYearMatch = p.week.match(/(20\d{2})/);
            const existingYear = existingYearMatch ? parseInt(existingYearMatch[1], 10) : 2024;

            // 1. Verifica se a semana precisa de padronização
            // Se não tem 4 dígitos OU tem "SEMANA DE" (formato antigo/sujo)
            if (!p.week.match(/\d{4}/) || p.week.toUpperCase().includes('SEMANA DE')) {
                // Passa o ano detectado (ex: 2025) em vez de forçar 2024
                newWeek = standardizeWeekDate(p.week, existingYear); 
                if (newWeek !== p.week) needsUpdate = true;
            }

            // 2. Verifica se a data ISO é válida ou se é 1970 (erro de cálculo anterior)
            const dateObj = new Date(p.date);
            if (!p.date || isNaN(dateObj.getTime()) || dateObj.getFullYear() <= 1970) {
                newDate = calculatePartDate(newWeek);
                // Só marca update se gerou uma data válida diferente da atual
                if (newDate !== p.date && newDate !== new Date(0).toISOString()) {
                     needsUpdate = true;
                }
            }

            if (needsUpdate) {
                updates.push(db.participations.update(p.id, { week: newWeek, date: newDate }));
            }
        }

        if (updates.length > 0) {
            await Promise.all(updates);
            console.log(`Integridade do banco verificada: ${updates.length} registros corrigidos em background.`);
        }
    } catch (e) {
        console.error("Erro não-fatal durante verificação de integridade:", e);
    }
};

// --- Seeding Function ---
export const initStorage = async () => {
    try {
        // 1. SOLICITA PERSISTÊNCIA IMEDIATA
        if (navigator.storage && navigator.storage.persist) {
            const isPersisted = await navigator.storage.persist();
            console.log(`Modo de Armazenamento Persistente: ${isPersisted ? 'ATIVO' : 'NEGADO pelo navegador'}`);
        }

        // 2. ABRE O BANCO
        if (!(db as any).isOpen()) {
            await (db as any).open();
        }

        // 3. VERIFICAÇÃO DE SEGURANÇA: Se temos backup, assumimos que o banco NÃO é novo.
        const backupCount = await db.historyBackup.count();
        
        // Se houver backups, tentamos restaurar o que falta na tabela principal
        if (backupCount > 0) {
            console.log("Backups encontrados. Verificando integridade do histórico...");
            await restoreMissingHistory();
        }

        // 4. Popula dados iniciais APENAS se as tabelas estiverem vazias E não houver backup
        
        const publisherCount = await db.publishers.count();
        if (publisherCount === 0) {
            console.log("Populando tabela de publicadores...");
            await db.publishers.bulkAdd(initialPublishers);
        }

        const participationCount = await db.participations.count();
        // Só insere participações de exemplo se não tiver backup e a tabela estiver vazia
        if (participationCount === 0 && backupCount === 0) {
            console.log("Populando tabela de participações (Dados de Exemplo)...");
            await db.participations.bulkAdd(initialParticipations);
        }

        const workbookCount = await db.workbooks.count();
        if (workbookCount === 0) {
            console.log("Populando tabela de apostilas...");
            await db.workbooks.bulkAdd(initialWorkbooks);
        }

        const ruleCount = await db.rules.count();
        if (ruleCount === 0) {
            console.log("Populando tabela de regras...");
            await db.rules.bulkAdd(initialRules);
        }
        
        const specialEventCount = await db.specialEvents.count();
        if (specialEventCount === 0) {
             console.log("Populando tabela de eventos especiais...");
             await db.specialEvents.bulkAdd(initialSpecialEvents);
        }

        const templateCount = await db.eventTemplates.count();
        if (templateCount === 0) {
            console.log("Populando tabela de modelos de evento...");
            await db.eventTemplates.bulkAdd(initialEventTemplates);
        }

        // Executa reparos de dados em background DEPOIS de restaurar backups
        setTimeout(() => repairDatabaseIntegrity(), 1000);
        
        console.log("Armazenamento inicializado com sucesso.");
        
    } catch (e) {
        console.error("Falha crítica ao inicializar o armazenamento:", e);
    }
};


// --- Getter Functions ---
export const getAllPublishers = () => db.publishers.toArray();
export const getAllParticipations = () => db.participations.toArray();
export const getAllWorkbooks = () => db.workbooks.toArray();
export const getAllRules = () => db.rules.toArray();
export const getAllSpecialEvents = () => db.specialEvents.toArray();
export const getAllEventTemplates = () => db.eventTemplates.toArray();

export const getAllData = async () => {
    if (!(db as any).isOpen()) await (db as any).open();

    const [publishers, participations, workbooks, rules, specialEvents, eventTemplates] = await Promise.all([
        getAllPublishers(),
        getAllParticipations(),
        getAllWorkbooks(),
        getAllRules(),
        getAllSpecialEvents(),
        getAllEventTemplates(),
    ]);
    return { publishers, participations, workbooks, rules, specialEvents, eventTemplates };
}

// --- Publisher Functions ---
export const savePublisher = (publisher: Publisher) => db.publishers.put(publisher);
export const deletePublisher = (id: string) => db.publishers.delete(id);

// --- Participation Functions ---
export const saveParticipation = (participation: Participation) => db.participations.put(participation);
export const deleteParticipation = (id: string) => db.participations.delete(id);
export const deleteParticipationsByWeek = async (week: string) => {
    await Promise.all([
        db.participations.where('week').equals(week).delete(),
        db.historyBackup.where('week').equals(week).delete(),
    ]);
};


// --- Workbook Functions ---
export const saveWorkbook = (workbook: Workbook) => db.workbooks.put(workbook);
export const deleteWorkbook = (id: string) => db.workbooks.delete(id);

// --- Rule Functions ---
export const saveRule = (rule: Rule) => db.rules.put(rule);
export const deleteRule = (id: string) => db.rules.delete(id);

// --- Special Event Functions ---
export const saveSpecialEvent = (event: SpecialEvent) => db.specialEvents.put(event);
export const deleteSpecialEvent = (id: string) => db.specialEvents.delete(id);

// --- Event Template Functions ---
export const saveEventTemplate = (template: EventTemplate) => db.eventTemplates.put(template);
export const deleteEventTemplate = (id: string) => db.eventTemplates.delete(id);

// --- Data Management Functions ---
export const clearAllData = async () => {
    await Promise.all([
        db.publishers.clear(),
        db.participations.clear(),
        db.workbooks.clear(),
        db.rules.clear(),
        db.specialEvents.clear(),
        db.eventTemplates.clear(),
        db.settings.clear(),
        db.historyBackup.clear(),
    ]);
};