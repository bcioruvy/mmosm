import { formatCurrency } from "@/lib/currency";
import type { ExpenseCategorySlice } from "@/lib/reports/expenseBreakdown";

/**
 * Validated categorical palette (dataviz skill, references/palette.md) —
 * passes lightness/chroma/CVD/normal-vision checks against a white card
 * surface. Three slots (aqua, yellow, magenta) sit below 3:1 contrast by
 * design; the legend's visible label+amount on every row is the required
 * relief channel, so identity never depends on the wedge color alone.
 * "Other" deliberately isn't a categorical hue — it's an aggregate
 * bucket, not an identity, so it gets a neutral gray instead of
 * consuming (and devaluing) a real slot.
 */
const CATEGORY_COLORS = ["#2a78d6", "#eb6834", "#1baf7a", "#eda100", "#e87ba4", "#008300", "#4a3aa7"];
const OTHER_COLOR = "#898781";

const SIZE = 180;
const STROKE_WIDTH = 28;
const RADIUS = (SIZE - STROKE_WIDTH) / 2;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;
const SEGMENT_GAP = 3;

export default function DonutChart({ data }: { data: ExpenseCategorySlice[] }) {
  const total = data.reduce((s, d) => s + d.value, 0);

  if (data.length === 0 || total <= 0) {
    return <div className="flex h-44 items-center justify-center text-sm text-muted">No expenses in this period.</div>;
  }

  let cumulative = 0;
  const segments = data.map((d, i) => {
    const fraction = d.value / total;
    const dash = fraction * CIRCUMFERENCE;
    const visible = Math.max(dash - SEGMENT_GAP, 0);
    const offset = -cumulative;
    cumulative += dash;
    const color = d.label === "Other" ? OTHER_COLOR : CATEGORY_COLORS[i % CATEGORY_COLORS.length];
    return { ...d, color, dasharray: `${visible} ${CIRCUMFERENCE - visible}`, offset, percent: fraction * 100 };
  });

  return (
    <div className="flex flex-col gap-6 sm:flex-row sm:items-center">
      <div className="relative mx-auto shrink-0 sm:mx-0" style={{ width: SIZE, height: SIZE }}>
        <svg width={SIZE} height={SIZE} viewBox={`0 0 ${SIZE} ${SIZE}`}>
          <g transform={`rotate(-90 ${SIZE / 2} ${SIZE / 2})`}>
            <circle cx={SIZE / 2} cy={SIZE / 2} r={RADIUS} fill="none" stroke="var(--color-border)" strokeWidth={STROKE_WIDTH} />
            {segments.map((s) => (
              <circle
                key={s.label}
                cx={SIZE / 2}
                cy={SIZE / 2}
                r={RADIUS}
                fill="none"
                stroke={s.color}
                strokeWidth={STROKE_WIDTH}
                strokeDasharray={s.dasharray}
                strokeDashoffset={s.offset}
                className="transition-opacity hover:opacity-75"
              >
                <title>{`${s.label}: ${formatCurrency(s.value)} (${s.percent.toFixed(1)}%)`}</title>
              </circle>
            ))}
          </g>
        </svg>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
          <div className="text-xs text-muted">Total</div>
          <div className="text-lg font-semibold">{formatCurrency(total)}</div>
        </div>
      </div>

      <ul className="min-w-0 flex-1 space-y-1.5">
        {segments.map((s) => (
          <li key={s.label} className="flex items-center gap-2 text-sm">
            <span className="h-2.5 w-2.5 shrink-0 rounded-sm" style={{ background: s.color }} aria-hidden="true" />
            <span className="min-w-0 flex-1 truncate">{s.label}</span>
            <span className="shrink-0 text-muted">{s.percent.toFixed(0)}%</span>
            <span className="shrink-0 font-medium">{formatCurrency(s.value)}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
