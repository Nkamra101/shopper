import Icon from "./Icon";

export default function EmptyState({ icon = "calendar", title, description, action }) {
  return (
    <div className="empty">
      <Icon name={icon} size={26} strokeWidth={1.6} className="empty-icon" />
      {title ? <p className="empty-title">{title}</p> : null}
      {description ? <p className="empty-text">{description}</p> : null}
      {action ? <div className="row-2" style={{ justifyContent: "center", marginTop: "var(--s4)" }}>{action}</div> : null}
    </div>
  );
}
