export function Skeleton({ width, height, radius, className = "", style = {} }) {
  return (
    <div
      className={`skeleton ${className}`}
      aria-hidden="true"
      style={{ width: width ?? "100%", height: height ?? 12, borderRadius: radius, ...style }}
    />
  );
}

export function SkeletonCard() {
  return (
    <div className="card card-body stack-3" aria-hidden="true">
      <Skeleton width="55%" height={15} />
      <Skeleton width="85%" />
      <Skeleton width="35%" />
    </div>
  );
}

export function SkeletonList({ count = 3 }) {
  return (
    <div className="stack-3">
      {Array.from({ length: count }).map((_, index) => (
        <SkeletonCard key={index} />
      ))}
    </div>
  );
}

export function SkeletonStats({ count = 4 }) {
  return (
    <div className="grid-auto" aria-hidden="true">
      {Array.from({ length: count }).map((_, index) => (
        <div key={index} className="card stat">
          <Skeleton width="45%" height={10} />
          <Skeleton width="30%" height={26} style={{ marginTop: 10 }} />
        </div>
      ))}
    </div>
  );
}
