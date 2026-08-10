import { useEffect, useMemo, useState } from "react";
import SectionCard from "../components/SectionCard";
import EmptyState from "../components/EmptyState";
import Icon from "../components/Icon";
import { SkeletonStats } from "../components/Skeleton";
import { useToast } from "../components/Toast";
import { api } from "../services/api";
import { browserTimezone, formatFullIn } from "../utils/date";

const RANGES = [
  { value: 7, label: "7 days" },
  { value: 30, label: "30 days" },
  { value: 90, label: "90 days" },
];

const DAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

function startOfDay(date) {
  const copy = new Date(date);
  copy.setHours(0, 0, 0, 0);
  return copy;
}

/** A simple SVG line chart. Deliberately dependency-free. */
function TrendChart({ points }) {
  const width = 640;
  const height = 180;
  const pad = { top: 14, right: 10, bottom: 22, left: 28 };
  const plotWidth = width - pad.left - pad.right;
  const plotHeight = height - pad.top - pad.bottom;
  const max = Math.max(...points.map((point) => point.value), 1);

  const coords = points.map((point, index) => ({
    ...point,
    x: pad.left + (points.length === 1 ? plotWidth / 2 : (index / (points.length - 1)) * plotWidth),
    y: pad.top + plotHeight - (point.value / max) * plotHeight,
  }));

  const line = coords.map((point) => `${point.x},${point.y}`).join(" ");
  // Deduped: a small max collapses the midpoint onto an endpoint.
  const ticks = [...new Set([0, Math.round(max / 2), max])];
  const labelEvery = Math.ceil(points.length / 6);

  return (
    <div style={{ overflowX: "auto" }}>
      <svg viewBox={`0 0 ${width} ${height}`} width="100%" height={height} role="img" aria-label="Bookings over time">
        {ticks.map((tick) => {
          const y = pad.top + plotHeight - (tick / max) * plotHeight;
          return (
            <g key={tick}>
              <line x1={pad.left} y1={y} x2={width - pad.right} y2={y} stroke="var(--c-line)" strokeDasharray="3 4" />
              <text x={pad.left - 7} y={y + 4} textAnchor="end" fontSize="10" fill="var(--c-ink-3)">{tick}</text>
            </g>
          );
        })}

        <polyline points={line} fill="none" stroke="var(--c-accent)" strokeWidth="2"
                  strokeLinecap="round" strokeLinejoin="round" />
        {coords.map((point) => (
          <circle key={point.label} cx={point.x} cy={point.y} r="2.5" fill="var(--c-accent)" />
        ))}

        {coords.map((point, index) => (
          index % labelEvery === 0 ? (
            <text key={`label-${point.label}`} x={point.x} y={height - 6} textAnchor="middle" fontSize="9.5" fill="var(--c-ink-3)">
              {point.label}
            </text>
          ) : null
        ))}
      </svg>
    </div>
  );
}

export default function AnalyticsPage() {
  const toast = useToast();
  const timezone = browserTimezone();

  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [range, setRange] = useState(30);

  useEffect(() => {
    (async () => {
      try {
        setBookings(await api.getBookings({ scope: "all" }));
      } catch (error) {
        toast.error(error.message || "Could not load analytics.");
      } finally {
        setLoading(false);
      }
    })();
  }, [toast]);

  const inRange = useMemo(() => {
    const cutoff = startOfDay(new Date());
    cutoff.setDate(cutoff.getDate() - range);
    return bookings.filter((booking) => new Date(booking.created_at || booking.start_time) >= cutoff);
  }, [bookings, range]);

  const stats = useMemo(() => {
    const confirmed = inRange.filter((booking) => booking.status !== "cancelled");
    const cancelled = inRange.length - confirmed.length;
    const minutes = confirmed.reduce((total, booking) => total + (booking.event_type?.duration || 0), 0);
    return {
      total: inRange.length,
      confirmed: confirmed.length,
      cancelled,
      hours: Math.round((minutes / 60) * 10) / 10,
      rate: inRange.length ? Math.round((confirmed.length / inRange.length) * 100) : 0,
    };
  }, [inRange]);

  const trend = useMemo(() => {
    const buckets = new Map();
    for (let index = range - 1; index >= 0; index -= 1) {
      const day = startOfDay(new Date());
      day.setDate(day.getDate() - index);
      buckets.set(day.toISOString().slice(0, 10), 0);
    }
    inRange.forEach((booking) => {
      const key = new Date(booking.created_at || booking.start_time).toISOString().slice(0, 10);
      if (buckets.has(key)) buckets.set(key, buckets.get(key) + 1);
    });
    return [...buckets.entries()].map(([key, value]) => ({
      label: new Date(`${key}T00:00:00`).toLocaleDateString("en-US", { month: "short", day: "numeric" }),
      value,
    }));
  }, [inRange, range]);

  const topEvents = useMemo(() => {
    const counts = new Map();
    inRange.forEach((booking) => {
      const title = booking.event_type?.title || "Unknown";
      counts.set(title, (counts.get(title) || 0) + 1);
    });
    const max = Math.max(...counts.values(), 1);
    return [...counts.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 6)
      .map(([title, count]) => ({ title, count, percent: Math.round((count / max) * 100) }));
  }, [inRange]);

  const byWeekday = useMemo(() => {
    const counts = Array(7).fill(0);
    inRange.forEach((booking) => {
      const index = (new Date(booking.start_time).getDay() + 6) % 7;
      counts[index] += 1;
    });
    const max = Math.max(...counts, 1);
    return counts.map((count, index) => ({
      label: DAY_LABELS[index], count, percent: Math.round((count / max) * 100),
    }));
  }, [inRange]);

  const recent = useMemo(
    () => [...inRange].sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0)).slice(0, 6),
    [inRange]
  );

  if (loading) return <div className="stack"><SkeletonStats /></div>;

  return (
    <div className="stack">
      <div className="toolbar">
        <p className="small muted">Based on bookings created in the selected window.</p>
        <div className="seg" role="tablist">
          {RANGES.map((item) => (
            <button key={item.value} type="button" role="tab" className="seg-item"
                    aria-selected={range === item.value} onClick={() => setRange(item.value)}>
              {item.label}
            </button>
          ))}
        </div>
      </div>

      <div className="grid-auto">
        <div className="card stat"><p className="stat-label">Bookings</p><p className="stat-value">{stats.total}</p></div>
        <div className="card stat"><p className="stat-label">Confirmed</p><p className="stat-value">{stats.confirmed}</p></div>
        <div className="card stat"><p className="stat-label">Cancelled</p><p className="stat-value">{stats.cancelled}</p></div>
        <div className="card stat"><p className="stat-label">Hours booked</p><p className="stat-value">{stats.hours}</p></div>
        <div className="card stat"><p className="stat-label">Kept</p><p className="stat-value">{stats.rate}%</p></div>
      </div>

      {inRange.length === 0 ? (
        <SectionCard title="Nothing to chart yet">
          <EmptyState
            icon="chart"
            title="No bookings in this window"
            description="Once people start booking, you'll see volume, popular days and your busiest event types here."
          />
        </SectionCard>
      ) : (
        <>
          <SectionCard title="Booking volume" subtitle={`New bookings over the last ${range} days.`}>
            <TrendChart points={trend} />
          </SectionCard>

          <div className="grid-2">
            <SectionCard title="Busiest event types">
              <div className="bars">
                {topEvents.map((item) => (
                  <div className="bar-row" key={item.title}>
                    <span className="truncate" title={item.title}>{item.title}</span>
                    <span className="bar-track"><span className="bar-fill" style={{ width: `${item.percent}%` }} /></span>
                    <span className="num subtle" style={{ textAlign: "right" }}>{item.count}</span>
                  </div>
                ))}
              </div>
            </SectionCard>

            <SectionCard title="Busiest weekdays">
              <div className="bars">
                {byWeekday.map((item) => (
                  <div className="bar-row" key={item.label}>
                    <span>{item.label}</span>
                    <span className="bar-track"><span className="bar-fill" style={{ width: `${item.percent}%` }} /></span>
                    <span className="num subtle" style={{ textAlign: "right" }}>{item.count}</span>
                  </div>
                ))}
              </div>
            </SectionCard>
          </div>

          <SectionCard title="Latest bookings">
            <div className="list">
              {recent.map((booking) => (
                <div className="list-row" key={booking.id}>
                  <div className="row-2" style={{ minWidth: 0 }}>
                    <span className="avatar" style={{ width: 26, height: 26, fontSize: "0.625rem" }}>
                      {(booking.booker_name || "?").slice(0, 1).toUpperCase()}
                    </span>
                    <div style={{ minWidth: 0 }}>
                      <p className="small truncate" style={{ fontWeight: 600 }}>{booking.booker_name}</p>
                      <p className="tiny subtle truncate">{booking.event_type?.title}</p>
                    </div>
                  </div>
                  <span className="tiny subtle" style={{ whiteSpace: "nowrap" }}>
                    {formatFullIn(booking.start_time, timezone)}
                  </span>
                </div>
              ))}
            </div>
          </SectionCard>
        </>
      )}
    </div>
  );
}
