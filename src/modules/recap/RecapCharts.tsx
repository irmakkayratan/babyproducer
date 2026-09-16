import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type { TelemetrySeries } from '@/data/types';

const AXIS = { stroke: 'var(--muted-foreground)', fontSize: 11 };

/**
 * Series are told apart twice over: by how light the line is, and by its dash.
 *
 * Lightness alone is enough on a good screen, but these get projected onto
 * whatever the venue has and read off photographs of a laptop, and a grey step
 * is the first thing either of those loses. The dash survives both, and it also
 * survives being printed.
 */
const SERIES_DASH = ['0', '6 3', '2 3', '10 3 2 3', '1 3'];
const TOOLTIP = {
  background: 'var(--popover)',
  border: '1px solid var(--border)',
  borderRadius: 8,
  fontSize: 12,
  color: 'var(--popover-foreground)',
};

export interface RecapChartProps {
  kind: 'attendance' | 'arrivals' | 'telemetry';
  funnel: { invited: number; confirmed: number; arrived: number; partyTotal: number };
  arrivalCurve: Array<{ t: string; v: number }>;
  byVoice: Array<{ label: string; count: number; value: number }>;
  telemetry: TelemetrySeries[];
}

/** Charts follow the theme through tokens, no conditional colours anywhere. */
export default function RecapCharts({ kind, funnel, arrivalCurve, telemetry }: RecapChartProps) {
  if (kind === 'attendance') {
    const data = [
      { stage: 'Invited', value: funnel.invited },
      { stage: 'Confirmed', value: funnel.confirmed },
      { stage: 'Arrived', value: funnel.arrived },
    ];
    return (
      <div className="h-56 w-full rounded-lg border p-3">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} layout="vertical" margin={{ left: 8, right: 16 }}>
            <CartesianGrid horizontal={false} stroke="var(--border)" strokeDasharray="3 3" />
            <XAxis type="number" tick={AXIS} axisLine={false} tickLine={false} />
            <YAxis type="category" dataKey="stage" tick={AXIS} axisLine={false} tickLine={false} width={80} />
            <Tooltip contentStyle={TOOLTIP} cursor={{ fill: 'var(--muted)', opacity: 0.4 }} />
            <Bar dataKey="value" radius={[0, 6, 6, 0]} isAnimationActive={false}>
              {data.map((_, index) => (
                <Cell key={index} fill={`var(--chart-${index + 1})`} stroke="var(--background)" strokeWidth={1} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    );
  }

  if (kind === 'arrivals') {
    const data = arrivalCurve.map((point) => ({
      t: new Date(point.t).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false }),
      v: point.v,
    }));
    return (
      <div className="h-56 w-full rounded-lg border p-3">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ left: 0, right: 8 }}>
            <defs>
              <linearGradient id="recapFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="var(--chart-1)" stopOpacity={0.4} />
                <stop offset="100%" stopColor="var(--chart-1)" stopOpacity={0.03} />
              </linearGradient>
            </defs>
            <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" vertical={false} />
            <XAxis dataKey="t" tick={AXIS} axisLine={false} tickLine={false} minTickGap={32} />
            <YAxis tick={AXIS} axisLine={false} tickLine={false} width={32} />
            <Tooltip contentStyle={TOOLTIP} formatter={(value: number) => [`${value} arrivals`, '']} />
            <Area
              type="monotone"
              dataKey="v"
              stroke="var(--chart-1)"
              strokeWidth={2}
              fill="url(#recapFill)"
              isAnimationActive={false}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    );
  }

  const series = telemetry.filter((entry) => entry.metric !== 'uptime').slice(0, 3);
  const merged = new Map<string, Record<string, number | string>>();
  for (const entry of series) {
    for (const point of entry.points) {
      const key = new Date(point.t).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
      const row = merged.get(key) ?? { t: key };
      row[entry.source] = point.v;
      merged.set(key, row);
    }
  }

  return (
    <div className="h-64 w-full rounded-lg border p-3">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={[...merged.values()]} margin={{ left: 0, right: 8 }}>
          <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" vertical={false} />
          <XAxis dataKey="t" tick={AXIS} axisLine={false} tickLine={false} minTickGap={40} />
          <YAxis tick={AXIS} axisLine={false} tickLine={false} width={40} />
          <Tooltip contentStyle={TOOLTIP} />
          <Legend wrapperStyle={{ fontSize: 11, color: 'var(--muted-foreground)' }} />
          {series.map((entry, index) => (
            <Line
              key={entry.id}
              type="monotone"
              dataKey={entry.source}
              stroke={`var(--chart-${index + 1})`}
              strokeWidth={1.75}
              strokeDasharray={SERIES_DASH[index % SERIES_DASH.length]}
              dot={false}
              isAnimationActive={false}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
