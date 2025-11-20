
import React, { useState, useEffect } from 'react';
import { HistoryBackupItem } from '../types';
import { getAllBackups, deleteBackup, forceRestoreBackup } from '../lib/historyBackup';
import { ArrowUpTrayIcon, TrashIcon } from './icons';

interface BackupManagerModalProps {
    isOpen: boolean;
    onClose: () => void;
    onDataChange: () => void; // Callback para recarregar dados no App
}

const BackupManagerModal: React.FC<BackupManagerModalProps> = ({ isOpen, onClose, onDataChange }) => {
    const [backups, setBackups] = useState<HistoryBackupItem[]>([]);
    const [isLoading, setIsLoading] = useState(false);

    const loadBackups = async () => {
        setIsLoading(true);
        try {
            const data = await getAllBackups();
            // Ordenar backups (tenta parsear a data da semana ou usa importedAt)
            data.sort((a, b) => new Date(b.importedAt).getTime() - new Date(a.importedAt).getTime());
            setBackups(data);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        if (isOpen) {
            loadBackups();
        }
    }, [isOpen]);

    const handleRestore = async (backup: HistoryBackupItem) => {
        if (!window.confirm(`Deseja forçar a restauração da semana "${backup.week}"? Isso substituirá os dados atuais desta semana.`)) return;
        
        try {
            await forceRestoreBackup(backup.id);
            alert("Semana restaurada com sucesso!");
            onDataChange(); // Atualiza a tela principal
        } catch (e) {
            alert("Erro ao restaurar backup.");
            console.error(e);
        }
    };

    const handleDelete = async (backup: HistoryBackupItem) => {
        if (!window.confirm(`Tem certeza que deseja excluir o backup de "${backup.week}"? Esta ação é irreversível.`)) return;
        
        try {
            await deleteBackup(backup.id);
            loadBackups(); // Recarrega a lista local
        } catch (e) {
            alert("Erro ao excluir backup.");
            console.error(e);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black bg-opacity-60 z-50 flex justify-center items-center" onClick={onClose}>
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-2xl m-4 flex flex-col" style={{ maxHeight: '90vh' }} onClick={e => e.stopPropagation()}>
                <div className="p-6 pb-4 border-b border-gray-200 dark:border-gray-700">
                    <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100">Gerenciar Backups de Histórico</h2>
                    <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                        Estes são os dados brutos importados de PDFs. Se alguma semana sumir da tela principal, você pode restaurá-la aqui.
                    </p>
                </div>

                <div className="flex-grow overflow-y-auto p-6">
                    {isLoading ? (
                        <p className="text-center text-gray-500">Carregando...</p>
                    ) : backups.length === 0 ? (
                        <p className="text-center text-gray-500 py-8">Nenhum backup encontrado.</p>
                    ) : (
                        <ul className="space-y-3">
                            {backups.map(backup => (
                                <li key={backup.id} className="bg-gray-50 dark:bg-gray-700/50 border border-gray-200 dark:border-gray-600 rounded-lg p-4 flex justify-between items-center">
                                    <div>
                                        <p className="font-bold text-gray-800 dark:text-gray-200">{backup.week}</p>
                                        <p className="text-xs text-gray-500 dark:text-gray-400">
                                            {backup.participations.length} participações • Importado em {new Date(backup.importedAt).toLocaleDateString()}
                                        </p>
                                    </div>
                                    <div className="flex space-x-2">
                                        <button 
                                            onClick={() => handleRestore(backup)}
                                            className="px-3 py-1.5 text-xs font-medium text-white bg-green-600 rounded hover:bg-green-700 flex items-center"
                                            title="Restaurar para a tabela principal"
                                        >
                                            <ArrowUpTrayIcon className="w-4 h-4 mr-1" /> Restaurar
                                        </button>
                                        <button 
                                            onClick={() => handleDelete(backup)}
                                            className="p-1.5 text-gray-400 hover:text-red-600 transition-colors"
                                            title="Excluir Backup"
                                        >
                                            <TrashIcon className="w-4 h-4" />
                                        </button>
                                    </div>
                                </li>
                            ))}
                        </ul>
                    )}
                </div>

                <div className="p-6 pt-4 border-t border-gray-200 dark:border-gray-700 flex justify-end">
                    <button type="button" onClick={onClose} className="px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200 rounded hover:bg-gray-300 dark:hover:bg-gray-600">
                        Fechar
                    </button>
                </div>
            </div>
        </div>
    );
};

export default BackupManagerModal;
