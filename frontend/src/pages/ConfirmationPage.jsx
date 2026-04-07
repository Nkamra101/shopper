import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { api } from "../services/api";
import { formatDateTime } from "../utils/date";
import { Skeleton } from "../components/Skeleton";
import ThemeToggle from "../components/ThemeToggle";
import { useToast } from "../components/Toast";

export default function ConfirmationPage() {
  const { bookingId, slug } = useParams();
  const toast = useToast();
  const [booking, setBooking] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadBooking() {
      try {
        const data = await api.getPublicBooking(bookingId);
        setBooking(data);
      } catch (error) {
        toast.error(error.message || "Could not load booking.");
      } finally {
        setLoading(false);
      }
    }
    loadBooking();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bookingId]);

  return (
    <div className="confirmation-page">
      <div style={{ position: "absolute", top: 20, right: 20 }}>
        <ThemeToggle />
      </div>
      <div className="confirmation-card">
        <div className="confirmation-icon" aria-hidden="true">
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
            <path d="M20 6 9 17l-5-5" />
          </svg>
        </div>
        <p className="eyebrow">Booking confirmed</p>
        <h1>Your meeting is scheduled.</h1>
        {loading ? (
          <>
            <Skeleton height={14} width="60%" style={{ margin: "8px auto" }} />
            <Skeleton height={14} width="80%" style={{ margin: "8px auto" }} />
          </>
        ) : booking ? (
          <>
            <p>{booking.event_type?.title}</p>
            <p>{formatDateTime(booking.start_time)}</p>
            <p>Booked by: {booking.booker_name}</p>
          </>
        ) : (
          <p>Booking details could not be loaded.</p>
        )}
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
