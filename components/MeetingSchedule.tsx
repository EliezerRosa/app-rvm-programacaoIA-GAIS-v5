
import React, { useState } from 'react';
import { MeetingData, ParticipationType, Publisher, SpecialEvent, EventTemplate } from '../types';
import { EyeIcon, PencilIcon, TrashIcon, PaperAirplaneIcon } from './icons';
import { TimedEvent, getFullScheduleWithTimings } from '../lib/scheduleUtils';
import { prepareS89Payload, sendS89ToN8N } from '../lib/s89Service';

interface MeetingScheduleProps {
  scheduleData: MeetingData[];
  publishers: Publisher[];
  specialEvents: SpecialEvent[];
  eventTemplates: EventTemplate[];
  onEditWeek: (meetingData: MeetingData) => void;
  onDeleteWeek: (meetingData: MeetingData) => void;
  onOpenPrintableView: (meetingData: MeetingData) => void;
}

interface TimedRowProps {
    event: TimedEvent;
    publishers: Publisher[];
}

const TimedRow: React.FC<TimedRowProps> = ({ event, publishers }) => {
    const { startTime, partTitle, publisherName, durationText, isCounseling, rawPart } = event;
    const [isSending, setIsSending] = useState(false);

    // Verifica se a parte é elegível para S-89
    const isEligibleForS89 = rawPart && (
        (rawPart.type === ParticipationType.TESOUROS && rawPart.partTitle.toLowerCase().includes('leitura da bíblia')) ||
        (rawPart.type === ParticipationType.MINISTERIO)
    );

    const handleSendS89 = async () => {
        if (!rawPart) return;
        if (!window.confirm(`Enviar designação (S-89) para ${rawPart.publisherName} via WhatsApp?`)) return;

        setIsSending(true);
        try {
            const payload = prepareS89Payload(rawPart, publishers);
            if (!payload) {
                alert("Erro: Publicador não encontrado ou dados incompletos.");
                return;
            }
            await sendS89ToN8N(payload);
            alert("Designação enviada com sucesso!");
        } catch (e: any) {
            alert(`Erro ao enviar: ${e.message}`);
        } finally {
            setIsSending(false);
        }
    };

    return (
        <div className={`grid grid-cols-[auto_1fr_auto_auto] gap-x-4 py-2 border-b border-gray-200 dark:border-gray-700 last:border-b-0 items-center ${isCounseling ? 'text-gray-500' : ''}`}>
            <span className="text-sm font-mono">{startTime}</span>
            <span className={`text-sm ${isCounseling ? 'italic pl-4' : 'text-gray-800 dark:text-gray-300'}`}>
                {partTitle}
            </span>
            <div className={`text-sm justify-self-end text-right ${isCounseling ? '' : 'text-gray-600 dark:text-gray-400'} flex items-center`}>
                <span>{publisherName}</span>
                {isEligibleForS89 && !isCounseling && (
                    <button 
                        onClick={handleSendS89}
                        disabled={isSending}
                        className={`ml-2 p-1 rounded-full hover:bg-green-100 text-green-600 dark:hover:bg-green-900 dark:text-green-400 transition-colors ${isSending ? 'opacity-50 cursor-not-allowed' : ''}`}
                        title="Enviar S-89 via WhatsApp"
                    >
                        <PaperAirplaneIcon className="w-4 h-4" />
                    </button>
                )}
            </div>
            <span className="text-gray-400 dark:text-gray-500 w-16 inline-block text-right">{durationText}</span>
        </div>
    );
};


const MeetingSchedule: React.FC<MeetingScheduleProps> = ({ scheduleData, publishers, specialEvents, eventTemplates, onEditWeek, onDeleteWeek, onOpenPrintableView }) => {

    return (
        <div className="space-y-8">
            {scheduleData.map((meeting) => {
                const president = meeting.parts.find(p => p.type === ParticipationType.PRESIDENTE);
                const timedSchedule = getFullScheduleWithTimings(meeting, publishers, specialEvents, eventTemplates);

                const openingParts = timedSchedule.filter(p => p.sectionType === 'OPENING' || p.sectionType === 'COMMENTS');
                const treasuresParts = timedSchedule.filter(p => p.sectionType === ParticipationType.TESOUROS);
                const transitionParts = timedSchedule.filter(p => p.sectionType === 'TRANSITION');
                const ministryParts = timedSchedule.filter(p => p.sectionType === ParticipationType.MINISTERIO);
                const lifeParts = timedSchedule.filter(p => p.sectionType === ParticipationType.VIDA_CRISTA || p.sectionType === ParticipationType.DIRIGENTE);
                const closingParts = timedSchedule.filter(p => p.sectionType === 'CLOSING');

                return (
                    <div key={meeting.week} className="bg-white dark:bg-gray-800 shadow-lg rounded-lg p-6">
                        <div className="flex justify-between items-start mb-4">
                            <div>
                                <h3 className="text-2xl font-bold text-indigo-600 dark:text-indigo-400">{meeting.week}</h3>
                                {president && <p className="text-md text-gray-600 dark:text-gray-400">Presidente: {president.publisherName}</p>}
                            </div>
                             <div className="flex items-center space-x-2">
                                <button onClick={() => onOpenPrintableView(meeting)} className="p-2 text-gray-500 hover:text-blue-600 dark:text-gray-400 dark:hover:text-blue-500" title="Visualizar Pauta">
                                    <EyeIcon className="w-5 h-5" />
                                </button>
                                <button onClick={() => onEditWeek(meeting)} className="p-2 text-gray-500 hover:text-indigo-600 dark:text-gray-400 dark:hover:text-indigo-500" title="Editar Pauta">
                                    <PencilIcon className="w-5 h-5" />
                                </button>
                                <button onClick={() => onDeleteWeek(meeting)} className="p-2 text-gray-500 hover:text-red-600 dark:text-gray-400 dark:hover:text-red-500" title="Excluir Pauta">
                                    <TrashIcon className="w-5 h-5" />
                                </button>
                            </div>
                        </div>
                        
                        <div className="space-y-6">
                           {openingParts.length > 0 && <div>{openingParts.map(event => <TimedRow key={event.id} event={event} publishers={publishers} />)}</div>}

                           {treasuresParts.length > 0 && (
                               <div>
                                   <h4 className="font-bold text-lg text-white bg-[#4A5568] dark:bg-blue-900/50 rounded-md px-3 py-1 mb-2">TESOUROS DA PALAVRA DE DEUS</h4>
                                   {treasuresParts.map(event => <TimedRow key={event.id} event={event} publishers={publishers} />)}
                               </div>
                           )}
                           
                           {transitionParts.length > 0 && <div>{transitionParts.map(event => <TimedRow key={event.id} event={event} publishers={publishers} />)}</div>}

                           {ministryParts.length > 0 && (
                               <div>
                                   <h4 className="font-bold text-lg text-white bg-[#D69E2E] dark:bg-yellow-900/50 rounded-md px-3 py-1 mt-4 mb-2">FAÇA SEU MELHOR NO MINISTÉRIO</h4>
                                   {ministryParts.map(event => <TimedRow key={event.id} event={event} publishers={publishers} />)}
                               </div>
                           )}

                           {lifeParts.length > 0 && (
                               <div>
                                   <h4 className="font-bold text-lg text-white bg-[#C53030] dark:bg-red-900/50 rounded-md px-3 py-1 mt-4 mb-2">NOSSA VIDA CRISTÃ</h4>
                                   {lifeParts.map(event => <TimedRow key={event.id} event={event} publishers={publishers} />)}
                               </div>
                           )}
                           
                           {closingParts.length > 0 && <div className="mt-4">{closingParts.map(event => <TimedRow key={event.id} event={event} publishers={publishers} />)}</div>}
                        </div>
                    </div>
                );
            })}
        </div>
    );
};

export default MeetingSchedule;
