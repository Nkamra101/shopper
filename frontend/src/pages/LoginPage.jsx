import { useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import Logo from "../components/Logo";
import Icon from "../components/Icon";
import ThemeToggle from "../components/ThemeToggle";
import { useAuth } from "../components/AuthContext";
import { useToast } from "../components/Toast";
import { api } from "../services/api";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const toast = useToast();
  const [params] = useSearchParams();

  const [mode, setMode] = useState(params.get("mode") === "signup" ? "signup" : "signin");
  const [form, setForm] = useState({ name: "", email: "", password: "", confirm: "" });
  const [errors, setErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  useEffect(() => {
    setErrors({});
  }, [mode]);

  function set(field, value) {
    setForm((current) => ({ ...current, [field]: value }));
    setErrors((current) => ({ ...current, [field]: "" }));
  }

  function validate() {
    const next = {};
    if (mode === "signup" && !form.name.trim()) next.name = "Tell us what to call you.";
    if (!EMAIL_PATTERN.test(form.email.trim())) next.email = "Enter a valid email address.";
    if (!form.password) next.password = "Password is required.";
    else if (mode === "signup" && form.password.length < 8) next.password = "Use at least 8 characters.";
    if (mode === "signup" && form.password !== form.confirm) next.confirm = "Passwords do not match.";
    return next;
  }

  async function handleSubmit(event) {
    event.preventDefault();
    const found = validate();
    if (Object.keys(found).length) {
      setErrors(found);
      return;
    }

    setSubmitting(true);
    try {
      const payload =
        mode === "signup"
          ? await api.register({ email: form.email.trim(), password: form.password, name: form.name.trim() })
          : await api.login({ email: form.email.trim(), password: form.password });

      login(payload.access_token, payload.user);
      navigate("/dashboard", { replace: true });
    } catch (error) {
      toast.error(error.message || "Authentication failed.");
    } finally {
      setSubmitting(false);
    }
  }

  const isSignup = mode === "signup";

  return (
    <div className="auth">
      <header className="public-bar">
        <Link to="/"><Logo size={30} tile /></Link>
        <ThemeToggle />
      </header>

      <main className="auth-main">
        <div className="auth-card card">
          <div className="card-body stack-4">
            <div>
              <h1 style={{ fontSize: "1.375rem" }}>{isSignup ? "Create your account" : "Welcome back"}</h1>
              <p className="small muted" style={{ marginTop: 4 }}>
                {isSignup
                  ? "Set your hours once and start taking bookings."
                  : "Sign in to manage your availability and bookings."}
              </p>
            </div>

            <div className="seg" role="tablist" style={{ alignSelf: "flex-start" }}>
              <button
                type="button" role="tab" className="seg-item"
                aria-selected={!isSignup} onClick={() => setMode("signin")}
              >
                Sign in
              </button>
              <button
                type="button" role="tab" className="seg-item"
                aria-selected={isSignup} onClick={() => setMode("signup")}
              >
                Sign up
              </button>
            </div>

            <a className="btn btn-block" href={api.googleLoginUrl()}>
              <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true">
                <path fill="#4285F4" d="M22.5 12.2c0-.8-.1-1.5-.2-2.2H12v4.3h5.9a5 5 0 0 1-2.2 3.3v2.7h3.5c2-1.9 3.3-4.7 3.3-8.1Z" />
                <path fill="#34A853" d="M12 23c3 0 5.5-1 7.3-2.7l-3.5-2.7c-1 .7-2.3 1.1-3.8 1.1-2.9 0-5.4-2-6.3-4.6H2v2.8A11 11 0 0 0 12 23Z" />
                <path fill="#FBBC05" d="M5.7 14.1a6.6 6.6 0 0 1 0-4.2V7.1H2a11 11 0 0 0 0 9.8l3.7-2.8Z" />
                <path fill="#EA4335" d="M12 5.4c1.6 0 3.1.6 4.2 1.7l3.1-3.1A11 11 0 0 0 2 7.1l3.7 2.8C6.6 7.4 9.1 5.4 12 5.4Z" />
              </svg>
              Continue with Google
            </a>

            <div className="auth-divider"><span>or use email</span></div>

            <form className="stack-4" onSubmit={handleSubmit} noValidate>
              {isSignup && (
                <label className="field">
                  <span className="field-label">Full name</span>
                  <input
                    className="input"
                    value={form.name}
                    onChange={(event) => set("name", event.target.value)}
                    placeholder="Ananya"
                    autoComplete="name"
                    aria-invalid={errors.name ? "true" : "false"}
                  />
                  {errors.name && <span className="error-text">{errors.name}</span>}
                </label>
              )}

              <label className="field">
                <span className="field-label">Email</span>
                <input
                  className="input"
                  type="email"
                  value={form.email}
                  onChange={(event) => set("email", event.target.value)}
                  placeholder="you@example.com"
                  autoComplete="email"
                  aria-invalid={errors.email ? "true" : "false"}
                />
                {errors.email && <span className="error-text">{errors.email}</span>}
              </label>

              <label className="field">
                <span className="field-label">Password</span>
                <div className="input-affix">
                  <input
                    className="input"
                    type={showPassword ? "text" : "password"}
                    value={form.password}
                    onChange={(event) => set("password", event.target.value)}
                    placeholder={isSignup ? "At least 8 characters" : "Your password"}
                    autoComplete={isSignup ? "new-password" : "current-password"}
                    aria-invalid={errors.password ? "true" : "false"}
                  />
                  <button
                    type="button"
                    className="affix affix-end"
                    onClick={() => setShowPassword((value) => !value)}
                    aria-label={showPassword ? "Hide password" : "Show password"}
                  >
                    {showPassword ? "Hide" : "Show"}
                  </button>
                </div>
                {errors.password && <span className="error-text">{errors.password}</span>}
              </label>

              {isSignup && (
                <label className="field">
                  <span className="field-label">Confirm password</span>
                  <input
                    className="input"
                    type={showPassword ? "text" : "password"}
                    value={form.confirm}
                    onChange={(event) => set("confirm", event.target.value)}
                    autoComplete="new-password"
                    aria-invalid={errors.confirm ? "true" : "false"}
                  />
                  {errors.confirm && <span className="error-text">{errors.confirm}</span>}
                </label>
              )}

              <button type="submit" className="btn btn-primary btn-lg btn-block" disabled={submitting}>
                {submitting ? <><span className="spinner" /> Please wait…</> : isSignup ? "Create account" : "Sign in"}
              </button>
            </form>
          </div>
        </div>

        <p className="tiny subtle" style={{ textAlign: "center", marginTop: "var(--s5)" }}>
          <Link to="/" className="btn-link">
            <Icon name="chevronLeft" size={13} />
            Back to home
          </Link>
        </p>
      </main>
    </div>
  );
}
