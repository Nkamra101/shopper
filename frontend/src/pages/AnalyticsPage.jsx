import { useEffect, useState } from "react";
import { api } from "../services/api";
import { useToast } from "../components/Toast";
import SectionCard from "../components/SectionCard";
import { SkeletonStats } from "../components/Skeleton";

const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const HOURS = ["6am", "8am", "10am", "12pm", "2pm", "4pm", "6pm", "8pm"];

function MiniBarChart({ data, color = "var(--accent)", label }) {
  const max = Math.max(...data.map((d) => d.value), 1);
  return (
    <div className="mini-bar-chart">
      <p className="chart-label">{label}</p>
      <div className="bar-chart-bars">
        {data.map((d, i) => (
          <div key={i} className="bar-col">
            <div
              className="bar-fill"
              style={{
                height: `${Math.round((d.value / max) * 100)}%`,
                background: color,
              }}
              title={`${d.name}: ${d.value}`}
            />
            <span className="bar-x-label">{d.name}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function LineChart({ data, color = "var(--accent)", label }) {
  const max = Math.max(...data.map((d) => d.value), 1);
  const w = 500;
  const h = 120;
  const pad = 20;
  const points = data.map((d, i) => {
    const x = pad + (i / Math.max(data.length - 1, 1)) * (w - pad * 2);
    const y = h - pad - (d.value / max) * (h - pad * 2);
    return `${x},${y}`;
  });

  return (
    <div className="line-chart-wrap">
      <p className="chart-label">{label}</p>
      <svg viewBox={`0 0 ${w} ${h}`} className="line-chart-svg" preserveAspectRatio="none">
        <defs>
          <linearGradient id="lineGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity="0.3" />
            <stop offset="100%" stopColor={color} stopOpacity="0.02" />
          </linearGradient>
        </defs>
        {points.length > 1 && (
          <>
            <polygon
              points={`${pad},${h - pad} ${points.join(" ")} ${w - pad},${h - pad}`}
              fill="url(#lineGrad)"
            />
            <polyline
              points={points.join(" ")}
              fill="none"
              stroke={color}
              strokeWidth="2.5"
              strokeLinejoin="round"
              strokeLinecap="round"
            />
          </>
        )}
        {data.map((d, i) => {
          const [x, y] = points[i]?.split(",") || [];
          return (
            <circle key={i} cx={x} cy={y} r="4" fill={color} className="line-dot" />
          );
        })}
      </svg>
      <div className="line-chart-labels">
        {data.filter((_, i) => i % Math.ceil(data.length / 6) === 0).map((d, i) => (
          <span key={i}>{d.name}</span>
        ))}
      </div>
    </div>
  );
}

function HeatmapCell({ value, max }) {
  const intensity = max > 0 ? value / max : 0;
  const alpha = 0.08 + intensity * 0.82;
  return (
    <div
      className="heatmap-cell"
      title={`${value} bookings`}
      style={{ background: `rgba(99, 102, 241, ${alpha})` }}
    />
  );
}

export default function AnalyticsPage() {
  const toast = useToast();
  const [summary, setSummary] = useState(null);
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const [sum, bks] = await Promise.all([api.getSummary(), api.getBookings("all")]);
        setSummary(sum);
        setBookings(bks);
      } catch (err) {
        toast.error(err.message || "Failed to load analytics.");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  // --- Derived data ---
  const last30Days = (() => {
    const map = {};
    const now = new Date();
    for (let i = 29; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(d.getDate() - i);
      const key = d.toISOString().slice(0, 10);
      map[key] = 0;
    }
    bookings.forEach((b) => {
      const key = b.start_time?.slice(0, 10);
      if (key && key in map) map[key]++;
    });
    return Object.entries(map).map(([date, value]) => ({
      name: date.slice(5),
      value,
    }));
  })();

  const byDayOfWeek = (() => {
    const counts = Array(7).fill(0);
    bookings.forEach((b) => {
      const d = new Date(b.start_time);
      counts[(d.getDay() + 6) % 7]++;
    });
    return DAYS.map((name, i) => ({ name, value: counts[i] }));
  })();

  const byHour = (() => {
    const hourLabels = ["12a","1a","2a","3a","4a","5a","6a","7a","8a","9a","10a","11a","12p","1p","2p","3p","4p","5p","6p","7p","8p","9p","10p","11p"];
    const counts = Array(24).fill(0);
    bookings.forEach((b) => {
      const d = new Date(b.start_time);
      counts[d.getHours()]++;
    });
    return hourLabels.map((name, i) => ({ name, value: counts[i] }));
  })();

  const heatmapData = (() => {
    const grid = Array.from({ length: 7 }, () => Array(24).fill(0));
    bookings.forEach((b) => {
      const d = new Date(b.start_time);
      const day = (d.getDay() + 6) % 7;
      const hour = d.getHours();
      grid[day][hour]++;
    });
    return grid;
  })();
  const heatmapMax = Math.max(...heatmapData.flat(), 1);

  const topEventTypes = (() => {
    const counts = {};
    bookings.forEach((b) => {
      const t = b.event_type?.title || "Unknown";
      counts[t] = (counts[t] || 0) + 1;
    });
    return Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([name, value]) => ({ name, value }));
  })();

  const confirmedCount = bookings.filter((b) => b.status === "confirmed").length;
  const cancelledCount = bookings.filter((b) => b.status === "cancelled").length;
  const conversionRate = bookings.length > 0 ? Math.round((confirmedCount / bookings.length) * 100) : 0;

  const avgDuration = (() => {
    const counts = {};
    const sums = {};
    bookings.forEach((b) => {
      if (!b.event_type?.title) return;
      const t = b.event_type.title;
      counts[t] = (counts[t] || 0) + 1;
      sums[t] = (sums[t] || 0) + (b.event_type?.duration || 0);
    });
    const total = Object.values(sums).reduce((a, b) => a + b, 0);
    const count = Object.values(counts).reduce((a, b) => a + b, 0);
    return count > 0 ? Math.round(total / count) : 0;
  })();

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
      {/* KPI strip */}
      <div className="kpi-grid">
        {[
          { label: "Total Bookings", value: bookings.length, icon: "📅", color: "var(--accent)" },
          { label: "Confirmed", value: confirmedCount, icon: "✅", color: "var(--success)" },
          { label: "Cancelled", value: cancelledCount, icon: "❌", color: "var(--danger)" },
          { label: "Conversion Rate", value: `${conversionRate}%`, icon: "📈", color: "#f59e0b" },
          { label: "Avg Duration", value: `${avgDuration}m`, icon: "⏱", color: "#8b5cf6" },
          { label: "Upcoming", value: summary?.upcoming_bookings_count ?? 0, icon: "🔜", color: "#06b6d4" },
        ].map((kpi) => (
          <div key={kpi.label} className="kpi-card">
            <div className="kpi-icon" style={{ color: kpi.color }}>{kpi.icon}</div>
            <div className="kpi-value" style={{ color: kpi.color }}>{kpi.value}</div>
            <div className="kpi-label">{kpi.label}</div>
          </div>
        ))}
      </div>

      {/* Bookings over time */}
      <SectionCard title="Bookings over last 30 days" subtitle="Daily booking volume trend">
        {bookings.length === 0 ? (
          <div className="chart-empty">No booking data yet. Share your booking links to get started.</div>
        ) : (
          <LineChart data={last30Days} label="" />
        )}
      </SectionCard>

      <div className="analytics-two-col">
        {/* Day of week */}
        <SectionCard title="Bookings by Day of Week" subtitle="When guests prefer to book">
          <MiniBarChart data={byDayOfWeek} color="var(--accent)" label="" />
        </SectionCard>

        {/* Top event types */}
        <SectionCard title="Top Event Types" subtitle="Most booked event types">
          {topEventTypes.length === 0 ? (
            <div className="chart-empty">No data yet.</div>
          ) : (
            <div className="top-events-list">
              {topEventTypes.map((et, i) => (
                <div key={et.name} className="top-event-row">
                  <span className="top-event-rank">#{i + 1}</span>
                  <span className="top-event-name">{et.name}</span>
                  <div className="top-event-bar-wrap">
                    <div
                      className="top-event-bar"
                      style={{
                        width: `${Math.round((et.value / (topEventTypes[0]?.value || 1)) * 100)}%`,
                        background: `hsl(${240 - i * 30}, 70%, 60%)`,
                      }}
                    />
                  </div>
                  <span className="top-event-count">{et.value}</span>
                </div>
              ))}
            </div>
          )}
        </SectionCard>
      </div>

      {/* Heatmap */}
      <SectionCard title="Booking Heatmap" subtitle="Day vs. hour — darker = more bookings">
        <div className="heatmap-container">
          <div className="heatmap-y-labels">
            {DAYS.map((d) => <span key={d}>{d}</span>)}
          </div>
          <div className="heatmap-grid">
            <div className="heatmap-x-labels">
              {Array.from({ length: 24 }).map((_, h) => (
                <span key={h}>{h % 3 === 0 ? `${h}h` : ""}</span>
              ))}
            </div>
            {heatmapData.map((row, di) => (
              <div key={di} className="heatmap-row">
                {row.map((val, hi) => (
                  <HeatmapCell key={hi} value={val} max={heatmapMax} />
                ))}
              </div>
            ))}
          </div>
        </div>
      </SectionCard>

      {/* Hour distribution */}
      <SectionCard title="Bookings by Hour" subtitle="Peak booking hours throughout the day">
        <MiniBarChart data={byHour} color="var(--success)" label="" />
      </SectionCard>
    </div>
  );
}
