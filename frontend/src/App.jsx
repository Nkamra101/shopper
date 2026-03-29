import { NavLink, Route, Routes } from "react-router-dom";
import DashboardPage from "./pages/DashboardPage";
import AvailabilityPage from "./pages/AvailabilityPage";
import BookingsPage from "./pages/BookingsPage";
import PublicBookingPage from "./pages/PublicBookingPage";
import ConfirmationPage from "./pages/ConfirmationPage";

function AdminLayout({ children }) {
  const navItems = [
    { to: "/", label: "Event Types" },
    { to: "/availability", label: "Availability" },
    { to: "/bookings", label: "Bookings" },
  ];

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand-block">
          <span style={{ fontSize: "1.4rem" }} className="brand-badge">👀</span>
          <div>
           { /*<p className="eyebrow">Beginner Level Demo</p> */}
            <h1 style={{ fontSize: "1.3rem" }}>Let's Book up🫴</h1>
          </div>
        </div>

        <nav className="nav-links">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === "/"}
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
      </aside>

      <main className="page-area">
        <header className="page-header">
          <div>
            {/*<p className="eyebrow">Cal.com style inspired flow</p> */}
            <h2>Scheduling dashboard</h2>
          </div>
          <div className="header-pill">Default user is signed in</div>
        </header>
        {children}
      </main>
    </div>
  );
}

export default function App() {
  return (
    <Routes>
      <Route
        path="/"
        element={
          <AdminLayout>
            <DashboardPage />
          </AdminLayout>
        }
      />
      <Route
        path="/availability"
        element={
          <AdminLayout>
            <AvailabilityPage />
          </AdminLayout>
        }
      />
      <Route
        path="/bookings"
        element={
          <AdminLayout>
            <BookingsPage />
          </AdminLayout>
        }
      />
      <Route path="/book/:slug" element={<PublicBookingPage />} />
      <Route path="/book/:slug/confirmed/:bookingId" element={<ConfirmationPage />} />
    </Routes>
  );
}

