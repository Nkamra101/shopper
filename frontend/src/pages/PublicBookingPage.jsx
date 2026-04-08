import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { api } from "../services/api";
import { formatDate, getUpcomingDates, toDateInputValue } from "../utils/date";
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

export default function PublicBookingPage() {
  const { slug } = useParams();
  const navigate = useNavigate();
  const toast = useToast();
  const dateChoices = useMemo(() => getUpcomingDates(10), []);
  const [eventType, setEventType] = useState(null);
  const [loadingEvent, setLoadingEvent] = useState(true);
  const [selectedDate, setSelectedDate] = useState(toDateInputValue(dateChoices[0]));
  const [slots, setSlots] = useState([]);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [selectedSlot, setSelectedSlot] = useState("");
  const [form, setForm] = useState({ booker_name: "", booker_email: "", notes: "" });
  const [touched, setTouched] = useState({});
  const [submitting, setSubmitting] = useState(false);

  // ----- OTP state -----
  // stage: "idle" → user can type email; "sent" → email locked, code field shown;
  // "verified" → verification_token in hand, ready to confirm booking.
  const [otpStage, setOtpStage] = useState("idle");
  const [otpCode, setOtpCode] = useState("");
  const [otpSending, setOtpSending] = useState(false);
  const [otpVerifying, setOtpVerifying] = useState(false);
  const [verificationToken, setVerificationToken] = useState("");
  const [verifiedEmail, setVerifiedEmail] = useState("");
  const [resendIn, setResendIn] = useState(0);
  const resendTimer = useRef(null);

  const errors = useMemo(() => validate(form), [form]);
  const emailValid = !errors.booker_email && form.booker_email.trim().length > 0;
  const isVerified = otpStage === "verified" && verifiedEmail === form.booker_email.trim().toLowerCase();
  const isValid =
    Object.keys(errors).length === 0 && !!selectedSlot && isVerified;

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
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slug, selectedDate]);

  // Resend countdown ticker.
  useEffect(() => {
    if (resendIn <= 0) {
      if (resendTimer.current) {
        clearInterval(resendTimer.current);
        resendTimer.current = null;
      }
      return;
    }
    if (!resendTimer.current) {
      resendTimer.current = setInterval(() => {
        setResendIn((prev) => (prev <= 1 ? 0 : prev - 1));
      }, 1000);
    }
    return () => {
      if (resendTimer.current) {
        clearInterval(resendTimer.current);
        resendTimer.current = null;
      }
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
    // Any edit invalidates a previously sent / verified code.
    if (otpStage !== "idle") {
      resetVerification();
    }
  }

  async function handleSendCode() {
    if (!emailValid) {
      setTouched((t) => ({ ...t, booker_email: true }));
      return;
    }
    setOtpSending(true);
    try {
      const data = await api.requestOtp(form.booker_email.trim());
      setOtpStage("sent");
      setResendIn(data.resend_after_seconds || 60);
      toast.success("Verification code sent. Check your inbox.");
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
      toast.error("Please choose a time slot first.");
      return;
    }
    if (Object.keys(errors).length > 0) return;
    if (!isVerified) {
      toast.error("Please verify your email before booking.");
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
      // If the server says the token expired, force re-verification.
      if (error.message && /verif/i.test(error.message)) {
        resetVerification();
      }
    } finally {
      setSubmitting(false);
    }
  }

  function showError(field) {
    return touched[field] && errors[field];
  }

  const emailLocked = otpStage !== "idle";

  return (
    <div className="public-page">
      <div style={{ position: "absolute", top: 20, right: 20 }}>
        <ThemeToggle />
      </div>
      <div className="public-card">
        <div className="public-left">
          <p className="eyebrow">Public booking page</p>
          {loadingEvent ? (
            <>
              <Skeleton height={32} width="70%" style={{ marginBottom: 12 }} />
              <Skeleton height={14} width="100%" style={{ marginBottom: 8 }} />
              <Skeleton height={14} width="80%" />
            </>
          ) : (
            <>
              <h1>{eventType?.title}</h1>
              <p>{eventType?.description}</p>
              <div className="public-meta">
                <span>{eventType?.duration} mins</span>
                <span>{eventType?.timezone}</span>
              </div>
            </>
          )}

          <div className="date-picker-grid" role="radiogroup" aria-label="Pick a date">
            {dateChoices.map((date) => {
              const value = toDateInputValue(date);
              const active = selectedDate === value;
              return (
                <button
                  key={value}
                  type="button"
                  role="radio"
                  aria-checked={active}
                  className={active ? "date-chip active" : "date-chip"}
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
            {loadingSlots ? (
              <div className="slot-grid">
                {Array.from({ length: 6 }).map((_, i) => (
                  <Skeleton key={i} height={44} />
                ))}
              </div>
            ) : slots.length === 0 ? (
              <p style={{ color: "var(--text-muted)", margin: "8px 0 16px" }}>
                No slots available for this day.
              </p>
            ) : (
              <div className="slot-grid" role="radiogroup" aria-label="Available times">
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

          <form className="form-grid" onSubmit={handleSubmit} noValidate>
            <label className="full-width">
              Your name
              <input
                value={form.booker_name}
                onChange={(e) => setForm({ ...form, booker_name: e.target.value })}
                onBlur={() => setTouched((t) => ({ ...t, booker_name: true }))}
                aria-invalid={showError("booker_name") ? "true" : "false"}
                required
              />
              {showError("booker_name") ? (
                <p className="field-error">{errors.booker_name}</p>
              ) : null}
            </label>
            <label className="full-width">
              Email
              <div className="otp-email-row">
                <input
                  type="email"
                  value={form.booker_email}
                  onChange={(e) => handleEmailChange(e.target.value)}
                  onBlur={() => setTouched((t) => ({ ...t, booker_email: true }))}
                  aria-invalid={showError("booker_email") ? "true" : "false"}
                  disabled={emailLocked}
                  required
                />
                {otpStage === "idle" ? (
                  <button
                    type="button"
                    className="ghost-button"
                    onClick={handleSendCode}
                    disabled={!emailValid || otpSending}
                  >
                    {otpSending ? "Sending..." : "Send code"}
                  </button>
                ) : (
                  <button
                    type="button"
                    className="ghost-button"
                    onClick={resetVerification}
                  >
                    Change
                  </button>
                )}
              </div>
              {showError("booker_email") ? (
                <p className="field-error">{errors.booker_email}</p>
              ) : null}
              {otpStage === "verified" ? (
                <p className="otp-success">Email verified.</p>
              ) : null}
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
                    placeholder="Enter 6-digit code"
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
                    {otpVerifying ? "Verifying..." : "Verify"}
                  </button>
                </div>
                <div className="otp-resend">
                  {resendIn > 0 ? (
                    <span>Resend available in {resendIn}s</span>
                  ) : (
                    <button
                      type="button"
                      className="link-button"
                      onClick={handleSendCode}
                      disabled={otpSending}
                    >
                      {otpSending ? "Sending..." : "Resend code"}
                    </button>
                  )}
                </div>
              </label>
            ) : null}

            <label className="full-width">
              Notes
              <textarea
                rows="4"
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
                placeholder="Tell us what you want to discuss."
              />
            </label>
            <button
              type="submit"
              className="primary-button full-width"
              disabled={!isValid || submitting}
            >
              {submitting
                ? "Confirming..."
                : !isVerified
                ? "Verify email to continue"
                : "Confirm booking"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
