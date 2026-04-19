import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import ThemeToggle from "../components/ThemeToggle";
import CursorParticles from "../components/CursorParticles";
import { useAuth } from "../components/AuthContext";
import { useToast } from "../components/Toast";
import { api } from "../services/api";

const API_BASE = import.meta.env.VITE_API_URL || "https://shopper-backend-2n4n.onrender.com";
const GOOGLE_OAUTH_URL = `${API_BASE}/api/auth/google`;

export default function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const toast = useToast();

  const [tab, setTab] = useState("google"); // "google" | "password"
  const [mode, setMode] = useState("signin"); // "signin" | "signup"
  const [form, setForm] = useState({ name: "", email: "", password: "", confirm: "" });
  const [errors, setErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [showPass, setShowPass] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  function set(field, value) {
    setForm((prev) => ({ ...prev, [field]: value }));
    setErrors((prev) => ({ ...prev, [field]: "" }));
  }

  function validate() {
    const errs = {};
    if (mode === "signup" && !form.name.trim()) errs.name = "Name is required.";
    if (!form.email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) errs.email = "Enter a valid email.";
    if (!form.password) errs.password = "Password is required.";
    else if (form.password.length < 8) errs.password = "At least 8 characters.";
    if (mode === "signup" && form.password !== form.confirm) errs.confirm = "Passwords do not match.";
    return errs;
  }

  async function handleSubmit(e) {
    e.preventDefault();
    const errs = validate();
    if (Object.keys(errs).length) { setErrors(errs); return; }

    setSubmitting(true);
    try {
      const payload = mode === "signup"
        ? await api.register({ email: form.email, password: form.password, name: form.name })
        : await api.login({ email: form.email, password: form.password });

      login(payload.access_token, payload.user);
      navigate("/dashboard", { replace: true });
    } catch (err) {
      toast.error(err.message || "Authentication failed.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="login-page">
      <CursorParticles />

      <header className="login-topbar">
        <Link to="/" className="brand-block" style={{ gap: 10, textDecoration: "none" }}>
          <div className="brand-logo">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M8 2v4M16 2v4M3 10h18M5 4h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z" />
            </svg>
          </div>
          <p className="brand-name">Shopper</p>
        </Link>
        <ThemeToggle />
      </header>

      <div className="login-wrapper">
        <div className="login-card">
          <div className="login-blob" />

          <div className="login-header">
            <div className="login-logo">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M8 2v4M16 2v4M3 10h18M5 4h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z" />
                <path d="M8 14h.01M12 14h.01M16 14h.01M8 18h.01M12 18h.01" />
              </svg>
            </div>
            <h1>Welcome to Shopper</h1>
            <p>Sign in to manage your booking pages, availability, and guests.</p>
          </div>

          {/* Tab switcher */}
          <div className="login-mode-tabs">
            <button className={`login-tab ${tab === "google" ? "active" : ""}`} onClick={() => setTab("google")}>
              Google
            </button>
            <button className={`login-tab ${tab === "password" ? "active" : ""}`} onClick={() => setTab("password")}>
              Email &amp; Password
            </button>
          </div>

          {tab === "google" ? (
            <a href={GOOGLE_OAUTH_URL} className="google-oauth-btn">
              <svg width="20" height="20" viewBox="0 0 24 24">
                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
              </svg>
              Continue with Google
            </a>
          ) : (
            <>
              {/* Sign in / Sign up sub-tabs */}
              <div className="login-mode-tabs" style={{ marginBottom: "var(--space-4)" }}>
                <button className={`login-tab ${mode === "signin" ? "active" : ""}`} onClick={() => { setMode("signin"); setErrors({}); }}>
                  Sign in
                </button>
                <button className={`login-tab ${mode === "signup" ? "active" : ""}`} onClick={() => { setMode("signup"); setErrors({}); }}>
                  Create account
                </button>
              </div>

              <form className="login-form" onSubmit={handleSubmit} noValidate>
                {mode === "signup" && (
                  <label>
                    Name
                    <input
                      type="text"
                      placeholder="Your name"
                      value={form.name}
                      onChange={(e) => set("name", e.target.value)}
                      aria-invalid={errors.name ? "true" : "false"}
                      autoComplete="name"
                    />
                    {errors.name && <p className="field-error">{errors.name}</p>}
                  </label>
                )}

                <label>
                  Email
                  <input
                    type="email"
                    placeholder="you@example.com"
                    value={form.email}
                    onChange={(e) => set("email", e.target.value)}
                    aria-invalid={errors.email ? "true" : "false"}
                    autoComplete="email"
                  />
                  {errors.email && <p className="field-error">{errors.email}</p>}
                </label>

                <label>
                  Password
                  <div className="password-input-wrap">
                    <input
                      type={showPass ? "text" : "password"}
                      placeholder={mode === "signup" ? "At least 8 characters" : "Your password"}
                      value={form.password}
                      onChange={(e) => set("password", e.target.value)}
                      aria-invalid={errors.password ? "true" : "false"}
                      autoComplete={mode === "signup" ? "new-password" : "current-password"}
                    />
                    <button type="button" className="password-toggle" onClick={() => setShowPass((v) => !v)} aria-label={showPass ? "Hide password" : "Show password"}>
                      {showPass ? (
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
                          <line x1="1" y1="1" x2="23" y2="23" />
                        </svg>
                      ) : (
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                          <circle cx="12" cy="12" r="3" />
                        </svg>
                      )}
                    </button>
                  </div>
                  {errors.password && <p className="field-error">{errors.password}</p>}
                </label>

                {mode === "signup" && (
                  <label>
                    Confirm password
                    <div className="password-input-wrap">
                      <input
                        type={showConfirm ? "text" : "password"}
                        placeholder="Repeat your password"
                        value={form.confirm}
                        onChange={(e) => set("confirm", e.target.value)}
                        aria-invalid={errors.confirm ? "true" : "false"}
                        autoComplete="new-password"
                      />
                      <button type="button" className="password-toggle" onClick={() => setShowConfirm((v) => !v)} aria-label={showConfirm ? "Hide password" : "Show password"}>
                        {showConfirm ? (
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
                            <line x1="1" y1="1" x2="23" y2="23" />
                          </svg>
                        ) : (
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                            <circle cx="12" cy="12" r="3" />
                          </svg>
                        )}
                      </button>
                    </div>
                    {errors.confirm && <p className="field-error">{errors.confirm}</p>}
                  </label>
                )}

                <button type="submit" className="primary-button login-submit" disabled={submitting}>
                  {submitting ? (
                    <><span className="btn-spinner" />{mode === "signup" ? "Creating account…" : "Signing in…"}</>
                  ) : (
                    mode === "signup" ? "Create account" : "Sign in"
                  )}
                </button>
              </form>
            </>
          )}

          <p className="login-footer-text">
            {tab === "google"
              ? "By continuing you agree to our terms of service and privacy policy."
              : mode === "signin"
                ? "Don't have an account? Switch to Create account above."
                : "Already have an account? Switch to Sign in above."}
            <br />
            <Link to="/">Back to home</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
