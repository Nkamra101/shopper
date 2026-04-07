import { useEffect, useState } from "react";
import SectionCard from "../components/SectionCard";
import { useToast } from "../components/Toast";
import { api } from "../services/api";

const dayNames = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

const fallbackRules = dayNames.map((_, index) => ({
  day_of_week: index,
  start_time: "10:00",
  end_time: "17:00",
  is_active: index < 5,
}));

export default function AvailabilityPage() {
  const toast = useToast();
  const [timezone, setTimezone] = useState("Asia/Kolkata");
  const [rules, setRules] = useState(fallbackRules);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    async function loadAvailability() {
      try {
        const data = await api.getAvailability();
        setTimezone(data.timezone);
        const normalized = fallbackRules.map((defaultRule) => {
          const existing = data.rules.find((rule) => rule.day_of_week === defaultRule.day_of_week);
          return existing
            ? {
                ...existing,
                start_time: existing.start_time.slice(0, 5),
                end_time: existing.end_time.slice(0, 5),
              }
            : defaultRule;
        });
        setRules(normalized);
      } catch (error) {
        toast.error(error.message || "Failed to load availability.");
      } finally {
        setLoading(false);
      }
    }

    loadAvailability();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function updateRule(index, changes) {
    setRules((current) => current.map((rule, i) => (i === index ? { ...rule, ...changes } : rule)));
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setSaving(true);
    try {
      await api.updateAvailability({ timezone, rules });
      toast.success("Availability updated.");
    } catch (error) {
      toast.error(error.message || "Could not save availability.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <SectionCard
      title="Weekly availability"
      subtitle="Set working hours once and the public booking page will show matching slots automatically."
    >
      <form className="stack" onSubmit={handleSubmit}>
        <label className="timezone-row">
          Timezone
          <select value={timezone} onChange={(e) => setTimezone(e.target.value)} disabled={loading}>
            <option value="Asia/Kolkata">Asia/Kolkata</option>
            <option value="Asia/Dubai">Asia/Dubai</option>
            <option value="Europe/London">Europe/London</option>
            <option value="America/New_York">America/New_York</option>
          </select>
        </label>

        <div className="availability-table">
          {rules.map((rule, index) => (
            <div
              key={rule.day_of_week}
              className={rule.is_active ? "availability-row" : "availability-row inactive"}
            >
              <label className="day-column" style={{ flexDirection: "row" }}>
                <input
                  type="checkbox"
                  checked={rule.is_active}
                  onChange={(e) => updateRule(index, { is_active: e.target.checked })}
                  aria-label={`Enable ${dayNames[rule.day_of_week]}`}
                />
                <span>{dayNames[rule.day_of_week]}</span>
              </label>
              <input
                type="time"
                value={rule.start_time}
                disabled={!rule.is_active}
                onChange={(e) => updateRule(index, { start_time: e.target.value })}
                aria-label={`${dayNames[rule.day_of_week]} start time`}
              />
              <span className="time-divider">to</span>
              <input
                type="time"
                value={rule.end_time}
                disabled={!rule.is_active}
                onChange={(e) => updateRule(index, { end_time: e.target.value })}
                aria-label={`${dayNames[rule.day_of_week]} end time`}
              />
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
  );
}
