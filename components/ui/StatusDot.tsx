export function StatusDot({
  tone = "teal"
}: {
  tone?: "teal" | "amber" | "red" | "green" | "slate";
}) {
  const color = {
    teal: "bg-[var(--accent)]",
    amber: "bg-[var(--warning)]",
    red: "bg-[var(--critical)]",
    green: "bg-[var(--success)]",
    slate: "bg-slate-400"
  }[tone];

  return <span className={`h-2.5 w-2.5 rounded-full ${color}`} />;
}
