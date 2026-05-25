type BadgeTone = "slate" | "cyan" | "emerald" | "amber" | "rose";

const toneClass: Record<BadgeTone, string> = {
  slate: "border-slate-600 bg-slate-800/80 text-slate-200",
  cyan: "border-cyan-300/30 bg-cyan-300/10 text-cyan-100",
  emerald: "border-emerald-300/30 bg-emerald-300/10 text-emerald-100",
  amber: "border-amber-300/30 bg-amber-300/10 text-amber-100",
  rose: "border-rose-300/30 bg-rose-300/10 text-rose-100"
};

export function Badge({
  children,
  tone = "slate"
}: {
  children: React.ReactNode;
  tone?: BadgeTone;
}) {
  return (
    <span className={`inline-flex items-center rounded-lg border px-2.5 py-1 text-xs font-semibold ${toneClass[tone]}`}>
      {children}
    </span>
  );
}
