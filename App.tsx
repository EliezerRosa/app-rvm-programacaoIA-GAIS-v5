
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Publisher, Participation, Workbook, Rule, MeetingData, ParticipationType, AiScheduleResult, SpecialEvent, EventTemplate } from './types';
import { initStorage, getAllData, savePublisher, deletePublisher, saveParticipation, deleteParticipation, deleteParticipationsByWeek, saveWorkbook, deleteWorkbook, saveRule, deleteRule, clearAllData, saveSpecialEvent, deleteSpecialEvent, getAllEventTemplates, saveEventTemplate, deleteEventTemplate } from './lib/storage';
import PublisherTable from './components/PublisherTable';
import PublisherForm from './components/PublisherForm';
import ParticipationTable from './components/ParticipationTable';
import ParticipationForm from './components/ParticipationForm';
import WorkbookList from './components/WorkbookList';
import WorkbookUploadModal from './components/WorkbookUploadModal';
import ConfirmationModal from './components/ConfirmationModal';
import MeetingSchedule from './components/MeetingSchedule';
import MeetingScheduleForm from './components/MeetingScheduleForm';
import RuleManagerModal from './components/RuleManagerModal';
import AiSchedulerModal from './components/AiSchedulerModal';
import AiScheduleResultsModal from './components/AiScheduleResultsModal';
import SpecialEventsModal from './components/SpecialEventsModal';
import EventTemplateManagerModal from './components/EventTemplateManagerModal';
import HistoricalDataModal, { HistoricalData } from './components/HistoricalDataModal';
import StatisticsDashboard from './components/StatisticsDashboard';
import SettingsModal from './components/SettingsModal';
import BackupManagerModal from './components/BackupManagerModal'; // IMPORT NOVO
import { ArrowDownTrayIcon, ArrowUpTrayIcon, SparklesIcon, CogIcon, WrenchScrewdriverIcon } from './components/icons';
import { getScheduleHtml } from './lib/scheduleTemplate';
import { openHtmlInNewTab, calculatePartDate, generateUUID, parseWeekDate, generateWeeksForWorkbook, inferParticipationType, normalizeName } from './lib/utils';
import { generateAiSchedule } from './lib/aiScheduler';
import { parseHistoricPdf } from './lib/historicPdfParser';
import { saveHistoryBackup } from './lib/historyBackup';

type ActiveTab = 'Pauta' | 'Participações' | 'Publicadores' | 'Apostilas' | 'Estatísticas';
type ItemToDelete = Publisher | Participation | Workbook | Rule | SpecialEvent | EventTemplate | { type: 'week'; week: string } | null;
type PublisherSortKey = 'name' | 'condition';
type ParticipationSortOrder = 'desc' | 'asc';

const App: React.FC = () => {
    // STATE MANAGEMENT
    const [activeTab, setActiveTab] = useState<ActiveTab>('Pauta');
    const [publishers, setPublishers] = useState<Publisher[]>([]);
    const [participations, setParticipations] = useState<Participation[]>([]);
    const [workbooks, setWorkbooks] = useState<Workbook[]>([]);
    const [rules, setRules] = useState<Rule[]>([]);
    const [specialEvents, setSpecialEvents] = useState<SpecialEvent[]>([]);
    const [eventTemplates, setEventTemplates] = useState<EventTemplate[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isGeneratingAiSchedule, setIsGeneratingAiSchedule] = useState(false);
    const [batchGenerationProgress, setBatchGenerationProgress] = useState<string | null>(null);
    
    // MODAL STATES
    const [isPublisherFormOpen, setIsPublisherFormOpen] = useState(false);
    const [publisherToEdit, setPublisherToEdit] = useState<Publisher | null>(null);
    const [isParticipationFormOpen, setIsParticipationFormOpen] = useState(false);
    const [participationToEdit, setParticipationToEdit] = useState<Participation | null>(null);
    const [isWorkbookModalOpen, setIsWorkbookModalOpen] = useState(false);
    const [workbookToEdit, setWorkbookToEdit] = useState<Workbook | null>(null);
    const [isRuleManagerOpen, setIsRuleManagerOpen] = useState(false);
    const [isAiSchedulerModalOpen, setIsAiSchedulerModalOpen] = useState(false);
    const [aiScheduleResults, setAiScheduleResults] = useState<AiScheduleResult[] | null>(null);
    const [currentAiWorkbook, setCurrentAiWorkbook] = useState<Workbook | null>(null);
    const [currentAiWeek, setCurrentAiWeek] = useState<string>('');
    const [isConfirmationModalOpen, setIsConfirmationModalOpen] = useState(false);
    const [itemToDelete, setItemToDelete] = useState<ItemToDelete>(null);
    const [isScheduleFormOpen, setIsScheduleFormOpen] = useState(false);
    const [scheduleToEdit, setScheduleToEdit] = useState<MeetingData | null>(null);
    const [isSpecialEventsModalOpen, setIsSpecialEventsModalOpen] = useState(false);
    const [isTemplateManagerOpen, setIsTemplateManagerOpen] = useState(false);
    const [isHistoricalDataModalOpen, setIsHistoricalDataModalOpen] = useState(false);
    const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);
    const [isBackupManagerOpen, setIsBackupManagerOpen] = useState(false); // NOVO ESTADO


    // FILTER AND SORT STATES
    const [publisherSearch, setPublisherSearch] = useState('');
    const [publisherSort, setPublisherSort] = useState<PublisherSortKey>('name');
    const [participationSearch, setParticipationSearch] = useState('');
    const [participationWeekFilter, setParticipationWeekFilter] = useState('Todas as Semanas');
    const [participationSort, setParticipationSort] = useState<ParticipationSortOrder>('desc');
    const [scheduleWeekFilter, setScheduleWeekFilter] = useState('Todas as Semanas');
    const [scheduleParticipantSearch, setScheduleParticipantSearch] = useState('');

    // DATA LOADING
    const loadData = useCallback(async () => {
        setIsLoading(true);
        await initStorage();
        const data = await getAllData();
        setPublishers(data.publishers);
        setParticipations(data.participations);
        setWorkbooks(data.workbooks.sort((a, b) => new Date(b.uploadDate).getTime() - new Date(a.uploadDate).getTime()));
        setRules(data.rules);
        setSpecialEvents(data.specialEvents);
        setEventTemplates(data.eventTemplates);
        setIsLoading(false);
    }, []);

    useEffect(() => { loadData(); }, [loadData]);

    const scheduleData: MeetingData[] = useMemo(() => {
        const weeks: { [week: string]: Participation[] } = {};
        participations.forEach(p => {
            if (!weeks[p.week]) weeks[p.week] = [];
            weeks[p.week].push(p);
        });
        return Object.keys(weeks).map(week => ({ week, parts: weeks[week] })).sort((a, b) => parseWeekDate(b.week).getTime() - parseWeekDate(a.week).getTime());
    }, [participations]);
    
    const scheduledWeeks = useMemo(() => scheduleData.map(s => s.week), [scheduleData]);

    const filteredPublishers = useMemo(() => publishers.filter(p => p.name.toLowerCase().includes(publisherSearch.toLowerCase())).sort((a, b) => {
        if (a[publisherSort] < b[publisherSort]) return -1;
        if (a[publisherSort] > b[publisherSort]) return 1;
        return 0;
    }), [publishers, publisherSearch, publisherSort]);
    const participationWeeks = useMemo(() => ['Todas as Semanas', ...Array.from(new Set(participations.map(p => p.week))).sort((a: string, b: string) => parseWeekDate(b).getTime() - parseWeekDate(a).getTime())], [participations]);
    const filteredParticipations = useMemo(() => participations.filter(p => (p.publisherName.toLowerCase().includes(participationSearch.toLowerCase()) || p.partTitle.toLowerCase().includes(participationSearch.toLowerCase())) && (participationWeekFilter === 'Todas as Semanas' || p.week === participationWeekFilter)).sort((a, b) => (participationSort === 'desc' ? new Date(b.date).getTime() - new Date(a.date).getTime() : new Date(a.date).getTime() - new Date(b.date).getTime())), [participations, participationSearch, participationWeekFilter, participationSort]);
    const scheduleWeeks = useMemo(() => ['Todas as Semanas', ...scheduleData.map(s => s.week)], [scheduleData]);
    const filteredScheduleData = useMemo(() => scheduleData.filter(m => (scheduleWeekFilter === 'Todas as Semanas' || m.week === scheduleWeekFilter) && (!scheduleParticipantSearch || m.parts.some(p => p.publisherName.toLowerCase().includes(scheduleParticipantSearch.toLowerCase())))), [scheduleData, scheduleWeekFilter, scheduleParticipantSearch]);

    // HANDLERS
    const handleSavePublisher = async (p: Publisher) => { await savePublisher(p); loadData(); };
    const handleDeletePublisher = (p: Publisher) => { setItemToDelete(p); setIsConfirmationModalOpen(true); };
    const handleSaveParticipation = async (ps: Participation[]) => { await Promise.all(ps.map(p => saveParticipation(p))); loadData(); };
    const handleDeleteParticipation = (p: Participation) => { setItemToDelete(p); setIsConfirmationModalOpen(true); };
    const handleSaveWorkbook = async (w: Workbook) => { await saveWorkbook(w); loadData(); };
    const handleDeleteWorkbook = (w: Workbook) => { setItemToDelete(w); setIsConfirmationModalOpen(true); };
    const handleSaveRule = async (r: Rule) => { await saveRule(r); loadData(); };
    const handleDeleteRule = (id: string) => { const r = rules.find(r => r.id === id); if (r) { setItemToDelete(r); setIsConfirmationModalOpen(true); } };
    
    const handleSaveSpecialEvent = async (event: SpecialEvent) => { try { await saveSpecialEvent(event); await loadData(); } catch (error) { console.error("Failed to save special event:", error); alert("Erro ao salvar o evento especial."); } };
    const handleDeleteSpecialEvent = (id: string) => { const e = specialEvents.find(e => e.id === id); if (e) { setItemToDelete(e); setIsConfirmationModalOpen(true); } };
    
    const handleSaveEventTemplate = async (template: EventTemplate) => { await saveEventTemplate(template); loadData(); };
    const handleDeleteEventTemplate = (id: string) => { const t = eventTemplates.find(t => t.id === id); if (t) { setItemToDelete(t); setIsConfirmationModalOpen(true); } };

    const handleEditWeek = (m: MeetingData) => { setScheduleToEdit(m); setIsScheduleFormOpen(true); };
    
    const handleSaveSchedule = async ({ parts, eventToUpdate }: { parts: Participation[], eventToUpdate?: SpecialEvent }) => {
        await Promise.all(parts.map(p => saveParticipation(p)));
        if (eventToUpdate) {
            await saveSpecialEvent(eventToUpdate);
        }
        loadData();
    };
    
    const handleDeleteWeek = (meeting: MeetingData) => { setItemToDelete({ type: 'week', week: meeting.week }); setIsConfirmationModalOpen(true); };
    
    const saveAiResults = async (results: AiScheduleResult[], week: string) => {
        const newParticipations: Participation[] = [];
        const eventForWeek = specialEvents.find(e => e.week === week);
        const template = eventForWeek ? eventTemplates.find(t => t.id === eventForWeek.templateId) : null;

        for (const result of results) {
            if (result.partTitle.toLowerCase().includes('cântico') || !result.studentName) continue;
            if (template && result.partTitle === eventForWeek!.theme) continue;

            const partType = result.partTitle.includes('Tesouros') ? ParticipationType.TESOUROS : result.partTitle.includes('Ministério') ? ParticipationType.MINISTERIO : ParticipationType.VIDA_CRISTA;
            newParticipations.push({ id: generateUUID(), publisherName: result.studentName, week, partTitle: result.partTitle, type: partType, date: calculatePartDate(week) });
            if (result.helperName) newParticipations.push({ id: generateUUID(), publisherName: result.helperName, week, partTitle: 'Ajudante', type: ParticipationType.AJUDANTE, date: calculatePartDate(week) });
        }
        
        if (eventForWeek && template) {
             newParticipations.push({ id: generateUUID(), publisherName: eventForWeek.assignedTo, week, partTitle: eventForWeek.theme, type: ParticipationType.VIDA_CRISTA, date: calculatePartDate(week), duration: eventForWeek.duration });
        }
        
        await Promise.all(newParticipations.map(p => saveParticipation(p)));
    };

    const handleGenerateAiSchedule = async (workbook: Workbook, week: string) => {
        setIsAiSchedulerModalOpen(false);
        if (week === 'ALL') {
            const allWeeksInWorkbook = generateWeeksForWorkbook(workbook.name);
            const scheduledWeeksSet = new Set(scheduledWeeks);
            const weeksToGenerate = allWeeksInWorkbook.filter(w => !scheduledWeeksSet.has(w));
            if (weeksToGenerate.length === 0) { alert("Nenhuma semana disponível para gerar nesta apostila."); return; }

            setIsGeneratingAiSchedule(true);
            setBatchGenerationProgress(`Iniciando geração para ${weeksToGenerate.length} semanas...`);
            for (let i = 0; i < weeksToGenerate.length; i++) {
                const currentWeek = weeksToGenerate[i];
                setBatchGenerationProgress(`Gerando pauta ${i + 1} de ${weeksToGenerate.length}: ${currentWeek}`);
                try {
                    const results = await generateAiSchedule(workbook, currentWeek, publishers, participations, rules, specialEvents, eventTemplates);
                    await saveAiResults(results, currentWeek);
                } catch (error) { console.error(`Falha ao gerar pauta para a semana ${currentWeek}:`, error); }
            }
            setBatchGenerationProgress(null);
            setIsGeneratingAiSchedule(false);
            await loadData();
            alert(`Geração em lote concluída para ${weeksToGenerate.length} semanas!`);
        } else {
            setIsGeneratingAiSchedule(true);
            try {
                const results = await generateAiSchedule(workbook, week, publishers, participations, rules, specialEvents, eventTemplates);
                setAiScheduleResults(results);
                setCurrentAiWorkbook(workbook);
                setCurrentAiWeek(week);
            } catch (error) { alert(`Erro ao gerar pauta: ${error instanceof Error ? error.message : String(error)}`); }
            finally { setIsGeneratingAiSchedule(false); }
        }
    };
    
    const handleSaveAiSchedule = async () => {
        if (!aiScheduleResults || !currentAiWeek) return;
        await saveAiResults(aiScheduleResults, currentAiWeek);
        setAiScheduleResults(null);
        setCurrentAiWorkbook(null);
        setCurrentAiWeek('');
        await loadData();
    };

    const partAllowsNamelessPublisher = (partTitle: string) => {
        const title = partTitle.toLowerCase();
        return title.includes('cântico') || title.includes('cantico');
    };

    const handleImportHistoricalData = async (dataToImport: HistoricalData[]) => {
        const newParticipations: Participation[] = [];
        const publisherNameMap = new Map<string, Publisher>();
        const existingKeys = new Set<string>();

        for (const p of participations) {
            existingKeys.add(`${p.week}|${normalizeName(p.partTitle)}|${normalizeName(p.publisherName)}`);
        }

        for (const p of publishers) {
            publisherNameMap.set(normalizeName(p.name), p);
            if (p.aliases) {
                for (const alias of p.aliases) {
                    publisherNameMap.set(normalizeName(alias), p);
                }
            }
        }

        for (const weekData of dataToImport) {
            for (const p of weekData.participations) {
                if (!p.partTitle) continue;

                const allowsNameless = partAllowsNamelessPublisher(p.partTitle);
                const rawPublisherName = p.publisherName?.trim() ?? '';

                if (!rawPublisherName && !allowsNameless) continue;

                let resolvedPublisherName = '';

                if (rawPublisherName) {
                    const normalizedName = normalizeName(rawPublisherName);
                    const foundPublisher = publisherNameMap.get(normalizedName);

                    if (!foundPublisher) {
                        console.warn(`Publicador "${p.publisherName}" não encontrado. Ignorando.`);
                        continue;
                    }
                    resolvedPublisherName = foundPublisher.name;
                }

                const partKey = `${weekData.week}|${normalizeName(p.partTitle)}|${normalizeName(resolvedPublisherName)}`;
                if (existingKeys.has(partKey)) {
                    continue;
                }

                let inferredType = inferParticipationType(p.partTitle);
                if (typeof (p as any).partNumber === 'number') {
                    const number = (p as any).partNumber as number;
                    if (number <= 3) inferredType = ParticipationType.TESOUROS;
                    else if (number <= 6) inferredType = ParticipationType.MINISTERIO;
                    else inferredType = ParticipationType.VIDA_CRISTA;
                }

                newParticipations.push({
                    id: generateUUID(),
                    publisherName: resolvedPublisherName,
                    week: weekData.week,
                    partTitle: p.partTitle,
                    type: inferredType,
                    date: calculatePartDate(weekData.week)
                });

                existingKeys.add(partKey);
            }
        }

        if (newParticipations.length > 0) {
            await Promise.all(newParticipations.map(p => saveParticipation(p)));
            
            // SALVAR BACKUP
            await saveHistoryBackup(newParticipations);

            alert(`${newParticipations.length} novas designações importadas com sucesso! Backup criado.`);
            await loadData();
        } else {
            alert("Nenhuma nova designação válida para importar.");
        }
    };
    
    const confirmDelete = async () => {
        if (!itemToDelete) return;
        try {
            if (typeof itemToDelete === 'object' && 'type' in itemToDelete && itemToDelete.type === 'week') await deleteParticipationsByWeek(itemToDelete.week);
            else if ('privileges' in itemToDelete) await deletePublisher(itemToDelete.id);
            else if ('partTitle' in itemToDelete) await deleteParticipation(itemToDelete.id);
            else if ('fileData' in itemToDelete) await deleteWorkbook(itemToDelete.id);
            else if ('conditions' in itemToDelete) { const rule = itemToDelete as Rule; await deleteRule(rule.id); }
            else if ('templateId' in itemToDelete) { const event = itemToDelete as SpecialEvent; await deleteSpecialEvent(event.id); }
            else if ('impact' in itemToDelete) { const template = itemToDelete as EventTemplate; await deleteEventTemplate(template.id); }
        } catch (error) { console.error("Failed to delete item:", error); alert("Erro ao excluir o item."); }
        setItemToDelete(null);
        setIsConfirmationModalOpen(false);
        loadData();
    };

    const getItemToDeleteDisplayName = (item: ItemToDelete): string => {
        if (!item) return '';
        if (typeof item === 'object' && 'type' in item && item.type === 'week') return `a pauta completa da semana "${item.week}"`;
        if ('partTitle' in item) return `a participação "${item.partTitle}" de ${item.publisherName}`;
        if ('conditions' in item) return `a regra "${item.description}"`;
        if ('templateId' in item) { const template = eventTemplates.find(t => t.id === (item as SpecialEvent).templateId); return `o evento "${template?.name}" da semana ${item.week}`; }
        if ('impact' in item) return `o modelo de evento "${(item as EventTemplate).name}"`;
        if ('name' in item) return `o item "${item.name}"`;
        return 'este item';
    };

    const handleOpenPrintableView = (m: MeetingData) => openHtmlInNewTab(getScheduleHtml(m, "Vila Velha - Central", publishers, specialEvents, eventTemplates));
    const handleExportData = async () => {
        const data = await getAllData();
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = `designacoes_rvm_backup_${new Date().toISOString().split('T')[0]}.json`;
        a.click();
        URL.revokeObjectURL(a.href);
    };
    const handleImportData = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = async (ev) => {
            try {
                const fileContent = ev.target?.result;
                if (typeof fileContent !== 'string') {
                    throw new Error("Falha ao ler o arquivo.");
                }
                const data = JSON.parse(fileContent);

                if (!data.publishers || !data.participations) {
                    throw new Error("Arquivo de backup inválido.");
                }
                if (window.confirm("Isso substituirá TODOS os dados existentes. Tem certeza?")) {
                    await clearAllData();
                    await Promise.all([
                        ...data.publishers.map((p: Publisher) => savePublisher(p)),
                        ...data.participations.map((p: Participation) => saveParticipation(p)),
                        ...data.workbooks.map((w: Workbook) => saveWorkbook(w)),
                        ...(data.rules || []).map((r: Rule) => saveRule(r)),
                        ...(data.eventTemplates || []).map((t: EventTemplate) => saveEventTemplate(t)),
                        ...(data.specialEvents || []).map((e: SpecialEvent) => saveSpecialEvent(e)),
                    ]);
                    alert("Dados importados com sucesso!");
                    loadData();
                }
            } catch (error) {
                const typedError = error as Error;
                alert(`Erro ao importar dados: ${typedError.message}`);
            } finally {
                e.target.value = '';
            }
        };
        reader.readAsText(file);
    };

    const renderTabContent = () => {
        switch (activeTab) {
            case 'Pauta': return <MeetingSchedule scheduleData={filteredScheduleData} publishers={publishers} specialEvents={specialEvents} eventTemplates={eventTemplates} onEditWeek={handleEditWeek} onDeleteWeek={handleDeleteWeek} onOpenPrintableView={handleOpenPrintableView} />;
            case 'Participações': return <ParticipationTable participations={filteredParticipations} onEdit={(p) => { setParticipationToEdit(p); setIsParticipationFormOpen(true); }} onDelete={handleDeleteParticipation} />;
            case 'Publicadores': return <PublisherTable publishers={filteredPublishers} onEdit={(p) => { setPublisherToEdit(p); setIsPublisherFormOpen(true); }} onDelete={handleDeletePublisher} />;
            case 'Apostilas': return <WorkbookList workbooks={workbooks} onEdit={(w) => { setWorkbookToEdit(w); setIsWorkbookModalOpen(true); }} onDelete={handleDeleteWorkbook} />;
            case 'Estatísticas': return <StatisticsDashboard publishers={publishers} participations={participations} />;
            default: return null;
        }
    };
    
    if (isLoading) return <div className="flex justify-center items-center h-screen"><div className="text-xl text-gray-500">Carregando banco de dados...</div></div>;
    
    return (
        <div className="min-h-screen bg-gray-100 dark:bg-gray-900 text-gray-900 dark:text-gray-100">
            <div className="sticky top-0 z-30 bg-gray-100 dark:bg-gray-900 shadow-md">
                <header className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8"><div className="flex justify-between items-center py-4">
                    <h1 className="text-2xl font-bold text-indigo-600 dark:text-indigo-400">Designações na RVM</h1>
                    <div className="flex items-center space-x-2">
                        <input type="file" id="import-file" className="hidden" accept=".json" onChange={handleImportData} />
                        <button onClick={() => document.getElementById('import-file')?.click()} className="p-2 text-gray-500 hover:text-indigo-600 dark:hover:text-indigo-400" title="Importar Backup"><ArrowUpTrayIcon className="w-6 h-6"/></button>
                        <button onClick={handleExportData} className="p-2 text-gray-500 hover:text-indigo-600 dark:hover:text-indigo-400" title="Exportar Backup"><ArrowDownTrayIcon className="w-6 h-6"/></button>
                        <button onClick={() => setIsRuleManagerOpen(true)} className="p-2 text-gray-500 hover:text-indigo-600 dark:text-indigo-400" title="Gerenciar Regras"><SparklesIcon className="w-6 h-6"/></button>
                        <button onClick={() => setIsSpecialEventsModalOpen(true)} className="p-2 text-gray-500 hover:text-indigo-600 dark:text-indigo-400" title="Gerenciar Eventos"><CogIcon className="w-6 h-6"/></button>
                        <button onClick={() => setIsSettingsModalOpen(true)} className="p-2 text-gray-500 hover:text-indigo-600 dark:text-indigo-400" title="Configurações"><WrenchScrewdriverIcon className="w-6 h-6"/></button>
                    </div>
                </div></header>
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8"><div className="border-b border-gray-200 dark:border-gray-700"><nav className="-mb-px flex space-x-6 overflow-x-auto">
                    {(['Pauta', 'Participações', 'Publicadores', 'Apostilas', 'Estatísticas'] as ActiveTab[]).map(tab => (<button key={tab} onClick={() => setActiveTab(tab)} className={`${activeTab === tab ? 'border-indigo-500 text-indigo-600' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'} whitespace-nowrap py-3 px-1 border-b-2 font-medium text-sm`}>{tab}</button>))}
                </nav></div></div>
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3"><div className="flex flex-col md:flex-row justify-between items-center gap-4">
                    <div className="w-full md:w-auto flex-grow">{batchGenerationProgress ? (<div className="text-sm text-indigo-600 animate-pulse">{batchGenerationProgress}</div>) : activeTab === 'Pauta' && (<div className="flex flex-wrap gap-4"><select value={scheduleWeekFilter} onChange={e => setScheduleWeekFilter(e.target.value)} className="px-3 py-2 bg-white border border-gray-300 dark:border-gray-600 rounded-md shadow-sm text-black focus:outline-none focus:ring-indigo-600 focus:border-indigo-600 sm:text-sm">{scheduleWeeks.map(w => <option key={w} value={w}>{w}</option>)}</select><input type="search" placeholder="Buscar por participante..." value={scheduleParticipantSearch} onChange={e => setScheduleParticipantSearch(e.target.value)} className="w-full md:w-64 px-3 py-2 bg-white border border-gray-300 dark:border-gray-600 rounded-md shadow-sm text-black placeholder-gray-500 focus:outline-none focus:ring-indigo-600 focus:border-indigo-600 sm:text-sm"/></div>)}{activeTab === 'Publicadores' && (<div className="flex gap-4"><input type="search" placeholder="Buscar por nome..." value={publisherSearch} onChange={e => setPublisherSearch(e.target.value)} className="w-full md:w-64 px-3 py-2 bg-white border border-gray-300 dark:border-gray-600 rounded-md shadow-sm text-black placeholder-gray-500 focus:outline-none focus:ring-indigo-600 focus:border-indigo-600 sm:text-sm"/><select value={publisherSort} onChange={e => setPublisherSort(e.target.value as PublisherSortKey)} className="px-3 py-2 bg-white border border-gray-300 dark:border-gray-600 rounded-md shadow-sm text-black focus:outline-none focus:ring-indigo-600 focus:border-indigo-600 sm:text-sm"><option value="name">Ordenar por Nome</option><option value="condition">Ordenar por Condição</option></select></div>)}{activeTab === 'Participações' && (<div className="flex flex-wrap gap-4"><input type="search" placeholder="Buscar por nome ou parte..." value={participationSearch} onChange={e => setParticipationSearch(e.target.value)} className="w-full md:w-64 px-3 py-2 bg-white border border-gray-300 dark:border-gray-600 rounded-md shadow-sm text-black placeholder-gray-500 focus:outline-none focus:ring-indigo-600 focus:border-indigo-600 sm:text-sm"/><select value={participationWeekFilter} onChange={e => setParticipationWeekFilter(e.target.value)} className="px-3 py-2 bg-white border border-gray-300 dark:border-gray-600 rounded-md shadow-sm text-black focus:outline-none focus:ring-indigo-600 focus:border-indigo-600 sm:text-sm">{participationWeeks.map(w => <option key={w} value={w}>{w}</option>)}</select><select value={participationSort} onChange={e => setParticipationSort(e.target.value as ParticipationSortOrder)} className="px-3 py-2 bg-white border border-gray-300 dark:border-gray-600 rounded-md shadow-sm text-black focus:outline-none focus:ring-indigo-600 focus:border-indigo-600 sm:text-sm"><option value="desc">Mais Recentes</option><option value="asc">Mais Antigas</option></select></div>)}</div>
                    <div className="flex-shrink-0 flex space-x-2">{activeTab === 'Pauta' && <button onClick={() => setIsAiSchedulerModalOpen(true)} className="btn-primary flex items-center"><SparklesIcon className="w-5 h-5 mr-2"/>Gerar Pauta com IA</button>}{activeTab === 'Participações' && <><button onClick={() => setIsHistoricalDataModalOpen(true)} className="btn-primary">Importar Histórico</button><button onClick={() => { setParticipationToEdit(null); setIsParticipationFormOpen(true); }} className="btn-primary">Adicionar Designação</button></>}{activeTab === 'Publicadores' && <button onClick={() => { setPublisherToEdit(null); setIsPublisherFormOpen(true); }} className="btn-primary">Adicionar Publicador</button>}{activeTab === 'Apostilas' && <button onClick={() => { setWorkbookToEdit(null); setIsWorkbookModalOpen(true); }} className="btn-primary">Adicionar Apostila</button>}</div>
                </div></div>
            </div>

            <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">{renderTabContent()}</main>

            {/* Modals */}
            <PublisherForm isOpen={isPublisherFormOpen} onClose={() => setIsPublisherFormOpen(false)} onSave={handleSavePublisher} publisherToEdit={publisherToEdit} publishers={publishers} />
            <ParticipationForm isOpen={isParticipationFormOpen} onClose={() => setIsParticipationFormOpen(false)} onSave={handleSaveParticipation} participationToEdit={participationToEdit} publishers={publishers} participations={participations} rules={rules} specialEvents={specialEvents} eventTemplates={eventTemplates} />
            <WorkbookUploadModal isOpen={isWorkbookModalOpen} onClose={() => setIsWorkbookModalOpen(false)} onSave={handleSaveWorkbook} workbookToEdit={workbookToEdit} />
            <RuleManagerModal isOpen={isRuleManagerOpen} onClose={() => setIsRuleManagerOpen(false)} rules={rules} onSave={handleSaveRule} onDelete={handleDeleteRule} />
            <AiSchedulerModal isOpen={isAiSchedulerModalOpen} onClose={() => setIsAiSchedulerModalOpen(false)} onGenerate={handleGenerateAiSchedule} workbooks={workbooks} scheduledWeeks={scheduledWeeks} isGenerating={isGeneratingAiSchedule} />
            {aiScheduleResults && <AiScheduleResultsModal isOpen={!!aiScheduleResults} onClose={() => setAiScheduleResults(null)} onSave={handleSaveAiSchedule} results={aiScheduleResults} workbookName={currentAiWeek} />}
            <ConfirmationModal isOpen={isConfirmationModalOpen} onClose={() => setIsConfirmationModalOpen(false)} onConfirm={confirmDelete} title="Confirmar Exclusão" message={`Você tem certeza que deseja excluir ${getItemToDeleteDisplayName(itemToDelete)}? Esta ação não pode ser desfeita.`} />
            <MeetingScheduleForm isOpen={isScheduleFormOpen} onClose={() => setIsScheduleFormOpen(false)} onSave={handleSaveSchedule} scheduleToEdit={scheduleToEdit} publishers={publishers} specialEvents={specialEvents} eventTemplates={eventTemplates} />
            <SpecialEventsModal isOpen={isSpecialEventsModalOpen} onClose={() => setIsSpecialEventsModalOpen(false)} specialEvents={specialEvents} eventTemplates={eventTemplates} onSave={handleSaveSpecialEvent} onDelete={handleDeleteSpecialEvent} onManageTemplates={() => setIsTemplateManagerOpen(true)} />
            <EventTemplateManagerModal isOpen={isTemplateManagerOpen} onClose={() => setIsTemplateManagerOpen(false)} templates={eventTemplates} onSave={handleSaveEventTemplate} onDelete={handleDeleteEventTemplate} />
            <HistoricalDataModal isOpen={isHistoricalDataModalOpen} onClose={() => setIsHistoricalDataModalOpen(false)} onImport={handleImportHistoricalData} existingWeeks={scheduledWeeks} parsePdf={parseHistoricPdf} />
            <SettingsModal isOpen={isSettingsModalOpen} onClose={() => setIsSettingsModalOpen(false)} onOpenBackupManager={() => setIsBackupManagerOpen(true)} />
            <BackupManagerModal isOpen={isBackupManagerOpen} onClose={() => setIsBackupManagerOpen(false)} onDataChange={loadData} />
        </div>
    );
};

export default App;
