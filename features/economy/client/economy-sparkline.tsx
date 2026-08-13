import type { EconomyIndicator } from "@/lib/economy-types";

type EconomySparklineProps = {
  indicator: EconomyIndicator;
};

const WIDTH = 220;
const HEIGHT = 58;
const PADDING = 4;

export function EconomySparkline({ indicator }: EconomySparklineProps) {
  const values = indicator.history.map((point) => point.value);
  if (values.length < 2) return <div className="h-[58px] border-y border-dashed border-[#bfd0dc] dark:border-[#29465d]" />;
  const minimum = Math.min(...values);
  const maximum = Math.max(...values);
  const range = maximum - minimum || 1;
  const points = values.map((value, index) => {
    const x = PADDING + (index / (values.length - 1)) * (WIDTH - PADDING * 2);
    const y = HEIGHT - PADDING - ((value - minimum) / range) * (HEIGHT - PADDING * 2);
    return [x, y] as const;
  });
  const path = points.map(([x, y], index) => `${index ? "L" : "M"}${x.toFixed(1)} ${y.toFixed(1)}`).join(" ");
  const last = points.at(-1)!;
  const tone = indicator.classification.outlook === "improved"
    ? "#15966f"
    : indicator.classification.outlook === "worsened"
      ? "#d9473f"
      : "#4f8cff";
  return (
    <svg
      viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
      className="h-[58px] w-full overflow-visible"
      role="img"
      aria-label={`${indicator.label}, ${values.length} perioodi trend`}
    >
      <path d={`M${PADDING} ${HEIGHT - PADDING}H${WIDTH - PADDING}`} fill="none" stroke="currentColor" className="text-[#c6d3dc] dark:text-[#29465d]" strokeWidth="1" />
      <path d={path} fill="none" stroke={tone} strokeWidth="2" vectorEffect="non-scaling-stroke" />
      <circle cx={last[0]} cy={last[1]} r="3" fill={tone} />
    </svg>
  );
}
