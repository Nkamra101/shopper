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
  if (!form.booker_email.trim()) errors.booker_email = "Email is required.";
  else if (!EMAIL_PATTERN.test(form.booker_email)) errors.booker_email = "Enter a valid email address.";
  return errors;
}

function CalendarGrid({ selectedDate, onSelectDate }) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const [viewMonth, setViewMonth] = useState(() => new Date(today.getFullYear(), today.getMonth(), 1));

  const year = viewMonth.getFullYear();
  const month = viewMonth.getMonth();
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  const startPad = (firstDay.getDay() + 6) % 7;
  const cells = [];

  for (let index = 0; index < startPad; index += 1) cells.push(null);
  for (let day = 1; day <= lastDay.getDate(); day += 1) cells.push(day);

  return (
    <div className="calendar-grid-widget">
      <div className="calendar-header">
        <button type="button" className="cal-nav-btn" onClick={() => setViewMonth(new Date(year, month - 1, 1))} aria-label="Previous month">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="15 18 9 12 15 6" />
          </svg>
        </button>
        <span className="cal-month-label">{viewMonth.toLocaleDateString("en-US", { month: "long", year: "numeric" })}</span>
        <button type="button" className="cal-nav-btn" onClick={() => setViewMonth(new Date(year, month + 1, 1))} aria-label="Next month">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="9 18 15 12 9 6" />
          </svg>
        </button>
      </div>
      <div className="calendar-weekdays">
        {["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"].map((label) => <span key={label} className="cal-weekday">{label}</span>)}
      </div>
      <div className="calendar-cells">
        {cells.map((day, index) => {
          if (!day) return <span key={`pad-${index}`} />;
          const date = new Date(year, month, day);
          date.setHours(0, 0, 0, 0);
          const iso = toDateInputValue(date);
          const isPast = date < today;
          const isToday = date.getTime() === today.getTime();
          const isSelected = selectedDate === iso;
          return (
            <button
              key={iso}
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
  const steps = ["Choose time", "Your details", "Confirm"];
  return (
    <div className="step-indicator">
      {steps.map((label, index) => (
        <div key={label} className={`step-item ${index < step ? "done" : index === step ? "active" : ""}`}>
          <div className="step-dot">{index < step ? "OK" : index + 1}</div>
          <span className="step-label">{label}</span>
          {index < steps.length - 1 && <div className="step-line" />}
        </div>
      ))}
    </div>
  );
}

export default function PublicBookingPage() {
  const { slug } = useParams();
  const navigate = useNavigate();
  const toast = useToast();
  const resendTimerRef = useRef(null);

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
  const [devCode, setDevCode] = useState("");

  const guestTimezone = useMemo(() => {
    try {
      return Intl.DateTimeFormat().resolvedOptions().timeZone;
    } catch {
      return "UTC";
    }
  }, []);

  const errors = useMemo(() => validate(form), [form]);
  const emailValid = !errors.booker_email && form.booker_email.trim().length > 0;
  const isVerified = otpStage === "verified" && verifiedEmail === form.booker_email.trim().toLowerCase();
  const selectedSlotDisplay = slots.find((slot) => slot.start_time === selectedSlot)?.display_time;

  useEffect(() => {
    async function loadEvent() {
      setLoadingEvent(true);
      try {
        setEventType(await api.getPublicEventType(slug));
      } catch (error) {
        toast.error(error.message || "Could not load event.");
      } finally {
        setLoadingEvent(false);
      }
    }

    loadEvent();
  }, [slug, toast]);

  useEffect(() => {
    async function loadSlots() {
      if (!slug || !selectedDate) return;
      setLoadingSlots(true);
      try {
        setSlots(await api.getSlots(slug, selectedDate));
        setSelectedSlot("");
      } catch (error) {
        toast.error(error.message || "Could not load slots.");
      } finally {
        setLoadingSlots(false);
      }
    }

    loadSlots();
  }, [slug, selectedDate, toast]);

  useEffect(() => {
    if (resendIn <= 0) {
      if (resendTimerRef.current) {
        clearInterval(resendTimerRef.current);
        resendTimerRef.current = null;
      }
      return;
    }

    if (!resendTimerRef.current) {
      resendTimerRef.current = setInterval(() => {
        setResendIn((current) => (current <= 1 ? 0 : current - 1));
      }, 1000);
    }

    return () => {
      if (resendTimerRef.current) {
        clearInterval(resendTimerRef.current);
        resendTimerRef.current = null;
      }
    };
  }, [resendIn]);

  function resetVerification() {
    setOtpStage("idle");
    setOtpCode("");
    setVerificationToken("");
    setVerifiedEmail("");
    setResendIn(0);
    setDevCode("");
  }

  function handleEmailChange(value) {
    setForm({ ...form, booker_email: value });
    if (otpStage !== "idle") resetVerification();
  }

  async function handleSendCode() {
    if (!emailValid) {
      setTouched((current) => ({ ...current, booker_email: true }));
      return;
    }
    setOtpSending(true);
    try {
      const data = await api.requestOtp(form.booker_email.trim());
      setOtpStage("sent");
      setResendIn(data.resend_after_seconds || 60);
      if (data.dev_code) {
        setDevCode(data.dev_code);
        toast.success(`Dev mode: code is ${data.dev_code}`);
      } else {
        toast.success("Verification code sent.");
      }
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
      toast.success("Email verified.");
    } catch (error) {
      toast.error(error.message || "Invalid code.");
    } finally {
      setOtpVerifying(false);
    }
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setTouched({ booker_name: true, booker_email: true });
    if (!selectedSlot) {
      toast.error("Please choose a time slot.");
      return;
    }
    if (Object.keys(errors).length > 0 || !isVerified) {
      toast.error("Please complete your details and verify your email.");
      return;
    }

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

  function showError(field) {
    return touched[field] && errors[field];
  }

  return (
    <div className="public-page">
      <div className="public-topbar">
        <div className="public-brand">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M8 2v4M16 2v4M3 10h18M5 4h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z" />
          </svg>
          Shopper
        </div>
        <ThemeToggle />
      </div>

      <div className="public-layout">
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
              <div className="public-event-badge" style={{ background: eventType?.accent_color || "var(--accent)" }} />
              <h1 className="public-event-title">{eventType?.title}</h1>
              {eventType?.description && <p className="public-event-desc">{eventType.description}</p>}
              <div className="public-meta-chips">
                <div className="public-meta-chip">{eventType?.duration} minutes</div>
                <div className="public-meta-chip">{guestTimezone}</div>
                {eventType?.timezone && eventType.timezone !== guestTimezone ? <div className="public-meta-chip host-tz">Host: {eventType.timezone}</div> : null}
              </div>
              <div className="public-help-card">
                <strong>Simple booking flow</strong>
                <p>Choose a time, verify your email with a one-time code, and confirm in a few clicks.</p>
              </div>
              {selectedSlot ? (
                <div className="booking-summary-preview">
                  <span>{selectedSlotDisplay} - {new Date(`${selectedDate}T00:00:00`).toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric" })}</span>
                </div>
              ) : null}
            </>
          )}
        </div>

        <div className="public-booking-panel">
          <StepIndicator step={step} />

          {step === 0 ? (
            <div className="booking-step">
              <h3 className="step-heading">Choose a date and time</h3>
              <CalendarGrid selectedDate={selectedDate} onSelectDate={(value) => { setSelectedDate(value); setSelectedSlot(""); }} />
              <div className="slots-section">
                <h4 className="slots-heading">
                  {new Date(`${selectedDate}T00:00:00`).toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}
                </h4>
                {loadingSlots ? (
                  <div className="slot-grid">{Array.from({ length: 8 }).map((_, index) => <Skeleton key={index} height={44} />)}</div>
                ) : slots.length === 0 ? (
                  <div className="slots-empty"><span>No available slots for this day.</span></div>
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
              <div className="step-actions">
                <button className="primary-button" disabled={!selectedSlot} onClick={() => setStep(1)}>
                  Continue
                </button>
              </div>
            </div>
          ) : null}

          {step === 1 ? (
            <div className="booking-step">
              <button className="step-back-btn" onClick={() => setStep(0)}>Back</button>
              <h3 className="step-heading">Add your details</h3>
              <form className="form-grid" onSubmit={(event) => { event.preventDefault(); setStep(2); }} noValidate>
                <label className="full-width">
                  Full name
                  <input
                    value={form.booker_name}
                    onChange={(event) => setForm({ ...form, booker_name: event.target.value })}
                    onBlur={() => setTouched((current) => ({ ...current, booker_name: true }))}
                    placeholder="Jane Smith"
                    aria-invalid={showError("booker_name") ? "true" : "false"}
                  />
                  {showError("booker_name") && <p className="field-error">{errors.booker_name}</p>}
                </label>

                <label className="full-width">
                  Email address
                  <div className="otp-email-row">
                    <input
                      type="email"
                      value={form.booker_email}
                      onChange={(event) => handleEmailChange(event.target.value)}
                      onBlur={() => setTouched((current) => ({ ...current, booker_email: true }))}
                      placeholder="jane@example.com"
                      aria-invalid={showError("booker_email") ? "true" : "false"}
                      disabled={otpStage !== "idle"}
                    />
                    {otpStage === "idle" ? (
                      <button type="button" className="secondary-button" onClick={handleSendCode} disabled={!emailValid || otpSending}>
                        {otpSending ? "Sending..." : "Send code"}
                      </button>
                    ) : (
                      <button type="button" className="ghost-button" onClick={resetVerification}>Change</button>
                    )}
                  </div>
                  {showError("booker_email") && <p className="field-error">{errors.booker_email}</p>}
                  {otpStage === "verified" && <p className="otp-success">Email verified</p>}
                </label>

                {otpStage === "sent" ? (
                  <label className="full-width">
                    Verification code
                    <div className="otp-code-row">
                      <input
                        type="text"
                        inputMode="numeric"
                        autoComplete="one-time-code"
                        maxLength={6}
                        value={otpCode}
                        onChange={(event) => setOtpCode(event.target.value.replace(/\D/g, ""))}
                        placeholder="000000"
                        className="otp-code-input"
                      />
                      <button type="button" className="primary-button" onClick={handleVerifyCode} disabled={otpCode.length < 4 || otpVerifying}>
                        {otpVerifying ? "..." : "Verify"}
                      </button>
                    </div>
                    <div className="otp-resend">
                      {resendIn > 0 ? <span>Resend in {resendIn}s</span> : <button type="button" className="link-button" onClick={handleSendCode}>Resend code</button>}
                    </div>
                    {devCode && (
                      <p className="otp-dev-hint">Dev mode — SMTP not configured. Code: <strong>{devCode}</strong></p>
                    )}
                  </label>
                ) : null}

                <label className="full-width">
                  Notes
                  <textarea
                    rows="3"
                    value={form.notes}
                    onChange={(event) => setForm({ ...form, notes: event.target.value })}
                    placeholder="Optional context for the meeting"
                  />
                </label>

                <div className="step-actions full-width">
                  <button type="submit" className="primary-button" disabled={Object.keys(errors).length > 0 || !isVerified}>
                    Review booking
                  </button>
                </div>
              </form>
            </div>
          ) : null}

          {step === 2 ? (
            <div className="booking-step">
              <button className="step-back-btn" onClick={() => setStep(1)}>Back</button>
              <h3 className="step-heading">Confirm your booking</h3>
              <div className="booking-review-card">
                <div className="review-row">
                  <div>
                    <p className="review-label">Event</p>
                    <p className="review-value">{eventType?.title}</p>
                  </div>
                </div>
                <div className="review-row">
                  <div>
                    <p className="review-label">Date and time</p>
                    <p className="review-value">
                      {new Date(`${selectedDate}T00:00:00`).toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" })} - {selectedSlotDisplay}
                    </p>
                  </div>
                </div>
                <div className="review-row">
                  <div>
                    <p className="review-label">Guest</p>
                    <p className="review-value">{form.booker_name} - {form.booker_email}</p>
                  </div>
                </div>
                {form.notes ? (
                  <div className="review-row">
                    <div>
                      <p className="review-label">Notes</p>
                      <p className="review-value">{form.notes}</p>
                    </div>
                  </div>
                ) : null}
              </div>
              <div className="step-actions">
                <button className="primary-button" onClick={handleSubmit} disabled={submitting}>
                  {submitting ? <><span className="btn-spinner" /> Confirming...</> : "Confirm booking"}
                </button>
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
