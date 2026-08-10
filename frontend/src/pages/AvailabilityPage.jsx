import { useEffect, useMemo, useState } from "react";
import SectionCard from "../components/SectionCard";
import { useToast } from "../components/Toast";
import { api } from "../services/api";
import { browserTimezone, toDateInputValue } from "../utils/date";

const DAY_NAMES = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
const DAY_ABBR = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

/** One editable row. Each day owns a list of windows, so lunch breaks work. */
const emptyDay = (index) => ({ day_of_week: index, is_active: index < 5, windows: [] });

const makeWindow = (start, end) => ({ start_time: start, end_time: end });

function buildDays(makeWindows, isActive) {
  return DAY_NAMES.map((_, index) => ({
    day_of_week: index,
    is_active: isActive(index),
    windows: isActive(index) ? makeWindows(index) : [],
  }));
}

const PRESETS = [
  {
    label: "Weekdays 9–5",
    build: () => buildDays(() => [makeWindow("09:00", "17:00")], (i) => i < 5),
  },
  {
    label: "Weekdays 9–5, lunch 1–2",
    build: () => buildDays(() => [makeWindow("09:00", "13:00"), makeWindow("14:00", "17:00")], (i) => i < 5),
  },
  {
    label: "Mornings only",
    build: () => buildDays(() => [makeWindow("08:00", "12:00")], (i) => i < 5),
  },
  {
    label: "All week 10–6",
    build: () => buildDays(() => [makeWindow("10:00", "18:00")], () => true),
  },
];

const DEFAULT_DAYS = PRESETS[0].build();

/** Flat API rules -> one row per weekday holding its windows. */
function rulesToDays(rules) {
  const days = DAY_NAMES.map((_, index) => emptyDay(index));
  rules.forEach((rule) => {
    const day = days[rule.day_of_week];
    if (!day) return;
    day.windows.push({
      start_time: String(rule.start_time).slice(0, 5),
      end_time: String(rule.end_time).slice(0, 5),
    });
  });
  days.forEach((day) => {
    day.windows.sort((a, b) => a.start_time.localeCompare(b.start_time));
    day.is_active = day.windows.length > 0;
  });
  return days;
}

function daysToRules(days) {
  return days.flatMap((day) =>
    day.is_active
      ? day.windows.map((slot) => ({
          day_of_week: day.day_of_week,
          start_time: `${slot.start_time}:00`,
          end_time: `${slot.end_time}:00`,
          is_active: true,
        }))
      : []
  );
}

/** Returns a human-readable problem with the schedule, or "". */
function validateDays(days) {
  for (const day of days) {
    if (!day.is_active) continue;
    if (day.windows.length === 0) {
      return `${DAY_NAMES[day.day_of_week]} is switched on but has no hours. Add a window or switch it off.`;
    }
    for (const slot of day.windows) {
      if (!slot.start_time || !slot.end_time) {
        return `${DAY_NAMES[day.day_of_week]}: fill in both times.`;
      }
      if (slot.start_time >= slot.end_time) {
        return `${DAY_NAMES[day.day_of_week]}: ${slot.start_time} to ${slot.end_time} ends before it starts.`;
      }
    }
    const sorted = [...day.windows].sort((a, b) => a.start_time.localeCompare(b.start_time));
    for (let i = 1; i < sorted.length; i += 1) {
      if (sorted[i].start_time < sorted[i - 1].end_time) {
        return `${DAY_NAMES[day.day_of_week]}: two windows overlap. Give each its own block of time.`;
      }
    }
  }
  return "";
}

function formatRange(start, end) {
  const label = (value) => new Date(`2000-01-01T${value}:00`).toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
  });
  return `${label(start)} – ${label(end)}`;
}

export default function AvailabilityPage() {
  const toast = useToast();
  const [timezone, setTimezone] = useState("Asia/Kolkata");
  const [timezoneOptions, setTimezoneOptions] = useState([]);
  const [days, setDays] = useState(DEFAULT_DAYS);
  const [blockouts, setBlockouts] = useState([]);
  const [newBlockout, setNewBlockout] = useState({ start_date: "", end_date: "", reason: "" });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    async function load() {
      try {
        const [availability, blockoutData] = await Promise.all([
          api.getAvailability(),
          api.getBlockouts(),
        ]);
        setTimezone(availability.timezone);
        setDays(availability.rules.length ? rulesToDays(availability.rules) : DEFAULT_DAYS);
        setBlockouts(blockoutData);
      } catch (error) {
        toast.error(error.message || "Failed to load availability.");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [toast]);

  useEffect(() => {
    // Non-critical: the field falls back to free text if this fails.
    api.getTimezones().then(setTimezoneOptions).catch(() => setTimezoneOptions([]));
  }, []);

  const activeDays = useMemo(() => days.filter((day) => day.is_active).length, [days]);
  const weeklyHours = useMemo(() => {
    const minutes = days.reduce((total, day) => {
      if (!day.is_active) return total;
      return total + day.windows.reduce((dayTotal, slot) => {
        if (!slot.start_time || !slot.end_time) return dayTotal;
        const [sh, sm] = slot.start_time.split(":").map(Number);
        const [eh, em] = slot.end_time.split(":").map(Number);
        return dayTotal + Math.max(0, eh * 60 + em - (sh * 60 + sm));
      }, 0);
    }, 0);
    return Math.round((minutes / 60) * 10) / 10;
  }, [days]);

  function updateDay(dayIndex, changes) {
    setDays((current) =>
      current.map((day, index) => (index === dayIndex ? { ...day, ...changes } : day))
    );
  }

  function toggleDay(dayIndex, isActive) {
    setDays((current) =>
      current.map((day, index) => {
        if (index !== dayIndex) return day;
        // Turning a blank day on should give it something to edit.
        const windows = isActive && day.windows.length === 0 ? [makeWindow("09:00", "17:00")] : day.windows;
        return { ...day, is_active: isActive, windows };
      })
    );
  }

  function updateWindow(dayIndex, windowIndex, changes) {
    setDays((current) =>
      current.map((day, index) => {
        if (index !== dayIndex) return day;
        return {
          ...day,
          windows: day.windows.map((slot, i) => (i === windowIndex ? { ...slot, ...changes } : slot)),
        };
      })
    );
  }

  function addWindow(dayIndex) {
    setDays((current) =>
      current.map((day, index) => {
        if (index !== dayIndex) return day;
        const last = day.windows[day.windows.length - 1];
        // Start the new window an hour after the previous one ends.
        const start = last ? last.end_time : "09:00";
        const [hour, minute] = start.split(":").map(Number);
        const nextStart = `${String(Math.min(22, hour + 1)).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
        const nextEnd = `${String(Math.min(23, hour + 4)).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
        return { ...day, is_active: true, windows: [...day.windows, makeWindow(nextStart, nextEnd)] };
      })
    );
  }

  function removeWindow(dayIndex, windowIndex) {
    setDays((current) =>
      current.map((day, index) => {
        if (index !== dayIndex) return day;
        const windows = day.windows.filter((_, i) => i !== windowIndex);
        return { ...day, windows, is_active: windows.length > 0 ? day.is_active : false };
      })
    );
  }

  function copyToWeekdays(dayIndex) {
    const source = days[dayIndex];
    setDays((current) =>
      current.map((day) =>
        day.day_of_week < 5
          ? { ...day, is_active: source.is_active, windows: source.windows.map((slot) => ({ ...slot })) }
          : day
      )
    );
    toast.success("Copied to every weekday.");
  }

  async function handleSave(event) {
    event.preventDefault();
    const problem = validateDays(days);
    if (problem) {
      toast.error(problem);
      return;
    }

    setSaving(true);
    try {
      const saved = await api.updateAvailability({ timezone, rules: daysToRules(days) });
      setDays(saved.rules.length ? rulesToDays(saved.rules) : days);
      toast.success("Availability saved.");
    } catch (error) {
      toast.error(error.message || "Could not save availability.");
    } finally {
      setSaving(false);
    }
  }

  async function handleAddBlockout(event) {
    event.preventDefault();
    if (!newBlockout.start_date) return;
    try {
      const added = await api.createBlockout({
        start_date: newBlockout.start_date,
        end_date: newBlockout.end_date || newBlockout.start_date,
        reason: newBlockout.reason,
      });
      setBlockouts((current) =>
        [...current, added].sort((left, right) => left.start_date.localeCompare(right.start_date))
      );
      setNewBlockout({ start_date: "", end_date: "", reason: "" });
      toast.success("Dates blocked.");
    } catch (error) {
      toast.error(error.message || "Could not block those dates.");
    }
  }

  async function removeBlockout(id) {
    try {
      await api.deleteBlockout(id);
      setBlockouts((current) => current.filter((item) => item.id !== id));
      toast.success("Blockout removed.");
    } catch (error) {
      toast.error(error.message || "Could not remove blockout.");
    }
  }

  function detectTimezone() {
    const detected = browserTimezone();
    setTimezone(detected);
    toast.success(`Timezone set to ${detected}.`);
  }

  const today = toDateInputValue(new Date());

  return (
    <div className="stack">
      <section className="availability-hero">
        <div>
          <p className="eyebrow">Availability</p>
          <h3>When can people book you?</h3>
          <p>Set recurring hours, add breaks within a day, and block out time you're away.</p>
        </div>
        <div className="availability-hero-stats">
          <div className="availability-hero-card">
            <span>Active days</span>
            <strong>{activeDays}</strong>
          </div>
          <div className="availability-hero-card">
            <span>Hours / week</span>
            <strong>{weeklyHours}</strong>
          </div>
          <div className="availability-hero-card">
            <span>Blockouts</span>
            <strong>{blockouts.length}</strong>
          </div>
        </div>
      </section>

      <SectionCard title="Weekly schedule" subtitle="Add more than one window to a day for a lunch break or split shift.">
        <form className="stack" onSubmit={handleSave}>
          <div className="availability-toolbar">
            <label className="availability-timezone-field">
              Timezone
              {timezoneOptions.length ? (
                <select value={timezone} onChange={(event) => setTimezone(event.target.value)} disabled={loading}>
                  {(timezoneOptions.includes(timezone) ? timezoneOptions : [timezone, ...timezoneOptions]).map((zone) => (
                    <option key={zone} value={zone}>{zone.replace(/_/g, " ")}</option>
                  ))}
                </select>
              ) : (
                <input value={timezone} onChange={(event) => setTimezone(event.target.value)} disabled={loading} />
              )}
            </label>
            <button type="button" className="secondary-button" onClick={detectTimezone}>
              Detect
            </button>
          </div>

          <div className="preset-chips">
            {PRESETS.map((preset) => (
              <button key={preset.label} type="button" className="preset-chip" onClick={() => setDays(preset.build())}>
                {preset.label}
              </button>
            ))}
          </div>

          <div className="availability-days">
            {days.map((day, dayIndex) => (
              <div key={day.day_of_week} className={`availability-day${day.is_active ? "" : " inactive"}`}>
                <div className="availability-day-head">
                  <label className="availability-day-toggle">
                    <input
                      type="checkbox"
                      checked={day.is_active}
                      onChange={(event) => toggleDay(dayIndex, event.target.checked)}
                    />
                    <span className="day-name">{DAY_ABBR[day.day_of_week]}</span>
                    <span className="day-name-full">{DAY_NAMES[day.day_of_week]}</span>
                  </label>

                  <div className="availability-day-tools">
                    {day.is_active ? (
                      <>
                        <button type="button" className="link-button" onClick={() => addWindow(dayIndex)}>
                          + Add window
                        </button>
                        {day.day_of_week < 5 ? (
                          <button type="button" className="link-button" onClick={() => copyToWeekdays(dayIndex)}>
                            Copy to weekdays
                          </button>
                        ) : null}
                      </>
                    ) : (
                      <span className="day-hours-label">Unavailable</span>
                    )}
                  </div>
                </div>

                {day.is_active ? (
                  <div className="availability-windows">
                    {day.windows.map((slot, windowIndex) => (
                      <div className="availability-window" key={windowIndex}>
                        <input
                          type="time"
                          value={slot.start_time}
                          onChange={(event) => updateWindow(dayIndex, windowIndex, { start_time: event.target.value })}
                        />
                        <span className="time-divider">to</span>
                        <input
                          type="time"
                          value={slot.end_time}
                          onChange={(event) => updateWindow(dayIndex, windowIndex, { end_time: event.target.value })}
                        />
                        <button
                          type="button"
                          className="icon-button danger"
                          onClick={() => removeWindow(dayIndex, windowIndex)}
                          aria-label={`Remove ${formatRange(slot.start_time, slot.end_time)}`}
                          title="Remove this window"
                        >
                          ×
                        </button>
                      </div>
                    ))}
                  </div>
                ) : null}
              </div>
            ))}
          </div>

          <div className="button-row">
            <button type="submit" className="primary-button" disabled={saving || loading}>
              {saving ? "Saving..." : "Save availability"}
            </button>
          </div>
        </form>
      </SectionCard>

      <SectionCard title="Blocked dates" subtitle="Block a single day or a whole range — holidays, leave, travel.">
        <form onSubmit={handleAddBlockout} className="form-grid">
          <label>
            From
            <input
              type="date"
              min={today}
              value={newBlockout.start_date}
              onChange={(event) => setNewBlockout({ ...newBlockout, start_date: event.target.value })}
              required
            />
          </label>
          <label>
            To <span className="field-hint-inline">optional</span>
            <input
              type="date"
              min={newBlockout.start_date || today}
              value={newBlockout.end_date}
              onChange={(event) => setNewBlockout({ ...newBlockout, end_date: event.target.value })}
            />
          </label>
          <label className="full-width">
            Reason
            <input
              value={newBlockout.reason}
              onChange={(event) => setNewBlockout({ ...newBlockout, reason: event.target.value })}
              placeholder="Holiday, leave, travel"
            />
          </label>
          <div className="button-row full-width">
            <button type="submit" className="primary-button" disabled={!newBlockout.start_date}>
              Block these dates
            </button>
          </div>
        </form>

        <div className="blockout-list" style={{ marginTop: "var(--space-5)" }}>
          {blockouts.length === 0 ? (
            <div className="blockout-empty"><p>No blocked dates yet.</p></div>
          ) : (
            blockouts.map((blockout) => {
              const start = new Date(`${blockout.start_date}T00:00:00`);
              const end = new Date(`${blockout.end_date}T00:00:00`);
              const options = { weekday: "short", month: "short", day: "numeric", year: "numeric" };
              const label =
                blockout.start_date === blockout.end_date
                  ? start.toLocaleDateString("en-US", options)
                  : `${start.toLocaleDateString("en-US", options)} → ${end.toLocaleDateString("en-US", options)}`;
              return (
                <div key={blockout.id} className="blockout-row">
                  <div className="blockout-info">
                    <span className="blockout-date">{label}</span>
                    {blockout.reason ? <span className="blockout-reason">{blockout.reason}</span> : null}
                  </div>
                  <button type="button" className="ghost-button danger" onClick={() => removeBlockout(blockout.id)}>
                    Remove
                  </button>
                </div>
              );
            })
          )}
        </div>
      </SectionCard>
    </div>
  );
}
