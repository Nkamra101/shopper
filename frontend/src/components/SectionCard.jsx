export default function SectionCard({ title, subtitle, action, children }) {
  return (
    <section className="section-card">
      <div className="section-header">
        <div>
          <h3>{title}</h3>
          {subtitle ? <p>{subtitle}</p> : null}
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

