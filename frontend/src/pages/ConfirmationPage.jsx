import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { api } from "../services/api";
import { formatDateTime } from "../utils/date";
import { Skeleton } from "../components/Skeleton";
import ThemeToggle from "../components/ThemeToggle";
import { useToast } from "../components/Toast";

function buildGoogleCalUrl(booking) {
  if (!booking) return "#";
  const start = new Date(booking.start_time);
  const end = new Date(start.getTime() + (booking.event_type?.duration || 30) * 60000);
  const format = (value) => value.toISOString().replace(/-|:|\.\d{3}/g, "");
  const params = new URLSearchParams({
    action: "TEMPLATE",
    text: booking.event_type?.title || "Meeting",
    dates: `${format(start)}/${format(end)}`,
    details: booking.notes || "",
  });
  return `https://calendar.google.com/calendar/render?${params}`;
}

function buildIcsContent(booking) {
  if (!booking) return "";
  const start = new Date(booking.start_time);
  const end = new Date(start.getTime() + (booking.event_type?.duration || 30) * 60000);
  const format = (value) => value.toISOString().replace(/-|:|\.\d{3}/g, "");
  return [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "BEGIN:VEVENT",
    `DTSTART:${format(start)}`,
    `DTEND:${format(end)}`,
    `SUMMARY:${booking.event_type?.title || "Meeting"}`,
    `DESCRIPTION:${booking.notes || ""}`,
    "END:VEVENT",
    "END:VCALENDAR",
  ].join("\r\n");
}

export default function ConfirmationPage() {
  const { bookingId, slug } = useParams();
  const toast = useToast();
  const [booking, setBooking] = useState(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);

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
  }, [bookingId, toast]);

  function downloadIcs() {
    const blob = new Blob([buildIcsContent(booking)], { type: "text/calendar" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "meeting.ics";
    anchor.click();
    URL.revokeObjectURL(url);
    toast.success("Calendar file downloaded.");
  }

  function copyLink() {
    navigator.clipboard.writeText(window.location.href);
    setCopied(true);
    toast.success("Confirmation link copied.");
    window.setTimeout(() => setCopied(false), 1800);
  }

  return (
    <div className="confirmation-page">
      <div className="public-topbar">
        <div className="public-brand">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M8 2v4M16 2v4M3 10h18M5 4h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z" />
          </svg>
          Shopper
        </div>
        <ThemeToggle />
      </div>

      <div className="confirmation-wrapper">
        <div className="confirmation-card confirmation-card-enhanced">
          <div className="confirmation-success-ring">
            <div className="confirmation-icon confirmed">
              <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M20 6 9 17l-5-5" />
              </svg>
            </div>
          </div>

          <p className="eyebrow" style={{ color: "var(--success)", marginBottom: 6 }}>Booking confirmed</p>
          <h1>You are all set.</h1>
          <p className="confirmation-lead">Your meeting has been saved and the details below are ready to share or add to your calendar.</p>

          {loading ? (
            <>
              <Skeleton height={14} width="70%" style={{ margin: "8px auto" }} />
              <Skeleton height={14} width="50%" style={{ margin: "8px auto" }} />
              <Skeleton height={14} width="60%" style={{ margin: "8px auto" }} />
            </>
          ) : booking ? (
            <>
              <div className="confirmation-details">
                {[
                  { label: "Event", value: booking.event_type?.title },
                  { label: "When", value: formatDateTime(booking.start_time) },
                  { label: "Guest", value: booking.booker_name },
                  { label: "Duration", value: booking.event_type?.duration ? `${booking.event_type.duration} minutes` : null },
                ].filter((item) => item.value).map((item) => (
                  <div key={item.label} className="conf-detail-row">
                    <span className="conf-detail-label">{item.label}</span>
                    <span className="conf-detail-value">{item.value}</span>
                  </div>
                ))}
              </div>

              {booking.meeting_url && (
                <a href={booking.meeting_url} target="_blank" rel="noreferrer" className="primary-button join-btn">
                  Join meeting link
                </a>
              )}

              <div className="cal-add-section">
                <p className="cal-section-label">Save or share</p>
                <div className="cal-buttons">
                  <a href={buildGoogleCalUrl(booking)} target="_blank" rel="noreferrer" className="cal-button google">
                    Add to Google Calendar
                  </a>
                  <button className="cal-button ics" onClick={downloadIcs}>
                    Download .ics
                  </button>
                  <button className="cal-button share" onClick={copyLink}>
                    {copied ? "Copied" : "Copy confirmation link"}
                  </button>
                </div>
              </div>
            </>
          ) : (
            <p style={{ color: "var(--text-muted)" }}>Booking details could not be loaded.</p>
          )}

          <div className="button-row confirmation-nav">
            <Link className="primary-button" to={`/book/${slug}`}>
              Book another time
            </Link>
            <Link className="secondary-button" to="/">
              Back to home
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
