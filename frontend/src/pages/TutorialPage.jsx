import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import SectionCard from "../components/SectionCard";

const STEPS = [
  {
    id: "event-types",
    title: "Create your event types",
    duration: "2 min",
    summary: "Define the meeting formats people can book with you.",
    tasks: [
      "Open Event Types and create your first booking page.",
      "Add a clear title, duration, slug, and short description.",
      "Choose a location type and keep the page active once it is ready.",
    ],
    tips: [
      "Create different event types for quick calls, demos, and deep-dive sessions.",
      "Use short slugs so links are easy to share.",
    ],
  },
  {
    id: "availability",
    title: "Set your availability",
    duration: "3 min",
    summary: "Control when guests can see and reserve time.",
    tasks: [
      "Pick the correct timezone before opening your calendar.",
      "Set working hours by weekday and turn off days you do not accept bookings.",
      "Add blockout dates for holidays, leave, or special closures.",
    ],
    tips: [
      "Use notice periods and buffers to protect your calendar.",
      "Availability changes apply to the booking pages automatically.",
    ],
  },
  {
    id: "booking-portal",
    title: "Use the booking portal",
    duration: "2 min",
    summary: "Create bookings for a person yourself from the admin side.",
    tasks: [
      "Go to the Bookings page and open the booking portal at the top.",
      "Choose an event type, date, and available slot.",
      "Enter the guest name and email, then add the booking directly.",
    ],
    tips: [
      "This is useful for phone bookings, walk-ins, or requests that arrive over chat.",
      "You can still let guests use the public page for self-service booking.",
    ],
  },
  {
    id: "public-booking",
    title: "Share the public booking page",
    duration: "1 min",
    summary: "Let guests book themselves with OTP verification.",
    tasks: [
      "Copy the public booking link from the event type card.",
      "Share it in email, on your website, or in social profiles.",
      "Guests choose a slot, verify their email, and confirm the booking.",
    ],
    tips: [
      "OTP verification helps prevent fake and low-quality bookings.",
      "Preview your public page before sharing it broadly.",
    ],
  },
  {
    id: "operations",
    title: "Manage booking operations",
    duration: "2 min",
    summary: "Keep the schedule clean once bookings start coming in.",
    tasks: [
      "Use the bookings timeline to search, review, and filter meetings.",
      "Reschedule or cancel from the dashboard when plans change.",
      "Export bookings to CSV when you need reporting or imports elsewhere.",
    ],
    tips: [
      "The analytics page helps you see when demand is strongest.",
      "Use integrations when you want bookings to flow into other tools.",
    ],
  },
];

const QUICK_LINKS = [
  { label: "Open Event Types", to: "/dashboard" },
  { label: "Open Availability", to: "/availability" },
  { label: "Open Bookings", to: "/bookings" },
  { label: "Open Integrations", to: "/integrations" },
];

const FAQ = [
  {
    question: "Do guests need an account to book?",
    answer: "No. Guests can book directly from the public page. They only verify their email with an OTP before confirming the slot.",
  },
  {
    question: "Can I add a booking myself?",
    answer: "Yes. The booking portal on the Bookings page lets you create a booking for a person manually.",
  },
  {
    question: "What happens when I cancel a booking?",
    answer: "The booking is marked cancelled, the slot becomes available again, and your email workflow can notify the guest.",
  },
  {
    question: "Can I make different kinds of meeting pages?",
    answer: "Yes. Create separate event types for every format you offer, each with its own duration, slug, and setup.",
  },
];

export default function TutorialPage() {
  const [activeStep, setActiveStep] = useState(0);
  const [openFaq, setOpenFaq] = useState(null);
  const currentStep = STEPS[activeStep];
  const progress = useMemo(() => `${activeStep + 1} / ${STEPS.length}`, [activeStep]);

  return (
    <div className="tutorial-page-shell">
      <aside className="tutorial-sidebar">
        <div className="tutorial-sidebar-header">
          <p className="eyebrow">Onboarding guide</p>
          <h3>Learn the full Shopper workflow.</h3>
          <p>Follow the steps in order, then jump into the dashboard when you are ready.</p>
        </div>

        <div className="tutorial-progress-box">
          <span>Progress</span>
          <strong>{progress}</strong>
        </div>

        <div className="tutorial-step-list">
          {STEPS.map((step, index) => (
            <button
              key={step.id}
              type="button"
              className={`tutorial-step-chip ${index === activeStep ? "active" : ""}`}
              onClick={() => setActiveStep(index)}
            >
              <span className="tutorial-step-chip-index">{index + 1}</span>
              <span className="tutorial-step-chip-copy">
                <strong>{step.title}</strong>
                <span>{step.duration}</span>
              </span>
            </button>
          ))}
        </div>

        <div className="tutorial-quick-links">
          <p className="tutorial-sidebar-label">Quick links</p>
          {QUICK_LINKS.map((link) => (
            <Link key={link.to} to={link.to} className="tutorial-quick-link">
              {link.label}
            </Link>
          ))}
        </div>
      </aside>

      <div className="tutorial-main">
        <section className="tutorial-hero-card">
          <div>
            <p className="eyebrow">Current step</p>
            <h3>{currentStep.title}</h3>
            <p>{currentStep.summary}</p>
          </div>
          <div className="tutorial-hero-badge">{currentStep.duration}</div>
        </section>

        <SectionCard title="What to do" subtitle="Complete these actions inside the app.">
          <div className="tutorial-task-list">
            {currentStep.tasks.map((task, index) => (
              <div key={task} className="tutorial-task-row">
                <span className="tutorial-task-index">{index + 1}</span>
                <p>{task}</p>
              </div>
            ))}
          </div>
        </SectionCard>

        <SectionCard title="Tips that help" subtitle="Small details that make setup smoother.">
          <div className="tutorial-tip-grid">
            {currentStep.tips.map((tip) => (
              <div key={tip} className="tutorial-tip-card">
                <span className="tutorial-tip-mark" />
                <p>{tip}</p>
              </div>
            ))}
          </div>
        </SectionCard>

        <div className="tutorial-navigation-row">
          <button type="button" className="secondary-button" onClick={() => setActiveStep((step) => Math.max(0, step - 1))} disabled={activeStep === 0}>
            Previous step
          </button>
          {activeStep < STEPS.length - 1 ? (
            <button type="button" className="primary-button" onClick={() => setActiveStep((step) => Math.min(STEPS.length - 1, step + 1))}>
              Next step
            </button>
          ) : (
            <Link to="/dashboard" className="primary-button">
              Go to dashboard
            </Link>
          )}
        </div>

        <SectionCard title="Frequently asked questions" subtitle="Common questions while getting set up.">
          <div className="tutorial-faq-list">
            {FAQ.map((item, index) => (
              <div key={item.question} className="tutorial-faq-card">
                <button type="button" className="tutorial-faq-trigger" onClick={() => setOpenFaq(openFaq === index ? null : index)}>
                  <span>{item.question}</span>
                  <span>{openFaq === index ? "-" : "+"}</span>
                </button>
                {openFaq === index ? <p className="tutorial-faq-copy">{item.answer}</p> : null}
              </div>
            ))}
          </div>
        </SectionCard>
      </div>
    </div>
  );
}
