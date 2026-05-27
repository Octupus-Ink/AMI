type BadgeTone = "neutral" | "blue" | "teal" | "amber" | "red" | "green";

const tones: Record<BadgeTone, string> = {
  neutral: "border-slate-200 bg-white text-slate-700",
  blue: "border-blue-200 bg-blue-50 text-blue-800",
  teal: "border-teal-200 bg-teal-50 text-teal-800",
  amber: "border-amber-200 bg-amber-50 text-amber-800",
  red: "border-red-200 bg-red-50 text-red-800",
  green: "border-emerald-200 bg-emerald-50 text-emerald-800"
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
