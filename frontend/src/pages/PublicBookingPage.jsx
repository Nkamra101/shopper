import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { api } from "../services/api";
import {
  COMMON_TIMEZONES,
  browserTimezone,
  dateKeyIn,
  formatTimeIn,
  shiftDateKey,
  timezoneOffsetLabel,
  toDateInputValue,
} from "../utils/date";
import { Skeleton } from "../components/Skeleton";
import ThemeToggle from "../components/ThemeToggle";
import { useToast } from "../components/Toast";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function validate(form, questions) {
  const errors = {};
  if (!form.booker_name.trim()) errors.booker_name = "Your name is required.";
  if (!form.booker_email.trim()) errors.booker_email = "Email is required.";
  else if (!EMAIL_PATTERN.test(form.booker_email)) errors.booker_email = "Enter a valid email address.";

  questions.forEach((question) => {
    if (question.required && !String(form.answers?.[question.id] || "").trim()) {
      errors[`q_${question.id}`] = `${question.label} is required.`;
    }
  });
  return errors;
}

function TimezoneSelect({ value, onChange }) {
  const options = useMemo(() => {
    const seen = new Set(COMMON_TIMEZONES);
    // Always include the visitor's own zone and whatever is selected, even
    // when they fall outside the curated list.
    return [
      ...(seen.has(value) ? [] : [value]),
      ...(seen.has(browserTimezone()) || browserTimezone() === value ? [] : [browserTimezone()]),
      ...COMMON_TIMEZONES,
    ];
  }, [value]);

  return (
    <label className="tz-select">
      <span className="tz-select-label">Times shown in</span>
      <select value={value} onChange={(event) => onChange(event.target.value)}>
        {options.map((zone) => (
          <option key={zone} value={zone}>
            {zone.replace(/_/g, " ")} ({timezoneOffsetLabel(zone)})
          </option>
        ))}
      </select>
    </label>
  );
}

function CalendarGrid({ selectedDate, onSelectDate, availableDays, onMonthChange, loadingDays }) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const [viewMonth, setViewMonth] = useState(() => new Date(today.getFullYear(), today.getMonth(), 1));

  const year = viewMonth.getFullYear();
  const month = viewMonth.getMonth();
  const monthKey = `${year}-${String(month + 1).padStart(2, "0")}`;

  useEffect(() => {
    onMonthChange(monthKey);
  }, [monthKey, onMonthChange]);

  const lastDay = new Date(year, month + 1, 0);
  const startPad = (new Date(year, month, 1).getDay() + 6) % 7;
  const cells = [];
  for (let index = 0; index < startPad; index += 1) cells.push(null);
  for (let day = 1; day <= lastDay.getDate(); day += 1) cells.push(day);

  function changeMonth(delta) {
    setViewMonth(new Date(year, month + delta, 1));
  }

  return (
    <div className="calendar-grid-widget">
      <div className="calendar-header">
        <button type="button" className="cal-nav-btn" onClick={() => changeMonth(-1)} aria-label="Previous month">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="15 18 9 12 15 6" />
          </svg>
        </button>
        <span className="cal-month-label">
          {viewMonth.toLocaleDateString("en-US", { month: "long", year: "numeric" })}
        </span>
        <button type="button" className="cal-nav-btn" onClick={() => changeMonth(1)} aria-label="Next month">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="9 18 15 12 9 6" />
          </svg>
        </button>
      </div>
      <div className="calendar-weekdays">
        {["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"].map((label) => (
          <span key={label} className="cal-weekday">{label}</span>
        ))}
      </div>
      <div className={`calendar-cells${loadingDays ? " is-loading" : ""}`}>
        {cells.map((day, index) => {
          if (!day) return <span key={`pad-${index}`} />;
          const date = new Date(year, month, day);
          date.setHours(0, 0, 0, 0);
          const iso = toDateInputValue(date);
          const isPast = date < today;
          // Only grey out days once we know the month's availability.
          const unavailable = !isPast && availableDays !== null && !availableDays.has(iso);
          const classes = [
            "cal-day",
            selectedDate === iso ? "selected" : "",
            date.getTime() === today.getTime() ? "today" : "",
            isPast ? "past" : "",
            unavailable ? "unavailable" : "",
          ].filter(Boolean).join(" ");

          return (
            <button
              key={iso}
              type="button"
              disabled={isPast || unavailable}
              className={classes}
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
          <div className="step-dot">{index < step ? "✓" : index + 1}</div>
          <span className="step-label">{label}</span>
          {index < steps.length - 1 && <div className="step-line" />}
        </div>
      ))}
    </div>
  );
}

function QuestionField({ question, value, onChange, error }) {
  const common = {
    value: value || "",
    onChange: (event) => onChange(question.id, event.target.value),
    "aria-invalid": error ? "true" : "false",
  };

  return (
    <label className="full-width">
      {question.label}
      {question.required ? <span className="required-mark"> *</span> : null}
      {question.type === "textarea" ? (
        <textarea rows="3" placeholder={question.placeholder} {...common} />
      ) : question.type === "select" ? (
        <select {...common}>
          <option value="">Select an option</option>
          {(question.options || []).map((option) => (
            <option key={option} value={option}>{option}</option>
          ))}
        </select>
      ) : question.type === "checkbox" ? (
        <div className="toggle-row">
          <input
            type="checkbox"
            checked={value === "Yes"}
            onChange={(event) => onChange(question.id, event.target.checked ? "Yes" : "")}
          />
          <span>{question.placeholder || "Yes"}</span>
        </div>
      ) : (
        <input
          type={question.type === "phone" ? "tel" : "text"}
          placeholder={question.placeholder}
          {...common}
        />
      )}
      {error ? <p className="field-error">{error}</p> : null}
    </label>
  );
}

export default function PublicBookingPage() {
  const { slug } = useParams();
  const navigate = useNavigate();
  const toast = useToast();
  const resendTimerRef = useRef(null);

  const [eventType, setEventType] = useState(null);
  const [loadingEvent, setLoadingEvent] = useState(true);
  const [timezone, setTimezone] = useState(browserTimezone);
  const [selectedDate, setSelectedDate] = useState(() => toDateInputValue(new Date()));
  const [slots, setSlots] = useState([]);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [availableDays, setAvailableDays] = useState(null);
  const [loadingDays, setLoadingDays] = useState(false);
  const [selectedSlot, setSelectedSlot] = useState("");
  const [step, setStep] = useState(0);
  const [form, setForm] = useState({ booker_name: "", booker_email: "", notes: "", answers: {} });
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

  const questions = eventType?.questions || [];
  const errors = useMemo(() => validate(form, questions), [form, questions]);
  const detailErrors = Object.keys(errors);
  const emailValid = !errors.booker_email && form.booker_email.trim().length > 0;
  const isVerified = otpStage === "verified" && verifiedEmail === form.booker_email.trim().toLowerCase();
  const selectedSlotObject = slots.find((slot) => slot.start_utc === selectedSlot);

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

  // Slots are generated per host-local day. When the visitor is reading them
  // in another timezone, a single visitor-day can straddle two host-days, so
  // fetch the neighbours too and keep only what lands on the chosen date.
  useEffect(() => {
    let cancelled = false;

    async function loadSlots() {
      if (!slug || !selectedDate) return;
      setLoadingSlots(true);
      try {
        const days = [shiftDateKey(selectedDate, -1), selectedDate, shiftDateKey(selectedDate, 1)];
        const results = await Promise.all(
          days.map((day) => api.getSlots(slug, day).catch(() => []))
        );

        if (cancelled) return;
        const byStart = new Map();
        results.flat().forEach((slot) => byStart.set(slot.start_utc, slot));
        const visible = [...byStart.values()]
          .filter((slot) => dateKeyIn(slot.start_utc, timezone) === selectedDate)
          .sort((a, b) => a.start_utc.localeCompare(b.start_utc));

        setSlots(visible);
        setSelectedSlot("");
      } catch (error) {
        if (!cancelled) toast.error(error.message || "Could not load slots.");
      } finally {
        if (!cancelled) setLoadingSlots(false);
      }
    }

    loadSlots();
    return () => { cancelled = true; };
  }, [slug, selectedDate, timezone, toast]);

  const handleMonthChange = useCallback(
    async (monthKey) => {
      if (!slug) return;
      setLoadingDays(true);
      try {
        const days = await api.getAvailableDays(slug, monthKey);
        setAvailableDays(new Set(days));
      } catch {
        // Non-fatal: without this the calendar simply doesn't grey days out.
        setAvailableDays(null);
      } finally {
        setLoadingDays(false);
      }
    },
    [slug]
  );

  useEffect(() => {
    if (resendIn <= 0) {
      if (resendTimerRef.current) {
        clearInterval(resendTimerRef.current);
        resendTimerRef.current = null;
      }
      return undefined;
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
    setForm((current) => ({ ...current, booker_email: value }));
    if (otpStage !== "idle") resetVerification();
  }

  function handleAnswerChange(questionId, value) {
    setForm((current) => ({ ...current, answers: { ...current.answers, [questionId]: value } }));
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
    if (detailErrors.length > 0 || !isVerified) {
      toast.error("Please complete your details and verify your email.");
      return;
    }

    setSubmitting(true);
    try {
      const answers = questions
        .map((question) => ({
          question_id: question.id,
          label: question.label,
          value: String(form.answers?.[question.id] || "").trim(),
        }))
        .filter((answer) => answer.value);

      const booking = await api.createBooking(slug, {
        booker_name: form.booker_name,
        booker_email: form.booker_email,
        notes: form.notes,
        start_time: selectedSlot,
        verification_token: verificationToken,
        answers,
      });

      if (booking.manage_token) {
        // The confirmation screen offers reschedule/cancel without another
        // round trip; the same link also arrives by email.
        sessionStorage.setItem(`shopper_manage_${booking.id}`, booking.manage_token);
      }
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

  const selectedDateLabel = new Date(`${selectedDate}T00:00:00`).toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
  });

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
              {eventType?.host_name ? <p className="public-host-name">{eventType.host_name}</p> : null}
              <h1 className="public-event-title">{eventType?.title}</h1>
              {eventType?.description && <p className="public-event-desc">{eventType.description}</p>}
              <div className="public-meta-chips">
                <div className="public-meta-chip">{eventType?.duration} minutes</div>
                {eventType?.location_type ? (
                  <div className="public-meta-chip">
                    {eventType.location || (eventType.location_type === "video" ? "Video call" : eventType.location_type)}
                  </div>
                ) : null}
              </div>
              {eventType?.host_welcome_message ? (
                <div className="public-help-card">
                  <p>{eventType.host_welcome_message}</p>
                </div>
              ) : (
                <div className="public-help-card">
                  <strong>How it works</strong>
                  <p>Pick a time, verify your email with a one-time code, and you're booked. You can reschedule or cancel later from your confirmation email.</p>
                </div>
              )}
              {selectedSlotObject ? (
                <div className="booking-summary-preview">
                  <span>
                    {formatTimeIn(selectedSlotObject.start_utc, timezone)} &middot; {selectedDateLabel}
                  </span>
                </div>
              ) : null}
            </>
          )}
        </div>

        <div className="public-booking-panel">
          <StepIndicator step={step} />

          {step === 0 ? (
            <div className="booking-step">
              <div className="step-heading-row">
                <h3 className="step-heading">Choose a date and time</h3>
                <TimezoneSelect value={timezone} onChange={setTimezone} />
              </div>

              <CalendarGrid
                selectedDate={selectedDate}
                availableDays={availableDays}
                loadingDays={loadingDays}
                onMonthChange={handleMonthChange}
                onSelectDate={(value) => { setSelectedDate(value); setSelectedSlot(""); }}
              />

              <div className="slots-section">
                <h4 className="slots-heading">{selectedDateLabel}</h4>
                {loadingSlots ? (
                  <div className="slot-grid">
                    {Array.from({ length: 8 }).map((_, index) => <Skeleton key={index} height={40} />)}
                  </div>
                ) : slots.length === 0 ? (
                  <div className="slots-empty"><span>No available times on this day.</span></div>
                ) : (
                  <div className="slot-grid" role="radiogroup" aria-label="Available times">
                    {slots.map((slot) => {
                      const active = selectedSlot === slot.start_utc;
                      return (
                        <button
                          key={slot.start_utc}
                          type="button"
                          role="radio"
                          aria-checked={active}
                          className={active ? "slot-button active" : "slot-button"}
                          onClick={() => setSelectedSlot(slot.start_utc)}
                        >
                          {formatTimeIn(slot.start_utc, timezone)}
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
              <form
                className="form-grid"
                onSubmit={(event) => {
                  event.preventDefault();
                  setTouched({ booker_name: true, booker_email: true });
                  if (detailErrors.length === 0 && isVerified) setStep(2);
                }}
                noValidate
              >
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
                      {resendIn > 0 ? (
                        <span>Resend in {resendIn}s</span>
                      ) : (
                        <button type="button" className="link-button" onClick={handleSendCode}>Resend code</button>
                      )}
                    </div>
                    {devCode && (
                      <p className="otp-dev-hint">Dev mode — SMTP not configured. Code: <strong>{devCode}</strong></p>
                    )}
                  </label>
                ) : null}

                {questions.map((question) => (
                  <QuestionField
                    key={question.id}
                    question={question}
                    value={form.answers?.[question.id]}
                    onChange={handleAnswerChange}
                    error={touched.booker_email || touched.booker_name ? errors[`q_${question.id}`] : ""}
                  />
                ))}

                <label className="full-width">
                  Anything else?
                  <textarea
                    rows="3"
                    value={form.notes}
                    onChange={(event) => setForm({ ...form, notes: event.target.value })}
                    placeholder="Optional context for the meeting"
                  />
                </label>

                <div className="step-actions full-width">
                  <button type="submit" className="primary-button" disabled={detailErrors.length > 0 || !isVerified}>
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
                      {selectedSlotObject ? formatTimeIn(selectedSlotObject.start_utc, timezone) : ""} &middot;{" "}
                      {new Date(`${selectedDate}T00:00:00`).toLocaleDateString("en-US", {
                        weekday: "long", month: "long", day: "numeric", year: "numeric",
                      })}
                    </p>
                    <p className="review-sub">{timezone.replace(/_/g, " ")} ({timezoneOffsetLabel(timezone)})</p>
                  </div>
                </div>
                <div className="review-row">
                  <div>
                    <p className="review-label">Guest</p>
                    <p className="review-value">{form.booker_name} &middot; {form.booker_email}</p>
                  </div>
                </div>
                {questions.map((question) => {
                  const value = form.answers?.[question.id];
                  if (!value) return null;
                  return (
                    <div className="review-row" key={question.id}>
                      <div>
                        <p className="review-label">{question.label}</p>
                        <p className="review-value">{value}</p>
                      </div>
                    </div>
                  );
                })}
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
