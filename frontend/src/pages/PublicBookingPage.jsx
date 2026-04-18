import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { api } from "../services/api";
import { toDateInputValue } from "../utils/date";
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

function CalendarGrid({ selectedDate, onSelectDate }) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const [viewMonth, setViewMonth] = useState(() => {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth(), 1);
  });

  const year = viewMonth.getFullYear();
  const month = viewMonth.getMonth();

  const firstDayOfMonth = new Date(year, month, 1);
  const lastDayOfMonth = new Date(year, month + 1, 0);
  const startPad = (firstDayOfMonth.getDay() + 6) % 7;
  const totalDays = lastDayOfMonth.getDate();

  const cells = [];
  for (let i = 0; i < startPad; i++) cells.push(null);
  for (let d = 1; d <= totalDays; d++) cells.push(d);

  function prevMonth() {
    setViewMonth(new Date(year, month - 1, 1));
  }
  function nextMonth() {
    setViewMonth(new Date(year, month + 1, 1));
  }

  const monthLabel = viewMonth.toLocaleDateString("en-US", { month: "long", year: "numeric" });

  return (
    <div className="calendar-grid-widget">
      <div className="calendar-header">
        <button type="button" className="cal-nav-btn" onClick={prevMonth} aria-label="Previous month">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="15 18 9 12 15 6" />
          </svg>
        </button>
        <span className="cal-month-label">{monthLabel}</span>
        <button type="button" className="cal-nav-btn" onClick={nextMonth} aria-label="Next month">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="9 18 15 12 9 6" />
          </svg>
        </button>
      </div>
      <div className="calendar-weekdays">
        {["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"].map((d) => (
          <span key={d} className="cal-weekday">{d}</span>
        ))}
      </div>
      <div className="calendar-cells">
        {cells.map((day, i) => {
          if (!day) return <span key={`pad-${i}`} />;
          const date = new Date(year, month, day);
          date.setHours(0, 0, 0, 0);
          const isPast = date < today;
          const iso = toDateInputValue(date);
          const isSelected = selectedDate === iso;
          const isToday = date.getTime() === today.getTime();
          return (
            <button
              key={day}
              type="button"
              disabled={isPast}
              className={`cal-day${isSelected ? " selected" : ""}${isToday ? " today" : ""}${isPast ? " past" : ""}`}
              onClick={() => onSelectDate(iso)}
            >
              {day}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function StepIndicator({ step }) {
  const steps = ["Pick date & time", "Your details", "Confirm"];
  return (
    <div className="step-indicator">
      {steps.map((label, i) => (
        <div key={i} className={`step-item ${i < step ? "done" : i === step ? "active" : ""}`}>
          <div className="step-dot">
            {i < step ? (
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                <path d="M20 6 9 17l-5-5" />
              </svg>
            ) : (
              <span>{i + 1}</span>
            )}
          </div>
          <span className="step-label">{label}</span>
          {i < steps.length - 1 && <div className="step-line" />}
        </div>
      ))}
    </div>
  );
}

export default function PublicBookingPage() {
  const { slug } = useParams();
  const navigate = useNavigate();
  const toast = useToast();

  const [eventType, setEventType] = useState(null);
  const [loadingEvent, setLoadingEvent] = useState(true);
  const [selectedDate, setSelectedDate] = useState(toDateInputValue(new Date()));
  const [slots, setSlots] = useState([]);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [selectedSlot, setSelectedSlot] = useState("");
  const [step, setStep] = useState(0);

  const [form, setForm] = useState({ booker_name: "", booker_email: "", notes: "" });
  const [touched, setTouched] = useState({});
  const [submitting, setSubmitting] = useState(false);

  const [otpStage, setOtpStage] = useState("idle");
  const [otpCode, setOtpCode] = useState("");
  const [otpSending, setOtpSending] = useState(false);
  const [otpVerifying, setOtpVerifying] = useState(false);
  const [verificationToken, setVerificationToken] = useState("");
  const [verifiedEmail, setVerifiedEmail] = useState("");
  const [resendIn, setResendIn] = useState(0);
  const resendTimer = useRef(null);

  const [guestTimezone] = useState(() => {
    try { return Intl.DateTimeFormat().resolvedOptions().timeZone; } catch { return "UTC"; }
  });

  const errors = useMemo(() => validate(form), [form]);
  const emailValid = !errors.booker_email && form.booker_email.trim().length > 0;
  const isVerified = otpStage === "verified" && verifiedEmail === form.booker_email.trim().toLowerCase();
  const isFormValid = Object.keys(errors).length === 0 && isVerified;

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
  }, [slug, selectedDate]);

  useEffect(() => {
    if (resendIn <= 0) {
      if (resendTimer.current) { clearInterval(resendTimer.current); resendTimer.current = null; }
      return;
    }
    if (!resendTimer.current) {
      resendTimer.current = setInterval(() => {
        setResendIn((prev) => (prev <= 1 ? 0 : prev - 1));
      }, 1000);
    }
    return () => {
      if (resendTimer.current) { clearInterval(resendTimer.current); resendTimer.current = null; }
    };
  }, [resendIn]);

  function resetVerification() {
    setOtpStage("idle");
    setOtpCode("");
    setVerificationToken("");
    setVerifiedEmail("");
    setResendIn(0);
  }

  function handleEmailChange(value) {
    setForm({ ...form, booker_email: value });
    if (otpStage !== "idle") resetVerification();
  }

  async function handleSendCode() {
    if (!emailValid) { setTouched((t) => ({ ...t, booker_email: true })); return; }
    setOtpSending(true);
    try {
      const data = await api.requestOtp(form.booker_email.trim());
      setOtpStage("sent");
      setResendIn(data.resend_after_seconds || 60);
      toast.success("Verification code sent!");
    } catch (error) {
      toast.error(error.message || "Could not send code.");
    } finally {
      setOtpSending(false);
    }
  }

  async function handleVerifyCode() {
    if (!otpCode.trim()) return;
    setOtpVerifying(true);
    try {
      const data = await api.verifyOtp(form.booker_email.trim(), otpCode.trim());
      setVerificationToken(data.verification_token);
      setVerifiedEmail(form.booker_email.trim().toLowerCase());
      setOtpStage("verified");
      toast.success("Email verified!");
    } catch (error) {
      toast.error(error.message || "Invalid code.");
    } finally {
      setOtpVerifying(false);
    }
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setTouched({ booker_name: true, booker_email: true });
    if (!selectedSlot) { toast.error("Please choose a time slot."); return; }
    if (Object.keys(errors).length > 0) return;
    if (!isVerified) { toast.error("Please verify your email."); return; }

    setSubmitting(true);
    try {
      const booking = await api.createBooking(slug, {
        ...form,
        start_time: selectedSlot,
        verification_token: verificationToken,
      });
      navigate(`/book/${slug}/confirmed/${booking.id}`);
    } catch (error) {
      toast.error(error.message || "Could not confirm booking.");
      if (error.message && /verif/i.test(error.message)) resetVerification();
    } finally {
      setSubmitting(false);
    }
  }

  function showError(field) { return touched[field] && errors[field]; }
  const emailLocked = otpStage !== "idle";

  const selectedSlotDisplay = slots.find((s) => s.start_time === selectedSlot)?.display_time;

  return (
    <div className="public-page">
      <div className="public-topbar">
        <div className="public-brand">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M8 2v4M16 2v4M3 10h18M5 4h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z" />
          </svg>
          Schedulr
        </div>
        <ThemeToggle />
      </div>

      <div className="public-layout">
        {/* Left panel: event info */}
        <div className="public-info-panel">
          {loadingEvent ? (
            <>
              <Skeleton height={20} width="40%" style={{ marginBottom: 12 }} />
              <Skeleton height={32} width="80%" style={{ marginBottom: 12 }} />
              <Skeleton height={14} width="100%" style={{ marginBottom: 6 }} />
              <Skeleton height={14} width="70%" />
            </>
          ) : (
            <>
              <div
                className="public-event-badge"
                style={{ background: eventType?.accent_color || "var(--accent)" }}
              />
              <h1 className="public-event-title">{eventType?.title}</h1>
              {eventType?.description && (
                <p className="public-event-desc">{eventType.description}</p>
              )}
              <div className="public-meta-chips">
                <div className="public-meta-chip">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" />
                  </svg>
                  {eventType?.duration} minutes
                </div>
                <div className="public-meta-chip">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="10" /><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
                  </svg>
                  {guestTimezone}
                </div>
                {eventType?.timezone && eventType.timezone !== guestTimezone && (
                  <div className="public-meta-chip host-tz">
                    Host: {eventType.timezone}
                  </div>
                )}
              </div>
              {selectedSlot && (
                <div className="booking-summary-preview">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M20 6 9 17l-5-5" />
                  </svg>
                  <span>{selectedSlotDisplay} · {new Date(selectedDate).toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric" })}</span>
                </div>
              )}
            </>
          )}
        </div>

        {/* Right: booking flow */}
        <div className="public-booking-panel">
          <StepIndicator step={step} />

          {/* Step 0: date + time */}
          {step === 0 && (
            <div className="booking-step">
              <h3 className="step-heading">Select a date & time</h3>
              <CalendarGrid selectedDate={selectedDate} onSelectDate={(d) => { setSelectedDate(d); setSelectedSlot(""); }} />

              {selectedDate && (
                <div className="slots-section">
                  <h4 className="slots-heading">
                    {new Date(selectedDate + "T00:00").toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}
                  </h4>
                  {loadingSlots ? (
                    <div className="slot-grid">{Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} height={44} />)}</div>
                  ) : slots.length === 0 ? (
                    <div className="slots-empty">
                      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                        <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
                      </svg>
                      <span>No available slots for this day</span>
                    </div>
                  ) : (
                    <div className="slot-grid" role="radiogroup">
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
              )}

              <div className="step-actions">
                <button
                  className="primary-button"
                  disabled={!selectedSlot}
                  onClick={() => setStep(1)}
                >
                  Continue
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="9 18 15 12 9 6" />
                  </svg>
                </button>
              </div>
            </div>
          )}

          {/* Step 1: details */}
          {step === 1 && (
            <div className="booking-step">
              <button className="step-back-btn" onClick={() => setStep(0)}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="15 18 9 12 15 6" />
                </svg>
                Back
              </button>
              <h3 className="step-heading">Your details</h3>

              <form className="form-grid" onSubmit={(e) => { e.preventDefault(); setStep(2); }} noValidate>
                <label className="full-width">
                  Full name
                  <input
                    value={form.booker_name}
                    onChange={(e) => setForm({ ...form, booker_name: e.target.value })}
                    onBlur={() => setTouched((t) => ({ ...t, booker_name: true }))}
                    placeholder="Jane Smith"
                    aria-invalid={showError("booker_name") ? "true" : "false"}
                    required
                  />
                  {showError("booker_name") && <p className="field-error">{errors.booker_name}</p>}
                </label>

                <label className="full-width">
                  Email address
                  <div className="otp-email-row">
                    <input
                      type="email"
                      value={form.booker_email}
                      onChange={(e) => handleEmailChange(e.target.value)}
                      onBlur={() => setTouched((t) => ({ ...t, booker_email: true }))}
                      placeholder="jane@example.com"
                      aria-invalid={showError("booker_email") ? "true" : "false"}
                      disabled={emailLocked}
                      required
                    />
                    {otpStage === "idle" ? (
                      <button type="button" className="ghost-button" onClick={handleSendCode} disabled={!emailValid || otpSending}>
                        {otpSending ? "Sending…" : "Send code"}
                      </button>
                    ) : (
                      <button type="button" className="ghost-button" onClick={resetVerification}>Change</button>
                    )}
                  </div>
                  {showError("booker_email") && <p className="field-error">{errors.booker_email}</p>}
                  {otpStage === "verified" && <p className="otp-success">✓ Email verified</p>}
                </label>

                {otpStage === "sent" && (
                  <label className="full-width">
                    Verification code
                    <div className="otp-code-row">
                      <input
                        type="text"
                        inputMode="numeric"
                        autoComplete="one-time-code"
                        maxLength={6}
                        placeholder="000000"
                        value={otpCode}
                        onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, ""))}
                        className="otp-code-input"
                      />
                      <button
                        type="button"
                        className="primary-button"
                        onClick={handleVerifyCode}
                        disabled={otpCode.length < 4 || otpVerifying}
                      >
                        {otpVerifying ? "…" : "Verify"}
                      </button>
                    </div>
                    <div className="otp-resend">
                      {resendIn > 0 ? (
                        <span>Resend in {resendIn}s</span>
                      ) : (
                        <button type="button" className="link-button" onClick={handleSendCode} disabled={otpSending}>
                          {otpSending ? "Sending…" : "Resend code"}
                        </button>
                      )}
                    </div>
                  </label>
                )}

                <label className="full-width">
                  Additional notes
                  <textarea
                    rows="3"
                    value={form.notes}
                    onChange={(e) => setForm({ ...form, notes: e.target.value })}
                    placeholder="What would you like to discuss?"
                  />
                </label>

                <div className="step-actions full-width">
                  <button
                    type="submit"
                    className="primary-button"
                    disabled={Object.keys(errors).length > 0 || !isVerified}
                  >
                    Review booking
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="9 18 15 12 9 6" />
                    </svg>
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* Step 2: confirm */}
          {step === 2 && (
            <div className="booking-step">
              <button className="step-back-btn" onClick={() => setStep(1)}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="15 18 9 12 15 6" />
                </svg>
                Back
              </button>
              <h3 className="step-heading">Confirm your booking</h3>

              <div className="booking-review-card">
                <div className="review-row">
                  <div className="review-icon">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <rect x="3" y="4" width="18" height="18" rx="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" />
                    </svg>
                  </div>
                  <div>
                    <p className="review-label">Event</p>
                    <p className="review-value">{eventType?.title}</p>
                  </div>
                </div>
                <div className="review-row">
                  <div className="review-icon">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" />
                    </svg>
                  </div>
                  <div>
                    <p className="review-label">Date & Time</p>
                    <p className="review-value">
                      {new Date(selectedDate + "T00:00").toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" })}
                      {" · "}
                      {selectedSlotDisplay}
                    </p>
                  </div>
                </div>
                <div className="review-row">
                  <div className="review-icon">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" />
                    </svg>
                  </div>
                  <div>
                    <p className="review-label">Guest</p>
                    <p className="review-value">{form.booker_name} · {form.booker_email}</p>
                  </div>
                </div>
                {form.notes && (
                  <div className="review-row">
                    <div className="review-icon">
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                      </svg>
                    </div>
                    <div>
                      <p className="review-label">Notes</p>
                      <p className="review-value">{form.notes}</p>
                    </div>
                  </div>
                )}
              </div>

              <div className="step-actions">
                <button
                  className="primary-button"
                  onClick={handleSubmit}
                  disabled={!isFormValid || submitting}
                >
                  {submitting ? (
                    <>
                      <span className="btn-spinner" />
                      Confirming…
                    </>
                  ) : (
                    <>
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M20 6 9 17l-5-5" />
                      </svg>
                      Confirm booking
                    </>
                  )}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
