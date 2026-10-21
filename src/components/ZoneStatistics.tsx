import React, { useState, useMemo } from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
  Cell
} from 'recharts';
import {
  BarChart3,
  Clock,
  Footprints,
  Sparkles,
  TrendingUp,
  RotateCcw,
  PlusCircle,
  Award,
  Layers,
  CheckCircle2,
  Calendar,
  Zap,
  Flame
} from 'lucide-react';
import { Zone, ZoneStatistic, DndEvent } from '../types';
import { computeZoneStatistics, formatDurationSeconds } from '../utils';
import ZoneEntryHeatmap from './ZoneEntryHeatmap';

interface ZoneStatisticsProps {
  zones: Zone[];
  activityLogs?: DndEvent[];
  onUpdateZones?: (zones: Zone[]) => void;
  onSelectZone?: (zone: Zone) => void;
}

type StatisticsSubTab = 'overview' | 'heatmap';
type MetricMode = 'combined' | 'visits' | 'duration';

const CHART_COLORS = [
  '#6366f1', // Indigo
  '#06b6d4', // Cyan
  '#10b981', // Emerald
  '#f59e0b', // Amber
  '#ec4899', // Pink
  '#8b5cf6', // Purple
  '#3b82f6', // Blue
  '#14b8a6', // Teal
];

export default function ZoneStatistics({
  zones,
  activityLogs,
  onUpdateZones,
  onSelectZone,
}: ZoneStatisticsProps) {
  const [activeSubTab, setActiveSubTab] = useState<StatisticsSubTab>('overview');
  const [metricMode, setMetricMode] = useState<MetricMode>('combined');
  const [highlightedZoneId, setHighlightedZoneId] = useState<string | null>(null);

  // Compute stats for all zones
  const stats: ZoneStatistic[] = useMemo(() => {
    return computeZoneStatistics(zones);
  }, [zones]);

  // Aggregate overview metrics
  const totals = useMemo(() => {
    const totalVisits = stats.reduce((acc, curr) => acc + curr.totalVisits, 0);
    const totalDurationSeconds = stats.reduce((acc, curr) => acc + curr.totalDurationSeconds, 0);
    const totalMinutes = Math.round(totalDurationSeconds / 60);

    const mostVisited = stats.length > 0
      ? [...stats].sort((a, b) => b.totalVisits - a.totalVisits)[0]
      : null;

    const longestStay = stats.length > 0
      ? [...stats].sort((a, b) => b.averageDurationMinutes - a.averageDurationMinutes)[0]
      : null;

    return {
      totalVisits,
      totalDurationFormatted: formatDurationSeconds(totalDurationSeconds),
      totalMinutes,
      mostVisited: mostVisited && mostVisited.totalVisits > 0 ? mostVisited : null,
      longestStay: longestStay && longestStay.averageDurationMinutes > 0 ? longestStay : null,
    };
  }, [stats]);

  // Chart data format
  const chartData = useMemo(() => {
    return stats.map((item, index) => ({
      id: item.id,
      name: item.name.length > 14 ? item.name.slice(0, 12) + '…' : item.name,
      fullName: item.name,
      visits: item.totalVisits,
      avgMinutes: item.averageDurationMinutes,
      avgFormatted: item.averageDurationFormatted,
      totalFormatted: item.totalDurationFormatted,
      color: CHART_COLORS[index % CHART_COLORS.length],
      enabled: item.enabled,
    }));
  }, [stats]);

  // Quick helper to simulate +1 visit & +30m duration for testing
  const handleSimulateVisit = (zoneId: string) => {
    if (!onUpdateZones) return;
    const updated = zones.map((z) => {
      if (z.id === zoneId) {
        const newVisits = (z.totalVisits ?? 0) + 1;
        const addSeconds = 30 * 60; // 30 mins
        const newDuration = (z.totalDurationSeconds ?? 0) + addSeconds;
        return {
          ...z,
          totalVisits: newVisits,
          totalDurationSeconds: newDuration,
        };
      }
      return z;
    });
    onUpdateZones(updated);
  };

  // Helper to seed realistic sample statistics if all counts are 0
  const handleSeedSampleStats = () => {
    if (!onUpdateZones || zones.length === 0) return;
    const presets = [
      { visits: 18, mins: 45 },
      { visits: 34, mins: 210 },
      { visits: 11, mins: 75 },
      { visits: 22, mins: 90 },
      { visits: 7, mins: 30 },
    ];
    const updated = zones.map((z, i) => {
      const preset = presets[i % presets.length];
      return {
        ...z,
        totalVisits: preset.visits,
        totalDurationSeconds: preset.visits * preset.mins * 60,
      };
    });
    onUpdateZones(updated);
  };

  // Helper to reset stats
  const handleResetStats = () => {
    if (!onUpdateZones) return;
    const updated = zones.map((z) => ({
      ...z,
      totalVisits: 0,
      totalDurationSeconds: 0,
      lastEnteredAt: null,
    }));
    onUpdateZones(updated);
  };

  const hasAnyVisits = totals.totalVisits > 0;

  return (
    <div className="space-y-4">
      {/* Sub-tab Navigation inside Statistics */}
      <div className="flex items-center bg-slate-200/80 p-1 rounded-xl text-xs font-bold w-full shadow-2xs">
        <button
          type="button"
          id="stats-subtab-overview-btn"
          onClick={() => setActiveSubTab('overview')}
          className={`flex-1 py-1.5 px-3 rounded-lg flex items-center justify-center gap-1.5 transition cursor-pointer ${
            activeSubTab === 'overview'
              ? 'bg-white text-indigo-700 shadow-sm font-extrabold'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <BarChart3 size={14} />
          <span>Overview & Totals</span>
        </button>
        <button
          type="button"
          id="stats-subtab-heatmap-btn"
          onClick={() => setActiveSubTab('heatmap')}
          className={`flex-1 py-1.5 px-3 rounded-lg flex items-center justify-center gap-1.5 transition cursor-pointer ${
            activeSubTab === 'heatmap'
              ? 'bg-white text-indigo-700 shadow-sm font-extrabold'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <Calendar size={14} />
          <span>7-Day Heatmap</span>
          <span className="text-[9px] bg-indigo-100 text-indigo-700 px-1.5 py-0.2 rounded-full font-bold ml-0.5">
            NEW
          </span>
        </button>
      </div>

      {/* 7-DAY ENTRY HEATMAP SUB-TAB */}
      {activeSubTab === 'heatmap' && (
        <ZoneEntryHeatmap
          zones={zones}
          activityLogs={activityLogs}
        />
      )}

      {/* OVERVIEW & TOTALS SUB-TAB */}
      {activeSubTab === 'overview' && (
        <>
          {/* Top Overview Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
            {/* Total Visits */}
            <div className="bg-white p-3 rounded-2xl border border-slate-100 shadow-xs flex flex-col">
              <div className="flex items-center justify-between text-indigo-600 mb-1">
                <Footprints size={16} />
                <span className="text-[10px] uppercase font-bold text-slate-400">Total Visits</span>
              </div>
              <span className="text-xl font-bold text-slate-900 tracking-tight">
                {totals.totalVisits}
              </span>
              <span className="text-[10px] text-slate-500 mt-0.5">Across {zones.length} silent zones</span>
            </div>

            {/* Total Quiet Time */}
            <div className="bg-white p-3 rounded-2xl border border-slate-100 shadow-xs flex flex-col">
              <div className="flex items-center justify-between text-teal-600 mb-1">
                <Clock size={16} />
                <span className="text-[10px] uppercase font-bold text-slate-400">Quiet Time</span>
              </div>
              <span className="text-xl font-bold text-slate-900 tracking-tight">
                {totals.totalDurationFormatted}
              </span>
              <span className="text-[10px] text-slate-500 mt-0.5">Cumulative DND active</span>
            </div>

            {/* Top Visited Zone */}
            <div className="bg-white p-3 rounded-2xl border border-slate-100 shadow-xs flex flex-col">
              <div className="flex items-center justify-between text-amber-500 mb-1">
                <Award size={16} />
                <span className="text-[10px] uppercase font-bold text-slate-400">Most Visited</span>
              </div>
              <span className="text-sm font-bold text-slate-900 truncate">
                {totals.mostVisited ? totals.mostVisited.name : '—'}
              </span>
              <span className="text-[10px] text-slate-500 mt-0.5">
                {totals.mostVisited ? `${totals.mostVisited.totalVisits} visits logged` : 'No visits yet'}
              </span>
            </div>

            {/* Longest Average Stay */}
            <div className="bg-white p-3 rounded-2xl border border-slate-100 shadow-xs flex flex-col">
              <div className="flex items-center justify-between text-purple-600 mb-1">
                <TrendingUp size={16} />
                <span className="text-[10px] uppercase font-bold text-slate-400">Longest Avg Stay</span>
              </div>
              <span className="text-sm font-bold text-slate-900 truncate">
                {totals.longestStay ? totals.longestStay.averageDurationFormatted : '—'}
              </span>
              <span className="text-[10px] text-slate-500 mt-0.5 truncate">
                {totals.longestStay ? totals.longestStay.name : 'No data yet'}
              </span>
            </div>
          </div>

      {/* Main Bar Chart Section */}
      <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-100">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 mb-4">
          <div>
            <div className="flex items-center gap-1.5">
              <BarChart3 size={17} className="text-indigo-600" />
              <h3 className="font-bold text-slate-900 text-sm">Zone Visit & Duration Summary</h3>
            </div>
            <p className="text-[11px] text-slate-500">
              Total visits and average time spent per perimeter
            </p>
          </div>

          {/* Metric Selector Toggle */}
          <div className="flex items-center bg-slate-100 p-0.5 rounded-lg text-xs font-semibold self-start sm:self-auto">
            <button
              type="button"
              onClick={() => setMetricMode('combined')}
              className={`px-2.5 py-1 rounded-md transition ${
                metricMode === 'combined'
                  ? 'bg-white text-indigo-700 shadow-2xs font-bold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Dual View
            </button>
            <button
              type="button"
              onClick={() => setMetricMode('visits')}
              className={`px-2.5 py-1 rounded-md transition ${
                metricMode === 'visits'
                  ? 'bg-white text-indigo-700 shadow-2xs font-bold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Visits
            </button>
            <button
              type="button"
              onClick={() => setMetricMode('duration')}
              className={`px-2.5 py-1 rounded-md transition ${
                metricMode === 'duration'
                  ? 'bg-white text-indigo-700 shadow-2xs font-bold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Avg Time (mins)
            </button>
          </div>
        </div>

        {/* Chart Canvas */}
        {zones.length === 0 ? (
          <div className="py-12 flex flex-col items-center justify-center text-center text-slate-400">
            <Layers size={36} className="text-slate-300 mb-2" />
            <p className="text-xs font-semibold text-slate-600">No Geofences to Display</p>
            <p className="text-[11px] text-slate-400 max-w-xs mt-0.5">
              Add your silent zones first to track visits and calculate average time spent.
            </p>
          </div>
        ) : !hasAnyVisits ? (
          <div className="py-10 px-4 bg-slate-50/80 rounded-xl border border-dashed border-slate-200 text-center flex flex-col items-center">
            <BarChart3 size={32} className="text-indigo-400 mb-2" />
            <p className="text-xs font-bold text-slate-700">No Visit History Recorded Yet</p>
            <p className="text-[11px] text-slate-500 max-w-sm mt-0.5 mb-1 leading-relaxed">
              Visits and durations are tracked automatically as you enter and spend time inside your silent zone perimeters.
            </p>
          </div>
        ) : (
          <div className="w-full h-64 select-none">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={chartData}
                margin={{ top: 12, right: 12, left: -16, bottom: 24 }}
              >
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis
                  dataKey="name"
                  stroke="#94a3b8"
                  fontSize={10}
                  tickLine={false}
                  interval={0}
                  angle={-15}
                  textAnchor="end"
                />
                <YAxis
                  stroke="#94a3b8"
                  fontSize={10}
                  tickLine={false}
                  axisLine={false}
                  allowDecimals={false}
                />
                <Tooltip
                  content={({ active, payload }) => {
                    if (active && payload && payload.length) {
                      const data = payload[0].payload;
                      return (
                        <div className="bg-slate-900 text-white p-2.5 rounded-xl shadow-xl text-xs border border-slate-800 space-y-1">
                          <p className="font-bold text-slate-100 flex items-center gap-1">
                            <span
                              className="w-2 h-2 rounded-full"
                              style={{ backgroundColor: data.color }}
                            />
                            {data.fullName}
                          </p>
                          <div className="text-[11px] text-slate-300 space-y-0.5 pt-0.5">
                            <p className="flex justify-between gap-4">
                              <span className="text-slate-400">Total Visits:</span>
                              <span className="font-semibold text-indigo-300">{data.visits}</span>
                            </p>
                            <p className="flex justify-between gap-4">
                              <span className="text-slate-400">Avg Time per Visit:</span>
                              <span className="font-semibold text-emerald-300">{data.avgFormatted}</span>
                            </p>
                            <p className="flex justify-between gap-4">
                              <span className="text-slate-400">Total Time Logged:</span>
                              <span className="font-medium text-slate-300">{data.totalFormatted}</span>
                            </p>
                          </div>
                        </div>
                      );
                    }
                    return null;
                  }}
                />
                <Legend
                  verticalAlign="top"
                  align="right"
                  iconType="circle"
                  iconSize={8}
                  wrapperStyle={{ fontSize: '11px', paddingBottom: '8px' }}
                />

                {(metricMode === 'combined' || metricMode === 'visits') && (
                  <Bar
                    dataKey="visits"
                    name="Visits"
                    fill="#6366f1"
                    radius={[5, 5, 0, 0]}
                    maxBarSize={38}
                  >
                    {chartData.map((entry) => (
                      <Cell
                        key={`cell-v-${entry.id}`}
                        fill={highlightedZoneId === entry.id ? '#4338ca' : '#6366f1'}
                      />
                    ))}
                  </Bar>
                )}

                {(metricMode === 'combined' || metricMode === 'duration') && (
                  <Bar
                    dataKey="avgMinutes"
                    name="Avg Stay (mins)"
                    fill="#0d9488"
                    radius={[5, 5, 0, 0]}
                    maxBarSize={38}
                  >
                    {chartData.map((entry) => (
                      <Cell
                        key={`cell-d-${entry.id}`}
                        fill={highlightedZoneId === entry.id ? '#0f766e' : '#0d9488'}
                      />
                    ))}
                  </Bar>
                )}
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      {/* Detailed Per-Zone Breakdown Cards & Quick Simulator */}
      {zones.length > 0 && (
        <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-100">
          <div className="flex items-center justify-between mb-3">
            <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
              Zone Performance Breakdown
            </h4>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleSeedSampleStats}
                className="text-[10px] text-indigo-600 hover:text-indigo-800 font-semibold flex items-center gap-1 transition"
                title="Populate test data"
              >
                <Sparkles size={11} />
                Seed Stats
              </button>
              <button
                type="button"
                onClick={handleResetStats}
                className="text-[10px] text-slate-400 hover:text-rose-500 font-medium flex items-center gap-1 transition"
                title="Reset all counters"
              >
                <RotateCcw size={11} />
                Reset
              </button>
            </div>
          </div>

          <div className="space-y-2.5">
            {stats.map((item, index) => {
              const zone = zones.find((z) => z.id === item.id);
              const isHighlighted = highlightedZoneId === item.id;
              const color = CHART_COLORS[index % CHART_COLORS.length];

              return (
                <div
                  key={item.id}
                  onMouseEnter={() => setHighlightedZoneId(item.id)}
                  onMouseLeave={() => setHighlightedZoneId(null)}
                  className={`p-3 rounded-xl border transition-all ${
                    isHighlighted
                      ? 'border-indigo-300 bg-indigo-50/40 shadow-xs'
                      : 'border-slate-100 bg-slate-50/60 hover:bg-slate-50'
                  } flex flex-col sm:flex-row sm:items-center justify-between gap-2`}
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <span
                      className="w-3 h-3 rounded-full shrink-0 shadow-2xs"
                      style={{ backgroundColor: color }}
                    />
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="font-bold text-xs text-slate-900 truncate">
                          {item.name}
                        </span>
                        {!item.enabled && (
                          <span className="text-[9px] bg-slate-200 text-slate-600 px-1.5 py-0.2 rounded font-medium">
                            Disabled
                          </span>
                        )}
                      </div>
                      <p className="text-[10px] text-slate-500">
                        Total Accumulated Time: {item.totalDurationFormatted}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2.5 shrink-0 self-end sm:self-auto">
                    {/* Visits Badge */}
                    <div className="text-right">
                      <span className="text-xs font-bold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded-md border border-indigo-100">
                        {item.totalVisits} {item.totalVisits === 1 ? 'visit' : 'visits'}
                      </span>
                    </div>

                    {/* Avg Time Badge */}
                    <div className="text-right">
                      <span className="text-xs font-bold text-teal-700 bg-teal-50 px-2 py-0.5 rounded-md border border-teal-100">
                        Avg: {item.averageDurationFormatted}
                      </span>
                    </div>

                    {/* Quick +1 Visit Test Button */}
                    <button
                      type="button"
                      onClick={() => handleSimulateVisit(item.id)}
                      className="text-[10px] px-2 py-1 bg-white hover:bg-slate-100 text-slate-700 font-semibold rounded-lg border border-slate-200 shadow-2xs transition active:scale-95 flex items-center gap-1"
                      title="Add 1 test visit (+30m) to this zone"
                    >
                      <PlusCircle size={11} className="text-indigo-600" />
                      +1 Visit
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
        </>
      )}
    </div>
  );
}
