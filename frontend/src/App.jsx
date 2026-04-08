import { useEffect, useRef } from "react";
import { NavLink, Route, Routes } from "react-router-dom";
import DashboardPage from "./pages/DashboardPage";
import AvailabilityPage from "./pages/AvailabilityPage";
import BookingsPage from "./pages/BookingsPage";
import PublicBookingPage from "./pages/PublicBookingPage";
import ConfirmationPage from "./pages/ConfirmationPage";
import ThemeToggle from "./components/ThemeToggle";
import { useToast } from "./components/Toast";

const navItems = [
  { to: "/", label: "Event Types", end: true },
  { to: "/availability", label: "Availability", end: false },
  { to: "/bookings", label: "Bookings", end: false },
];

function AdminLayout({ children, title, subtitle }) {
  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand-block">
          <span className="brand-badge" aria-hidden="true">👀</span>
          <div>
            <h1>Let's Book up</h1>
          </div>
        </div>

        <nav className="nav-links" aria-label="Main">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) => (isActive ? "nav-link active" : "nav-link")}
            >
              {item.label}
            </NavLink>
          ))}
        </nav>

        <div className="sidebar-card">
          <p className="eyebrow">Public demo</p>
          <p>Sample booking links are generated from the event type slugs.</p>
        </div>

        <div className="sidebar-footer">
          <span className="sidebar-footer-label">Appearance</span>
          <ThemeToggle />
        </div>
      </aside>

      <main className="page-area">
        <header className="page-header">
          <div>
            <p className="eyebrow">{subtitle}</p>
            <h2>{title}</h2>
          </div>
          <div className="header-pill">Default user is signed in</div>
        </header>
        {children}
      </main>
    </div>
  );
}

export default function App() {
  const toast = useToast();
  const slowToastIdRef = useRef(null);

  useEffect(() => {
    function handleSlow() {
      if (!slowToastIdRef.current) {
        slowToastIdRef.current = toast.info(
          "Waking up the server, this might take up to a minute...",
          { duration: 60000 }
        );
      }
    }

    function handleFast() {
      if (slowToastIdRef.current) {
        toast.dismiss(slowToastIdRef.current);
        slowToastIdRef.current = null;
        toast.success("Server is awake and ready!");
      }
    }

    window.addEventListener("api-slow", handleSlow);
    window.addEventListener("api-fast", handleFast);

    return () => {
      window.removeEventListener("api-slow", handleSlow);
      window.removeEventListener("api-fast", handleFast);
    };
  }, [toast]);

  return (
    <Routes>
      <Route
        path="/"
        element={
          <AdminLayout title="Event Types" subtitle="Scheduling dashboard">
            <DashboardPage />
          </AdminLayout>
        }
      />
      <Route
        path="/availability"
        element={
          <AdminLayout title="Availability" subtitle="Weekly schedule">
            <AvailabilityPage />
          </AdminLayout>
        }
      />
      <Route
        path="/bookings"
        element={
          <AdminLayout title="Bookings" subtitle="Upcoming and past meetings">
            <BookingsPage />
          </AdminLayout>
        }
      />
      <Route path="/book/:slug" element={<PublicBookingPage />} />
      <Route path="/book/:slug/confirmed/:bookingId" element={<ConfirmationPage />} />
    </Routes>
  );
}
