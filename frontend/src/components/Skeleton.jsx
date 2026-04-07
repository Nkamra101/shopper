export function Skeleton({ width, height, className = "", style = {} }) {
  return (
    <div
      className={`skeleton ${className}`}
      aria-hidden="true"
      style={{
        width: width ?? "100%",
        height: height ?? 12,
        ...style,
      }}
    />
  );
}

export function SkeletonCard() {
  return (
    <div className="event-card" aria-hidden="true">
      <Skeleton className="skeleton-text lg" width="60%" />
      <Skeleton className="skeleton-text" width="90%" />
      <Skeleton className="skeleton-text" width="40%" />
    </div>
  );
}

export function SkeletonList({ count = 3 }) {
  return (
    <div className="card-list">
      {Array.from({ length: count }).map((_, i) => (
        <SkeletonCard key={i} />
      ))}
    </div>
  );
}

export function SkeletonStats() {
  return (
    <div className="stats-grid" aria-hidden="true">
      {Array.from({ length: 3 }).map((_, i) => (
        <div key={i} className="stat-card">
          <Skeleton width="50%" height={12} />
          <Skeleton width="40%" height={32} style={{ marginTop: 8 }} />
        </div>
      ))}
    </div>
  );
}
