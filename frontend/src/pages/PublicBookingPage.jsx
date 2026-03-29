import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { api } from "../services/api";
import { formatDate, getUpcomingDates, toDateInputValue } from "../utils/date";

export default function PublicBookingPage() {
  const { slug } = useParams();
  const navigate = useNavigate();
  const dateChoices = getUpcomingDates(10);
  const [eventType, setEventType] = useState(null);
  const [selectedDate, setSelectedDate] = useState(toDateInputValue(dateChoices[0]));
  const [slots, setSlots] = useState([]);
  const [selectedSlot, setSelectedSlot] = useState("");
  const [form, setForm] = useState({ booker_name: "", booker_email: "", notes: "" });
  const [message, setMessage] = useState("");

  useEffect(() => {
    async function loadEvent() {
      try {
        const data = await api.getPublicEventType(slug);
        setEventType(data);
      } catch (error) {
        setMessage(error.message);
      }
    }

    loadEvent();
  }, [slug]);

  useEffect(() => {
    async function loadSlots() {
      if (!slug || !selectedDate) {
        return;
      }

      try {
        const data = await api.getSlots(slug, selectedDate);
        setSlots(data);
        setSelectedSlot("");
      } catch (error) {
        setMessage(error.message);
      }
    }

    loadSlots();
  }, [slug, selectedDate]);

  async function handleSubmit(event) {
    event.preventDefault();
    if (!selectedSlot) {
      setMessage("Please choose a time slot first.");
      return;
    }

    try {
      const booking = await api.createBooking(slug, {
        ...form,
        start_time: selectedSlot,
      });
      navigate(`/book/${slug}/confirmed/${booking.id}`);
    } catch (error) {
      setMessage(error.message);
    }
  }

  return (
    <div className="public-page">
      <div className="public-card">
        <div className="public-left">
          <p className="eyebrow">Public booking page</p>
          <h1>{eventType?.title || "Loading..."}</h1>
          <p>{eventType?.description}</p>

          <div className="public-meta">
            <span>{eventType?.duration} mins</span>
            <span>{eventType?.timezone}</span>
          </div>

          <div className="date-picker-grid">
            {dateChoices.map((date) => {
              const value = toDateInputValue(date);
              return (
                <button
                  key={value}
                  type="button"
                  className={selectedDate === value ? "date-chip active" : "date-chip"}
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
            <div className="slot-grid">
              {slots.length === 0 ? <p>No slots available for this day.</p> : null}
              {slots.map((slot) => (
                <button
                  key={slot.start_time}
                  type="button"
                  className={selectedSlot === slot.start_time ? "slot-button active" : "slot-button"}
                  onClick={() => setSelectedSlot(slot.start_time)}
                >
                  {slot.display_time}
                </button>
              ))}
            </div>
          </div>

          <form className="form-grid" onSubmit={handleSubmit}>
            <label>
              Your name
              <input
                value={form.booker_name}
                onChange={(event) => setForm({ ...form, booker_name: event.target.value })}
                required
              />
            </label>
            <label>
              Email
              <input
                type="email"
                value={form.booker_email}
                onChange={(event) => setForm({ ...form, booker_email: event.target.value })}
                required
              />
            </label>
            <label className="full-width">
              Notes
              <textarea
                rows="4"
                value={form.notes}
                onChange={(event) => setForm({ ...form, notes: event.target.value })}
                placeholder="Tell us what you want to discuss."
              />
            </label>
            <button type="submit" className="primary-button full-width">
              Confirm booking
            </button>
          </form>
          {message ? <p className="inline-message">{message}</p> : null}
        </div>
      </div>
    </div>
  );
}

