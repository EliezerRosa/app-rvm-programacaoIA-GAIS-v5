
import { db } from './db';
import { Participation, HistoryBackupItem } from '../types';
import { generateUUID } from './utils';

/**
 * Salva um lote de participações importadas na tabela de backup segura.
 * Deve ser chamado logo após uma importação de PDF bem-sucedida.
 */
export const saveHistoryBackup = async (participations: Participation[]) => {
    try {
        // Agrupa por semana
        const weeksMap = new Map<string, Participation[]>();
        participations.forEach(p => {
            if (!weeksMap.has(p.week)) weeksMap.set(p.week, []);
            weeksMap.get(p.week)!.push(p);
        });

        const backupItems: HistoryBackupItem[] = [];

        for (const [week, parts] of weeksMap.entries()) {
            // Verifica se já existe backup para esta semana para evitar duplicação no backup
            const existingBackup = await db.historyBackup.where('week').equals(week).first();
            
            // Busca o estado atual do banco para essa semana para ter certeza que estamos salvando a versão mais recente
            const currentDbParts = await db.participations.where('week').equals(week).toArray();
            const partsToBackup = currentDbParts.length > 0 ? currentDbParts : parts;

            if (existingBackup) {
                // Atualiza o backup existente
                await db.historyBackup.put({
                    ...existingBackup,
                    participations: partsToBackup,
                    importedAt: new Date().toISOString()
                });
            } else {
                // Cria novo backup
                backupItems.push({
                    id: generateUUID(),
                    week,
                    participations: partsToBackup,
                    importedAt: new Date().toISOString()
                });
            }
        }

        if (backupItems.length > 0) {
            await db.historyBackup.bulkAdd(backupItems);
            console.log(`Backup de histórico salvo/atualizado para ${backupItems.length} semanas.`);
        }
    } catch (e) {
        console.error("Falha ao salvar backup de histórico:", e);
    }
};

/**
 * Restaura dados de um backup específico para a tabela principal.
 */
export const forceRestoreBackup = async (backupId: string) => {
    const backup = await db.historyBackup.get(backupId);
    if (!backup) throw new Error("Backup não encontrado.");

    // Remove dados existentes dessa semana na tabela principal para evitar duplicidade
    await db.participations.where('week').equals(backup.week).delete();
    
    // Reinsere os dados do backup
    await db.participations.bulkAdd(backup.participations);
    console.log(`Backup da semana ${backup.week} restaurado manualmente.`);
};

/**
 * Exclui um item de backup.
 */
export const deleteBackup = async (backupId: string) => {
    await db.historyBackup.delete(backupId);
};

/**
 * Retorna todos os backups ordenados por semana.
 */
export const getAllBackups = async () => {
    return await db.historyBackup.toArray();
};

/**
 * Verifica se existem pautas na tabela de backup que NÃO estão na tabela principal
 * e as restaura automaticamente. Rodar na inicialização.
 */
export const restoreMissingHistory = async () => {
    try {
        const backups = await db.historyBackup.toArray();
        if (backups.length === 0) return;

        // Normaliza as chaves para comparação (ignora maiusculas/minusculas)
        const existingWeeks = new Set(
            (await db.participations.orderBy('week').uniqueKeys())
            .map(w => String(w).trim().toUpperCase())
        );
        
        const participationsToRestore: Participation[] = [];
        let restoredWeeksCount = 0;

        for (const backup of backups) {
            const normalizedBackupWeek = backup.week.trim().toUpperCase();
            
            if (!existingWeeks.has(normalizedBackupWeek)) {
                // Se a semana do backup não existe na tabela principal (mesmo ignorando case)
                // Verifica novamente com count() exato para ter certeza absoluta
                const count = await db.participations.where('week').equals(backup.week).count();
                
                if (count === 0) {
                    console.log(`Restaurando semana perdida do backup: ${backup.week}`);
                    participationsToRestore.push(...backup.participations);
                    restoredWeeksCount++;
                }
            }
        }

        if (participationsToRestore.length > 0) {
            await db.participations.bulkPut(participationsToRestore); 
            console.log(`RESTAURAÇÃO AUTOMÁTICA: ${restoredWeeksCount} semanas de histórico recuperadas do backup.`);
        }

    } catch (e) {
        console.error("Erro ao tentar restaurar histórico do backup:", e);
    }
};