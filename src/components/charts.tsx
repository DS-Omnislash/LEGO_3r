import { Bar, BarChart, CartesianGrid, Cell, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import type { Team } from '../db/models';
import type { MissionStat, ProgressPoint } from '../lib/rankings';
import { MISSION_BY_ID } from '../scoring/rules';
import { fmtShort } from '../lib/format';

/** Enfosqueix colors massa clars (p. ex. groc LEGO) perquè les línies es vegin sobre fons blanc. */
export function chartColor(hex: string): string {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex);
  if (!m) return hex;
  const n = parseInt(m[1], 16);
  let r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
  const lum = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
  if (lum > 0.62) {
    const f = 0.62 / lum;
    r = Math.round(r * f); g = Math.round(g * f); b = Math.round(b * f);
  }
  return `#${((1 << 24) | (r << 16) | (g << 8) | b).toString(16).slice(1)}`;
}

const axis = { stroke: '#9aa1b4', fontSize: 12, tickLine: false, axisLine: false } as const;
const tooltipStyle = { borderRadius: 12, border: '1px solid #e4e0d4', boxShadow: '0 10px 30px rgba(0,0,0,.12)', fontFamily: 'inherit' };

export function ProgressChart({ data, teams, percent, height = 300 }: { data: ProgressPoint[]; teams: Team[]; percent?: boolean; height?: number }) {
  if (!data.length) return <div className="empty small">Encara no hi ha sessions completades per dibuixar l'evolució.</div>;
  const rows = data.map((p) => ({ ...p, x: `${fmtShort(p.date)}` }));
  return (
    <ResponsiveContainer width="100%" height={height}>
      <LineChart data={rows} margin={{ top: 10, right: 16, left: -10, bottom: 0 }}>
        <CartesianGrid stroke="#efebe0" vertical={false} />
        <XAxis dataKey="x" {...axis} />
        <YAxis {...axis} domain={percent ? [0, 100] : [0, 'auto']} unit={percent ? '%' : ''} />
        <Tooltip
          contentStyle={tooltipStyle}
          labelFormatter={(_, p) => (p?.[0]?.payload ? `${p[0].payload.label} · ${p[0].payload.x}` : '')}
          formatter={(v: number, name: string) => [percent ? `${v}%` : `${v} pts`, teams.find((t) => t.id === name)?.name ?? name]}
        />
        <Legend formatter={(id: string) => <span style={{ color: '#1b2236', fontWeight: 700, fontSize: 12 }}>{teams.find((t) => t.id === id)?.name ?? id}</span>} />
        {teams.map((t) => (
          <Line key={t.id} type="monotone" dataKey={t.id} stroke={chartColor(t.color)} strokeWidth={2} dot={{ r: 4, strokeWidth: 2, fill: '#fff' }} activeDot={{ r: 6 }} connectNulls />
        ))}
      </LineChart>
    </ResponsiveContainer>
  );
}

export function MissionBars({ stats, height = 280 }: { stats: MissionStat[]; height?: number }) {
  if (!stats.length) return <div className="empty small">Encara no hi ha missions puntuades.</div>;
  const rows = stats.map((s) => ({ ...s, name: MISSION_BY_ID[s.missionId]?.number ?? s.missionId, full: MISSION_BY_ID[s.missionId]?.name }));
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={rows} margin={{ top: 10, right: 10, left: -18, bottom: 0 }} barCategoryGap="22%">
        <CartesianGrid stroke="#efebe0" vertical={false} />
        <XAxis dataKey="name" {...axis} />
        <YAxis {...axis} domain={[0, 100]} unit="%" />
        <Tooltip
          cursor={{ fill: 'rgba(0,108,183,.06)' }}
          contentStyle={tooltipStyle}
          labelFormatter={(_, p) => (p?.[0]?.payload ? `M${p[0].payload.name} · ${p[0].payload.full}` : '')}
          formatter={(v, _n, p) => [`${v}% del màxim (mitjana ${p.payload.avg}/${p.payload.max}, ${p.payload.attempts} intents)`, 'Assoliment']}
        />
        <Bar dataKey="avgPct" radius={[4, 4, 0, 0]} fill="#006cb7" />
      </BarChart>
    </ResponsiveContainer>
  );
}

export function TeamTotalsBars({ rows, height = 260 }: { rows: { team: Team; value: number }[]; height?: number }) {
  if (!rows.length) return null;
  const data = rows.map((r) => ({ name: r.team.name, value: r.value, color: chartColor(r.team.color) }));
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} layout="vertical" margin={{ top: 0, right: 20, left: 10, bottom: 0 }} barCategoryGap="25%">
        <CartesianGrid stroke="#efebe0" horizontal={false} />
        <XAxis type="number" {...axis} />
        <YAxis type="category" dataKey="name" {...axis} width={120} />
        <Tooltip cursor={{ fill: 'rgba(0,108,183,.06)' }} contentStyle={tooltipStyle} formatter={(v: number) => [`${v} pts`, 'Puntuació']} />
        <Bar dataKey="value" radius={[0, 4, 4, 0]}>
          {data.map((d) => <Cell key={d.name} fill={d.color} />)}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
