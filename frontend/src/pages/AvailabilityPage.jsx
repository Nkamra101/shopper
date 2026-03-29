import { useEffect, useState } from "react";
import SectionCard from "../components/SectionCard";
import { api } from "../services/api";

const dayNames = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

const fallbackRules = dayNames.map((_, index) => ({
  day_of_week: index,
  start_time: "10:00",
  end_time: "17:00",
  is_active: index < 5,
}));

export default function AvailabilityPage() {
  const [timezone, setTimezone] = useState("Asia/Kolkata");
  const [rules, setRules] = useState(fallbackRules);
  const [message, setMessage] = useState("");

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
        setMessage(error.message);
      }
    }

    loadAvailability();
  }, []);

  function updateRule(index, changes) {
    setRules((current) => current.map((rule, ruleIndex) => (ruleIndex === index ? { ...rule, ...changes } : rule)));
  }

  async function handleSubmit(event) {
    event.preventDefault();
    try {
      await api.updateAvailability({ timezone, rules });
      setMessage("Availability updated.");
    } catch (error) {
      setMessage(error.message);
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
          <select value={timezone} onChange={(event) => setTimezone(event.target.value)}>
            <option value="Asia/Kolkata">Asia/Kolkata</option>
            <option value="Asia/Dubai">Asia/Dubai</option>
            <option value="Europe/London">Europe/London</option>
            <option value="America/New_York">America/New_York</option>
          </select>
        </label>

        <div className="availability-table">
          {rules.map((rule, index) => (
            <div key={rule.day_of_week} className="availability-row">
              <div className="day-column">
                <input
                  type="checkbox"
                  checked={rule.is_active}
                  onChange={(event) => updateRule(index, { is_active: event.target.checked })}
                />
                <span>{dayNames[rule.day_of_week]}</span>
              </div>
              <input
                type="time"
                value={rule.start_time}
                disabled={!rule.is_active}
                onChange={(event) => updateRule(index, { start_time: event.target.value })}
              />
              <span className="time-divider">to</span>
              <input
                type="time"
                value={rule.end_time}
                disabled={!rule.is_active}
                onChange={(event) => updateRule(index, { end_time: event.target.value })}
              />
            </div>
          ))}
        </div>

        <div className="button-row">
          <button type="submit" className="primary-button">
            Save availability
          </button>
          {message ? <p className="inline-message">{message}</p> : null}
        </div>
      </form>
    </SectionCard>
  );
}

