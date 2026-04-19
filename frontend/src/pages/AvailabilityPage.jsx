import { useEffect, useMemo, useState } from "react";
import SectionCard from "../components/SectionCard";
import { useToast } from "../components/Toast";
import { api } from "../services/api";

const DAY_NAMES = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
const DAY_ABBR = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

const DEFAULT_RULES = DAY_NAMES.map((_, index) => ({
  day_of_week: index,
  start_time: "09:00",
  end_time: "17:00",
  is_active: index < 5,
}));

const PRESETS = [
  { label: "Weekdays 9-5", rules: DAY_NAMES.map((_, index) => ({ day_of_week: index, start_time: "09:00", end_time: "17:00", is_active: index < 5 })) },
  { label: "Weekdays 10-6", rules: DAY_NAMES.map((_, index) => ({ day_of_week: index, start_time: "10:00", end_time: "18:00", is_active: index < 5 })) },
  { label: "All week 10-6", rules: DAY_NAMES.map((_, index) => ({ day_of_week: index, start_time: "10:00", end_time: "18:00", is_active: true })) },
];

export default function AvailabilityPage() {
  const toast = useToast();
  const [timezone, setTimezone] = useState("Asia/Kolkata");
  const [rules, setRules] = useState(DEFAULT_RULES);
  const [blockouts, setBlockouts] = useState([]);
  const [newBlockoutDate, setNewBlockoutDate] = useState("");
  const [newBlockoutReason, setNewBlockoutReason] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    async function loadAvailability() {
      try {
        const [availability, blockoutData] = await Promise.all([api.getAvailability(), api.getBlockouts()]);
        setTimezone(availability.timezone);
        setRules(
          DEFAULT_RULES.map((rule) => {
            const existing = availability.rules.find((item) => item.day_of_week === rule.day_of_week);
            return existing
              ? { ...existing, start_time: existing.start_time.slice(0, 5), end_time: existing.end_time.slice(0, 5) }
              : rule;
          })
        );
        setBlockouts(blockoutData);
      } catch (error) {
        toast.error(error.message || "Failed to load availability.");
      } finally {
        setLoading(false);
      }
    }

    loadAvailability();
  }, [toast]);

  const activeDays = useMemo(() => rules.filter((rule) => rule.is_active).length, [rules]);

  function updateRule(index, changes) {
    setRules((current) => current.map((rule, ruleIndex) => (ruleIndex === index ? { ...rule, ...changes } : rule)));
  }

  async function handleSave(event) {
    event.preventDefault();
    const invalid = rules.find((rule) => rule.is_active && rule.start_time >= rule.end_time);
    if (invalid) {
      toast.error(`${DAY_NAMES[invalid.day_of_week]}: end time must be after start time.`);
      return;
    }
    setSaving(true);
    try {
      await api.updateAvailability({ timezone, rules });
      toast.success("Availability saved.");
    } catch (error) {
      toast.error(error.message || "Could not save availability.");
    } finally {
      setSaving(false);
    }
  }

  async function handleAddBlockout(event) {
    event.preventDefault();
    if (!newBlockoutDate) return;
    try {
      const added = await api.createBlockout({ date: newBlockoutDate, reason: newBlockoutReason });
      setBlockouts((current) => [...current, added].sort((left, right) => left.date.localeCompare(right.date)));
      setNewBlockoutDate("");
      setNewBlockoutReason("");
      toast.success("Blocked date added.");
    } catch (error) {
      toast.error(error.message || "Could not add blocked date.");
    }
  }

  async function removeBlockout(date) {
    try {
      await api.deleteBlockout(date);
      setBlockouts((current) => current.filter((item) => item.date !== date));
      toast.success("Blocked date removed.");
    } catch (error) {
      toast.error(error.message || "Could not remove blocked date.");
    }
  }

  function useDetectedTimezone() {
    try {
      const detected = Intl.DateTimeFormat().resolvedOptions().timeZone;
      setTimezone(detected);
      toast.success(`Timezone set to ${detected}.`);
    } catch {
      toast.error("Could not detect timezone.");
    }
  }

  return (
    <div className="stack">
      <section className="availability-hero">
        <div>
          <p className="eyebrow">Availability controls</p>
          <h3>Make your schedule easy to manage.</h3>
          <p>Set weekly working hours, protect days off, and keep your booking pages aligned with your real availability.</p>
        </div>
        <div className="availability-hero-stats">
          <div className="availability-hero-card">
            <span>Active days</span>
            <strong>{activeDays}</strong>
          </div>
          <div className="availability-hero-card">
            <span>Blocked dates</span>
            <strong>{blockouts.length}</strong>
          </div>
        </div>
      </section>

      <SectionCard title="Weekly schedule" subtitle="Set recurring hours for each day.">
        <form className="stack" onSubmit={handleSave}>
          <div className="availability-toolbar">
            <label className="availability-timezone-field">
              Timezone
              <input value={timezone} onChange={(event) => setTimezone(event.target.value)} disabled={loading} />
            </label>
            <button type="button" className="secondary-button" onClick={useDetectedTimezone}>
              Detect timezone
            </button>
          </div>

          <div className="preset-chips">
            {PRESETS.map((preset) => (
              <button key={preset.label} type="button" className="preset-chip" onClick={() => setRules(preset.rules)}>
                {preset.label}
              </button>
            ))}
          </div>

          <div className="availability-table availability-table-enhanced">
            {rules.map((rule, index) => (
              <div key={rule.day_of_week} className={`availability-row ${rule.is_active ? "" : "inactive"}`}>
                <label className="day-column" style={{ flexDirection: "row" }}>
                  <input type="checkbox" checked={rule.is_active} onChange={(event) => updateRule(index, { is_active: event.target.checked })} />
                  <span className="day-name">{DAY_ABBR[rule.day_of_week]}</span>
                  <span className="day-name-full">{DAY_NAMES[rule.day_of_week]}</span>
                </label>
                <input type="time" value={rule.start_time} disabled={!rule.is_active} onChange={(event) => updateRule(index, { start_time: event.target.value })} />
                <span className="time-divider">to</span>
                <input type="time" value={rule.end_time} disabled={!rule.is_active} onChange={(event) => updateRule(index, { end_time: event.target.value })} />
                <span className="day-hours-label">{rule.is_active ? "Available" : "Off"}</span>
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

      <SectionCard title="Blocked dates" subtitle="Stop bookings on specific dates like holidays or leave days.">
        <form onSubmit={handleAddBlockout} className="form-grid">
          <label>
            Date
            <input type="date" value={newBlockoutDate} onChange={(event) => setNewBlockoutDate(event.target.value)} required />
          </label>
          <label>
            Reason
            <input value={newBlockoutReason} onChange={(event) => setNewBlockoutReason(event.target.value)} placeholder="Holiday, leave, travel" />
          </label>
          <div className="button-row full-width">
            <button type="submit" className="primary-button" disabled={!newBlockoutDate}>
              Block this date
            </button>
          </div>
        </form>

        <div className="blockout-list" style={{ marginTop: "var(--space-5)" }}>
          {blockouts.length === 0 ? (
            <div className="blockout-empty"><p>No blocked dates yet.</p></div>
          ) : (
            blockouts.map((blockout) => (
              <div key={blockout.id} className="blockout-row">
                <div className="blockout-info">
                  <span className="blockout-date">{new Date(`${blockout.date}T00:00:00`).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", year: "numeric" })}</span>
                  {blockout.reason ? <span className="blockout-reason">{blockout.reason}</span> : null}
                </div>
                <button type="button" className="ghost-button danger" onClick={() => removeBlockout(blockout.date)}>
                  Remove
                </button>
              </div>
            ))
          )}
        </div>
      </SectionCard>
    </div>
  );
}
