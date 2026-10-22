import {
  Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, ComposedChart, Line, Pie, PieChart,
  ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts';
import { BarChart3 } from 'lucide-react';
import ChartTooltip from '../common/ChartTooltip';
import { EmptyState } from '../common/States';
import { formatCompact, formatCurrency, monthLabel, formatShortDate } from '../../utils/format';

// Chart palette: green = actual, apricot = forecast, sage = reference/previous.
export const CHART = { actual: '#173F35', mint: '#9fd3b4', forecast: '#F4A261', previous: '#9aa59c', grid: '#EDF0EC', axis: '#78827B' };
const AXIS = { fontSize: 11, fill: CHART.axis };

const NoData = ({ text = 'No spending recorded for this period.' }) => (
  <EmptyState icon={BarChart3} title="Nothing to chart yet" message={text} />
);

export function Legend({ items }) {
  return (
    <div className="chart-legend">
      {items.map((i) => (
        <span key={i.label}><i className={i.dashed ? 'dashed' : ''} style={{ borderTopColor: i.color }} />{i.label}</span>
      ))}
    </div>
  );
}

/**
 * Cumulative spending by day of month: actual (solid green), previous month (grey dashed) and,
 * for a running month, a clearly labelled forecast extension (apricot dashed) to the projected total.
 */
export function TrendForecastChart({ cumulative, month, previousMonth, elapsed, projected, isComplete, height = 300 }) {
  if (!cumulative.some((d) => d.current > 0 || d.previous > 0)) return <NoData text="No spending in either month yet." />;
  const days = cumulative.length;
  const showForecast = !isComplete && elapsed > 0 && elapsed < days && projected > 0;
  const now = showForecast ? cumulative[elapsed - 1].current || 0 : 0;
  const data = cumulative.map((d) => ({
    day: d.day,
    actual: d.current,
    previous: d.previous,
    forecast: showForecast && d.day >= elapsed ? Math.round(now + ((projected - now) * (d.day - elapsed)) / (days - elapsed)) : null,
  }));
  const items = [
    { label: `${monthLabel(month)} (actual)`, color: CHART.actual },
    { label: monthLabel(previousMonth), color: CHART.previous, dashed: true },
    ...(showForecast ? [{ label: 'Forecast to month-end', color: CHART.forecast, dashed: true }] : []),
  ];
  return (
    <div className="fade-in">
      <div style={{ height }} role="img" aria-label="Cumulative spending this month compared with last month, with forecast">
        <ResponsiveContainer>
          <ComposedChart data={data} margin={{ top: 12, right: 12, left: -6, bottom: 0 }}>
            <defs>
              <linearGradient id="actualFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={CHART.actual} stopOpacity={0.14} />
                <stop offset="100%" stopColor={CHART.actual} stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid stroke={CHART.grid} vertical={false} />
            <XAxis dataKey="day" tick={AXIS} axisLine={false} tickLine={false} minTickGap={18} />
            <YAxis tickFormatter={formatCompact} tick={AXIS} axisLine={false} tickLine={false} width={52} />
            <Tooltip content={<ChartTooltip labelFormatter={(d) => `Day ${d}`} />} />
            {showForecast && <ReferenceLine x={elapsed} stroke="#c9d1ca" label={{ value: 'Today', position: 'insideTopLeft', fill: CHART.axis, fontSize: 11 }} />}
            <Line type="monotone" dataKey="previous" name={monthLabel(previousMonth)} stroke={CHART.previous} strokeWidth={1.75} strokeDasharray="5 4" dot={false} isAnimationActive={false} />
            {showForecast && <Line type="linear" dataKey="forecast" name="Forecast" stroke={CHART.forecast} strokeWidth={2.25} strokeDasharray="6 4" dot={false} isAnimationActive={false} />}
            <Area type="monotone" dataKey="actual" name={monthLabel(month)} stroke={CHART.actual} strokeWidth={2.5} fill="url(#actualFill)" dot={false} isAnimationActive={false} connectNulls={false} />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
      <div className="mt-2"><Legend items={items} /></div>
    </div>
  );
}

/** Tiny axis-less trend line for metric cards. */
export function Sparkline({ data, dataKey, color = CHART.actual }) {
  if (!data || data.filter((d) => d[dataKey] > 0).length < 2) return null;
  return (
    <div className="spark" aria-hidden="true">
      <ResponsiveContainer>
        <AreaChart data={data} margin={{ top: 2, right: 0, left: 0, bottom: 0 }}>
          <Area type="monotone" dataKey={dataKey} stroke={color} strokeWidth={1.5} fill={color} fillOpacity={0.08} dot={false} isAnimationActive={false} />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

/** Last N months as bars; the highlighted month is forest green, the rest pale mint. */
export function MonthlyTrendChart({ data, selectedMonth }) {
  if (!data.some((d) => d.total > 0)) return <NoData text="No spending recorded in this period." />;
  return (
    <div style={{ height: 260 }} className="fade-in" role="img" aria-label="Monthly expense trend">
      <ResponsiveContainer>
        <BarChart data={data} margin={{ top: 8, right: 8, left: -6, bottom: 0 }}>
          <CartesianGrid stroke={CHART.grid} vertical={false} />
          <XAxis dataKey="month" tickFormatter={(m) => monthLabel(m, 'short').split(' ')[0]} tick={AXIS} axisLine={false} tickLine={false} />
          <YAxis tickFormatter={formatCompact} tick={AXIS} axisLine={false} tickLine={false} width={52} />
          <Tooltip cursor={{ fill: '#f4f6f3' }} content={<ChartTooltip labelFormatter={(m) => monthLabel(m)} />} />
          <Bar dataKey="total" name="Spent" radius={[5, 5, 0, 0]} maxBarSize={40} isAnimationActive={false}>
            {data.map((d) => <Cell key={d.month} fill={d.month === selectedMonth ? CHART.actual : CHART.mint} />)}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

/** Category donut with a compact legend. `stacked` puts the legend below (narrow columns). */
export function CategoryDonut({ data, height = 220, stacked = false, maxLegend = 7 }) {
  if (!data.length) return <NoData />;
  const total = data.reduce((s, d) => s + d.total, 0);
  return (
    <div className={stacked ? '' : 'row align-items-center g-3'}>
      <div className={stacked ? '' : 'col-md-6'}>
        <div style={{ height }} role="img" aria-label="Spending distribution by category" className="position-relative fade-in">
          <ResponsiveContainer>
            <PieChart>
              <Pie data={data} dataKey="total" nameKey="name" innerRadius="68%" outerRadius="94%" paddingAngle={2} stroke="none" isAnimationActive={false}>
                {data.map((d) => <Cell key={d.id} fill={d.color || '#9AA59C'} />)}
              </Pie>
              <Tooltip content={<ChartTooltip labelFormatter={(_, p) => p[0]?.name} />} />
            </PieChart>
          </ResponsiveContainer>
          <div className="position-absolute top-50 start-50 translate-middle text-center" style={{ pointerEvents: 'none' }}>
            <div className="eyebrow">Total</div>
            <div className="fw-bold tnum" style={{ fontSize: '1.15rem', letterSpacing: '-0.02em' }}>{formatCurrency(total)}</div>
          </div>
        </div>
      </div>
      <div className={stacked ? 'mt-3' : 'col-md-6'}>
        {data.slice(0, maxLegend).map((d) => (
          <div className="legend-row" key={d.id}>
            <span className="d-flex align-items-center gap-2 text-truncate"><span className="cat-dot" style={{ background: d.color }} />{d.name}</span>
            <span className="text-muted-sw text-nowrap tnum">{Number(d.percentage).toFixed(1)}%</span>
          </div>
        ))}
        {data.length > maxLegend && <div className="small-label mt-1">+ {data.length - maxLegend} more</div>}
      </div>
    </div>
  );
}

// mode: 'day' (x = day of month), 'date' (x = ISO date) or 'week' (x = ISO date of the week's Monday)
export function DailyChart({ data, average, mode = 'day' }) {
  if (!data.some((d) => d.total > 0)) return <NoData />;
  const key = mode === 'day' ? 'day' : 'date';
  const label = (v) => (mode === 'day' ? `Day ${v}` : mode === 'week' ? `Week of ${formatShortDate(v)}` : formatShortDate(v));
  return (
    <div style={{ height: 260 }} className="fade-in" role="img" aria-label={mode === 'week' ? 'Weekly expenses' : 'Daily expenses'}>
      <ResponsiveContainer>
        <BarChart data={data} margin={{ top: 8, right: 8, left: -6, bottom: 0 }}>
          <CartesianGrid stroke={CHART.grid} vertical={false} />
          <XAxis dataKey={key} tick={AXIS} axisLine={false} tickLine={false} minTickGap={16} tickFormatter={mode === 'day' ? undefined : formatShortDate} />
          <YAxis tickFormatter={formatCompact} tick={AXIS} axisLine={false} tickLine={false} width={52} />
          <Tooltip cursor={{ fill: '#f4f6f3' }} content={<ChartTooltip labelFormatter={label} />} />
          {average > 0 && <ReferenceLine y={average} stroke={CHART.forecast} strokeDasharray="4 4" label={{ value: 'Avg', fill: '#a85a16', fontSize: 11, position: 'insideTopRight' }} />}
          <Bar dataKey="total" name="Spent" fill={CHART.actual} radius={[3, 3, 0, 0]} maxBarSize={20} isAnimationActive={false} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
