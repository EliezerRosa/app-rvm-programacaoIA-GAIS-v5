
import React, { useState, useEffect } from 'react';
import { getStoredWebhookUrl, saveWebhookUrl } from '../lib/s89Service';
import { ArrowDownTrayIcon } from './icons'; // Reusing an existing icon or similar

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenBackupManager: () => void; // NOVO PROP
}

const SettingsModal: React.FC<SettingsModalProps> = ({ isOpen, onClose, onOpenBackupManager }) => {
  const [webhookUrl, setWebhookUrl] = useState('');
  const [isSaved, setIsSaved] = useState(false);

  useEffect(() => {
    if (isOpen) {
      // Carregar URL do banco
      getStoredWebhookUrl().then(url => {
          setWebhookUrl(url);
          setIsSaved(false);
      });
    }
  }, [isOpen]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    await saveWebhookUrl(webhookUrl);
    setIsSaved(true);
    setTimeout(() => {
        setIsSaved(false); // Reset state instead of closing immediately to allow other actions
    }, 1500);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-60 z-50 flex justify-center items-center" onClick={onClose}>
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-md m-4 flex flex-col" onClick={e => e.stopPropagation()}>
        <div className="p-6 pb-4 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100">Configurações</h2>
        </div>
        
        <div className="p-6 space-y-6">
            {/* Seção de Integração */}
            <form onSubmit={handleSave} className="space-y-4">
            <div>
                <label htmlFor="n8n-url" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                URL do Webhook n8n (WhatsApp)
                </label>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 mb-2">
                    Cole aqui a URL do seu workflow n8n que recebe o JSON do formulário S-89.
                </p>
                <input
                type="url"
                id="n8n-url"
                value={webhookUrl}
                onChange={(e) => setWebhookUrl(e.target.value)}
                placeholder="https://seu-n8n.com/webhook/..."
                className="block w-full px-3 py-2 bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm placeholder-gray-500 focus:outline-none focus:ring-indigo-600 focus:border-indigo-600 sm:text-sm text-black dark:text-white"
                />
            </div>
            <div className="flex justify-end">
                <button 
                    type="submit" 
                    className={`px-4 py-2 text-sm font-medium text-white border border-transparent rounded-md shadow-sm focus:outline-none ${isSaved ? 'bg-green-600 hover:bg-green-700' : 'bg-indigo-600 hover:bg-indigo-700'}`}
                >
                {isSaved ? 'Salvo!' : 'Salvar URL'}
                </button>
            </div>
            </form>

            <hr className="border-gray-200 dark:border-gray-700" />

            {/* Seção de Dados */}
            <div>
                <h3 className="text-md font-medium text-gray-900 dark:text-gray-100 mb-2">Gerenciamento de Dados</h3>
                <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">
                    Gerencie as pautas importadas (histórico) para garantir que nenhum dado seja perdido.
                </p>
                <button 
                    onClick={() => {
                        onClose(); // Fecha settings
                        onOpenBackupManager(); // Abre backup manager
                    }}
                    className="w-full flex justify-center items-center px-4 py-2 border border-gray-300 dark:border-gray-600 shadow-sm text-sm font-medium rounded-md text-gray-700 dark:text-gray-200 bg-white dark:bg-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600 focus:outline-none"
                >
                    <ArrowDownTrayIcon className="w-5 h-5 mr-2 text-gray-500" />
                    Gerenciar Backups de Histórico
                </button>
            </div>
        </div>
          
        <div className="p-4 border-t border-gray-200 dark:border-gray-700 flex justify-end">
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-200 bg-gray-100 dark:bg-gray-700 rounded-md hover:bg-gray-200 dark:hover:bg-gray-600 focus:outline-none">
              Fechar
            </button>
        </div>
      </div>
    </div>
  );
};

export default SettingsModal;
