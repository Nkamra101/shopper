import { useEffect, useState } from "react";
import SectionCard from "../components/SectionCard";
import { useToast } from "../components/Toast";
import { api } from "../services/api";

const dayNames = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
const dayAbbr = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

const fallbackRules = dayNames.map((_, index) => ({
  day_of_week: index,
  start_time: "09:00",
  end_time: "17:00",
  is_active: index < 5,
}));

const TIMEZONES = [
  { group: "Asia", options: [
    { value: "Asia/Kolkata", label: "Asia/Kolkata (IST, UTC+5:30)" },
    { value: "Asia/Dubai", label: "Asia/Dubai (GST, UTC+4)" },
    { value: "Asia/Tokyo", label: "Asia/Tokyo (JST, UTC+9)" },
    { value: "Asia/Shanghai", label: "Asia/Shanghai (CST, UTC+8)" },
    { value: "Asia/Singapore", label: "Asia/Singapore (SGT, UTC+8)" },
    { value: "Asia/Seoul", label: "Asia/Seoul (KST, UTC+9)" },
    { value: "Asia/Jakarta", label: "Asia/Jakarta (WIB, UTC+7)" },
    { value: "Asia/Karachi", label: "Asia/Karachi (PKT, UTC+5)" },
    { value: "Asia/Dhaka", label: "Asia/Dhaka (BST, UTC+6)" },
  ]},
  { group: "Europe", options: [
    { value: "Europe/London", label: "Europe/London (GMT/BST)" },
    { value: "Europe/Paris", label: "Europe/Paris (CET/CEST, UTC+1/2)" },
    { value: "Europe/Berlin", label: "Europe/Berlin (CET/CEST, UTC+1/2)" },
    { value: "Europe/Amsterdam", label: "Europe/Amsterdam (CET/CEST, UTC+1/2)" },
    { value: "Europe/Moscow", label: "Europe/Moscow (MSK, UTC+3)" },
    { value: "Europe/Istanbul", label: "Europe/Istanbul (TRT, UTC+3)" },
    { value: "Europe/Madrid", label: "Europe/Madrid (CET/CEST, UTC+1/2)" },
    { value: "Europe/Rome", label: "Europe/Rome (CET/CEST, UTC+1/2)" },
  ]},
  { group: "Americas", options: [
    { value: "America/New_York", label: "America/New_York (ET, UTC-5/-4)" },
    { value: "America/Chicago", label: "America/Chicago (CT, UTC-6/-5)" },
    { value: "America/Denver", label: "America/Denver (MT, UTC-7/-6)" },
    { value: "America/Los_Angeles", label: "America/Los_Angeles (PT, UTC-8/-7)" },
    { value: "America/Anchorage", label: "America/Anchorage (AKT, UTC-9/-8)" },
    { value: "America/Sao_Paulo", label: "America/Sao_Paulo (BRT, UTC-3)" },
    { value: "America/Mexico_City", label: "America/Mexico_City (CST/CDT)" },
    { value: "America/Toronto", label: "America/Toronto (ET, UTC-5/-4)" },
    { value: "America/Vancouver", label: "America/Vancouver (PT, UTC-8/-7)" },
  ]},
  { group: "Pacific & Africa", options: [
    { value: "Australia/Sydney", label: "Australia/Sydney (AEST/AEDT)" },
    { value: "Australia/Melbourne", label: "Australia/Melbourne (AEST/AEDT)" },
    { value: "Pacific/Auckland", label: "Pacific/Auckland (NZST/NZDT)" },
    { value: "Africa/Cairo", label: "Africa/Cairo (EET, UTC+2)" },
    { value: "Africa/Lagos", label: "Africa/Lagos (WAT, UTC+1)" },
    { value: "Africa/Nairobi", label: "Africa/Nairobi (EAT, UTC+3)" },
  ]},
  { group: "UTC", options: [
    { value: "UTC", label: "UTC (Coordinated Universal Time)" },
  ]},
];

const PRESET_SCHEDULES = [
  { label: "9–5 Weekdays", rules: dayNames.map((_, i) => ({ day_of_week: i, start_time: "09:00", end_time: "17:00", is_active: i < 5 })) },
  { label: "10–6 Weekdays", rules: dayNames.map((_, i) => ({ day_of_week: i, start_time: "10:00", end_time: "18:00", is_active: i < 5 })) },
  { label: "All Week 10–6", rules: dayNames.map((_, i) => ({ day_of_week: i, start_time: "10:00", end_time: "18:00", is_active: true })) },
  { label: "Evenings Only", rules: dayNames.map((_, i) => ({ day_of_week: i, start_time: "18:00", end_time: "22:00", is_active: i < 5 })) },
];

export default function AvailabilityPage() {
  const toast = useToast();
  const [timezone, setTimezone] = useState("Asia/Kolkata");
  const [rules, setRules] = useState(fallbackRules);
  const [blockouts, setBlockouts] = useState([]);
  const [newBlockoutDate, setNewBlockoutDate] = useState("");
  const [newBlockoutReason, setNewBlockoutReason] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savingBlockout, setSavingBlockout] = useState(false);

  useEffect(() => {
    async function loadAvailability() {
      try {
        const [data, blockoutsData] = await Promise.all([api.getAvailability(), api.getBlockouts()]);
        setTimezone(data.timezone);
        const normalized = fallbackRules.map((defaultRule) => {
          const existing = data.rules.find((r) => r.day_of_week === defaultRule.day_of_week);
          return existing
            ? { ...existing, start_time: existing.start_time.slice(0, 5), end_time: existing.end_time.slice(0, 5) }
            : defaultRule;
        });
        setRules(normalized);
        setBlockouts(blockoutsData);
      } catch (error) {
        toast.error(error.message || "Failed to load availability.");
      } finally {
        setLoading(false);
      }
    }
    loadAvailability();
  }, []);

  async function handleSubmit(event) {
    event.preventDefault();
    setSaving(true);
    try {
      await api.updateAvailability({ timezone, rules });
      toast.success("Availability saved!");
    } catch (error) {
      toast.error(error.message || "Could not save availability.");
    } finally {
      setSaving(false);
    }
  }

  async function handleAddBlockout(e) {
    e.preventDefault();
    if (!newBlockoutDate) return;
    setSavingBlockout(true);
    try {
      const added = await api.createBlockout({ date: newBlockoutDate, reason: newBlockoutReason });
      setBlockouts([...blockouts, added].sort((a, b) => a.date.localeCompare(b.date)));
      setNewBlockoutDate("");
      setNewBlockoutReason("");
      toast.success("Blockout date added.");
    } catch (error) {
      toast.error(error.message || "Failed to add blockout.");
    } finally {
      setSavingBlockout(false);
    }
  }

  async function handleDeleteBlockout(date) {
    if (!window.confirm(`Remove blockout for ${date}?`)) return;
    try {
      await api.deleteBlockout(date);
      setBlockouts((current) => current.filter((b) => b.date !== date));
      toast.success("Blockout removed.");
    } catch (error) {
      toast.error(error.message || "Failed to remove blockout.");
    }
  }

  function updateRule(index, changes) {
    setRules((current) => current.map((rule, i) => (i === index ? { ...rule, ...changes } : rule)));
  }

  function applyPreset(preset) {
    setRules(preset.rules);
    toast.info(`Applied preset: ${preset.label}`);
  }

  function useDetectedTimezone() {
    try {
      const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
      setTimezone(tz);
      toast.success(`Timezone set to ${tz}`);
    } catch {
      toast.error("Could not detect timezone.");
    }
  }

  const activeCount = rules.filter((r) => r.is_active).length;

  return (
    <div className="stack">
      {/* Weekly schedule */}
      <SectionCard
        title="Weekly availability"
        subtitle={`${activeCount} active day${activeCount !== 1 ? "s" : ""} · Set your recurring working hours`}
      >
        <form className="stack" onSubmit={handleSubmit}>
          {/* Timezone row */}
          <div className="availability-tz-row">
            <label style={{ flex: 1 }}>
              Timezone
              <select value={timezone} onChange={(e) => setTimezone(e.target.value)} disabled={loading}>
                {TIMEZONES.map((grp) => (
                  <optgroup key={grp.group} label={grp.group}>
                    {grp.options.map((opt) => (
                      <option key={opt.value} value={opt.value}>{opt.label}</option>
                    ))}
                  </optgroup>
                ))}
              </select>
            </label>
            <button type="button" className="secondary-button" onClick={useDetectedTimezone}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10" /><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
              </svg>
              Auto-detect
            </button>
          </div>

          {/* Presets */}
          <div className="preset-row">
            <span className="eyebrow">Quick presets</span>
            <div className="preset-chips">
              {PRESET_SCHEDULES.map((p) => (
                <button
                  key={p.label}
                  type="button"
                  className="preset-chip"
                  onClick={() => applyPreset(p)}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>

          {/* Day rows */}
          <div className="availability-table">
            {rules.map((rule, index) => (
              <div
                key={rule.day_of_week}
                className={`availability-row ${rule.is_active ? "" : "inactive"}`}
              >
                <label className="day-column" style={{ flexDirection: "row" }}>
                  <input
                    type="checkbox"
                    checked={rule.is_active}
                    onChange={(e) => updateRule(index, { is_active: e.target.checked })}
                    aria-label={`Enable ${dayNames[rule.day_of_week]}`}
                  />
                  <span className="day-name">{dayAbbr[rule.day_of_week]}</span>
                  <span className="day-name-full">{dayNames[rule.day_of_week]}</span>
                </label>
                <input
                  type="time"
                  value={rule.start_time}
                  disabled={!rule.is_active}
                  onChange={(e) => updateRule(index, { start_time: e.target.value })}
                  aria-label={`${dayNames[rule.day_of_week]} start time`}
                />
                <span className="time-divider">→</span>
                <input
                  type="time"
                  value={rule.end_time}
                  disabled={!rule.is_active}
                  onChange={(e) => updateRule(index, { end_time: e.target.value })}
                  aria-label={`${dayNames[rule.day_of_week]} end time`}
                />
                {rule.is_active && (
                  <span className="day-hours-label">
                    {(() => {
                      const [sh, sm] = rule.start_time.split(":").map(Number);
                      const [eh, em] = rule.end_time.split(":").map(Number);
                      const mins = (eh * 60 + em) - (sh * 60 + sm);
                      return mins > 0 ? `${Math.floor(mins / 60)}h${mins % 60 > 0 ? ` ${mins % 60}m` : ""}` : "";
                    })()}
                  </span>
                )}
                {!rule.is_active && <span className="day-unavailable-label">Unavailable</span>}
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

      {/* Blockout dates */}
      <SectionCard
        title="Blocked Dates"
        subtitle="Mark specific dates as completely unavailable (holidays, vacations, etc.)"
      >
        <form onSubmit={handleAddBlockout} className="form-grid" style={{ marginBottom: "var(--space-6)" }}>
          <label>
            Date
            <input
              type="date"
              value={newBlockoutDate}
              onChange={(e) => setNewBlockoutDate(e.target.value)}
              min={new Date().toISOString().slice(0, 10)}
              required
            />
          </label>
          <label>
            Reason (optional)
            <input
              type="text"
              placeholder="Vacation, holiday, personal…"
              value={newBlockoutReason}
              onChange={(e) => setNewBlockoutReason(e.target.value)}
            />
          </label>
          <div className="button-row full-width">
            <button type="submit" className="primary-button" disabled={!newBlockoutDate || savingBlockout}>
              {savingBlockout ? "Adding..." : "Block this date"}
            </button>
          </div>
        </form>

        {blockouts.length > 0 ? (
          <div className="blockout-list">
            {blockouts.map((b) => {
              const date = new Date(b.date + "T00:00:00");
              const formatted = date.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", year: "numeric" });
              return (
                <div key={b.id} className="blockout-row">
                  <div className="blockout-date-icon">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M18 6 6 18M6 6l12 12" />
                    </svg>
                  </div>
                  <div className="blockout-info">
                    <span className="blockout-date">{formatted}</span>
                    {b.reason && <span className="blockout-reason">{b.reason}</span>}
                  </div>
                  <button type="button" className="ghost-button" style={{ minHeight: 36, padding: "6px 14px", fontSize: 13 }} onClick={() => handleDeleteBlockout(b.date)}>
                    Remove
                  </button>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="blockout-empty">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="4" width="18" height="18" rx="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" />
            </svg>
            <p>No blocked dates. You're available every week!</p>
          </div>
        )}
      </SectionCard>
    </div>
  );
}
