import { useEffect, useMemo, useState } from "react";
import SectionCard from "../components/SectionCard";
import Icon from "../components/Icon";
import { useToast } from "../components/Toast";
import { api } from "../services/api";
import { browserTimezone, toDateInputValue } from "../utils/date";

const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

const makeWindow = (start, end) => ({ start_time: start, end_time: end });

function buildWeek(windowsFor, isOn) {
  return DAYS.map((_, index) => ({
    day_of_week: index,
    is_active: isOn(index),
    windows: isOn(index) ? windowsFor(index) : [],
  }));
}

const PRESETS = [
  { label: "Weekdays 9–5", build: () => buildWeek(() => [makeWindow("09:00", "17:00")], (i) => i < 5) },
  { label: "Weekdays, lunch break", build: () => buildWeek(() => [makeWindow("09:00", "13:00"), makeWindow("14:00", "17:00")], (i) => i < 5) },
  { label: "Mornings only", build: () => buildWeek(() => [makeWindow("08:00", "12:00")], (i) => i < 5) },
  { label: "Every day 10–6", build: () => buildWeek(() => [makeWindow("10:00", "18:00")], () => true) },
];

const DEFAULT_WEEK = PRESETS[0].build();

function rulesToWeek(rules) {
  const week = DAYS.map((_, index) => ({ day_of_week: index, is_active: false, windows: [] }));
  rules.forEach((rule) => {
    const day = week[rule.day_of_week];
    if (!day) return;
    day.windows.push({
      start_time: String(rule.start_time).slice(0, 5),
      end_time: String(rule.end_time).slice(0, 5),
    });
  });
  week.forEach((day) => {
    day.windows.sort((a, b) => a.start_time.localeCompare(b.start_time));
    day.is_active = day.windows.length > 0;
  });
  return week;
}

function weekToRules(week) {
  return week.flatMap((day) =>
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

/** Human-readable problem with the schedule, or "" when it's valid. */
function findProblem(week) {
  for (const day of week) {
    if (!day.is_active) continue;
    if (day.windows.length === 0) return `${DAYS[day.day_of_week]} is on but has no hours.`;
    for (const slot of day.windows) {
      if (!slot.start_time || !slot.end_time) return `${DAYS[day.day_of_week]}: fill in both times.`;
      if (slot.start_time >= slot.end_time) return `${DAYS[day.day_of_week]}: ${slot.start_time}–${slot.end_time} ends before it starts.`;
    }
    const sorted = [...day.windows].sort((a, b) => a.start_time.localeCompare(b.start_time));
    for (let i = 1; i < sorted.length; i += 1) {
      if (sorted[i].start_time < sorted[i - 1].end_time) {
        return `${DAYS[day.day_of_week]}: two windows overlap.`;
      }
    }
  }
  return "";
}

export default function AvailabilityPage() {
  const toast = useToast();
  const [timezone, setTimezone] = useState("Asia/Kolkata");
  const [zones, setZones] = useState([]);
  const [week, setWeek] = useState(DEFAULT_WEEK);
  const [blockouts, setBlockouts] = useState([]);
  const [draft, setDraft] = useState({ start_date: "", end_date: "", reason: "" });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const [availability, blocks] = await Promise.all([api.getAvailability(), api.getBlockouts()]);
        setTimezone(availability.timezone);
        setWeek(availability.rules.length ? rulesToWeek(availability.rules) : DEFAULT_WEEK);
        setBlockouts(blocks);
      } catch (error) {
        toast.error(error.message || "Could not load your availability.");
      } finally {
        setLoading(false);
      }
    })();
  }, [toast]);

  useEffect(() => {
    api.getTimezones().then(setZones).catch(() => setZones([]));
  }, []);

  const activeDays = useMemo(() => week.filter((day) => day.is_active).length, [week]);
  const weeklyHours = useMemo(() => {
    const minutes = week.reduce((total, day) => {
      if (!day.is_active) return total;
      return total + day.windows.reduce((sum, slot) => {
        if (!slot.start_time || !slot.end_time) return sum;
        const [sh, sm] = slot.start_time.split(":").map(Number);
        const [eh, em] = slot.end_time.split(":").map(Number);
        return sum + Math.max(0, eh * 60 + em - (sh * 60 + sm));
      }, 0);
    }, 0);
    return Math.round((minutes / 60) * 10) / 10;
  }, [week]);

  function updateDay(index, changes) {
    setWeek((current) => current.map((day, i) => (i === index ? { ...day, ...changes } : day)));
  }

  function toggleDay(index, on) {
    setWeek((current) => current.map((day, i) => {
      if (i !== index) return day;
      const windows = on && day.windows.length === 0 ? [makeWindow("09:00", "17:00")] : day.windows;
      return { ...day, is_active: on, windows };
    }));
  }

  function updateWindow(dayIndex, windowIndex, changes) {
    setWeek((current) => current.map((day, i) => (i === dayIndex
      ? { ...day, windows: day.windows.map((slot, j) => (j === windowIndex ? { ...slot, ...changes } : slot)) }
      : day)));
  }

  function addWindow(dayIndex) {
    setWeek((current) => current.map((day, i) => {
      if (i !== dayIndex) return day;
      const last = day.windows[day.windows.length - 1];
      const [hour, minute] = (last ? last.end_time : "09:00").split(":").map(Number);
      const pad = (n) => String(Math.min(23, n)).padStart(2, "0");
      return {
        ...day,
        is_active: true,
        windows: [...day.windows, makeWindow(`${pad(hour + 1)}:${String(minute).padStart(2, "0")}`, `${pad(hour + 4)}:${String(minute).padStart(2, "0")}`)],
      };
    }));
  }

  function removeWindow(dayIndex, windowIndex) {
    setWeek((current) => current.map((day, i) => {
      if (i !== dayIndex) return day;
      const windows = day.windows.filter((_, j) => j !== windowIndex);
      return { ...day, windows, is_active: windows.length > 0 && day.is_active };
    }));
  }

  function copyToWeekdays(dayIndex) {
    const source = week[dayIndex];
    setWeek((current) => current.map((day) => (day.day_of_week < 5
      ? { ...day, is_active: source.is_active, windows: source.windows.map((slot) => ({ ...slot })) }
      : day)));
    toast.success("Copied to every weekday.");
  }

  async function save(event) {
    event.preventDefault();
    const problem = findProblem(week);
    if (problem) { toast.error(problem); return; }

    setSaving(true);
    try {
      const saved = await api.updateAvailability({ timezone, rules: weekToRules(week) });
      setWeek(saved.rules.length ? rulesToWeek(saved.rules) : week);
      toast.success("Availability saved.");
    } catch (error) {
      toast.error(error.message || "Could not save your availability.");
    } finally {
      setSaving(false);
    }
  }

  async function addBlockout(event) {
    event.preventDefault();
    if (!draft.start_date) return;
    try {
      const created = await api.createBlockout({
        start_date: draft.start_date,
        end_date: draft.end_date || draft.start_date,
        reason: draft.reason,
      });
      setBlockouts((current) => [...current, created].sort((a, b) => a.start_date.localeCompare(b.start_date)));
      setDraft({ start_date: "", end_date: "", reason: "" });
      toast.success("Dates blocked.");
    } catch (error) {
      toast.error(error.message || "Could not block those dates.");
    }
  }

  async function removeBlockout(id) {
    try {
      await api.deleteBlockout(id);
      setBlockouts((current) => current.filter((item) => item.id !== id));
    } catch (error) {
      toast.error(error.message || "Could not remove that blockout.");
    }
  }

  const today = toDateInputValue(new Date());
  const dateOptions = { weekday: "short", month: "short", day: "numeric", year: "numeric" };

  return (
    <div className="stack">
      <div className="grid-auto">
        <div className="card stat"><p className="stat-label">Active days</p><p className="stat-value">{activeDays}</p></div>
        <div className="card stat"><p className="stat-label">Hours per week</p><p className="stat-value">{weeklyHours}</p></div>
        <div className="card stat"><p className="stat-label">Blockouts</p><p className="stat-value">{blockouts.length}</p></div>
      </div>

      <SectionCard
        title="Weekly schedule"
        subtitle="Add more than one window to a day for a lunch break or split shift."
      >
        <form className="stack-4" onSubmit={save}>
          <div className="row-wrap" style={{ alignItems: "flex-end" }}>
            <div className="field" style={{ flex: "0 1 320px" }}>
              <label className="field-label" htmlFor="tz">Timezone</label>
              {zones.length ? (
                <select id="tz" className="select" value={timezone} disabled={loading}
                        onChange={(event) => setTimezone(event.target.value)}>
                  {(zones.includes(timezone) ? zones : [timezone, ...zones]).map((zone) => (
                    <option key={zone} value={zone}>{zone.replace(/_/g, " ")}</option>
                  ))}
                </select>
              ) : (
                <input id="tz" className="input" value={timezone} disabled={loading}
                       onChange={(event) => setTimezone(event.target.value)} />
              )}
            </div>
            <button type="button" className="btn" onClick={() => {
              const detected = browserTimezone();
              setTimezone(detected);
              toast.success(`Timezone set to ${detected}.`);
            }}>
              Detect
            </button>
          </div>

          <div className="row-wrap" style={{ gap: 6 }}>
            {PRESETS.map((preset) => (
              <button key={preset.label} type="button" className="chip" onClick={() => setWeek(preset.build())}>
                {preset.label}
              </button>
            ))}
          </div>

          <div className="day-list">
            {week.map((day, dayIndex) => (
              <div key={day.day_of_week} className={`day-row${day.is_active ? "" : " is-off"}`}>
                <label className="day-toggle">
                  <input type="checkbox" checked={day.is_active}
                         onChange={(event) => toggleDay(dayIndex, event.target.checked)} />
                  <span className="day-name">{DAYS[day.day_of_week]}</span>
                </label>

                {day.is_active ? (
                  <div className="day-windows">
                    {day.windows.map((slot, windowIndex) => (
                      <div className="day-window" key={windowIndex}>
                        <input className="input" type="time" value={slot.start_time}
                               onChange={(event) => updateWindow(dayIndex, windowIndex, { start_time: event.target.value })} />
                        <span className="tiny subtle">to</span>
                        <input className="input" type="time" value={slot.end_time}
                               onChange={(event) => updateWindow(dayIndex, windowIndex, { end_time: event.target.value })} />
                        <button type="button" className="btn btn-icon btn-ghost btn-icon-sm"
                                aria-label="Remove this window"
                                onClick={() => removeWindow(dayIndex, windowIndex)}>
                          <Icon name="close" size={13} />
                        </button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <span className="small subtle" style={{ paddingTop: 7 }}>Unavailable</span>
                )}

                <div className="day-tools">
                  {day.is_active && (
                    <>
                      <button type="button" className="btn-link" onClick={() => addWindow(dayIndex)}>Add window</button>
                      {day.day_of_week < 5 && (
                        <button type="button" className="btn-link" onClick={() => copyToWeekdays(dayIndex)}>Copy to weekdays</button>
                      )}
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>

          <div>
            <button type="submit" className="btn btn-primary" disabled={saving || loading}>
              {saving ? <><span className="spinner" /> Saving…</> : "Save availability"}
            </button>
          </div>
        </form>
      </SectionCard>

      <SectionCard title="Blocked dates" subtitle="Holidays, leave, travel — block a day or a whole range.">
        <form className="stack-4" onSubmit={addBlockout}>
          <div className="grid-2">
            <div className="field">
              <label className="field-label" htmlFor="from">From</label>
              <input id="from" className="input" type="date" min={today} required value={draft.start_date}
                     onChange={(event) => setDraft({ ...draft, start_date: event.target.value })} />
            </div>
            <div className="field">
              <label className="field-label" htmlFor="to">To <span className="opt">optional</span></label>
              <input id="to" className="input" type="date" min={draft.start_date || today} value={draft.end_date}
                     onChange={(event) => setDraft({ ...draft, end_date: event.target.value })} />
            </div>
          </div>

          <div className="field">
            <label className="field-label" htmlFor="reason">Reason <span className="opt">optional</span></label>
            <input id="reason" className="input" value={draft.reason} placeholder="Holiday, travel, conference"
                   onChange={(event) => setDraft({ ...draft, reason: event.target.value })} />
          </div>

          <div>
            <button type="submit" className="btn btn-primary" disabled={!draft.start_date}>Block these dates</button>
          </div>
        </form>

        <div className="stack-2" style={{ marginTop: "var(--s5)" }}>
          {blockouts.length === 0 ? (
            <p className="empty small">Nothing blocked out yet.</p>
          ) : (
            blockouts.map((blockout) => {
              const start = new Date(`${blockout.start_date}T00:00:00`);
              const end = new Date(`${blockout.end_date}T00:00:00`);
              const label = blockout.start_date === blockout.end_date
                ? start.toLocaleDateString("en-US", dateOptions)
                : `${start.toLocaleDateString("en-US", dateOptions)} → ${end.toLocaleDateString("en-US", dateOptions)}`;

              return (
                <div key={blockout.id} className="list-bordered">
                  <div className="list-row">
                    <div>
                      <p className="small" style={{ fontWeight: 600 }}>{label}</p>
                      {blockout.reason ? <p className="tiny subtle">{blockout.reason}</p> : null}
                    </div>
                    <button className="btn btn-sm btn-ghost btn-danger" onClick={() => removeBlockout(blockout.id)}>Remove</button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </SectionCard>
    </div>
  );
}
