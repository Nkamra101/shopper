import { Link } from "react-router-dom";
import Logo from "../components/Logo";
import ThemeToggle from "../components/ThemeToggle";

export default function NotFoundPage() {
  return (
    <div className="public">
      <header className="public-bar">
        <Link to="/"><Logo size={28} tile /></Link>
        <ThemeToggle />
      </header>

      <main className="public-main public-narrow">
        <div className="card result-card">
          <p className="eyebrow">404</p>
          <h1 style={{ margin: "var(--s3) 0 var(--s2)" }}>We couldn't find that page</h1>
          <p className="small muted" style={{ maxWidth: "42ch", margin: "0 auto" }}>
            The link may be mistyped, or the booking page it pointed to is no longer active.
          </p>
          <div className="row-2" style={{ justifyContent: "center", marginTop: "var(--s6)" }}>
            <Link className="btn btn-primary" to="/">Back to home</Link>
          </div>
        </div>
      </main>
    </div>
  );
}
