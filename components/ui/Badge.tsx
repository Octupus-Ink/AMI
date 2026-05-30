type BadgeTone = "neutral" | "blue" | "teal" | "amber" | "red" | "green";

const tones: Record<BadgeTone, string> = {
  // Neutral badges: use a light gray background with a darker gray text for small-text contrast
  neutral: "border-[var(--border-subtle)] bg-gray-100 text-gray-700",
  // Informational/source badges: subtle info background with accessible blue text
  blue: "border-[var(--border-subtle)] bg-[var(--info-light)] text-blue-700",
  // Accent/teal badges: use the light accent background but a darker teal text for contrast
  teal: "border-[var(--border-subtle)] bg-[var(--accent-light)] text-teal-800",
  // Warning/amber badges: preserve semantic amber styling with accessible text
  amber: "border-[var(--border-subtle)] bg-[var(--warning-light)] text-amber-700",
  // Critical/red badges: preserve semantic critical styling with accessible text
  red: "border-[var(--border-subtle)] bg-[var(--critical-light)] text-red-700",
  // Success/green badges: preserve semantic success styling with accessible text
  green: "border-[var(--border-subtle)] bg-[var(--success-light)] text-green-700"
};

export function Badge({
  children,
  tone = "neutral"
}: {
  children: React.ReactNode;
  tone?: BadgeTone;
}) {
  return (
    <span className={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-semibold ${tones[tone]}`}>
      {children}
    </span>
  );
}
