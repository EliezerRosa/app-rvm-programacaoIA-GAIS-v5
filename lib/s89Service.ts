
import { Publisher, Participation } from '../types';
import { RenderablePart } from './scheduleUtils';
import { db } from './db';

// Chave para a tabela settings
export const N8N_WEBHOOK_KEY = 'n8n_webhook_url';

export interface S89Payload {
    type: 'S-89';
    week: string;
    student: {
        name: string;
        phone: string;
    };
    assistant?: {
        name: string;
    };
    part: {
        title: string;
        date: string; // YYYY-MM-DD
        isMainHall: boolean; // Por padrão true
    };
}

// Função assíncrona para pegar a URL do banco
export const getStoredWebhookUrl = async (): Promise<string> => {
    const setting = await db.settings.get(N8N_WEBHOOK_KEY);
    return setting ? setting.value : '';
};

// Função assíncrona para salvar a URL no banco
export const saveWebhookUrl = async (url: string) => {
    await db.settings.put({ key: N8N_WEBHOOK_KEY, value: url.trim() });
};

export const prepareS89Payload = (
    part: RenderablePart, 
    publishers: Publisher[]
): S89Payload | null => {
    const studentPublisher = publishers.find(p => p.name === part.publisherName);
    
    if (!studentPublisher) {
        console.error("Publicador não encontrado para S-89:", part.publisherName);
        return null;
    }

    const payload: S89Payload = {
        type: 'S-89',
        week: part.week,
        student: {
            name: studentPublisher.name,
            phone: studentPublisher.phone || '',
        },
        part: {
            title: part.partTitle,
            date: part.date.split('T')[0],
            isMainHall: true,
        }
    };

    if (part.pair) {
        payload.assistant = {
            name: part.pair.publisherName
        };
    }

    return payload;
};

export const sendS89ToN8N = async (payload: S89Payload): Promise<boolean> => {
    const url = await getStoredWebhookUrl();
    
    if (!url) {
        throw new Error("URL do Webhook n8n não configurada. Vá em Configurações.");
    }

    try {
        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(payload),
        });

        if (!response.ok) {
            throw new Error(`Erro na resposta do servidor: ${response.statusText}`);
        }
        
        return true;
    } catch (error) {
        console.error("Falha ao enviar para n8n:", error);
        throw error;
    }
};