
import React, { useMemo, useState } from 'react';
import { Publisher, Participation, PublisherStats, ParticipationType } from '../types';
import { ChartBarIcon, UserCircleIcon, TrashIcon } from './icons';
import { calculatePartDate } from '../lib/utils';

interface StatisticsDashboardProps {
  publishers: Publisher[];
  participations: Participation[];
}

// --- Interfaces ---
interface MonthData {
    monthLabel: string;
    totalParts: number;
    forgottenCount: number;
    inactiveCount: number;
    topPublishers: { name: string; count: number }[];
    leastPublishers: { name: string; count: number }[]; // NOVO: Lista de quem menos participou
}

// --- Helpers de SVG ---
const getCoordinatesForPercent = (percent: number) => {
  const x = Math.cos(2 * Math.PI * percent);
  const y = Math.sin(2 * Math.PI * percent);
  return [x, y];
};

// --- Gráfico de Rosca (Donut) - Distribuição por Tipo ---
const DistributionDonutChart: React.FC<{ participations: Participation[] }> = ({ participations }) => {
    const data = useMemo(() => {
        const counts = {
            [ParticipationType.TESOUROS]: 0,
            [ParticipationType.MINISTERIO]: 0,
            [ParticipationType.VIDA_CRISTA]: 0,
        };
        let total = 0;

        participations.forEach(p => {
            // Agrupar tipos similares
            if (p.type === ParticipationType.TESOUROS) { counts[ParticipationType.TESOUROS]++; total++; }
            else if (p.type === ParticipationType.MINISTERIO) { counts[ParticipationType.MINISTERIO]++; total++; }
            else if (p.type === ParticipationType.VIDA_CRISTA || p.type === ParticipationType.DIRIGENTE) { counts[ParticipationType.VIDA_CRISTA]++; total++; }
        });

        return { counts, total };
    }, [participations]);

    if (data.total === 0) return <div className="h-full flex items-center justify-center text-gray-400 text-xs">Sem dados</div>;

    let cumulativePercent = 0;
    const slices = [
        { type: ParticipationType.TESOUROS, color: '#4A5568', label: 'Tesouros' }, 
        { type: ParticipationType.MINISTERIO, color: '#D69E2E', label: 'Ministério' }, 
        { type: ParticipationType.VIDA_CRISTA, color: '#C53030', label: 'Vida Cristã' }, 
    ].map(slice => {
        const count = data.counts[slice.type as keyof typeof data.counts];
        const percent = count / data.total;
        if (percent === 0) return null;

        const [startX, startY] = getCoordinatesForPercent(cumulativePercent);
        cumulativePercent += percent;
        const [endX, endY] = getCoordinatesForPercent(cumulativePercent);
        const largeArcFlag = percent > 0.5 ? 1 : 0;

        const pathData = [
            `M ${startX} ${startY}`,
            `A 1 1 0 ${largeArcFlag} 1 ${endX} ${endY}`,
            `L 0 0`,
        ].join(' ');

        return { ...slice, pathData, percent, count };
    }).filter(Boolean);

    return (
        <div className="flex flex-col items-center justify-center h-full w-full">
            <div className="w-24 h-24 sm:w-32 sm:h-32 relative mb-2">
                <svg viewBox="-1 -1 2 2" className="transform -rotate-90 w-full h-full overflow-visible">
                    {slices.map((slice, i) => (
                        <path key={i} d={slice!.pathData} fill={slice!.color} stroke="white" strokeWidth="0.05" />
                    ))}
                    <circle cx="0" cy="0" r="0.6" fill="currentColor" className="text-white dark:text-gray-800" />
                </svg>
                <div className="absolute inset-0 flex items-center justify-center flex-col pointer-events-none">
                    <span className="text-lg font-bold text-gray-700 dark:text-gray-200">{data.total}</span>
                    <span className="text-[10px] text-gray-500 uppercase">Partes</span>
                </div>
            </div>
            <div className="flex flex-wrap justify-center gap-x-3 gap-y-1 text-[10px] sm:text-xs w-full px-2">
                {slices.map((slice, i) => (
                    <div key={i} className="flex items-center gap-1 mb-1">
                        <span className="w-2 h-2 rounded-full" style={{ backgroundColor: slice!.color }}></span>
                        <span className="text-gray-600 dark:text-gray-300 font-medium">{slice!.label}:</span>
                        <span className="font-bold text-gray-800 dark:text-gray-100">{slice!.count}</span>
                        <span className="text-gray-400">({Math.round(slice!.percent * 100)}%)</span>
                    </div>
                ))}
            </div>
        </div>
    );
};

// --- Gráfico de Colunas (Barras) - Por Condição ---
const ConditionBarChart: React.FC<{ publishers: Publisher[], participations: Participation[] }> = ({ publishers, participations }) => {
    const data = useMemo(() => {
        const counts = { 'Ancião': 0, 'Servo Ministerial': 0, 'Publicador': 0 };
        const pubMap = new Map(publishers.map(p => [p.name, p.condition]));

        participations.forEach(p => {
            const condition = pubMap.get(p.publisherName);
            if (condition && counts[condition as keyof typeof counts] !== undefined) {
                counts[condition as keyof typeof counts]++;
            }
        });

        return [
            { label: 'Ancião', value: counts['Ancião'], color: '#3B82F6' }, 
            { label: 'Servo Min.', value: counts['Servo Ministerial'], color: '#10B981' }, 
            { label: 'Publicador', value: counts['Publicador'], color: '#6366F1' }, 
        ];
    }, [publishers, participations]);

    const maxValue = Math.max(...data.map(d => d.value), 1);

    return (
        <div className="w-full h-full flex items-end justify-around gap-2 sm:gap-4 pt-6 pb-2 px-2 sm:px-4">
            {data.map((d) => {
                const heightPercent = (d.value / maxValue) * 100;
                return (
                    <div key={d.label} className="flex flex-col items-center flex-1 group h-full justify-end">
                        <span className="text-xs font-bold text-gray-700 dark:text-gray-200 mb-1">{d.value}</span>
                        <div 
                            className="w-full max-w-[40px] rounded-t-md transition-all duration-500 ease-out hover:opacity-80"
                            style={{ height: `${heightPercent}%`, backgroundColor: d.color, minHeight: '4px' }}
                        ></div>
                        <span className="text-[10px] text-gray-500 dark:text-gray-400 mt-1 font-medium text-center truncate w-full" title={d.label}>{d.label.split(' ')[0]}</span>
                    </div>
                )
            })}
        </div>
    );
};


// --- Gráfico de Evolução Interativo ---
const EvolutionChart: React.FC<{ data: MonthData[] }> = ({ data }) => {
    const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

    if (!data || data.length === 0) return <div className="h-full flex items-center justify-center text-gray-400 text-sm">Sem dados de histórico</div>;

    // Escala Y ajustada para incluir inativos
    const maxVal = Math.max(
        ...data.map(d => d.totalParts), 
        ...data.map(d => d.forgottenCount), 
        ...data.map(d => d.inactiveCount),
        5
    );
    
    const height = 200;
    const width = 1000;
    const paddingX = 40;
    const paddingY = 30;
    
    const chartWidth = width - (paddingX * 2);
    const chartHeight = height - (paddingY * 2);

    const getX = (index: number) => paddingX + (index / (data.length - 1 || 1)) * chartWidth;
    const getY = (val: number) => height - paddingY - (val / maxVal) * chartHeight;

    const pointsTotal = data.map((d, i) => `${getX(i)},${getY(d.totalParts)}`).join(' ');
    const pointsForgotten = data.map((d, i) => `${getX(i)},${getY(d.forgottenCount)}`).join(' ');
    const pointsInactive = data.map((d, i) => `${getX(i)},${getY(d.inactiveCount)}`).join(' ');

    return (
        <div className="w-full h-full relative group select-none">
            {/* Legend */}
            <div className="absolute top-0 right-0 flex flex-wrap justify-end gap-x-4 gap-y-1 text-xs bg-white/90 dark:bg-gray-800/90 p-1 rounded z-10">
                <div className="flex items-center"><span className="w-2 h-2 rounded-full bg-indigo-600 mr-1"></span> Partes</div>
                <div className="flex items-center"><span className="w-2 h-2 rounded-full bg-red-500 mr-1"></span> Esquecidos</div>
                <div className="flex items-center"><span className="w-2 h-2 rounded-full bg-gray-400 mr-1"></span> Não Atuantes</div>
            </div>

            <svg viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none" className="w-full h-full overflow-visible">
                {/* Grid Lines */}
                <line x1={paddingX} y1={getY(0)} x2={width - paddingX} y2={getY(0)} stroke="#e5e7eb" strokeWidth="1" />
                <line x1={paddingX} y1={getY(maxVal/2)} x2={width - paddingX} y2={getY(maxVal/2)} stroke="#e5e7eb" strokeWidth="1" strokeDasharray="4 4" />
                <line x1={paddingX} y1={getY(maxVal)} x2={width - paddingX} y2={getY(maxVal)} stroke="#e5e7eb" strokeWidth="1" strokeDasharray="4 4" />

                {/* Line: Inactive (Gray) */}
                <polyline points={pointsInactive} fill="none" stroke="#9CA3AF" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" strokeDasharray="5 5" />

                {/* Line: Forgotten (Red) */}
                <polyline points={pointsForgotten} fill="none" stroke="#EF4444" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />

                {/* Line: Total (Indigo) */}
                <polyline points={pointsTotal} fill="none" stroke="#4F46E5" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" className="drop-shadow-md" />
                
                {/* Fill Area Total */}
                <path d={`${pointsTotal} L ${getX(data.length - 1)},${getY(0)} L ${getX(0)},${getY(0)} Z`} fill="url(#gradientTotal)" opacity="0.1" />
                
                <defs>
                    <linearGradient id="gradientTotal" x1="0" x2="0" y1="0" y2="1">
                        <stop offset="0%" stopColor="#4F46E5" />
                        <stop offset="100%" stopColor="#4F46E5" stopOpacity="0" />
                    </linearGradient>
                </defs>

                {/* Points & Interactions */}
                {data.map((d, i) => (
                    <g key={i} 
                       onMouseEnter={() => setHoveredIndex(i)} 
                       onMouseLeave={() => setHoveredIndex(null)}
                       onTouchStart={() => setHoveredIndex(i)}
                       className="cursor-pointer"
                    >
                        <rect x={getX(i) - 20} y={0} width={40} height={height} fill="transparent" />
                        
                        {/* Dot Total */}
                        <circle cx={getX(i)} cy={getY(d.totalParts)} r={hoveredIndex === i ? 6 : 4} fill={hoveredIndex === i ? "#ffffff" : "#4F46E5"} stroke="#4F46E5" strokeWidth={hoveredIndex === i ? 3 : 0} className="transition-all duration-200"/>

                        {/* Dot Forgotten */}
                        <circle cx={getX(i)} cy={getY(d.forgottenCount)} r={hoveredIndex === i ? 5 : 3} fill={hoveredIndex === i ? "#ffffff" : "#EF4444"} stroke="#EF4444" strokeWidth={hoveredIndex === i ? 2 : 0} className="transition-all duration-200"/>

                        {/* Dot Inactive */}
                        <circle cx={getX(i)} cy={getY(d.inactiveCount)} r={3} fill="#9CA3AF" />
                        
                        <text x={getX(i)} y={height - 5} textAnchor="middle" className={`text-xs fill-gray-500 dark:fill-gray-400 ${hoveredIndex === i ? 'font-bold fill-indigo-600 dark:fill-indigo-400' : ''}`} style={{fontSize: '14px'}}>
                            {d.monthLabel}
                        </text>
                    </g>
                ))}
            </svg>

            {/* Tooltip Avançado: Duas Colunas (Mais vs Menos) */}
            {hoveredIndex !== null && data[hoveredIndex] && (
                <div 
                    className="absolute z-20 bg-white dark:bg-gray-800 p-4 rounded-lg shadow-2xl border border-gray-200 dark:border-gray-600 pointer-events-none w-96 animate-fade-in"
                    style={{ 
                        left: '50%', 
                        top: '0', 
                        transform: 'translate(-50%, 10%)' 
                    }}
                >
                    <h4 className="text-sm font-bold text-gray-900 dark:text-gray-100 border-b border-gray-200 dark:border-gray-600 pb-2 mb-2">
                        {data[hoveredIndex].monthLabel}
                    </h4>
                    
                    {/* Resumo do Mês */}
                    <div className="flex justify-between text-xs mb-4 bg-gray-50 dark:bg-gray-700/50 p-2 rounded">
                        <div className="text-center">
                            <span className="block font-bold text-indigo-600 dark:text-indigo-400 text-lg">{data[hoveredIndex].totalParts}</span>
                            <span className="text-gray-500">Partes</span>
                        </div>
                        <div className="text-center">
                            <span className="block font-bold text-red-600 dark:text-red-400 text-lg">{data[hoveredIndex].forgottenCount}</span>
                            <span className="text-gray-500">Esquecidos</span>
                        </div>
                        <div className="text-center">
                            <span className="block font-bold text-gray-500 dark:text-gray-400 text-lg">{data[hoveredIndex].inactiveCount}</span>
                            <span className="text-gray-500">Inativos</span>
                        </div>
                    </div>

                    {/* Colunas de Listas */}
                    <div className="grid grid-cols-2 gap-4">
                        {/* Coluna 1: Mais Participaram */}
                        <div>
                            <p className="text-[10px] font-bold text-indigo-600 dark:text-indigo-400 mb-2 uppercase border-b border-indigo-200 pb-1">Mais Participaram</p>
                            <ul className="space-y-1">
                                {data[hoveredIndex].topPublishers.length > 0 ? (
                                    data[hoveredIndex].topPublishers.map((pub, idx) => (
                                        <li key={idx} className="flex justify-between text-xs items-center">
                                            <span className="text-gray-700 dark:text-gray-300 truncate w-24">
                                                {idx + 1}. {pub.name.split(' ')[0]} {pub.name.split(' ')[1]?.[0]}.
                                            </span>
                                            <span className="font-bold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-900/50 px-1.5 rounded-full text-[10px]">
                                                {pub.count}
                                            </span>
                                        </li>
                                    ))
                                ) : (
                                    <li className="text-[10px] text-gray-500 italic">Sem dados.</li>
                                )}
                            </ul>
                        </div>

                        {/* Coluna 2: Menos Participaram */}
                        <div>
                            <p className="text-[10px] font-bold text-orange-600 dark:text-orange-400 mb-2 uppercase border-b border-orange-200 pb-1">Menos Participaram</p>
                            <ul className="space-y-1">
                                {data[hoveredIndex].leastPublishers.length > 0 ? (
                                    data[hoveredIndex].leastPublishers.map((pub, idx) => (
                                        <li key={idx} className="flex justify-between text-xs items-center">
                                            <span className="text-gray-700 dark:text-gray-300 truncate w-24">
                                                {pub.name.split(' ')[0]} {pub.name.split(' ')[1]?.[0]}.
                                            </span>
                                            <span className="font-bold text-orange-600 dark:text-orange-400 bg-orange-50 dark:bg-orange-900/50 px-1.5 rounded-full text-[10px]">
                                                {pub.count}
                                            </span>
                                        </li>
                                    ))
                                ) : (
                                    <li className="text-[10px] text-gray-500 italic">Todos participaram igual.</li>
                                )}
                            </ul>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

// --- Componente StatCard ---

const StatCard: React.FC<{ title: string; value: string | number; icon?: React.ReactNode; subtext?: string; colorClass?: string }> = ({ title, value, icon, subtext, colorClass = "border-indigo-500" }) => (
    <div className={`bg-white dark:bg-gray-800 p-4 rounded-lg shadow-sm flex items-center border-l-4 ${colorClass} h-full`}>
        {icon && <div className="p-3 rounded-full bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 mr-4">{icon}</div>}
        <div>
            <p className="text-sm text-gray-500 dark:text-gray-400 font-medium">{title}</p>
            <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">{value}</p>
            {subtext && <p className="text-xs text-gray-400">{subtext}</p>}
        </div>
    </div>
);

// --- Helpers de Cálculo ---

const isPublisherActive = (publisher: Publisher) => publisher.isServing ?? true;

const calculatePublisherStats = (publishers: Publisher[], participations: Participation[]): PublisherStats[] => {
    const publisherMap = new Map<string, Publisher>(publishers.map(p => [p.name, p]));
    const participationsByPublisher = new Map<string, Participation[]>();

    for (const part of participations) {
        if (publisherMap.has(part.publisherName)) {
            const pubId = publisherMap.get(part.publisherName)!.id;
            if (!participationsByPublisher.has(pubId)) {
                participationsByPublisher.set(pubId, []);
            }
            participationsByPublisher.get(pubId)!.push(part);
        }
    }

    return publishers.filter(isPublisherActive).map(p => {
        const publisherParts = participationsByPublisher.get(p.id) || [];
        
        let countTreasures = 0;
        let countMinistry = 0;
        let countLife = 0;
        let countPresidency = 0;

        publisherParts.forEach(part => {
            if (part.type === ParticipationType.TESOUROS) countTreasures++;
            else if (part.type === ParticipationType.MINISTERIO) countMinistry++;
            else if (part.type === ParticipationType.VIDA_CRISTA || part.type === ParticipationType.DIRIGENTE) countLife++;
            else if (part.type === ParticipationType.PRESIDENTE) countPresidency++;
        });

        const stat: PublisherStats = {
            publisherId: p.id,
            publisherName: p.name,
            totalAssignments: publisherParts.length,
            countTreasures,
            countMinistry,
            countLife,
            countPresidency,
            lastAssignmentDate: null,
            lastAssignmentWeek: null,
            avgDaysBetweenAssignments: null,
        };

        if (publisherParts.length > 0) {
            const sortedParts = [...publisherParts].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
            stat.lastAssignmentDate = sortedParts[0].date;
            stat.lastAssignmentWeek = sortedParts[0].week;

            if (publisherParts.length > 1) {
                const dates = sortedParts.map(part => new Date(part.date).getTime()).reverse(); 
                const diffsInDays = [];
                for (let i = 1; i < dates.length; i++) {
                    const diffMillis = dates[i] - dates[i-1];
                    if (diffMillis > 0) {
                       diffsInDays.push(diffMillis / (1000 * 60 * 60 * 24));
                    }
                }
                if (diffsInDays.length > 0) {
                    const totalDiff = diffsInDays.reduce((sum, diff) => sum + diff, 0);
                    stat.avgDaysBetweenAssignments = Math.round(totalDiff / diffsInDays.length);
                }
            }
        }
        return stat;
    });
};

// --- Main Component ---

const StatisticsDashboard: React.FC<StatisticsDashboardProps> = ({ publishers, participations }) => {
    const [sortKey, setSortKey] = useState<keyof PublisherStats>('lastAssignmentDate');
    const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
    const [searchTerm, setSearchTerm] = useState('');

    const publisherStats = useMemo(() => calculatePublisherStats(publishers, participations), [publishers, participations]);

    // Counts for Summary
    const totalPublishers = publishers.length;
    const activePublishers = publishers.filter(isPublisherActive).length;
    const inactivePublishers = totalPublishers - activePublishers;

    // --- Lógica de Evolução (ROBUSTA para Datas) ---
    const evolutionData: MonthData[] = useMemo(() => {
        const months: MonthData[] = [];
        const today = new Date();
        
        let latestDate = today;
        if (participations.length > 0) {
             // Tenta extrair datas válidas
             const validDates = participations
                .map(p => {
                    let d = new Date(p.date);
                    if(isNaN(d.getTime())) d = new Date(calculatePartDate(p.week));
                    return d.getTime();
                })
                .filter(t => !isNaN(t));
             
             if (validDates.length > 0) {
                 latestDate = new Date(Math.max(...validDates));
             }
        }
        
        const referenceDate = latestDate.getTime() < today.getTime() ? today : latestDate; 
        
        // Publicadores que DEVEM receber parte (Atuantes)
        const activePublisherNames = new Set(publishers.filter(isPublisherActive).map(p => p.name));
        
        // Número de inativos (Constante para o gráfico atual, pois não temos histórico de status)
        const currentInactiveCount = publishers.filter(p => !isPublisherActive(p)).length;

        for (let i = 5; i >= 0; i--) {
            const d = new Date(referenceDate.getFullYear(), referenceDate.getMonth() - i, 1);
            const monthLabel = d.toLocaleString('pt-BR', { month: 'short' }).toUpperCase();
            
            const partsInMonth = participations.filter(p => {
                let pDate = new Date(p.date);
                if (isNaN(pDate.getTime())) {
                    const isoDate = calculatePartDate(p.week);
                    pDate = new Date(isoDate);
                }

                if (isNaN(pDate.getTime())) return false;
                return pDate.getMonth() === d.getMonth() && pDate.getFullYear() === d.getFullYear();
            });

            const counts: Record<string, number> = {};
            const participantsInMonth = new Set<string>();

            partsInMonth.forEach(p => {
                 if (p.publisherName && p.publisherName !== 'N/A' && p.publisherName !== 'Não Designado' && !p.partTitle.toLowerCase().includes('cântico') && !p.partTitle.toLowerCase().includes('comentários finais')) {
                     if (!counts[p.publisherName]) counts[p.publisherName] = 0;
                     counts[p.publisherName]++;
                     participantsInMonth.add(p.publisherName);
                 }
            });

            // Calcula Esquecidos (Atuantes - Participantes do Mês)
            let forgottenCount = 0;
            activePublisherNames.forEach(name => {
                if (!participantsInMonth.has(name)) {
                    forgottenCount++;
                }
            });

            const allParticipantsArray = Object.entries(counts).map(([name, count]) => ({ name, count }));

            // Top 5 (Mais Participaram)
            const topPublishers = [...allParticipantsArray]
                .sort((a, b) => b.count - a.count)
                .slice(0, 5);
            
            // Bottom 5 (Menos Participaram - mas participaram > 0)
            const leastPublishers = [...allParticipantsArray]
                .sort((a, b) => a.count - b.count)
                .slice(0, 5);

            months.push({
                monthLabel,
                totalParts: partsInMonth.length,
                forgottenCount,
                inactiveCount: currentInactiveCount,
                topPublishers,
                leastPublishers
            });
        }
        return months;
    }, [participations, publishers]);


    const sortedAndFilteredStats = useMemo(() => {
        const filtered = publisherStats.filter(stat => 
            stat.publisherName.toLowerCase().includes(searchTerm.toLowerCase())
        );

        return filtered.sort((a, b) => {
            const valA = a[sortKey];
            const valB = b[sortKey];

            if (sortKey === 'lastAssignmentDate' && sortOrder === 'asc') {
                if (valA === null && valB === null) return 0;
                if (valA === null) return -1; 
                if (valB === null) return 1;
            }
            if (valA === null && valB === null) return 0;
            if (valA === null) return 1;
            if (valB === null) return -1;

            if (valA > valB) return sortOrder === 'asc' ? 1 : -1;
            if (valA < valB) return sortOrder === 'asc' ? -1 : 1;
            return 0;
        });
    }, [publisherStats, searchTerm, sortKey, sortOrder]);

    const handleSort = (key: keyof PublisherStats) => {
        if (sortKey === key) {
            setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc');
        } else {
            setSortKey(key);
            setSortOrder(key.includes('count') || key === 'totalAssignments' ? 'desc' : 'asc');
        }
    };

    const getDateStatus = (dateString: string | null) => {
        if (!dateString) return { color: 'bg-green-100 text-green-800', label: 'Disponível (Nunca)' };
        
        const date = new Date(dateString);
        const today = new Date();
        const diffTime = Math.abs(today.getTime() - date.getTime());
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

        if (diffDays > 60) return { color: 'bg-green-100 text-green-800', label: 'Disponível (+60d)', days: diffDays };
        if (diffDays > 30) return { color: 'bg-yellow-100 text-yellow-800', label: 'Recente (30-60d)', days: diffDays };
        return { color: 'bg-red-100 text-red-800', label: 'Muito Recente (<30d)', days: diffDays };
    };
    
    const getSortIndicator = (key: keyof PublisherStats) => {
      if (sortKey !== key) return <span className="text-gray-300 ml-1 text-[10px]">⇅</span>;
      return sortOrder === 'asc' ? <span className="text-indigo-600 ml-1 text-[10px]">▲</span> : <span className="text-indigo-600 ml-1 text-[10px]">▼</span>;
    }

    return (
        <div className="space-y-6 animate-fade-in pb-12">
            {/* --- Top Section: Evolution & Breakdowns --- */}
            <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
                
                {/* 1. Evolution Chart (2/3 Width) */}
                <div className="xl:col-span-2 bg-white dark:bg-gray-800 p-6 rounded-lg shadow-sm border border-gray-100 dark:border-gray-700 h-96 flex flex-col">
                    <div className="flex justify-between items-center mb-4 flex-shrink-0">
                        <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Evolução Mensal & Campeões</h3>
                         <span className="text-xs text-gray-500 bg-gray-100 dark:bg-gray-700 px-2 py-1 rounded">Interativo (Passe o mouse)</span>
                    </div>
                    <div className="flex-grow w-full overflow-hidden relative">
                        <EvolutionChart data={evolutionData} />
                    </div>
                </div>

                {/* 2. Mini Charts (1/3 Width) */}
                <div className="xl:col-span-1 flex flex-col gap-6 h-96">
                    {/* Pie Chart */}
                    <div className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow-sm border border-gray-100 dark:border-gray-700 flex-1 flex flex-col overflow-hidden">
                        <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2 text-center">Distribuição por Tipo</h3>
                        <div className="flex-grow relative flex items-center justify-center">
                            <DistributionDonutChart participations={participations} />
                        </div>
                    </div>
                    
                    {/* Bar Chart */}
                     <div className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow-sm border border-gray-100 dark:border-gray-700 flex-1 flex flex-col overflow-hidden">
                        <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2 text-center">Participação por Cargo</h3>
                        <div className="flex-grow relative flex items-end justify-center">
                            <ConditionBarChart publishers={publishers} participations={participations} />
                        </div>
                    </div>
                </div>
            </div>

             {/* --- Summary Cards Row --- */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
                 <StatCard 
                    title="Total de Publicadores" 
                    value={totalPublishers} 
                    icon={<UserCircleIcon className="w-6 h-6"/>} 
                    colorClass="border-l-4 border-blue-500"
                    subtext={`${activePublishers} Atuantes • ${inactivePublishers} Não Atuantes`}
                />
                <StatCard 
                    title="Total de Designações" 
                    value={evolutionData.reduce((acc, curr) => acc + curr.totalParts, 0)} 
                    icon={<ChartBarIcon className="w-6 h-6"/>} 
                    colorClass="border-l-4 border-indigo-500"
                    subtext="Nos últimos 6 meses"
                />
                <StatCard 
                    title="Média por Publicador" 
                    value={(evolutionData.reduce((acc, curr) => acc + curr.totalParts, 0) / (activePublishers || 1)).toFixed(1)} 
                    subtext="Considerando atuantes nos últimos 6 meses"
                    colorClass="border-l-4 border-green-500"
                />
            </div>

            {/* --- Main Table --- */}
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden mt-6">
                 {/* Header & Search */}
                 <div className="p-5 border-b border-gray-200 dark:border-gray-700 flex flex-col md:flex-row justify-between items-center gap-4 bg-gray-50 dark:bg-gray-900/50">
                    <div>
                        <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100">Índice de Participação por Publicador</h3>
                        <p className="text-sm text-gray-500 dark:text-gray-400">Use esta tabela para selecionar o próximo participante.</p>
                    </div>
                    <div className="relative w-full md:w-1/3">
                         <input 
                            type="search" 
                            placeholder="Buscar publicador..." 
                            value={searchTerm} 
                            onChange={e => setSearchTerm(e.target.value)} 
                            className="w-full pl-3 pr-10 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm text-black dark:text-white focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                        />
                        {searchTerm && (
                            <button 
                                aria-label="Limpar busca"
                                onClick={() => setSearchTerm('')}
                                className="absolute right-2 top-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
                            >
                                <TrashIcon className="w-5 h-5" />
                            </button>
                        )}
                    </div>
                 </div>
                 
                 <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                        <thead className="bg-gray-100 dark:bg-gray-800">
                            <tr>
                                <th onClick={() => handleSort('publisherName')} className="px-6 py-3 text-left text-xs font-bold text-gray-500 dark:text-gray-300 uppercase tracking-wider cursor-pointer hover:bg-gray-200 dark:hover:bg-gray-700">Nome {getSortIndicator('publisherName')}</th>
                                <th onClick={() => handleSort('lastAssignmentDate')} className="px-6 py-3 text-center text-xs font-bold text-gray-500 dark:text-gray-300 uppercase tracking-wider cursor-pointer hover:bg-gray-200 dark:hover:bg-gray-700">Status / Recência {getSortIndicator('lastAssignmentDate')}</th>
                                <th onClick={() => handleSort('totalAssignments')} className="px-6 py-3 text-center text-xs font-bold text-indigo-600 dark:text-indigo-400 uppercase tracking-wider cursor-pointer hover:bg-gray-200 dark:hover:bg-gray-700 border-l border-gray-200 dark:border-gray-700">Total {getSortIndicator('totalAssignments')}</th>
                                <th onClick={() => handleSort('countTreasures')} className="px-4 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-400 uppercase cursor-pointer hover:bg-gray-200 dark:hover:bg-gray-700">Tesouros {getSortIndicator('countTreasures')}</th>
                                <th onClick={() => handleSort('countMinistry')} className="px-4 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-400 uppercase cursor-pointer hover:bg-gray-200 dark:hover:bg-gray-700">Ministério {getSortIndicator('countMinistry')}</th>
                                <th onClick={() => handleSort('countLife')} className="px-4 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-400 uppercase cursor-pointer hover:bg-gray-200 dark:hover:bg-gray-700">Vida Cristã {getSortIndicator('countLife')}</th>
                            </tr>
                        </thead>
                        <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                            {sortedAndFilteredStats.length > 0 ? sortedAndFilteredStats.map(stat => {
                                const status = getDateStatus(stat.lastAssignmentDate);
                                
                                return (
                                    <tr key={stat.publisherId} className="hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <div className="text-sm font-medium text-gray-900 dark:text-gray-100">{stat.publisherName}</div>
                                            {stat.countPresidency > 0 && <div className="text-xs text-indigo-500">Presidiu {stat.countPresidency}x</div>}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-center">
                                            <span className={`px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${status.color}`}>
                                                {status.label}
                                            </span>
                                            {status.days !== undefined && <div className="text-xs text-gray-400 mt-1">{status.days} dias atrás</div>}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-center text-sm font-bold text-gray-800 dark:text-gray-200 border-l border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/20">
                                            {stat.totalAssignments}
                                        </td>
                                        <td className="px-4 py-4 whitespace-nowrap text-center text-sm text-gray-600 dark:text-gray-400">
                                            {stat.countTreasures > 0 ? stat.countTreasures : <span className="text-gray-300">-</span>}
                                        </td>
                                        <td className="px-4 py-4 whitespace-nowrap text-center text-sm text-gray-600 dark:text-gray-400">
                                            {stat.countMinistry > 0 ? stat.countMinistry : <span className="text-gray-300">-</span>}
                                        </td>
                                        <td className="px-4 py-4 whitespace-nowrap text-center text-sm text-gray-600 dark:text-gray-400">
                                            {stat.countLife > 0 ? stat.countLife : <span className="text-gray-300">-</span>}
                                        </td>
                                    </tr>
                                );
                            }) : (
                                <tr>
                                    <td colSpan={6} className="px-6 py-8 text-center text-gray-500 dark:text-gray-400">
                                        Nenhum publicador encontrado.
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                 </div>
            </div>
        </div>
    );
};

export default StatisticsDashboard;
