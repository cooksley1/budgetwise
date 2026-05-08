type Props = {
  size?: number;
  variant?: "onDark" | "onLight";
  withWordmark?: boolean;
  className?: string;
};

export function WayfareMark({ size = 28, variant = "onDark" }: { size?: number; variant?: "onDark" | "onLight" }) {
  const bg = variant === "onDark" ? "#f4ecdc" : "#3a5746";
  const fg = variant === "onDark" ? "#3a5746" : "#f4ecdc";
  const sun = "#d9b48a";
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" aria-hidden="true">
      <rect width="64" height="64" rx={14} fill={bg} />
      <path d="M10 46 L24 24 L32 34 L40 22 L54 46 Z" fill={fg} />
      <circle cx="44" cy="20" r="3.5" fill={sun} />
    </svg>
  );
}

export function WayfareLogo({ size = 28, variant = "onDark", withWordmark = true, className = "" }: Props) {
  // Wordmark color follows the surface, so contrast is guaranteed wherever the lockup is placed.
  const wordmarkClass = variant === "onDark" ? "text-sidebar-foreground" : "text-foreground";
  return (
    <div className={`flex items-center gap-2.5 ${className}`}>
      <WayfareMark size={size} variant={variant} />
      {withWordmark && (
        <span
          className={`font-display font-semibold tracking-wide uppercase leading-none ${wordmarkClass}`}
          style={{
            fontSize: Math.round(size * 0.5),
            letterSpacing: "0.14em",
          }}
        >
          Wayfare
        </span>
      )}
    </div>
  );
}
