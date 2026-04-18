import { Link } from "react-router-dom";

export default function NotFoundPage() {
  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: "var(--space-8) var(--space-5)",
        textAlign: "center",
        gap: "var(--space-4)",
      }}
    >
      {/* Decorative ring */}
      <div
        style={{
          position: "relative",
          width: 120,
          height: 120,
          marginBottom: "var(--space-4)",
        }}
      >
        <svg viewBox="0 0 120 120" width="120" height="120">
          <circle
            cx="60" cy="60" r="56"
            fill="none"
            stroke="var(--border)"
            strokeWidth="2"
            strokeDasharray="8 6"
          />
          <text x="60" y="76" textAnchor="middle" fontSize="52" fontWeight="800">
            🔍
          </text>
        </svg>
      </div>

      <div>
        <p
          style={{
            fontSize: 88,
            fontWeight: 900,
            letterSpacing: "-0.05em",
            lineHeight: 1,
            background: "linear-gradient(135deg, var(--accent), var(--accent-2))",
            WebkitBackgroundClip: "text",
            WebkitTextFillColor: "transparent",
            margin: 0,
          }}
        >
          404
        </p>
        <h1
          style={{
            fontSize: "1.6rem",
            fontWeight: 800,
            letterSpacing: "-0.03em",
            margin: "var(--space-3) 0 var(--space-2)",
          }}
        >
          Page not found
        </h1>
        <p style={{ color: "var(--text-muted)", fontSize: 15, maxWidth: 380, lineHeight: 1.6, margin: "0 auto var(--space-6)" }}>
          The page you're looking for doesn't exist or has been moved.
          If you followed a booking link, it may have been deactivated.
        </p>
      </div>

      <div style={{ display: "flex", gap: "var(--space-3)", flexWrap: "wrap", justifyContent: "center" }}>
        <Link to="/" className="primary-button">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
            <polyline points="9 22 9 12 15 12 15 22"/>
          </svg>
          Go to dashboard
        </Link>
        <button
          className="secondary-button"
          onClick={() => window.history.back()}
        >
          ← Go back
        </button>
      </div>
    </div>
  );
}
