import { Link } from "react-router-dom";
import Logo from "../components/Logo";
import Icon from "../components/Icon";
import ThemeToggle from "../components/ThemeToggle";

const FEATURES = [
  {
    icon: "clock",
    title: "Availability that fits real life",
    body: "Set working hours per weekday, add a lunch break or a split shift, and block out whole weeks when you're away.",
  },
  {
    icon: "globe",
    title: "Every guest sees their own timezone",
    body: "Slots render in the visitor's local time automatically. Nobody does mental arithmetic and nobody shows up an hour late.",
  },
  {
    icon: "mail",
    title: "Verified guests only",
    body: "A one-time code confirms the email address before a booking is held, so your calendar stays free of junk.",
  },
  {
    icon: "refresh",
    title: "Guests reschedule themselves",
    body: "Every confirmation carries a private link to move or cancel the meeting. No back-and-forth threads.",
  },
  {
    icon: "zap",
    title: "Reminders that actually send",
    body: "Automated email and webhook workflows fire on booking events, and on a timer before or after the meeting.",
  },
  {
    icon: "calendar",
    title: "Lives in your calendar",
    body: "Subscribe from Google Calendar, Apple Calendar or Outlook through a private feed you can rotate at any time.",
  },
];

const STEPS = [
  { title: "Set your hours", body: "Tell Shopper when you're free. Once." },
  { title: "Share your link", body: "Send one URL, or embed it on your site." },
  { title: "Get booked", body: "Confirmations, reminders and calendar entries happen on their own." },
];

export default function LandingPage() {
  return (
    <div className="landing">
      <header className="landing-nav">
        <div className="landing-nav-inner">
          <Logo size={30} tile />
          <div className="row-2">
            <ThemeToggle />
            <Link className="btn" to="/login">Sign in</Link>
            <Link className="btn btn-primary" to="/login?mode=signup">Get started</Link>
          </div>
        </div>
      </header>

      <main>
        <section className="landing-hero">
          <div className="landing-hero-inner">
            <div className="landing-hero-copy">
              <span className="badge">
                <span className="dot" style={{ color: "var(--c-ok)" }} />
                Free to use
              </span>
              <h1 className="display">
                Scheduling without<br />the back-and-forth.
              </h1>
              <p className="lede">
                Share one link. People pick a time that actually works for both of you, and
                Shopper handles the confirmation, the reminder and the calendar invite.
              </p>
              <div className="row-wrap" style={{ marginTop: "var(--s6)" }}>
                <Link className="btn btn-primary btn-lg" to="/login?mode=signup">
                  Create your booking page
                  <Icon name="arrowRight" size={15} />
                </Link>
                <Link className="btn btn-lg" to="/login">Sign in</Link>
              </div>
              <p className="hint" style={{ marginTop: "var(--s3)" }}>
                No credit card. Set up in about two minutes.
              </p>
            </div>

            <div className="landing-preview" aria-hidden="true">
              <div className="preview-window">
                <div className="preview-bar">
                  <span className="preview-dot" /><span className="preview-dot" /><span className="preview-dot" />
                  <span className="preview-url mono">shopper.app/book/intro-call</span>
                </div>
                <div className="preview-body">
                  <div className="preview-side">
                    <span className="preview-accent" />
                    <p className="tiny subtle">Priya Nair</p>
                    <p className="preview-title">Intro Call</p>
                    <div className="row-2" style={{ flexWrap: "wrap" }}>
                      <span className="badge">30 min</span>
                      <span className="badge">Video call</span>
                    </div>
                  </div>
                  <div className="preview-slots">
                    <p className="tiny subtle" style={{ marginBottom: 8 }}>Thursday, 13 August</p>
                    {["9:00 AM", "9:35 AM", "10:10 AM", "11:20 AM"].map((time, index) => (
                      <span key={time} className={`preview-slot${index === 1 ? " is-active" : ""}`}>{time}</span>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="landing-section">
          <div className="landing-section-inner">
            <div className="landing-section-head">
              <p className="eyebrow">How it works</p>
              <h2>Three steps, then it runs itself.</h2>
            </div>
            <div className="grid-3">
              {STEPS.map((step, index) => (
                <div key={step.title} className="step-card">
                  <span className="step-number">{index + 1}</span>
                  <h3>{step.title}</h3>
                  <p className="small muted">{step.body}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="landing-section landing-section-alt">
          <div className="landing-section-inner">
            <div className="landing-section-head">
              <p className="eyebrow">What you get</p>
              <h2>Everything the scheduling back-and-forth was hiding.</h2>
            </div>
            <div className="grid-3">
              {FEATURES.map((feature) => (
                <article key={feature.title} className="card card-body feature-card">
                  <span className="feature-icon"><Icon name={feature.icon} size={17} /></span>
                  <h3>{feature.title}</h3>
                  <p className="small muted">{feature.body}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="landing-section">
          <div className="landing-section-inner">
            <div className="landing-cta">
              <h2>Ready to stop trading emails?</h2>
              <p className="lede">Set your hours once and share a single link.</p>
              <Link className="btn btn-primary btn-lg" to="/login?mode=signup">
                Get started free
                <Icon name="arrowRight" size={15} />
              </Link>
            </div>
          </div>
        </section>
      </main>

      <footer className="landing-footer">
        <div className="landing-section-inner row-between" style={{ flexWrap: "wrap", gap: "var(--s4)" }}>
          <Logo size={24} />
          <p className="tiny subtle">Built for people with better things to do than schedule meetings.</p>
        </div>
      </footer>
    </div>
  );
}
