import { Area, AreaChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import type { TelemetryPoint } from '@/data/types';

/**
 * One series, drawn small. Thresholds are subtle bands rather than alarm
 * colours until they are actually crossed.
 */
export default function Sparkline({
  points,
  unit,
  thresholds,
}: {
  points: TelemetryPoint[];
  unit?: string;
  thresholds?: { warn?: number; critical?: number };
}) {
  const data = points.map((point) => ({
    t: new Date(point.t).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false }),
    v: point.v,
  }));

  return (
    <div className="h-full w-full p-2">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
          <defs>
            <linearGradient id="sparkFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--chart-1)" stopOpacity={0.35} />
              <stop offset="100%" stopColor="var(--chart-1)" stopOpacity={0.02} />
            </linearGradient>
          </defs>
          <XAxis dataKey="t" hide />
          <YAxis hide domain={['dataMin', 'dataMax']} />
          <Tooltip
            contentStyle={{
              background: 'var(--popover)',
              border: '1px solid var(--border)',
              borderRadius: 8,
              fontSize: 12,
              color: 'var(--popover-foreground)',
            }}
            formatter={(value: number) => [`${value} ${unit ?? ''}`.trim(), '']}
            labelFormatter={(label: string) => label}
          />
          {thresholds?.warn !== undefined && (
            <ReferenceLine y={thresholds.warn} stroke="var(--warning)" strokeDasharray="4 4" strokeOpacity={0.5} />
          )}
          {thresholds?.critical !== undefined && (
            <ReferenceLine y={thresholds.critical} stroke="var(--destructive)" strokeDasharray="4 4" strokeOpacity={0.6} />
          )}
          <Area
            type="monotone"
            dataKey="v"
            stroke="var(--chart-1)"
            strokeWidth={1.75}
            fill="url(#sparkFill)"
            isAnimationActive={false}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
