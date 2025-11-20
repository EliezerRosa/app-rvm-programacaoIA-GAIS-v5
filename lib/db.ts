import Dexie, { Table } from 'dexie';
import { Publisher, Participation, Workbook, Rule, SpecialEvent, ParticipationType, EventTemplate, HistoryBackupItem } from '../types';

export interface Setting {
  key: string;
  value: any;
}

// Define a classe do banco de dados explicitamente para melhor tipagem e controle
class CongregationDB extends Dexie {
  publishers!: Table<Publisher, string>;
  participations!: Table<Participation, string>;
  workbooks!: Table<Workbook, string>;
  rules!: Table<Rule, string>;
  specialEvents!: Table<SpecialEvent, string>;
  eventTemplates!: Table<EventTemplate, string>;
  settings!: Table<Setting, string>;
  historyBackup!: Table<HistoryBackupItem, string>;

  constructor() {
    super('CongregationDB');

    // VERSÃO 25 (Estabilidade e Correção de Persistência)
    // Mantemos o schema limpo. A lógica de correção de dados fica exclusivamente
    // no storage.ts para evitar problemas de transação durante o boot do DB.
    
    (this as any).version(25).stores({
      publishers: 'id, name',
      participations: 'id, week, publisherName, date',
      workbooks: 'id, name',
      rules: 'id, isActive',
      specialEvents: 'id, week, templateId',
      eventTemplates: 'id, name',
      settings: 'key',
      historyBackup: 'id, week'
    });
  }
}

export const db = new CongregationDB();