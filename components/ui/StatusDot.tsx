export function StatusDot({
  tone = "teal"
}: {
  tone?: "teal" | "amber" | "red" | "green" | "slate";
}) {
  const color = {
    teal: "bg-teal-500",
    amber: "bg-amber-500",
    red: "bg-red-600",
    green: "bg-emerald-500",
    slate: "bg-slate-400"
  }[tone];

  return <span className={`h-2.5 w-2.5 rounded-full ${color}`} />;
}
