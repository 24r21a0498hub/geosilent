import React, { useMemo } from 'react';
import { 
  ResponsiveContainer, 
  AreaChart, 
  Area, 
  Tooltip, 
  ReferenceLine,
  YAxis,
  XAxis
} from 'recharts';
import { 
  Activity, 
  Radio, 
  CheckCircle2, 
  AlertTriangle, 
  AlertCircle, 
  RotateCw,
  Info,
  Navigation
} from 'lucide-react';
import { Location } from '../types';

export interface GpsAccuracyPoint {
  timestamp: number;
  timeStr: string;
  accuracy: number; // in meters (lower is more accurate)
  lat: number;
  lng: number;
}

interface GpsAccuracySparklineProps {
  history: GpsAccuracyPoint[];
  currentLocation: Location | null;
  isSimulating: boolean;
  onRefreshGps?: () => void;
}

export default function GpsAccuracySparkline({
  history,
  currentLocation,
  isSimulating,
  onRefreshGps,
}: GpsAccuracySparklineProps) {
  // Filter history to last 10 minutes
  const tenMinutesAgo = Date.now() - 10 * 60 * 1000;
  const filteredData = useMemo(() => {
    const pts = history.filter((p) => p.timestamp >= tenMinutesAgo);
    return pts.length > 0 ? pts : history.slice(-15);
  }, [history, tenMinutesAgo]);

  // Compute metrics (average, min, max, drift variance)
  const metrics = useMemo(() => {
    if (filteredData.length === 0) {
      return {
        avg: currentLocation?.accuracy ?? 10,
        min: currentLocation?.accuracy ?? 10,
        max: currentLocation?.accuracy ?? 10,
        driftDelta: 0,
        status: 'stable' as const,
        label: 'Stable Precision',
      };
    }

    const accuracies = filteredData.map((d) => d.accuracy);
    const min = Math.min(...accuracies);
    const max = Math.max(...accuracies);
    const sum = accuracies.reduce((a, b) => a + b, 0);
    const avg = Math.round((sum / accuracies.length) * 10) / 10;
    const driftDelta = Math.round((max - min) * 10) / 10;

    let status: 'stable' | 'moderate' | 'drifting' = 'stable';
    let label = 'High Precision';

    if (avg > 25 || driftDelta > 20) {
      status = 'drifting';
      label = 'Position Drifting';
    } else if (avg > 15 || driftDelta > 10) {
      status = 'moderate';
      label = 'Moderate Variance';
    } else {
      status = 'stable';
      label = 'Stable Signal';
    }

    return {
      avg,
      min,
      max,
      driftDelta,
      status,
      label,
    };
  }, [filteredData, currentLocation]);

  const currentAcc = currentLocation?.accuracy ? Math.round(currentLocation.accuracy) : Math.round(metrics.avg);

  // Gradient & stroke colors based on health
  const colorConfig = useMemo(() => {
    if (metrics.status === 'drifting') {
      return {
        stroke: '#f43f5e',
        fill: '#f43f5e',
        badgeBg: 'bg-rose-50 text-rose-800 border-rose-200',
        dotColor: 'bg-rose-500',
      };
    }
    if (metrics.status === 'moderate') {
      return {
        stroke: '#f59e0b',
        fill: '#f59e0b',
        badgeBg: 'bg-amber-50 text-amber-800 border-amber-200',
        dotColor: 'bg-amber-500',
      };
    }
    return {
      stroke: '#10b981',
      fill: '#10b981',
      badgeBg: 'bg-emerald-50 text-emerald-800 border-emerald-200',
      dotColor: 'bg-emerald-500',
    };
  }, [metrics.status]);

  return (
    <div className="w-full bg-white rounded-2xl p-4 shadow-sm border border-slate-100 mb-4 transition-all">
      {/* Header with Title and Current Drift Status */}
      <div className="flex items-center justify-between gap-2 mb-2">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-xl bg-slate-100 text-slate-700 flex items-center justify-center shrink-0 shadow-2xs">
            <Activity size={14} className="text-indigo-600" />
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <h3 className="text-xs font-bold text-slate-800 tracking-tight">
                GPS Accuracy & Drift
              </h3>
              <span className="text-[9px] text-slate-400 font-mono">Last 10m</span>
            </div>
            <p className="text-[10px] text-slate-400 font-medium">
              {isSimulating ? 'Simulated location feed' : 'Live hardware GPS feed'}
            </p>
          </div>
        </div>

        {/* Current status chip */}
        <div className="flex items-center gap-1.5">
          <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold flex items-center gap-1 border shadow-2xs ${colorConfig.badgeBg}`}>
            <span className={`w-1.5 h-1.5 rounded-full ${colorConfig.dotColor} animate-pulse`} />
            {metrics.label} (±{currentAcc}m)
          </span>

          {onRefreshGps && (
            <button
              type="button"
              onClick={onRefreshGps}
              className="p-1 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition active:scale-95 cursor-pointer"
              title="Request fresh high-precision GPS fix"
              aria-label="Refresh GPS fix"
            >
              <RotateCw size={12} />
            </button>
          )}
        </div>
      </div>

      {/* Sparkline Chart Container */}
      <div className="h-16 w-full relative pt-1 pb-1">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={filteredData} margin={{ top: 2, right: 2, left: 2, bottom: 0 }}>
            <defs>
              <linearGradient id="gpsAccuracyGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={colorConfig.fill} stopOpacity={0.35} />
                <stop offset="95%" stopColor={colorConfig.fill} stopOpacity={0.0} />
              </linearGradient>
            </defs>
            <YAxis hide domain={['dataMin - 2', 'dataMax + 4']} />
            <XAxis hide dataKey="timeStr" />
            <Tooltip
              content={({ active, payload }) => {
                if (active && payload && payload.length) {
                  const data = payload[0].payload as GpsAccuracyPoint;
                  return (
                    <div className="bg-slate-900/95 text-white text-[10px] px-2.5 py-1.5 rounded-xl shadow-xl border border-slate-700/80 backdrop-blur-xs font-sans">
                      <p className="font-mono text-slate-400">{data.timeStr}</p>
                      <p className="font-bold text-white flex items-center gap-1 mt-0.5">
                        Accuracy: <span className="font-mono text-emerald-400">±{data.accuracy}m</span>
                      </p>
                      <p className="text-[9px] text-slate-400">
                        {data.accuracy <= 10 ? 'Excellent fix' : data.accuracy <= 20 ? 'Good fix' : 'High drift margin'}
                      </p>
                    </div>
                  );
                }
                return null;
              }}
            />
            {/* Safety perimeter tolerance line at 15m */}
            <ReferenceLine y={15} stroke="#94a3b8" strokeDasharray="3 3" opacity={0.5} />
            <Area
              type="monotone"
              dataKey="accuracy"
              stroke={colorConfig.stroke}
              strokeWidth={1.8}
              fill="url(#gpsAccuracyGrad)"
              dot={false}
              activeDot={{ r: 3.5, stroke: '#ffffff', strokeWidth: 1.5, fill: colorConfig.stroke }}
              isAnimationActive={false}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {/* Sparkline Diagnostics Metadata Footer */}
      <div className="mt-2 pt-2 border-t border-slate-100 flex items-center justify-between text-[10px]">
        <div className="flex items-center gap-3 text-slate-500">
          <span>
            Avg: <strong className="text-slate-700 font-mono">±{metrics.avg}m</strong>
          </span>
          <span>•</span>
          <span>
            Best: <strong className="text-emerald-700 font-mono">±{metrics.min}m</strong>
          </span>
          <span>•</span>
          <span>
            Variance: <strong className="text-slate-700 font-mono">{metrics.driftDelta}m</strong>
          </span>
        </div>

        <div className="flex items-center gap-1 text-[9.5px] font-semibold text-slate-500">
          {metrics.driftDelta <= 8 ? (
            <span className="text-emerald-600 flex items-center gap-0.5">
              <CheckCircle2 size={11} /> No drift
            </span>
          ) : metrics.driftDelta <= 18 ? (
            <span className="text-amber-600 flex items-center gap-0.5">
              <AlertTriangle size={11} /> Minor drift
            </span>
          ) : (
            <span className="text-rose-600 flex items-center gap-0.5">
              <AlertCircle size={11} /> High drift
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
