type PrimitiveProps = {
  children?: React.ReactNode;
  className?: string;
};

function cx(...classes: Array<string | undefined | false>) {
  return classes.filter(Boolean).join(" ");
}

export function PageShell({ children, className }: PrimitiveProps) {
  return <main className={cx("mx-auto w-full max-w-7xl px-4 py-8 sm:px-6 lg:px-8", className)}>{children}</main>;
}

export function PageHeader({
  eyebrow,
  title,
  description,
  actions,
  children,
  className
}: PrimitiveProps & {
  eyebrow?: React.ReactNode;
  title: string;
  description?: string;
  actions?: React.ReactNode;
}) {
  return (
    <section className={cx("border-b border-[var(--border)] pb-6", className)}>
      <div className="flex flex-wrap items-start justify-between gap-5">
        <div className="max-w-3xl">
          {eyebrow}
          <h1 className="mt-4 text-3xl font-semibold leading-tight text-[var(--text)] sm:text-4xl">{title}</h1>
          {description && <p className="mt-3 text-sm leading-6 text-[var(--text-secondary)]">{description}</p>}
        </div>
        {actions}
      </div>
      {children}
    </section>
  );
}

export function Section({ children, className, ...props }: PrimitiveProps & React.HTMLAttributes<HTMLElement>) {
  return (
    <section className={cx("mt-7", className)} {...props}>
      {children}
    </section>
  );
}

export function SectionHeader({ title, description, action }: { title: string; description?: string; action?: React.ReactNode }) {
  return (
    <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h2 className="text-lg font-semibold text-[var(--text)]">{title}</h2>
        {description && <p className="mt-1 max-w-3xl text-sm leading-6 text-[var(--text-secondary)]">{description}</p>}
      </div>
      {action}
    </div>
  );
}

export function ContentStack({ children, className }: PrimitiveProps) {
  return <div className={cx("flex flex-col gap-4", className)}>{children}</div>;
}

export function InlineCluster({ children, className }: PrimitiveProps) {
  return <div className={cx("flex flex-wrap items-center gap-3", className)}>{children}</div>;
}

export function Surface({ children, className }: PrimitiveProps) {
  return <div className={cx("rounded-xl border border-[var(--border)] bg-[var(--surface-raised)] p-5 shadow-sm", className)}>{children}</div>;
}

export function DecisionSurface({ children, className }: PrimitiveProps) {
  return (
    <div className={cx("rounded-lg border border-[var(--border)] bg-[var(--surface-raised)] p-6 shadow-sm", className)}>
      {children}
    </div>
  );
}

export function DetailPanel({ children, className }: PrimitiveProps) {
  return <div className={cx("rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-muted)] p-4", className)}>{children}</div>;
}

export function StatusStrip({ children, className }: PrimitiveProps) {
  return (
    <div className={cx("flex flex-wrap items-center justify-between gap-3 rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-muted)] p-4", className)}>
      {children}
    </div>
  );
}

