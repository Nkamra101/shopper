import { useEffect, useState } from "react";
import SectionCard from "../components/SectionCard";
import { api } from "../services/api";
import { formatDateTime } from "../utils/date";

export default function BookingsPage() {
  const [scope, setScope] = useState("upcoming");
  const [bookings, setBookings] = useState([]);
  const [message, setMessage] = useState("");

  async function loadBookings(activeScope = scope) {
    try {
      const data = await api.getBookings(activeScope);
      setBookings(data);
    } catch (error) {
      setMessage(error.message);
    }
  }

  useEffect(() => {
    loadBookings(scope);
  }, [scope]);

  async function handleCancel(id) {
    try {
      await api.cancelBooking(id);
      setMessage("Booking cancelled.");
      loadBookings(scope);
    } catch (error) {
      setMessage(error.message);
    }
  }

  return (
    <SectionCard title="Bookings dashboard" subtitle="Track upcoming meetings and keep older ones for reference.">
      <div className="filter-tabs">
        {["upcoming", "past", "all"].map((item) => (
          <button
            key={item}
            type="button"
            className={scope === item ? "tab-button active" : "tab-button"}
            onClick={() => setScope(item)}
          >
            {item}
          </button>
        ))}
      </div>

      <div className="card-list">
        {bookings.map((booking) => (
          <article key={booking.id} className="booking-card">
            <div>
              <p className="eyebrow">{booking.event_type.title}</p>
              <h4>{booking.booker_name}</h4>
              <p>{booking.booker_email}</p>
              <p>{formatDateTime(booking.start_time)}</p>
            </div>
            <div className="booking-side">
              <span className={`status-pill ${booking.status}`}>{booking.status}</span>
              {booking.status === "confirmed" && scope !== "past" ? (
                <button type="button" className="ghost-button" onClick={() => handleCancel(booking.id)}>
                  Cancel booking
                </button>
              ) : null}
            </div>
          </article>
        ))}
      </div>

      {message ? <p className="inline-message">{message}</p> : null}
    </SectionCard>
  );
}

