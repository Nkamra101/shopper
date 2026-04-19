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
import NotFoundPage from "./pages/NotFoundPage";
import WorkflowsPage from "./pages/WorkflowsPage";
import LandingPage from "./pages/LandingPage";
import TutorialPage from "./pages/TutorialPage";
import LoginPage from "./pages/LoginPage";
import AuthCallbackPage from "./pages/AuthCallbackPage";
import ThemeToggle from "./components/ThemeToggle";
import { useToast } from "./components/Toast";
import { useAuth } from "./components/AuthContext";

const navItems = [
  { to: "/dashboard", end: true, label: "Event Types" },
  { to: "/availability", label: "Availability" },
  { to: "/bookings", label: "Bookings" },
  { to: "/analytics", label: "Analytics" },
  { to: "/integrations", label: "Integrations" },
  { to: "/workflows", label: "Workflows" },
  { to: "/tutorial", label: "Tutorial" },
];

const navIcons = {
  "/dashboard": (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="4" width="18" height="18" rx="2" />
      <line x1="16" y1="2" x2="16" y2="6" />
      <line x1="8" y1="2" x2="8" y2="6" />
      <line x1="3" y1="10" x2="21" y2="10" />
    </svg>
  ),
  "/availability": (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <polyline points="12 6 12 12 16 14" />
    </svg>
  ),
  "/bookings": (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  ),
  "/analytics": (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="18" y1="20" x2="18" y2="10" />
      <line x1="12" y1="20" x2="12" y2="4" />
      <line x1="6" y1="20" x2="6" y2="14" />
    </svg>
  ),
  "/integrations": (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="18" cy="18" r="3" />
      <circle cx="6" cy="6" r="3" />
      <path d="M6 21V9a9 9 0 0 0 9 9" />
    </svg>
  ),
  "/workflows": (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
    </svg>
  ),
  "/tutorial": (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
      <line x1="12" y1="17" x2="12.01" y2="17" />
    </svg>
  ),
};

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

function AdminLayout({ children, title, subtitle }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const location = useLocation();
  const { user, logout } = useAuth();

  useEffect(() => {
    setSidebarOpen(false);
  }, [location]);

  function handleLogout() {
    logout();
    window.location.href = "/login";
  }

  const initials = user?.name
    ? user.name.split(" ").map((name) => name[0]).join("").slice(0, 2).toUpperCase()
    : user?.email?.[0]?.toUpperCase() || "?";

  return (
    <div className={`app-shell ${sidebarOpen ? "sidebar-expanded" : ""}`}>
      {sidebarOpen && <div className="sidebar-overlay" onClick={() => setSidebarOpen(false)} />}

      <aside className={`sidebar ${sidebarOpen ? "open" : ""}`}>
        <div className="brand-block">
          <div className="brand-logo">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M8 2v4M16 2v4M3 10h18M5 4h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z" />
              <path d="M8 14h.01M12 14h.01M16 14h.01M8 18h.01M12 18h.01" />
            </svg>
          </div>
          <div>
            <p className="brand-name">Shopper</p>
            <p className="brand-tagline">Unified scheduling</p>
          </div>
        </div>

        <nav className="nav-links" aria-label="Main navigation">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) => (isActive ? "nav-link active" : "nav-link")}
            >
              <span className="nav-icon">{navIcons[item.to]}</span>
              <span className="nav-label">{item.label}</span>
            </NavLink>
          ))}
        </nav>

        <div className="nav-divider" />

        <NavLink to="/profile" className={({ isActive }) => (isActive ? "nav-link active" : "nav-link")}>
          <span className="nav-icon">
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
              <circle cx="12" cy="7" r="4" />
            </svg>
          </span>
          <span className="nav-label">Profile</span>
        </NavLink>

        {user && (
          <div className="sidebar-user">
            <div className="sidebar-user-avatar">{initials}</div>
            <div className="sidebar-user-info">
              <p className="sidebar-user-name">{user.name || "Admin"}</p>
              <p className="sidebar-user-email">{user.email}</p>
            </div>
            <button className="sidebar-logout-btn" onClick={handleLogout} title="Sign out">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                <polyline points="16 17 21 12 16 7" />
                <line x1="21" y1="12" x2="9" y2="12" />
              </svg>
            </button>
          </div>
        )}

        <div className="sidebar-footer">
          <span className="sidebar-footer-label">Appearance</span>
          <ThemeToggle />
        </div>
      </aside>

      <main className="page-area">
        <header className="page-header">
          <button className="menu-toggle" onClick={() => setSidebarOpen((value) => !value)} aria-label="Toggle menu">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="3" y1="6" x2="21" y2="6" />
              <line x1="3" y1="12" x2="21" y2="12" />
              <line x1="3" y1="18" x2="21" y2="18" />
            </svg>
          </button>
          <div className="page-header-text">
            <p className="eyebrow">{subtitle}</p>
            <h2>{title}</h2>
          </div>
          <div className="header-actions">
            <div className="header-pill">
              <span className="status-dot" />
              {user?.name || "Admin"}
            </div>
          </div>
        </header>

        <div className="page-content">{children}</div>
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
        slowToastIdRef.current = toast.info("Waking up the server...", { duration: 60000 });
      }
    }

    function handleFast() {
      if (slowToastIdRef.current) {
        toast.dismiss(slowToastIdRef.current);
        slowToastIdRef.current = null;
        toast.success("Server is awake and ready.");
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
      <Route path="/" element={<RootRoute />} />
      <Route path="/login" element={<LoginPage />} />
      <Route path="/auth/callback" element={<AuthCallbackPage />} />
      <Route path="/book/:slug" element={<PublicBookingPage />} />
      <Route path="/book/:slug/confirmed/:bookingId" element={<ConfirmationPage />} />
      <Route path="/dashboard" element={<ProtectedRoute><AdminLayout title="Event Types" subtitle="Scheduling dashboard"><DashboardPage /></AdminLayout></ProtectedRoute>} />
      <Route path="/availability" element={<ProtectedRoute><AdminLayout title="Availability" subtitle="Weekly schedule"><AvailabilityPage /></AdminLayout></ProtectedRoute>} />
      <Route path="/bookings" element={<ProtectedRoute><AdminLayout title="Bookings" subtitle="Portal and meeting timeline"><BookingsPage /></AdminLayout></ProtectedRoute>} />
      <Route path="/analytics" element={<ProtectedRoute><AdminLayout title="Analytics" subtitle="Performance insights"><AnalyticsPage /></AdminLayout></ProtectedRoute>} />
      <Route path="/integrations" element={<ProtectedRoute><AdminLayout title="Integrations" subtitle="Connected tools"><IntegrationsPage /></AdminLayout></ProtectedRoute>} />
      <Route path="/profile" element={<ProtectedRoute><AdminLayout title="Profile" subtitle="Your public presence"><ProfilePage /></AdminLayout></ProtectedRoute>} />
      <Route path="/workflows" element={<ProtectedRoute><AdminLayout title="Workflows" subtitle="Reminders and notifications"><WorkflowsPage /></AdminLayout></ProtectedRoute>} />
      <Route path="/tutorial" element={<ProtectedRoute><AdminLayout title="Tutorial" subtitle="Getting started with Shopper"><TutorialPage /></AdminLayout></ProtectedRoute>} />
      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  );
}
