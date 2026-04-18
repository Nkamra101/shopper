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
  const fmt = (d) => d.toISOString().replace(/-|:|\.\d{3}/g, "");
  const params = new URLSearchParams({
    action: "TEMPLATE",
    text: booking.event_type?.title || "Meeting",
    dates: `${fmt(start)}/${fmt(end)}`,
    details: booking.notes || "",
  });
  return `https://calendar.google.com/calendar/render?${params}`;
}

function buildIcsContent(booking) {
  if (!booking) return "";
  const start = new Date(booking.start_time);
  const end = new Date(start.getTime() + (booking.event_type?.duration || 30) * 60000);
  const fmt = (d) => d.toISOString().replace(/-|:|\.\d{3}/g, "");
  return [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "BEGIN:VEVENT",
    `DTSTART:${fmt(start)}`,
    `DTEND:${fmt(end)}`,
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
  const [linkCopied, setLinkCopied] = useState(false);

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
  }, [bookingId]);

  function downloadIcs() {
    const ics = buildIcsContent(booking);
    const blob = new Blob([ics], { type: "text/calendar" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "meeting.ics";
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Calendar file downloaded!");
  }

  function shareLink() {
    const url = window.location.href;
    navigator.clipboard.writeText(url);
    setLinkCopied(true);
    toast.success("Confirmation link copied!");
    setTimeout(() => setLinkCopied(false), 2000);
  }

  return (
    <div className="confirmation-page">
      <div className="public-topbar">
        <div className="public-brand">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M8 2v4M16 2v4M3 10h18M5 4h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z" />
          </svg>
          Schedulr
        </div>
        <ThemeToggle />
      </div>

      <div className="confirmation-wrapper">
        <div className="confirmation-card">
          {/* Success animation */}
          <div className="confirmation-success-ring">
            <div className="confirmation-icon confirmed">
              <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M20 6 9 17l-5-5" />
              </svg>
            </div>
          </div>

          <p className="eyebrow" style={{ color: "var(--success)", marginBottom: 4 }}>Booking confirmed</p>
          <h1>You're all set!</h1>

          {loading ? (
            <>
              <Skeleton height={14} width="70%" style={{ margin: "8px auto" }} />
              <Skeleton height={14} width="50%" style={{ margin: "8px auto" }} />
              <Skeleton height={14} width="60%" style={{ margin: "8px auto" }} />
            </>
          ) : booking ? (
            <>
              <div className="confirmation-details">
                <div className="conf-detail-row">
                  <span className="conf-detail-icon">
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <rect x="3" y="4" width="18" height="18" rx="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" />
                    </svg>
                  </span>
                  <span className="conf-detail-label">Event</span>
                  <span className="conf-detail-value">{booking.event_type?.title}</span>
                </div>
                <div className="conf-detail-row">
                  <span className="conf-detail-icon">
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" />
                    </svg>
                  </span>
                  <span className="conf-detail-label">When</span>
                  <span className="conf-detail-value">{formatDateTime(booking.start_time)}</span>
                </div>
                <div className="conf-detail-row">
                  <span className="conf-detail-icon">
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" />
                    </svg>
                  </span>
                  <span className="conf-detail-label">Guest</span>
                  <span className="conf-detail-value">{booking.booker_name}</span>
                </div>
                {booking.event_type?.duration && (
                  <div className="conf-detail-row">
                    <span className="conf-detail-icon">
                      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" />
                      </svg>
                    </span>
                    <span className="conf-detail-label">Duration</span>
                    <span className="conf-detail-value">{booking.event_type.duration} minutes</span>
                  </div>
                )}
              </div>

              {booking.meeting_url && (
                <a
                  href={booking.meeting_url}
                  target="_blank"
                  rel="noreferrer"
                  className="primary-button join-btn"
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <polygon points="23 7 16 12 23 17 23 7" /><rect x="1" y="5" width="15" height="14" rx="2" />
                  </svg>
                  Join video call
                </a>
              )}

              <div className="cal-add-section">
                <p className="cal-section-label">Add to your calendar</p>
                <div className="cal-buttons">
                  <a
                    href={buildGoogleCalUrl(booking)}
                    target="_blank"
                    rel="noreferrer"
                    className="cal-button google"
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <rect x="3" y="4" width="18" height="18" rx="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" />
                    </svg>
                    Google Calendar
                  </a>
                  <button className="cal-button ics" onClick={downloadIcs}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" />
                    </svg>
                    Download .ics
                  </button>
                  <button className="cal-button share" onClick={shareLink}>
                    {linkCopied ? (
                      <>
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M20 6 9 17l-5-5" />
                        </svg>
                        Copied!
                      </>
                    ) : (
                      <>
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <circle cx="18" cy="5" r="3" /><circle cx="6" cy="12" r="3" /><circle cx="18" cy="19" r="3" /><line x1="8.59" y1="13.51" x2="15.42" y2="17.49" /><line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
                        </svg>
                        Share link
                      </>
                    )}
                  </button>
                </div>
              </div>
            </>
          ) : (
            <p style={{ color: "var(--text-muted)" }}>Booking details could not be loaded.</p>
          )}

          <div className="button-row confirmation-nav">
            <Link className="primary-button" to={`/book/${slug}`}>
              Book another
            </Link>
            <Link className="secondary-button" to="/">
              Back to dashboard
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
