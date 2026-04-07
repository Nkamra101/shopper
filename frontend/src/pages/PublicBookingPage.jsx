import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { api } from "../services/api";
import { formatDate, getUpcomingDates, toDateInputValue } from "../utils/date";
import { Skeleton } from "../components/Skeleton";
import ThemeToggle from "../components/ThemeToggle";
import { useToast } from "../components/Toast";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function validate(form) {
  const errors = {};
  if (!form.booker_name.trim()) errors.booker_name = "Your name is required.";
  if (!form.booker_email.trim()) {
    errors.booker_email = "Email is required.";
  } else if (!EMAIL_PATTERN.test(form.booker_email)) {
    errors.booker_email = "Enter a valid email address.";
  }
  return errors;
}

export default function PublicBookingPage() {
  const { slug } = useParams();
  const navigate = useNavigate();
  const toast = useToast();
  const dateChoices = useMemo(() => getUpcomingDates(10), []);
  const [eventType, setEventType] = useState(null);
  const [loadingEvent, setLoadingEvent] = useState(true);
  const [selectedDate, setSelectedDate] = useState(toDateInputValue(dateChoices[0]));
  const [slots, setSlots] = useState([]);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [selectedSlot, setSelectedSlot] = useState("");
  const [form, setForm] = useState({ booker_name: "", booker_email: "", notes: "" });
  const [touched, setTouched] = useState({});
  const [submitting, setSubmitting] = useState(false);

  const errors = useMemo(() => validate(form), [form]);
  const isValid = Object.keys(errors).length === 0 && !!selectedSlot;

  useEffect(() => {
    async function loadEvent() {
      setLoadingEvent(true);
      try {
        const data = await api.getPublicEventType(slug);
        setEventType(data);
      } catch (error) {
        toast.error(error.message || "Could not load event.");
      } finally {
        setLoadingEvent(false);
      }
    }
    loadEvent();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slug]);

  useEffect(() => {
    async function loadSlots() {
      if (!slug || !selectedDate) return;
      setLoadingSlots(true);
      try {
        const data = await api.getSlots(slug, selectedDate);
        setSlots(data);
        setSelectedSlot("");
      } catch (error) {
        toast.error(error.message || "Could not load slots.");
      } finally {
        setLoadingSlots(false);
      }
    }
    loadSlots();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slug, selectedDate]);

  async function handleSubmit(event) {
    event.preventDefault();
    setTouched({ booker_name: true, booker_email: true });
    if (!selectedSlot) {
      toast.error("Please choose a time slot first.");
      return;
    }
    if (Object.keys(errors).length > 0) return;

    setSubmitting(true);
    try {
      const booking = await api.createBooking(slug, { ...form, start_time: selectedSlot });
      navigate(`/book/${slug}/confirmed/${booking.id}`);
    } catch (error) {
      toast.error(error.message || "Could not confirm booking.");
    } finally {
      setSubmitting(false);
    }
  }

  function showError(field) {
    return touched[field] && errors[field];
  }

  return (
    <div className="public-page">
      <div style={{ position: "absolute", top: 20, right: 20 }}>
        <ThemeToggle />
      </div>
      <div className="public-card">
        <div className="public-left">
          <p className="eyebrow">Public booking page</p>
          {loadingEvent ? (
            <>
              <Skeleton height={32} width="70%" style={{ marginBottom: 12 }} />
              <Skeleton height={14} width="100%" style={{ marginBottom: 8 }} />
              <Skeleton height={14} width="80%" />
            </>
          ) : (
            <>
              <h1>{eventType?.title}</h1>
              <p>{eventType?.description}</p>
              <div className="public-meta">
                <span>{eventType?.duration} mins</span>
                <span>{eventType?.timezone}</span>
              </div>
            </>
          )}

          <div className="date-picker-grid" role="radiogroup" aria-label="Pick a date">
            {dateChoices.map((date) => {
              const value = toDateInputValue(date);
              const active = selectedDate === value;
              return (
                <button
                  key={value}
                  type="button"
                  role="radio"
                  aria-checked={active}
                  className={active ? "date-chip active" : "date-chip"}
                  onClick={() => setSelectedDate(value)}
                >
                  {formatDate(date)}
                </button>
              );
            })}
          </div>
        </div>

        <div className="public-right">
          <div className="slot-section">
            <h3>Select a time</h3>
            {loadingSlots ? (
              <div className="slot-grid">
                {Array.from({ length: 6 }).map((_, i) => (
                  <Skeleton key={i} height={44} />
                ))}
              </div>
            ) : slots.length === 0 ? (
              <p style={{ color: "var(--text-muted)", margin: "8px 0 16px" }}>
                No slots available for this day.
              </p>
            ) : (
              <div className="slot-grid" role="radiogroup" aria-label="Available times">
                {slots.map((slot) => {
                  const active = selectedSlot === slot.start_time;
                  return (
                    <button
                      key={slot.start_time}
                      type="button"
                      role="radio"
                      aria-checked={active}
                      className={active ? "slot-button active" : "slot-button"}
                      onClick={() => setSelectedSlot(slot.start_time)}
                    >
                      {slot.display_time}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          <form className="form-grid" onSubmit={handleSubmit} noValidate>
            <label>
              Your name
              <input
                value={form.booker_name}
                onChange={(e) => setForm({ ...form, booker_name: e.target.value })}
                onBlur={() => setTouched((t) => ({ ...t, booker_name: true }))}
                aria-invalid={showError("booker_name") ? "true" : "false"}
                required
              />
              {showError("booker_name") ? (
                <p className="field-error">{errors.booker_name}</p>
              ) : null}
            </label>
            <label>
              Email
              <input
                type="email"
                value={form.booker_email}
                onChange={(e) => setForm({ ...form, booker_email: e.target.value })}
                onBlur={() => setTouched((t) => ({ ...t, booker_email: true }))}
                aria-invalid={showError("booker_email") ? "true" : "false"}
                required
              />
              {showError("booker_email") ? (
                <p className="field-error">{errors.booker_email}</p>
              ) : null}
            </label>
            <label className="full-width">
              Notes
              <textarea
                rows="4"
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
                placeholder="Tell us what you want to discuss."
              />
            </label>
            <button
              type="submit"
              className="primary-button full-width"
              disabled={!isValid || submitting}
            >
              {submitting ? "Confirming..." : "Confirm booking"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
