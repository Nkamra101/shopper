import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { api } from "../services/api";
import { browserTimezone, formatFullIn } from "../utils/date";
import Logo from "../components/Logo";
import Icon from "../components/Icon";
import ThemeToggle from "../components/ThemeToggle";
import { Skeleton } from "../components/Skeleton";
import { useToast } from "../components/Toast";

function icsStamp(value) {
  return value.toISOString().replace(/[-:]|\.\d{3}/g, "");
}

function googleCalendarUrl(booking) {
  if (!booking) return "#";
  const start = new Date(booking.start_time);
  const end = new Date(booking.end_time || start.getTime() + (booking.event_type?.duration || 30) * 60000);
  const params = new URLSearchParams({
    action: "TEMPLATE",
    text: booking.event_type?.title || "Meeting",
    dates: `${icsStamp(start)}/${icsStamp(end)}`,
    details: [booking.notes, booking.meeting_url].filter(Boolean).join("\n\n"),
    location: booking.meeting_url || "",
  });
  return `https://calendar.google.com/calendar/render?${params}`;
}

function icsFile(booking) {
  const start = new Date(booking.start_time);
  const end = new Date(booking.end_time || start.getTime() + (booking.event_type?.duration || 30) * 60000);
  return [
    "BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Shopper//EN", "BEGIN:VEVENT",
    `UID:${booking.id}@shopper`,
    `DTSTAMP:${icsStamp(new Date())}`,
    `DTSTART:${icsStamp(start)}`,
    `DTEND:${icsStamp(end)}`,
    `SUMMARY:${booking.event_type?.title || "Meeting"}`,
    `DESCRIPTION:${(booking.notes || "").replace(/\n/g, "\\n")}`,
    `LOCATION:${booking.meeting_url || ""}`,
    "END:VEVENT", "END:VCALENDAR",
  ].join("\r\n");
}

export default function ConfirmationPage() {
  const { bookingId, slug } = useParams();
  const toast = useToast();
  const [booking, setBooking] = useState(null);
  const [loading, setLoading] = useState(true);
  const timezone = browserTimezone();

  // Stashed by the booking page on success. Deliberately not fetchable by
  // booking id — only the guest who just booked, or who holds the emailed
  // link, can reach the manage page.
  const manageToken = sessionStorage.getItem(`shopper_manage_${bookingId}`) || "";

  useEffect(() => {
    (async () => {
      try {
        setBooking(await api.getPublicBooking(bookingId));
      } catch (error) {
        toast.error(error.message || "Could not load this booking.");
      } finally {
        setLoading(false);
      }
    })();
  }, [bookingId, toast]);

  function downloadIcs() {
    const blob = new Blob([icsFile(booking)], { type: "text/calendar" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "meeting.ics";
    link.click();
    URL.revokeObjectURL(url);
  }

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(window.location.href);
      toast.success("Link copied.");
    } catch {
      toast.error("Could not copy the link.");
    }
  }

  return (
    <div className="public">
      <header className="public-bar">
        <Logo size={28} tile />
        <ThemeToggle />
      </header>

      <main className="public-main public-narrow">
        <div className="card result-card">
          <div className="result-icon"><Icon name="check" size={22} strokeWidth={2.6} /></div>

          <p className="eyebrow" style={{ color: "var(--c-ok)" }}>Booking confirmed</p>
          <h1 style={{ margin: "var(--s2) 0" }}>You're all set.</h1>
          <p className="small muted">
            We've emailed the details to {booking?.booker_email || "your inbox"}.
          </p>

          {loading ? (
            <div className="stack-3" style={{ marginTop: "var(--s6)" }}>
              <Skeleton height={14} /><Skeleton height={14} width="70%" /><Skeleton height={14} width="50%" />
            </div>
          ) : booking ? (
            <>
              <dl className="dl panel">
                <div><dt>Event</dt><dd>{booking.event_type?.title}</dd></div>
                <div><dt>When</dt><dd>{formatFullIn(booking.start_time, timezone)}</dd></div>
                <div><dt>Duration</dt><dd>{booking.event_type?.duration} minutes</dd></div>
                <div><dt>Guest</dt><dd>{booking.booker_name}</dd></div>
                {(booking.answers || []).map((answer) => (
                  <div key={answer.question_id}><dt>{answer.label || answer.question_id}</dt><dd>{answer.value}</dd></div>
                ))}
              </dl>

              {booking.meeting_url && (
                <a className="btn btn-primary btn-lg" href={booking.meeting_url} target="_blank" rel="noreferrer" style={{ marginTop: "var(--s5)" }}>
                  <Icon name="video" size={15} /> Join the video call
                </a>
              )}

              <div className="stack-2" style={{ marginTop: "var(--s6)" }}>
                <p className="eyebrow">Add to your calendar</p>
                <div className="row-wrap" style={{ justifyContent: "center", gap: 6 }}>
                  <a className="btn btn-sm" href={googleCalendarUrl(booking)} target="_blank" rel="noreferrer">Google Calendar</a>
                  <button className="btn btn-sm" onClick={downloadIcs}>Download .ics</button>
                  <button className="btn btn-sm" onClick={copyLink}><Icon name="copy" size={13} /> Copy link</button>
                </div>
              </div>

              {manageToken && (
                <p className="small muted" style={{ marginTop: "var(--s6)", paddingTop: "var(--s5)", borderTop: "1px solid var(--c-line)" }}>
                  Plans change?{" "}
                  <Link to={`/manage/${manageToken}`} className="btn-link">Reschedule or cancel</Link>
                  {" "}— this link is in your email too.
                </p>
              )}
            </>
          ) : (
            <p className="small muted" style={{ marginTop: "var(--s5)" }}>
              We couldn't load those details. Check your inbox for the confirmation.
            </p>
          )}

          <div className="row-2" style={{ justifyContent: "center", marginTop: "var(--s6)" }}>
            <Link className="btn" to={`/book/${slug}`}>Book another time</Link>
          </div>
        </div>
      </main>
    </div>
  );
}
