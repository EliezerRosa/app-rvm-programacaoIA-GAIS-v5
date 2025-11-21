import React, { useEffect, useMemo, useState } from 'react';
import { MeetingData, Participation, ParticipationType, Publisher, SpecialEvent, EventTemplate } from '../types';
import { calculatePartDate, generateUUID } from '../lib/utils';

interface MeetingScheduleFormProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (payload: {
    parts: Participation[];
    deletedPartIds: string[];
    eventToUpdate?: SpecialEvent;
    updatedWeek: string;
    originalWeek: string;
  }) => void;
  scheduleToEdit: MeetingData | null;
  publishers: Publisher[];
  specialEvents: SpecialEvent[];
  eventTemplates: EventTemplate[];
}

type SectionKey = 'opening' | 'treasures' | 'transition' | 'ministry' | 'life' | 'closing';

const ORDERED_SECTIONS: SectionKey[] = ['opening', 'treasures', 'transition', 'ministry', 'life', 'closing'];

const SECTION_LABELS: Record<SectionKey, string> = {
  opening: 'Abertura',
  treasures: 'Tesouros da Palavra de Deus',
  transition: 'Transição',
  ministry: 'Faça Seu Melhor no Ministério',
  life: 'Nossa Vida Cristã',
  closing: 'Encerramento',
};

const SECTION_DEFAULT_TYPE: Record<SectionKey, ParticipationType> = {
  opening: ParticipationType.PRESIDENTE,
  treasures: ParticipationType.TESOUROS,
  transition: ParticipationType.CANTICO,
  ministry: ParticipationType.MINISTERIO,
  life: ParticipationType.VIDA_CRISTA,
  closing: ParticipationType.CANTICO,
};

const SECTION_SUPPORTS_PART_NUMBER: Record<SectionKey, boolean> = {
  opening: false,
  treasures: true,
  transition: false,
  ministry: true,
  life: true,
  closing: false,
};

const SECTION_TYPE_OPTIONS: Record<SectionKey, { label: string; value: ParticipationType }[]> = {
  opening: [
    { label: 'Presidente', value: ParticipationType.PRESIDENTE },
    { label: 'Oração Inicial', value: ParticipationType.ORACAO_INICIAL },
    { label: 'Cântico', value: ParticipationType.CANTICO },
  ],
  treasures: [{ label: 'Parte de Tesouros', value: ParticipationType.TESOUROS }],
  transition: [{ label: 'Cântico', value: ParticipationType.CANTICO }],
  ministry: [{ label: 'Parte do Ministério', value: ParticipationType.MINISTERIO }],
  life: [
    { label: 'Parte da Vida Cristã', value: ParticipationType.VIDA_CRISTA },
    { label: 'Estudo Bíblico (Dirigente)', value: ParticipationType.DIRIGENTE },
  ],
  closing: [
    { label: 'Cântico', value: ParticipationType.CANTICO },
    { label: 'Comentários Finais', value: ParticipationType.COMENTARIOS_FINAIS },
    { label: 'Oração Final', value: ParticipationType.ORACAO_FINAL },
  ],
};

interface EditablePartRow {
  id: string;
  partTitle: string;
  publisherName: string;
  type: ParticipationType;
  section: SectionKey;
  order: number;
  duration?: number;
  partNumber?: number | null;
  helperId?: string | null;
  helperName?: string;
  helperType?: ParticipationType;
  isSong?: boolean;
  isPrayer?: boolean;
  isSpecialEvent?: boolean;
  specialEventMeta?: { id: string; templateId: string };
}

const createEmptySections = (): Record<SectionKey, EditablePartRow[]> =>
  ORDERED_SECTIONS.reduce((acc, key) => {
    acc[key] = [];
    return acc;
  }, {} as Record<SectionKey, EditablePartRow[]>);

const assignSequentialOrders = (sections: Record<SectionKey, EditablePartRow[]>): Record<SectionKey, EditablePartRow[]> => {
  let counter = 0;
  const result: Record<SectionKey, EditablePartRow[]> = {} as Record<SectionKey, EditablePartRow[]>;
  ORDERED_SECTIONS.forEach((sectionKey) => {
    result[sectionKey] = sections[sectionKey].map((part) => ({ ...part, order: counter++ }));
  });
  return result;
};

const determineSection = (part: Participation, songSections: Record<string, SectionKey>): SectionKey => {
  switch (part.type) {
    case ParticipationType.CANTICO:
      return songSections[part.id] ?? 'transition';
    case ParticipationType.PRESIDENTE:
    case ParticipationType.ORACAO_INICIAL:
      return 'opening';
    case ParticipationType.ORACAO_FINAL:
    case ParticipationType.COMENTARIOS_FINAIS:
      return 'closing';
    case ParticipationType.TESOUROS:
      return 'treasures';
    case ParticipationType.MINISTERIO:
      return 'ministry';
    case ParticipationType.VIDA_CRISTA:
    case ParticipationType.DIRIGENTE:
      return 'life';
    default:
      return 'opening';
  }
};

const isSongType = (type: ParticipationType) => type === ParticipationType.CANTICO;
const isPrayerType = (type: ParticipationType) => type === ParticipationType.ORACAO_INICIAL || type === ParticipationType.ORACAO_FINAL;

const requiresHelper = (row: EditablePartRow) => {
  if (row.type === ParticipationType.DIRIGENTE) return true;
  if (row.type !== ParticipationType.MINISTERIO) return false;
  return !row.partTitle.toLowerCase().includes('discurso');
};

const helperLabel = (row: EditablePartRow) => (row.type === ParticipationType.DIRIGENTE ? 'Leitor' : 'Ajudante');

const MeetingScheduleForm: React.FC<MeetingScheduleFormProps> = ({
  isOpen,
  onClose,
  onSave,
  scheduleToEdit,
  publishers,
  specialEvents,
  eventTemplates,
}) => {
  const [sections, setSections] = useState<Record<SectionKey, EditablePartRow[]>>(createEmptySections());
  const [weekLabel, setWeekLabel] = useState('');

  const eventForWeek = useMemo(() => {
    if (!scheduleToEdit) return null;
    return specialEvents.find((event) => event.week === scheduleToEdit.week) ?? null;
  }, [scheduleToEdit, specialEvents]);

  const publisherNames = useMemo(() => publishers.map((p) => p.name).sort((a, b) => a.localeCompare(b)), [publishers]);

  useEffect(() => {
    if (!scheduleToEdit) {
      setSections(createEmptySections());
      setWeekLabel('');
      return;
    }

    setWeekLabel(scheduleToEdit.week);
    const initialSections = createEmptySections();

    const annotated = scheduleToEdit.parts.map((part, index) => ({ part, index }));
    annotated.sort((a, b) => {
      const orderA = typeof a.part.order === 'number' ? a.part.order : Number.MAX_SAFE_INTEGER;
      const orderB = typeof b.part.order === 'number' ? b.part.order : Number.MAX_SAFE_INTEGER;
      if (orderA !== orderB) return orderA - orderB;
      return a.index - b.index;
    });
    const sortedParts = annotated.map((item) => item.part);

    const songSections: Record<string, SectionKey> = {};
    const songs = sortedParts.filter((part) => part.type === ParticipationType.CANTICO);
    songs.forEach((song, index) => {
      if (index === 0) songSections[song.id] = 'opening';
      else if (index === 1) songSections[song.id] = 'transition';
      else songSections[song.id] = 'closing';
    });

    const helperPool = sortedParts.filter((part) => part.type === ParticipationType.AJUDANTE);
    const readerPool = sortedParts.filter((part) => part.type === ParticipationType.LEITOR);
    const usedHelperIds = new Set<string>();
    const usedReaderIds = new Set<string>();

    sortedParts.forEach((part) => {
      if (part.type === ParticipationType.AJUDANTE || part.type === ParticipationType.LEITOR) {
        return;
      }

      const section = determineSection(part, songSections);
      const row: EditablePartRow = {
        id: part.id,
        partTitle: part.partTitle,
        publisherName: part.publisherName,
        type: part.type,
        section,
        order: part.order ?? Number.MAX_SAFE_INTEGER,
        duration: part.duration,
        partNumber: typeof part.partNumber === 'number' ? part.partNumber : null,
        helperId: null,
        helperName: '',
        helperType: undefined,
        isSong: isSongType(part.type),
        isPrayer: isPrayerType(part.type),
      };

      if (part.type === ParticipationType.MINISTERIO && !part.partTitle.toLowerCase().includes('discurso')) {
        const helper = helperPool.find((h) => !usedHelperIds.has(h.id));
        if (helper) {
          row.helperId = helper.id;
          row.helperName = helper.publisherName;
          row.helperType = ParticipationType.AJUDANTE;
          usedHelperIds.add(helper.id);
        }
      } else if (part.type === ParticipationType.DIRIGENTE) {
        const reader = readerPool.find((r) => !usedReaderIds.has(r.id));
        if (reader) {
          row.helperId = reader.id;
          row.helperName = reader.publisherName;
          row.helperType = ParticipationType.LEITOR;
          usedReaderIds.add(reader.id);
        }
      }

      initialSections[section].push(row);
    });

    if (eventForWeek) {
      initialSections.life.push({
        id: eventForWeek.id,
        partTitle: eventForWeek.theme,
        publisherName: eventForWeek.assignedTo,
        type: ParticipationType.VIDA_CRISTA,
        section: 'life',
        order: Number.MAX_SAFE_INTEGER,
        isSpecialEvent: true,
        specialEventMeta: { id: eventForWeek.id, templateId: eventForWeek.templateId },
      });
    }

    setSections(assignSequentialOrders(initialSections));
  }, [scheduleToEdit, eventForWeek]);

  const updateSection = (sectionKey: SectionKey, updater: (parts: EditablePartRow[]) => EditablePartRow[]) => {
    setSections((prev) => assignSequentialOrders({ ...prev, [sectionKey]: updater(prev[sectionKey]) }));
  };

  const handleFieldChange = <K extends keyof EditablePartRow>(sectionKey: SectionKey, partId: string, field: K, value: EditablePartRow[K]) => {
    updateSection(sectionKey, (parts) =>
      parts.map((part) => {
        if (part.id !== partId) return part;
        const updated: EditablePartRow = { ...part, [field]: value };

        if (field === 'type') {
          const castedValue = value as ParticipationType;
          updated.isSong = isSongType(castedValue);
          updated.isPrayer = isPrayerType(castedValue);
          if (castedValue === ParticipationType.DIRIGENTE) {
            updated.helperType = ParticipationType.LEITOR;
          } else if (castedValue === ParticipationType.MINISTERIO) {
            updated.helperType = ParticipationType.AJUDANTE;
          } else {
            updated.helperType = undefined;
            updated.helperName = '';
            updated.helperId = null;
          }
        }

        return updated;
      })
    );
  };

  const handleHelperChange = (sectionKey: SectionKey, partId: string, value: string) => {
    updateSection(sectionKey, (parts) =>
      parts.map((part) => {
        if (part.id !== partId) return part;
        return { ...part, helperName: value, helperId: value ? part.helperId : null };
      })
    );
  };

  const handleAddPart = (sectionKey: SectionKey) => {
    const defaultType = SECTION_DEFAULT_TYPE[sectionKey];
    const newPart: EditablePartRow = {
      id: generateUUID(),
      partTitle: '',
      publisherName: '',
      type: defaultType,
      section: sectionKey,
      order: Number.MAX_SAFE_INTEGER,
      duration: undefined,
      partNumber: SECTION_SUPPORTS_PART_NUMBER[sectionKey] ? null : undefined,
      helperId: null,
      helperName: '',
      helperType: defaultType === ParticipationType.DIRIGENTE ? ParticipationType.LEITOR : defaultType === ParticipationType.MINISTERIO ? ParticipationType.AJUDANTE : undefined,
      isSong: isSongType(defaultType),
      isPrayer: isPrayerType(defaultType),
    };

    updateSection(sectionKey, (parts) => [...parts, newPart]);
  };

  const handleRemovePart = (sectionKey: SectionKey, partId: string) => {
    updateSection(sectionKey, (parts) => parts.filter((part) => part.id !== partId));
  };

  const handleMovePart = (sectionKey: SectionKey, partId: string, direction: -1 | 1) => {
    updateSection(sectionKey, (parts) => {
      const cloned = [...parts];
      const index = cloned.findIndex((part) => part.id === partId);
      const targetIndex = index + direction;
      if (index === -1 || targetIndex < 0 || targetIndex >= cloned.length) return parts;
      [cloned[index], cloned[targetIndex]] = [cloned[targetIndex], cloned[index]];
      return cloned;
    });
  };

  const flattenSections = () => ORDERED_SECTIONS.flatMap((sectionKey) => sections[sectionKey]);

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    if (!scheduleToEdit) return;

    const trimmedWeek = weekLabel.trim() || scheduleToEdit.week;
    const meetingDate = calculatePartDate(trimmedWeek);
    const flatRows = flattenSections();

    for (const row of flatRows) {
      if (row.isSpecialEvent) continue;
      if (!row.partTitle.trim()) {
        alert(`Informe o título da parte na seção "${SECTION_LABELS[row.section]}".`);
        return;
      }
      const requiresPublisher = row.type !== ParticipationType.CANTICO;
      if (requiresPublisher && !row.publisherName.trim()) {
        alert(`Informe o titular da parte "${row.partTitle}".`);
        return;
      }
      if (requiresHelper(row) && !row.helperName?.trim()) {
        alert(`Informe o ${helperLabel(row).toLowerCase()} da parte "${row.partTitle}".`);
        return;
      }
    }

    const newParts: Participation[] = [];
    flatRows.forEach((row) => {
      if (row.isSpecialEvent) return;

      const basePart: Participation = {
        id: row.id,
        publisherName: row.publisherName,
        week: trimmedWeek,
        date: meetingDate,
        partTitle: row.partTitle,
        type: row.type,
        duration: typeof row.duration === 'number' ? row.duration : undefined,
        order: row.order,
        partNumber: typeof row.partNumber === 'number' ? row.partNumber : undefined,
      };
      newParts.push(basePart);

      if (requiresHelper(row) && row.helperName) {
        const helperPart: Participation = {
          id: row.helperId ?? generateUUID(),
          publisherName: row.helperName,
          week: trimmedWeek,
          date: meetingDate,
          partTitle: row.type === ParticipationType.DIRIGENTE ? 'Leitor do EBC' : 'Ajudante',
          type: row.type === ParticipationType.DIRIGENTE ? ParticipationType.LEITOR : ParticipationType.AJUDANTE,
          order: row.order + 0.1,
        };
        newParts.push(helperPart);
      }
    });

    const existingIds = new Set(scheduleToEdit.parts.map((part) => part.id));
    const newIds = new Set(newParts.map((part) => part.id));
    const deletedPartIds = Array.from(existingIds).filter((id) => !newIds.has(id));

    let eventToUpdate: SpecialEvent | undefined;
    const specialEventRow = flatRows.find((row) => row.isSpecialEvent);
    if (eventForWeek && specialEventRow) {
      if (
        eventForWeek.assignedTo !== specialEventRow.publisherName ||
        eventForWeek.theme !== specialEventRow.partTitle ||
        eventForWeek.week !== trimmedWeek
      ) {
        eventToUpdate = {
          ...eventForWeek,
          assignedTo: specialEventRow.publisherName,
          theme: specialEventRow.partTitle,
          week: trimmedWeek,
        };
      } else if (trimmedWeek !== eventForWeek.week) {
        eventToUpdate = { ...eventForWeek, week: trimmedWeek };
      }
    } else if (eventForWeek && trimmedWeek !== eventForWeek.week) {
      eventToUpdate = { ...eventForWeek, week: trimmedWeek };
    }

    onSave({
      parts: newParts,
      deletedPartIds,
      eventToUpdate,
      updatedWeek: trimmedWeek,
      originalWeek: scheduleToEdit.week,
    });
    onClose();
  };

  if (!isOpen || !scheduleToEdit) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-60 z-50 flex justify-center items-center" onClick={onClose}>
      <div
        className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-5xl m-4 flex flex-col"
        style={{ maxHeight: '92vh' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-6 pb-4 border-b border-gray-200 dark:border-gray-700 space-y-4">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100">Editar Pauta - {scheduleToEdit.week}</h2>
            <span className="text-sm text-gray-500 dark:text-gray-400">Total de partes: {flattenSections().filter((row) => !row.isSpecialEvent).length}</span>
          </div>
          <div>
            <label htmlFor="week-field" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
              Semana
            </label>
            <input
              id="week-field"
              type="text"
              value={weekLabel}
              onChange={(e) => setWeekLabel(e.target.value)}
              className="mt-1 block w-full px-3 py-2 bg-white border border-gray-300 dark:border-gray-600 rounded-md shadow-sm placeholder-gray-500 focus:outline-none focus:ring-indigo-600 focus:border-indigo-600 sm:text-sm text-black"
              placeholder="Ex.: 3-9 de FEV, 2025"
            />
          </div>
        </div>

        <form onSubmit={handleSubmit} className="flex-grow flex flex-col overflow-hidden">
          <div className="p-6 flex-grow overflow-y-auto space-y-6">
            {ORDERED_SECTIONS.map((sectionKey) => (
              <section key={sectionKey}>
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-100">{SECTION_LABELS[sectionKey]}</h3>
                  <button
                    type="button"
                    onClick={() => handleAddPart(sectionKey)}
                    className="text-sm px-3 py-1 rounded-md border border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700"
                  >
                    Adicionar parte
                  </button>
                </div>
                {sections[sectionKey].length === 0 ? (
                  <p className="text-sm italic text-gray-500">Nenhuma parte cadastrada nesta seção.</p>
                ) : (
                  <div className="space-y-3">
                    {sections[sectionKey].map((part, index) => {
                      const templateName = part.specialEventMeta
                        ? eventTemplates.find((tpl) => tpl.id === part.specialEventMeta?.templateId)?.name
                        : undefined;
                      const helperRequired = requiresHelper(part);
                      return (
                        <div key={part.id} className="rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/40 p-4 space-y-3">
                          <div className="flex items-center justify-between flex-wrap gap-2">
                            <div className="inline-flex items-center space-x-2">
                              <span className="text-sm font-semibold text-gray-600 dark:text-gray-300">Parte #{index + 1}</span>
                              {part.isSpecialEvent && (
                                <span className="text-xs px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-800 dark:bg-indigo-900 dark:text-indigo-200">
                                  Evento especial {templateName ? `- ${templateName}` : ''}
                                </span>
                              )}
                            </div>
                            <div className="flex items-center space-x-1">
                              <button
                                type="button"
                                onClick={() => handleMovePart(sectionKey, part.id, -1)}
                                disabled={index === 0}
                                className="px-2 py-1 text-xs rounded border border-gray-300 dark:border-gray-600 disabled:opacity-50"
                              >
                                ↑
                              </button>
                              <button
                                type="button"
                                onClick={() => handleMovePart(sectionKey, part.id, 1)}
                                disabled={index === sections[sectionKey].length - 1}
                                className="px-2 py-1 text-xs rounded border border-gray-300 dark:border-gray-600 disabled:opacity-50"
                              >
                                ↓
                              </button>
                              {!part.isSpecialEvent && (
                                <button
                                  type="button"
                                  onClick={() => handleRemovePart(sectionKey, part.id)}
                                  className="px-2 py-1 text-xs rounded border border-red-300 text-red-600 hover:bg-red-50 dark:border-red-600 dark:text-red-300"
                                >
                                  Remover
                                </button>
                              )}
                            </div>
                          </div>

                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="space-y-3">
                              <div>
                                <label className="block text-xs font-medium text-gray-600 dark:text-gray-400">Tipo</label>
                                <select
                                  value={part.type}
                                  disabled={part.isSpecialEvent}
                                  onChange={(e) => handleFieldChange(sectionKey, part.id, 'type', e.target.value as ParticipationType)}
                                  className="mt-1 block w-full px-3 py-2 bg-white border border-gray-300 dark:border-gray-600 rounded-md text-sm text-black"
                                >
                                  {SECTION_TYPE_OPTIONS[sectionKey].map((option) => (
                                    <option key={option.value} value={option.value}>
                                      {option.label}
                                    </option>
                                  ))}
                                </select>
                              </div>

                              {SECTION_SUPPORTS_PART_NUMBER[sectionKey] && (
                                <div>
                                  <label className="block text-xs font-medium text-gray-600 dark:text-gray-400">Número</label>
                                  <input
                                    type="number"
                                    min={1}
                                    value={part.partNumber ?? ''}
                                    onChange={(e) =>
                                      handleFieldChange(
                                        sectionKey,
                                        part.id,
                                        'partNumber',
                                        e.target.value ? Number(e.target.value) : null
                                      )
                                    }
                                    className="mt-1 block w-full px-3 py-2 bg-white border border-gray-300 dark:border-gray-600 rounded-md text-sm text-black"
                                    placeholder="Ex.: 1"
                                  />
                                </div>
                              )}

                              <div>
                                <label className="block text-xs font-medium text-gray-600 dark:text-gray-400">Título da parte</label>
                                <input
                                  type="text"
                                  value={part.partTitle}
                                  onChange={(e) => handleFieldChange(sectionKey, part.id, 'partTitle', e.target.value)}
                                  className="mt-1 block w-full px-3 py-2 bg-white border border-gray-300 dark:border-gray-600 rounded-md text-sm text-black"
                                  placeholder="Descrição exibida na pauta"
                                  required
                                />
                              </div>

                              <div>
                                <label className="block text-xs font-medium text-gray-600 dark:text-gray-400">Duração (min)</label>
                                <input
                                  type="number"
                                  min={0}
                                  value={part.duration ?? ''}
                                  onChange={(e) =>
                                    handleFieldChange(
                                      sectionKey,
                                      part.id,
                                      'duration',
                                      e.target.value ? Number(e.target.value) : undefined
                                    )
                                  }
                                  className="mt-1 block w-full px-3 py-2 bg-white border border-gray-300 dark:border-gray-600 rounded-md text-sm text-black"
                                  placeholder="Opcional"
                                />
                              </div>
                            </div>

                            <div className="space-y-3">
                              <div>
                                <label className="block text-xs font-medium text-gray-600 dark:text-gray-400">
                                  Titular
                                </label>
                                <input
                                  type="text"
                                  value={part.publisherName}
                                  onChange={(e) => handleFieldChange(sectionKey, part.id, 'publisherName', e.target.value)}
                                  list="publisher-list"
                                  className="mt-1 block w-full px-3 py-2 bg-white border border-gray-300 dark:border-gray-600 rounded-md text-sm text-black"
                                  placeholder={part.isSong ? 'Opcional para cânticos' : 'Nome do publicador'}
                                  required={!part.isSong}
                                />
                              </div>

                              {(helperRequired || part.helperName) && (
                                <div>
                                  <label className="block text-xs font-medium text-gray-600 dark:text-gray-400">
                                    {helperLabel(part)}
                                  </label>
                                  <input
                                    type="text"
                                    value={part.helperName ?? ''}
                                    onChange={(e) => handleHelperChange(sectionKey, part.id, e.target.value)}
                                    list="publisher-list"
                                    className="mt-1 block w-full px-3 py-2 bg-white border border-gray-300 dark:border-gray-600 rounded-md text-sm text-black"
                                    placeholder={helperRequired ? 'Obrigatório' : 'Opcional'}
                                    required={helperRequired}
                                  />
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </section>
            ))}
          </div>

          <datalist id="publisher-list">
            {publisherNames.map((name) => (
              <option key={name} value={name} />
            ))}
          </datalist>

          <div className="p-6 pt-4 border-t border-gray-200 dark:border-gray-700 flex-shrink-0 flex justify-end space-x-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-200 bg-white dark:bg-gray-600 border border-gray-300 dark:border-gray-500 rounded-md shadow-sm hover:bg-gray-50 dark:hover:bg-gray-500 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 border border-transparent rounded-md shadow-sm hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
            >
              Salvar alterações
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default MeetingScheduleForm;
