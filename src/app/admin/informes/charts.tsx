'use client'

import { Bar, BarChart, CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'

const COLORS = ['var(--primary)', 'var(--accent)', 'var(--sky, #aadbff)', 'var(--navy, #003154)', '#e11d48']
const tip = { background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, color: 'var(--text)', fontSize: 12 }
const tick = { fontSize: 11, fill: 'var(--muted)' }

export function RevenueStack({ data, keys, labels }: { data: Record<string, number | string>[]; keys: string[]; labels: Record<string, string> }) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={data} margin={{ top: 5, right: 8, bottom: 0, left: -8 }}>
        <CartesianGrid stroke="var(--border)" vertical={false} />
        <XAxis dataKey="month" tick={tick} tickLine={false} axisLine={false} />
        <YAxis tick={tick} tickLine={false} axisLine={false} tickFormatter={(v) => `${v}€`} />
        <Tooltip formatter={(v, n) => [`${Number(v).toFixed(2)} €`, labels[String(n)] ?? n]} contentStyle={tip} cursor={{ fill: 'var(--surface-2)' }} />
        <Legend formatter={(v) => labels[v] ?? v} wrapperStyle={{ fontSize: 12 }} />
        {keys.map((k, i) => <Bar key={k} dataKey={k} stackId="a" fill={COLORS[i % COLORS.length]} radius={i === keys.length - 1 ? [6, 6, 0, 0] : 0} />)}
      </BarChart>
    </ResponsiveContainer>
  )
}

export function MembersLine({ data, labels }: { data: { month: string; active: number; joined: number; ended: number }[]; labels: { active: string; joined: string; ended: string } }) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <LineChart data={data} margin={{ top: 5, right: 8, bottom: 0, left: -12 }}>
        <CartesianGrid stroke="var(--border)" vertical={false} />
        <XAxis dataKey="month" tick={tick} tickLine={false} axisLine={false} interval="preserveStartEnd" />
        <YAxis yAxisId="a" tick={tick} tickLine={false} axisLine={false} domain={['auto', 'auto']} />
        <YAxis yAxisId="b" orientation="right" tick={tick} tickLine={false} axisLine={false} />
        <Tooltip contentStyle={tip} />
        <Legend wrapperStyle={{ fontSize: 12 }} />
        <Line yAxisId="a" type="monotone" dataKey="active" name={labels.active} stroke="var(--primary)" strokeWidth={2.5} dot={false} />
        <Line yAxisId="b" type="monotone" dataKey="joined" name={labels.joined} stroke="var(--success)" strokeWidth={2} dot={false} />
        <Line yAxisId="b" type="monotone" dataKey="ended" name={labels.ended} stroke="var(--danger)" strokeWidth={2} dot={false} />
      </LineChart>
    </ResponsiveContainer>
  )
}
