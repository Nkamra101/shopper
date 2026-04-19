import { useEffect, useMemo, useState } from "react";
import { api } from "../services/api";
import { useToast } from "../components/Toast";
import SectionCard from "../components/SectionCard";
import { SkeletonStats } from "../components/Skeleton";

const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

const RANGES = [
  { label: "7 days", days: 7 },
  { label: "30 days", days: 30 },
  { label: "90 days", days: 90 },
  { label: "All time", days: 0 },
];

function TrendChart({ data }) {
  const [hovered, setHovered] = useState(null);
  const W = 620;
  const H = 180;
  const PAD = { top: 16, right: 16, bottom: 28, left: 32 };
  const max = Math.max(...data.map((p) => p.value), 1);
  const plotW = W - PAD.left - PAD.right;
  const plotH = H - PAD.top - PAD.bottom;

  const pts = data.map((p, i) => ({
    ...p,
    x: PAD.left + (i / Math.max(data.length - 1, 1)) * plotW,
    y: PAD.top + plotH - (p.value / max) * plotH,
  }));

  const line = pts.map((p) => `${p.x},${p.y}`).join(" ");
  const area = `${PAD.left},${PAD.top + plotH} ${line} ${W - PAD.right},${PAD.top + plotH}`;

  const yTicks = [0, Math.round(max / 2), max];
  const xLabels = data.filter((_, i) => i % Math.ceil(data.length / 6) === 0);

  return (
    <div className="trend-chart-wrap">
      <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" style={{ width: "100%", height: 200 }}>
        <defs>
          <linearGradient id="trendFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--accent)" stopOpacity="0.22" />
            <stop offset="100%" stopColor="var(--accent)" stopOpacity="0" />
          </linearGradient>
        </defs>
        {yTicks.map((v) => {
          const cy = PAD.top + plotH - (v / max) * plotH;
          return (
            <g key={v}>
              <line x1={PAD.left} y1={cy} x2={W - PAD.right} y2={cy} stroke="var(--border)" strokeWidth="1" strokeDasharray="4 4" />
              <text x={PAD.left - 6} y={cy + 4} textAnchor="end" fontSize="10" fill="var(--text-subtle)">{v}</text>
            </g>
          );
        })}
        <polygon points={area} fill="url(#trendFill)" />
        <polyline points={line} fill="none" stroke="var(--accent)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
        {pts.map((p) => (
          <circle
            key={p.label}
            cx={p.x} cy={p.y} r={hovered === p.label ? 6 : 4}
            fill={hovered === p.label ? "var(--accent)" : "var(--surface-solid)"}
            stroke="var(--accent)" strokeWidth="2.5"
            style={{ cursor: "crosshair", transition: "r 100ms" }}
            onMouseEnter={() => setHovered(p.label)}
            onMouseLeave={() => setHovered(null)}
          />
        ))}
        {hovered && (() => {
          const p = pts.find((pt) => pt.label === hovered);
          if (!p) return null;
          const bw = 88; const bh = 36; const bx = Math.min(Math.max(p.x - bw / 2, 0), W - bw); const by = p.y - bh - 10;
          return (
            <g>
              <rect x={bx} y={by} width={bw} height={bh} rx="6" fill="var(--surface-solid)" stroke="var(--border)" />
              <text x={bx + bw / 2} y={by + 14} textAnchor="middle" fontSize="10" fill="var(--text-subtle)">{p.label}</text>
              <text x={bx + bw / 2} y={by + 28} textAnchor="middle" fontSize="13" fontWeight="700" fill="var(--text)">{p.value} booking{p.value !== 1 ? "s" : ""}</text>
            </g>
          );
        })()}
      </svg>
      <div className="trend-chart-x-labels">
        {xLabels.map((p) => <span key={p.label}>{p.label}</span>)}
      </div>
    </div>
  );
}

function BarChart({ data, color = "var(--accent)" }) {
  const max = Math.max(...data.map((d) => d.value), 1);
  return (
    <div className="bar-chart">
      {data.map((item) => (
        <div key={item.label} className="bar-chart-row">
          <span className="bar-chart-label">{item.label}</span>
          <div className="bar-chart-track">
            <div
              className="bar-chart-fill"
              style={{
                width: item.value === 0 ? "0%" : `${Math.max(3, Math.round((item.value / max) * 100))}%`,
                background: color,
              }}
            />
          </div>
          <span className="bar-chart-value">{item.value}</span>
        </div>
      ))}
    </div>
  );
}

function StatDelta({ value, prev }) {
  if (!prev) return null;
  const pct = prev === 0 ? (value > 0 ? 100 : 0) : Math.round(((value - prev) / prev) * 100);
  const up = pct >= 0;
  return (
    <span className={`stat-delta ${up ? "up" : "down"}`}>
      {up ? "↑" : "↓"} {Math.abs(pct)}%
    </span>
  );
}

export default function AnalyticsPage() {
  const toast = useToast();
  const [summary, setSummary] = useState(null);
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [rangeIndex, setRangeIndex] = useState(1);

  useEffect(() => {
    async function load() {
      try {
        const [s, b] = await Promise.all([api.getSummary(), api.getBookings("all")]);
        setSummary(s);
        setBookings(b);
      } catch (err) {
        toast.error(err.message || "Failed to load analytics.");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [toast]);

  const { days: rangeDays, label: rangeLabel } = RANGES[rangeIndex];

  const analytics = useMemo(() => {
    const now = new Date();
    const cutoff = rangeDays > 0 ? new Date(now.getTime() - rangeDays * 86400000) : null;
    const prevCutoff = rangeDays > 0 ? new Date(now.getTime() - rangeDays * 2 * 86400000) : null;

    const inRange = (b) => !cutoff || new Date(b.start_time) >= cutoff;
    const inPrev = (b) => prevCutoff && new Date(b.start_time) >= prevCutoff && new Date(b.start_time) < cutoff;

    const filtered = bookings.filter(inRange);
    const prevPeriod = bookings.filter(inPrev);

    const confirmed = filtered.filter((b) => b.status === "confirmed");
    const cancelled = filtered.filter((b) => b.status === "cancelled");
    const prevConfirmed = prevPeriod.filter((b) => b.status === "confirmed");

    const totalMinutes = confirmed.reduce((s, b) => s + (b.event_type?.duration || 0), 0);
    const avgDuration = confirmed.length ? Math.round(totalMinutes / confirmed.length) : 0;

    const spanDays = rangeDays || 90;
    const trendMap = new Map();
    for (let i = spanDays - 1; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(now.getDate() - i);
      trendMap.set(d.toISOString().slice(0, 10), 0);
    }
    filtered.forEach((b) => {
      const key = b.start_time?.slice(0, 10);
      if (key && trendMap.has(key)) trendMap.set(key, (trendMap.get(key) || 0) + 1);
    });

    const dayCounts = Array(7).fill(0);
    const hourCounts = Array(24).fill(0);
    const heatmap = Array.from({ length: 7 }, () => Array(24).fill(0));
    const etCounts = {};

    filtered.forEach((b) => {
      const d = new Date(b.start_time);
      const wd = (d.getDay() + 6) % 7;
      const hr = d.getHours();
      dayCounts[wd]++;
      hourCounts[hr]++;
      heatmap[wd][hr]++;
      const t = b.event_type?.title || "Unknown";
      etCounts[t] = (etCounts[t] || 0) + 1;
    });

    const topEventTypes = Object.entries(etCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([title, count]) => ({ title, count }));

    const bestDayIdx = dayCounts.indexOf(Math.max(...dayCounts, 0));
    const bestHourIdx = hourCounts.indexOf(Math.max(...hourCounts, 0));

    const topHours = hourCounts
      .map((v, i) => ({ hour: i, value: v }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 8)
      .sort((a, b) => a.hour - b.hour)
      .map(({ hour, value }) => ({
        label: `${hour.toString().padStart(2, "0")}:00`,
        value,
      }));

    const recentBookings = [...bookings]
      .sort((a, b) => new Date(b.start_time) - new Date(a.start_time))
      .slice(0, 8);

    const rate = filtered.length ? Math.round((confirmed.length / filtered.length) * 100) : 0;
    const cancelRate = filtered.length ? Math.round((cancelled.length / filtered.length) * 100) : 0;

    const trend = [...trendMap.entries()].map(([date, value]) => ({
      label: date.slice(5),
      value,
    }));

    return {
      total: filtered.length,
      confirmed: confirmed.length,
      cancelled: cancelled.length,
      prevConfirmed: prevConfirmed.length,
      avgDuration,
      rate,
      cancelRate,
      bestDay: filtered.length ? DAYS[bestDayIdx] : "—",
      bestHour: filtered.length ? `${bestHourIdx.toString().padStart(2, "0")}:00` : "—",
      trend,
      dayBreakdown: DAYS.map((l, i) => ({ label: l, value: dayCounts[i] })),
      topHours,
      heatmap,
      heatmapMax: Math.max(...heatmap.flat(), 1),
      topEventTypes,
      recentBookings,
    };
  }, [bookings, rangeDays]);

  if (loading) {
    return (
      <div className="stack">
        <SkeletonStats />
        <SkeletonStats />
      </div>
    );
  }

  return (
    <div className="stack">
      {/* Hero */}
      <section className="analytics-hero">
        <div className="analytics-hero-copy">
          <p className="eyebrow">Booking intelligence</p>
          <h3>See what's driving your calendar.</h3>
          <p>Track momentum, peak demand, top meeting types, and where guests engage most.</p>
        </div>
        <div className="analytics-hero-summary">
          <div className="analytics-hero-pill">
            <span className="status-dot" />
            {analytics.rate}% confirmation rate in this period
          </div>
          <div className="analytics-hero-grid">
            {[
              { label: "Total bookings", value: analytics.total },
              { label: "Confirmed", value: analytics.confirmed },
              { label: "Avg. duration", value: `${analytics.avgDuration} min` },
              { label: "Peak day", value: analytics.bestDay },
            ].map((item) => (
              <div key={item.label} className="analytics-hero-card">
                <span>{item.label}</span>
                <strong>{item.value}</strong>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Range picker + KPIs */}
      <div className="analytics-controls-row">
        <div className="analytics-range-pills">
          {RANGES.map((r, i) => (
            <button
              key={r.label}
              type="button"
              className={`analytics-range-pill ${i === rangeIndex ? "active" : ""}`}
              onClick={() => setRangeIndex(i)}
            >
              {r.label}
            </button>
          ))}
        </div>
        <span className="analytics-range-hint">Showing data for: <strong>{rangeLabel}</strong></span>
      </div>

      <div className="kpi-grid analytics-kpi-grid">
        {[
          { label: "Confirmed", value: analytics.confirmed, tone: "var(--success)", prev: analytics.prevConfirmed },
          { label: "Cancelled", value: analytics.cancelled, tone: "var(--danger)" },
          { label: "Confirmation rate", value: `${analytics.rate}%`, tone: "var(--accent)" },
          { label: "Cancellation rate", value: `${analytics.cancelRate}%`, tone: "#b45309" },
          { label: "Peak booking hour", value: analytics.bestHour, tone: "var(--accent)" },
          { label: "Event types", value: summary?.event_types_count ?? 0, tone: "#0f766e" },
        ].map((item) => (
          <div key={item.label} className="kpi-card analytics-kpi-card">
            <div className="kpi-value" style={{ color: item.tone }}>{item.value}</div>
            <div className="kpi-label">{item.label}</div>
            {item.prev !== undefined && (
              <StatDelta value={item.value} prev={item.prev} />
            )}
          </div>
        ))}
      </div>

      {/* Trend chart */}
      <SectionCard title="Booking trend" subtitle={`Daily volume — last ${rangeLabel}.`}>
        {analytics.total === 0 ? (
          <div className="chart-empty">No bookings in this period. Share your booking links to start collecting data.</div>
        ) : (
          <TrendChart data={analytics.trend} />
        )}
      </SectionCard>

      {/* Main grid */}
      <div className="analytics-dashboard-grid">
        <SectionCard title="Busiest weekdays" subtitle="Which days generate the most bookings.">
          <BarChart data={analytics.dayBreakdown} color="var(--accent)" />
        </SectionCard>

        <SectionCard title="Top event types" subtitle="Your most-booked meeting formats.">
          {analytics.topEventTypes.length === 0 ? (
            <div className="chart-empty">Your most-booked event types appear here.</div>
          ) : (
            <div className="analytics-rank-list">
              {analytics.topEventTypes.map((item, i) => (
                <div key={item.title} className="analytics-rank-row">
                  <span className="analytics-rank-badge">#{i + 1}</span>
                  <div className="analytics-rank-copy">
                    <strong>{item.title}</strong>
                    <span>{item.count} booking{item.count !== 1 ? "s" : ""}</span>
                  </div>
                  <span className="analytics-rank-bar-wrap">
                    <span
                      className="analytics-rank-bar"
                      style={{ width: `${Math.round((item.count / analytics.topEventTypes[0].count) * 100)}%` }}
                    />
                  </span>
                </div>
              ))}
            </div>
          )}
        </SectionCard>

        <SectionCard title="Booking heatmap" subtitle="Day × hour — darker means more activity.">
          <div className="analytics-heatmap-shell">
            <div className="analytics-heatmap-days">
              {DAYS.map((d) => <span key={d}>{d}</span>)}
            </div>
            <div className="analytics-heatmap-grid">
              {analytics.heatmap.map((row, ri) => (
                <div key={DAYS[ri]} className="analytics-heatmap-row">
                  {row.map((v, ci) => {
                    const alpha = analytics.heatmapMax ? 0.06 + (v / analytics.heatmapMax) * 0.84 : 0.06;
                    return (
                      <div
                        key={`${ri}-${ci}`}
                        className="analytics-heatmap-cell"
                        style={{ background: v > 0 ? `rgba(99,102,241,${alpha})` : "var(--surface-muted)" }}
                        title={v > 0 ? `${DAYS[ri]} ${ci.toString().padStart(2,"0")}:00 — ${v} booking${v !== 1 ? "s" : ""}` : undefined}
                      />
                    );
                  })}
                </div>
              ))}
            </div>
          </div>
          <div className="heatmap-legend">
            <span>Less</span>
            {[0.06, 0.25, 0.5, 0.75, 0.9].map((a) => (
              <span key={a} className="heatmap-legend-cell" style={{ background: `rgba(99,102,241,${a})` }} />
            ))}
            <span>More</span>
          </div>
        </SectionCard>

        <SectionCard title="Recent activity" subtitle="Latest bookings across all event types.">
          {analytics.recentBookings.length === 0 ? (
            <div className="chart-empty">Recent bookings will appear here.</div>
          ) : (
            <div className="analytics-activity-list">
              {analytics.recentBookings.map((b) => (
                <div key={b.id} className="analytics-activity-row">
                  <div className="analytics-activity-avatar">{(b.booker_name?.[0] || "?").toUpperCase()}</div>
                  <div className="analytics-activity-copy">
                    <strong>{b.booker_name}</strong>
                    <span>{b.event_type?.title || "Unknown event type"}</span>
                  </div>
                  <div className="analytics-activity-meta">
                    <span>{new Date(b.start_time).toLocaleDateString("en-US", { month: "short", day: "numeric" })}</span>
                    <span className={`status-pill ${b.status}`}>{b.status}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </SectionCard>
      </div>

      {/* Peak hours bar */}
      <SectionCard title="Peak booking hours" subtitle="Top hours with the most confirmed meetings.">
        {analytics.topHours.every((h) => h.value === 0) ? (
          <div className="chart-empty">No hourly data yet.</div>
        ) : (
          <BarChart data={analytics.topHours} color="linear-gradient(90deg, var(--accent), #06b6d4)" />
        )}
      </SectionCard>
    </div>
  );
}
