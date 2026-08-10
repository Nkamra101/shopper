import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import SectionCard from "../components/SectionCard";
import Icon from "../components/Icon";
import { api } from "../services/api";

const STEPS = [
  {
    id: "profile",
    title: "Claim your booking username",
    body: "Your username becomes your personal link. Pick something short that you'd be happy to say out loud.",
    to: "/profile",
    cta: "Open profile",
  },
  {
    id: "availability",
    title: "Set your weekly hours",
    body: "Tell Shopper when you're free. Add a second window to any day for a lunch break, and block out holidays in advance.",
    to: "/availability",
    cta: "Set availability",
  },
  {
    id: "event",
    title: "Create an event type",
    body: "An event type is one kind of meeting — a 30 minute intro, a 60 minute review. Add booking questions if you need context up front.",
    to: "/dashboard",
    cta: "Create one",
  },
  {
    id: "share",
    title: "Share your link",
    body: "Copy the booking link and put it in your email signature, your bio, or a calendar invite.",
    to: "/dashboard",
    cta: "Get the link",
  },
  {
    id: "workflow",
    title: "Add a reminder",
    body: "A workflow that emails guests 24 hours before the meeting is the single best way to cut no-shows.",
    to: "/workflows",
    cta: "Add a workflow",
  },
];

const FAQS = [
  {
    q: "Do guests need an account?",
    a: "No. They pick a time and confirm their email with a one-time code. That's the whole flow.",
  },
  {
    q: "What timezone do guests see?",
    a: "Their own, detected from the browser, and they can switch it. You always set your hours in your own timezone.",
  },
  {
    q: "Can someone reschedule without emailing me?",
    a: "Yes. Every confirmation email carries a private link to reschedule or cancel, and you're notified when they use it.",
  },
  {
    q: "Why is the first page load slow sometimes?",
    a: "The backend runs on a free tier that sleeps when idle. The first request wakes it, which takes a few seconds.",
  },
  {
    q: "How do I get bookings into my own calendar?",
    a: "Profile → Calendar subscription gives you a private iCal URL that Google, Apple and Outlook can subscribe to.",
  },
];

export default function TutorialPage() {
  const [state, setState] = useState({ hasUsername: false, hasHours: false, hasEvent: false, hasWorkflow: false });
  const [open, setOpen] = useState(null);

  useEffect(() => {
    (async () => {
      const [me, availability, eventTypes, workflows] = await Promise.all([
        api.getMe().catch(() => null),
        api.getAvailability().catch(() => null),
        api.getEventTypes().catch(() => []),
        api.getWorkflows().catch(() => []),
      ]);
      setState({
        hasUsername: Boolean(me?.booking_username),
        hasHours: Boolean(availability?.rules?.length),
        hasEvent: eventTypes.length > 0,
        hasWorkflow: workflows.length > 0,
      });
    })();
  }, []);

  const done = {
    profile: state.hasUsername,
    availability: state.hasHours,
    event: state.hasEvent,
    share: state.hasEvent,
    workflow: state.hasWorkflow,
  };
  const completed = STEPS.filter((step) => done[step.id]).length;

  return (
    <div className="split">
      <div className="stack">
        <SectionCard
          title="Set up your booking page"
          subtitle="Five steps. You only do this once."
          actions={<span className="badge">{completed} of {STEPS.length}</span>}
        >
          <div className="stack-3">
            {STEPS.map((step, index) => {
              const complete = done[step.id];
              return (
                <div key={step.id} className="item" style={{ alignItems: "flex-start" }}>
                  <span className={`step-dot${complete ? " is-complete" : ""}`}
                        style={complete ? { background: "var(--c-ok)", borderColor: "var(--c-ok)", color: "#fff" } : undefined}>
                    {complete ? <Icon name="check" size={11} strokeWidth={3} /> : index + 1}
                  </span>

                  <div className="item-main">
                    <h3 style={{ fontSize: "0.875rem" }}>{step.title}</h3>
                    <p className="small muted" style={{ marginTop: 3 }}>{step.body}</p>
                  </div>

                  <Link className="btn btn-sm" to={step.to}>
                    {complete ? "Review" : step.cta}
                  </Link>
                </div>
              );
            })}
          </div>
        </SectionCard>

        <SectionCard title="Questions people usually ask">
          <div className="list-bordered">
            {FAQS.map((faq, index) => (
              <div key={faq.q} style={{ borderBottom: index === FAQS.length - 1 ? "none" : "1px solid var(--c-line)" }}>
                <button
                  className="list-row"
                  style={{ width: "100%", textAlign: "left", padding: "var(--s3) var(--s4)" }}
                  aria-expanded={open === index}
                  onClick={() => setOpen(open === index ? null : index)}
                >
                  <span className="small" style={{ fontWeight: 600 }}>{faq.q}</span>
                  <Icon name={open === index ? "chevronDown" : "chevronRight"} size={14} />
                </button>
                {open === index && (
                  <p className="small muted" style={{ padding: "0 var(--s4) var(--s4)" }}>{faq.a}</p>
                )}
              </div>
            ))}
          </div>
        </SectionCard>
      </div>

      <SectionCard title="Good defaults" subtitle="What most people end up doing.">
        <div className="stack-3">
          {[
            "Add a 5–10 minute buffer so back-to-back calls don't collide.",
            "Set a minimum notice of 2–4 hours so nobody books you in ten minutes.",
            "Keep the booking window to 30–60 days ahead.",
            "Send the 24 hour reminder. It's the biggest win for a minute of setup.",
            "Ask one required question — “what would you like to cover?” — and nothing else.",
          ].map((tip) => (
            <div className="row-top" key={tip} style={{ gap: "var(--s2)" }}>
              <Icon name="check" size={14} strokeWidth={2.6} className="subtle" />
              <p className="small muted">{tip}</p>
            </div>
          ))}
        </div>
      </SectionCard>
    </div>
  );
}
