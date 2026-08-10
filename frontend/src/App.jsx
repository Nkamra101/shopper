import { useEffect, useRef, useState } from "react";
import { NavLink, Navigate, Route, Routes, useLocation } from "react-router-dom";

import DashboardPage from "./pages/DashboardPage";
import AvailabilityPage from "./pages/AvailabilityPage";
import BookingsPage from "./pages/BookingsPage";
import AnalyticsPage from "./pages/AnalyticsPage";
import IntegrationsPage from "./pages/IntegrationsPage";
import ProfilePage from "./pages/ProfilePage";
import PublicBookingPage from "./pages/PublicBookingPage";
import ConfirmationPage from "./pages/ConfirmationPage";
import ManageBookingPage from "./pages/ManageBookingPage";
import NotFoundPage from "./pages/NotFoundPage";
import WorkflowsPage from "./pages/WorkflowsPage";
import LandingPage from "./pages/LandingPage";
import TutorialPage from "./pages/TutorialPage";
import LoginPage from "./pages/LoginPage";
import AuthCallbackPage from "./pages/AuthCallbackPage";

import Logo from "./components/Logo";
import Icon from "./components/Icon";
import ThemeToggle from "./components/ThemeToggle";
import { useToast } from "./components/Toast";
import { useAuth } from "./components/AuthContext";

const NAV = [
  { to: "/dashboard", label: "Event types", icon: "calendar", end: true },
  { to: "/availability", label: "Availability", icon: "clock" },
  { to: "/bookings", label: "Bookings", icon: "users" },
  { to: "/analytics", label: "Analytics", icon: "chart" },
  { to: "/integrations", label: "Integrations", icon: "plug" },
  { to: "/workflows", label: "Workflows", icon: "zap" },
  { to: "/tutorial", label: "Get started", icon: "help" },
];

function RootRoute() {
  const { isAuthenticated, loading } = useAuth();
  if (loading) return null;
  return isAuthenticated ? <Navigate to="/dashboard" replace /> : <LandingPage />;
}

function ProtectedRoute({ children }) {
  const { isAuthenticated, loading } = useAuth();
  if (loading) return null;
  return isAuthenticated ? children : <Navigate to="/" replace />;
}

function initialsOf(user) {
  if (user?.name?.trim()) {
    return user.name
      .trim()
      .split(/\s+/)
      .map((part) => part[0])
      .join("")
      .slice(0, 2)
      .toUpperCase();
  }
  return user?.email?.[0]?.toUpperCase() || "?";
}

function AppShell({ title, subtitle, actions, children }) {
  const [navOpen, setNavOpen] = useState(false);
  const location = useLocation();
  const { user, logout } = useAuth();

  useEffect(() => setNavOpen(false), [location]);

  function handleLogout() {
    logout();
    window.location.href = "/login";
  }

  return (
    <div className={`app ${navOpen ? "nav-open" : ""}`}>
      <div className="sidebar-scrim" onClick={() => setNavOpen(false)} />

      <aside className="sidebar">
        <div className="sidebar-brand">
          <Logo size={30} tile tagline="Scheduling" />
        </div>

        <nav className="nav" aria-label="Main">
          {NAV.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) => (isActive ? "nav-item is-active" : "nav-item")}
            >
              <Icon name={item.icon} size={16} />
              {item.label}
            </NavLink>
          ))}
        </nav>

        <div className="sidebar-foot">
          <NavLink to="/profile" className={({ isActive }) => (isActive ? "nav-item is-active" : "nav-item")}>
            <Icon name="user" size={16} />
            Profile
          </NavLink>

          {user && (
            <div className="user-chip">
              <span className="avatar">{initialsOf(user)}</span>
              <span className="user-chip-info">
                <span className="user-chip-name truncate">{user.name || "Account"}</span>
                <span className="user-chip-mail truncate">{user.email}</span>
              </span>
              <button type="button" className="btn btn-icon btn-ghost btn-icon-sm" onClick={handleLogout} title="Sign out" aria-label="Sign out">
                <Icon name="logout" size={14} />
              </button>
            </div>
          )}
        </div>
      </aside>

      <div className="main">
        <header className="topbar">
          <button
            type="button"
            className="btn btn-icon btn-ghost menu-toggle"
            onClick={() => setNavOpen((open) => !open)}
            aria-label="Toggle navigation"
          >
            <Icon name="menu" size={18} />
          </button>

          <div style={{ minWidth: 0 }}>
            <h1 className="topbar-title truncate">{title}</h1>
            {subtitle ? <p className="topbar-sub truncate">{subtitle}</p> : null}
          </div>

          <div className="spacer" />
          <div className="row-2">
            {actions}
            <ThemeToggle />
          </div>
        </header>

        <main className="content">{children}</main>
      </div>
    </div>
  );
}

/** Wraps a page in the shell without repeating the boilerplate per route. */
function shell(title, subtitle, Page) {
  return (
    <ProtectedRoute>
      <AppShell title={title} subtitle={subtitle}>
        <Page />
      </AppShell>
    </ProtectedRoute>
  );
}

export default function App() {
  const toast = useToast();
  const slowToastRef = useRef(null);

  // The free backend tier sleeps; surface that instead of looking frozen.
  useEffect(() => {
    function onSlow() {
      if (!slowToastRef.current) {
        slowToastRef.current = toast.info("Waking the server up — this takes a moment.", { duration: 60000 });
      }
    }
    function onFast() {
      if (slowToastRef.current) {
        toast.dismiss(slowToastRef.current);
        slowToastRef.current = null;
      }
    }
    window.addEventListener("api-slow", onSlow);
    window.addEventListener("api-fast", onFast);
    return () => {
      window.removeEventListener("api-slow", onSlow);
      window.removeEventListener("api-fast", onFast);
    };
  }, [toast]);

  return (
    <Routes>
      <Route path="/" element={<RootRoute />} />
      <Route path="/login" element={<LoginPage />} />
      <Route path="/auth/callback" element={<AuthCallbackPage />} />
      <Route path="/book/:slug" element={<PublicBookingPage />} />
      <Route path="/book/:slug/confirmed/:bookingId" element={<ConfirmationPage />} />
      <Route path="/manage/:token" element={<ManageBookingPage />} />

      <Route path="/dashboard" element={shell("Event types", "The meetings people can book with you", DashboardPage)} />
      <Route path="/availability" element={shell("Availability", "When you can be booked", AvailabilityPage)} />
      <Route path="/bookings" element={shell("Bookings", "Everything on your calendar", BookingsPage)} />
      <Route path="/analytics" element={shell("Analytics", "How your booking pages are performing", AnalyticsPage)} />
      <Route path="/integrations" element={shell("Integrations", "Connect Shopper to your other tools", IntegrationsPage)} />
      <Route path="/workflows" element={shell("Workflows", "Automatic reminders and notifications", WorkflowsPage)} />
      <Route path="/tutorial" element={shell("Get started", "Set up your booking page in five steps", TutorialPage)} />
      <Route path="/profile" element={shell("Profile", "Your account and public presence", ProfilePage)} />

      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  );
}
