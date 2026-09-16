import { PolarAngleAxis, PolarGrid, Radar, RadarChart, ResponsiveContainer } from 'recharts';

export interface RadarAxis {
  axis: string;
  label: string;
  value: number;
  raw: number;
}

/**
 * Loaded on demand: charts are the heaviest dependency in the app and the
 * guest table must open without paying for them.
 */
export default function MetricRadar({ data }: { data: RadarAxis[] }) {
  return (
    <div className="h-52 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <RadarChart data={data} outerRadius="72%">
          <PolarGrid stroke="var(--border)" />
          <PolarAngleAxis dataKey="label" tick={{ fill: 'var(--muted-foreground)', fontSize: 11 }} />
          <Radar
            dataKey="value"
            stroke="var(--chart-1)"
            fill="var(--chart-1)"
            fillOpacity={0.28}
            isAnimationActive={false}
          />
        </RadarChart>
      </ResponsiveContainer>
    </div>
  );
}
