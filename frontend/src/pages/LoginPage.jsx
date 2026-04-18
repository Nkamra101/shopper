import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useAuth } from "../components/AuthContext";
import { useToast } from "../components/Toast";
import ThemeToggle from "../components/ThemeToggle";

const API_BASE = import.meta.env.VITE_API_URL || "https://shopper-backend-2n4n.onrender.com";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const toast = useToast();

  const [mode, setMode] = useState("login"); // "login" | "register"
  const [form, setForm] = useState({ email: "", password: "", name: "" });
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState({});

  const GOOGLE_OAUTH_URL = `${API_BASE}/api/auth/google`;

  function validate() {
    const e = {};
    if (!EMAIL_RE.test(form.email)) e.email = "Enter a valid email.";
    if (form.password.length < 8) e.password = "Password must be at least 8 characters.";
    if (mode === "register" && !form.name.trim()) e.name = "Name is required.";
    return e;
  }

  async function handleSubmit(e) {
    e.preventDefault();
    const errs = validate();
    setErrors(errs);
    if (Object.keys(errs).length > 0) return;

    setLoading(true);
    try {
      const endpoint = mode === "login" ? "/api/auth/login" : "/api/auth/register";
      const body = mode === "login"
        ? { email: form.email, password: form.password }
        : { email: form.email, password: form.password, name: form.name };

      const resp = await fetch(`${API_BASE}${endpoint}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await resp.json();
      if (!resp.ok) throw new Error(data.detail || "Authentication failed.");

      login(data.access_token, data.user);
      toast.success(mode === "login" ? "Welcome back!" : "Account created!");
      navigate("/dashboard", { replace: true });
    } catch (err) {
      toast.error(err.message || "Something went wrong.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="login-page">
      <div className="login-topbar">
        <Link to="/" className="public-brand" style={{ textDecoration: "none", color: "inherit" }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M8 2v4M16 2v4M3 10h18M5 4h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z" />
          </svg>
          Shopper
        </Link>
        <ThemeToggle />
      </div>

      <div className="login-wrapper">
        <div className="login-card">
          {/* Decorative gradient blob */}
          <div className="login-blob" />

          <div className="login-header">
            <div className="login-logo">
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M8 2v4M16 2v4M3 10h18M5 4h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z" />
                <path d="M8 14h.01M12 14h.01M16 14h.01M8 18h.01M12 18h.01" />
              </svg>
            </div>
            <h1>{mode === "login" ? "Welcome back" : "Create your account"}</h1>
            <p>{mode === "login" ? "Sign in to your Shopper dashboard" : "Start scheduling meetings in minutes"}</p>
          </div>

          {/* Google OAuth button */}
          <a href={GOOGLE_OAUTH_URL} className="google-oauth-btn">
            <svg width="18" height="18" viewBox="0 0 24 24">
              <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
              <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
              <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
              <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
            </svg>
            Continue with Google
          </a>

          <div className="login-divider">
            <span>or</span>
          </div>

          {/* Mode toggle */}
          <div className="login-mode-tabs">
            <button
              type="button"
              className={mode === "login" ? "login-tab active" : "login-tab"}
              onClick={() => { setMode("login"); setErrors({}); }}
            >
              Sign in
            </button>
            <button
              type="button"
              className={mode === "register" ? "login-tab active" : "login-tab"}
              onClick={() => { setMode("register"); setErrors({}); }}
            >
              Register
            </button>
          </div>

          <form onSubmit={handleSubmit} noValidate className="login-form">
            {mode === "register" && (
              <label>
                Full name
                <input
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="Alex Johnson"
                  aria-invalid={errors.name ? "true" : "false"}
                />
                {errors.name && <p className="field-error">{errors.name}</p>}
              </label>
            )}

            <label>
              Email
              <input
                type="email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                placeholder="you@example.com"
                aria-invalid={errors.email ? "true" : "false"}
                autoComplete="email"
              />
              {errors.email && <p className="field-error">{errors.email}</p>}
            </label>

            <label>
              Password
              <input
                type="password"
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
                placeholder="••••••••"
                aria-invalid={errors.password ? "true" : "false"}
                autoComplete={mode === "login" ? "current-password" : "new-password"}
              />
              {errors.password && <p className="field-error">{errors.password}</p>}
            </label>

            <button type="submit" className="primary-button login-submit" disabled={loading}>
              {loading ? (
                <><span className="btn-spinner" /> {mode === "login" ? "Signing in…" : "Creating account…"}</>
              ) : (
                mode === "login" ? "Sign in" : "Create account"
              )}
            </button>
          </form>

          <p className="login-footer-text">
            By continuing, you agree to our{" "}
            <Link to="/terms" style={{ color: "var(--accent)" }}>Terms</Link> and{" "}
            <Link to="/privacy" style={{ color: "var(--accent)" }}>Privacy Policy</Link>.
          </p>
        </div>
      </div>
    </div>
  );
}
