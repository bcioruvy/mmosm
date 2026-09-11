type Point = { label: string; value: number };

export default function TrendChart({ data }: { data: Point[] }) {
  const maxAbs = Math.max(1, ...data.map((d) => Math.abs(d.value)));
  const chartHeight = 120;
  const barWidth = 36;
  const gap = 20;
  const width = data.length * (barWidth + gap);
  const midY = chartHeight / 2;

  return (
    <svg width="100%" viewBox={`0 0 ${width} ${chartHeight + 26}`} style={{ maxWidth: 480, display: "block" }}>
      <line x1={0} y1={midY} x2={width} y2={midY} stroke="var(--color-border)" strokeWidth={1} />
      {data.map((d, i) => {
        const barHeight = Math.max((Math.abs(d.value) / maxAbs) * (chartHeight / 2 - 6), 1);
        const x = i * (barWidth + gap) + gap / 2;
        const y = d.value >= 0 ? midY - barHeight : midY;
        const color = d.value >= 0 ? "var(--color-brand)" : "var(--color-error)";
        return (
          <g key={`${d.label}-${i}`}>
            <rect x={x} y={y} width={barWidth} height={barHeight} fill={color} rx={3} />
            <text x={x + barWidth / 2} y={chartHeight + 18} textAnchor="middle" fontSize="11" fill="var(--color-text-muted)">
              {d.label}
            </text>
          </g>
        );
      })}
    </svg>
  );
}
