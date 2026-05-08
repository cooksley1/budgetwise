type Props = {
  size?: number;
  variant?: "onDark" | "onLight";
  withWordmark?: boolean;
  className?: string;
};

/**
 * Wayfare brand mark — sibling to The Slow Travel Planner.
 * Borrows their circle silhouette, sage hill, and sun motif (exact palette: #2F4842, #5A7A71, #EBD9B4, #D4B483).
 * The signature S-river of the planner is replaced here with a stack of three coins,
 * marking this sibling as the *spend / live the trip* product.
 */
export function WayfareMark({
  size = 28,
  variant = "onDark",
}: {
  size?: number;
  variant?: "onDark" | "onLight";
}) {
  const isOnDark = variant === "onDark";
  const ring = isOnDark ? "#EBD9B4" : "#1A2F2B";
  const disc = isOnDark ? "#2F4842" : "#2F4842";
  const sage = "#5A7A71";
  const cream = "#EBD9B4";
  const sand = "#D4B483";
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" aria-hidden="true">
      <circle cx="32" cy="32" r="31" fill={ring} />
      <circle cx="32" cy="32" r="29" fill={disc} />
      {/* Sun */}
      <circle cx="46" cy="20" r="4.5" fill={cream} />
      {/* Sage hill */}
      <path d="M2 44 Q18 34 32 40 Q46 46 62 36 L62 60 Q32 60 2 60 Z" fill={sage} opacity="0.55" />
      {/* Stack of three coins — the sibling differentiator */}
      <ellipse cx="32" cy="50" rx="11" ry="2.6" fill={sand} />
      <ellipse cx="32" cy="46" rx="11" ry="2.6" fill={cream} />
      <ellipse cx="32" cy="42" rx="11" ry="2.6" fill={sand} />
    </svg>
  );
}

export function WayfareLogo({
  size = 28,
  variant = "onDark",
  withWordmark = true,
  className = "",
}: Props) {
  const wordmarkClass = variant === "onDark" ? "text-sidebar-foreground" : "text-foreground";
  return (
    <div className={`flex items-center gap-2.5 ${className}`}>
      <WayfareMark size={size} variant={variant} />
      {withWordmark && (
        <span
          className={`font-display font-semibold tracking-wide uppercase leading-none ${wordmarkClass}`}
          style={{
            fontSize: Math.round(size * 0.5),
            letterSpacing: "0.16em",
          }}
        >
          Wayfare
        </span>
      )}
    </div>
  );
}
