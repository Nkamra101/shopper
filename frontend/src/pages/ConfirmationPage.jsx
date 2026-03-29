import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { api } from "../services/api";
import { formatDateTime } from "../utils/date";

export default function ConfirmationPage() {
  const { bookingId, slug } = useParams();
  const [booking, setBooking] = useState(null);

  useEffect(() => {
    async function loadBooking() {
      const data = await api.getPublicBooking(bookingId);
      setBooking(data);
    }

    loadBooking();
  }, [bookingId]);

  return (
    <div className="confirmation-page">
      <div className="confirmation-card">
        <p className="eyebrow">Booking confirmed</p>
        <h1>Your meeting is scheduled.</h1>
        <p>{booking?.event_type?.title}</p>
        <p>{booking ? formatDateTime(booking.start_time) : "Loading..."}</p>
        <p>Booked by: {booking?.booker_name}</p>
        <div className="button-row">
          <Link className="primary-button" to={`/book/${slug}`}>
            Book another slot
          </Link>
          <Link className="secondary-button" to="/">
            Back to dashboard
          </Link>
        </div>
      </div>
    </div>
  );
}

