import { axisTimeFormatter, dateTimeFormatter, decimalFormatter } from "@/features/weather/client/weather-formatters";
import { fieldValue, type MetricDefinition } from "@/features/weather/model/weather-client-model";
import type { WeatherPoint } from "@/lib/weather-types";

type Padding = { top: number; right: number; bottom: number; left: number };

type MetricChartSvgProps = {
  metric: MetricDefinition;
  chartPoints: WeatherPoint[];
  startMs: number;
  endMs: number;
  nowMs: number;
  inspectionMs: number | null;
  inspectionInRange: boolean;
  inspectedPoints: WeatherPoint[];
  width: number;
  height: number;
  padding: Padding;
  plotWidth: number;
  plotHeight: number;
  yMin: number;
  yTicks: number[];
  xTicks: number[];
  xForTime: (value: number) => number;
  yForValue: (value: number) => number;
  modeledBarPatternId: string;
  selectedStart: number | null;
  selectedEnd: number | null;
  timesWithBothKinds: Set<string>;
  observedPaths: string[];
  modeledPaths: string[];
  observedSecondaryPaths: string[];
  modeledSecondaryPaths: string[];
  titleId: string;
};

export function MetricChartSvg(props: MetricChartSvgProps) {
  const {
    metric, chartPoints, startMs, endMs, nowMs, inspectionMs, inspectionInRange,
    inspectedPoints, width, height, padding, plotWidth, plotHeight, yMin, yTicks,
    xTicks, xForTime, yForValue, modeledBarPatternId, selectedStart, selectedEnd,
    timesWithBothKinds, observedPaths, modeledPaths, observedSecondaryPaths,
    modeledSecondaryPaths, titleId,
  } = props;

  return (
    <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-labelledby={titleId} className="block h-[10.875rem] w-full" preserveAspectRatio="xMidYMid meet">
      <desc>
        {metric.title} ajavahemikus {dateTimeFormatter.format(new Date(startMs))} kuni {dateTimeFormatter.format(new Date(endMs))}.
        Pidev joon või täistulp tähistab mõõtmisi; katkendjoon või viirutatud tulp mudelandmeid.
      </desc>
      {metric.bars && (
        <defs>
          <pattern id={modeledBarPatternId} width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(135)">
            <line x1="0" y1="0" x2="0" y2="6" stroke={metric.color} strokeWidth="2" />
          </pattern>
        </defs>
      )}
      {selectedStart !== null && selectedEnd !== null && selectedEnd > selectedStart && (
        <rect x={xForTime(selectedStart)} y={padding.top} width={Math.max(0, xForTime(selectedEnd) - xForTime(selectedStart))} height={plotHeight} fill="#4f8cff" opacity="0.09" />
      )}
      {yTicks.map((tick, index) => {
        const y = yForValue(tick);
        return (
          <g key={`${metric.id}-y-${index}`}>
            <line x1={padding.left} x2={width - padding.right} y1={y} y2={y} stroke="currentColor" opacity="0.22" />
            <text x={padding.left - 7} y={y + 4} textAnchor="end" fill="currentColor" fontSize="10">{decimalFormatter.format(tick)}</text>
          </g>
        );
      })}
      {xTicks.map((tick, index) => {
        const x = xForTime(tick);
        return (
          <g key={`${metric.id}-x-${index}`}>
            <line x1={x} x2={x} y1={padding.top} y2={height - padding.bottom} stroke="currentColor" opacity="0.11" />
            <text x={x} y={height - 10} textAnchor={index === 0 ? "start" : index === xTicks.length - 1 ? "end" : "middle"} fill="currentColor" fontSize="10">
              {axisTimeFormatter.format(new Date(tick)).replace(",", "")}
            </text>
          </g>
        );
      })}
      {metric.bars ? chartPoints.map((point, index) => {
        const value = fieldValue(point, metric.field);
        if (value === null) return null;
        const x = xForTime(Date.parse(point.time));
        const barWidth = Math.max(1, Math.min(8, plotWidth / Math.max(chartPoints.length, 1) - 0.5));
        const hasOtherKindAtTime = timesWithBothKinds.has(point.time);
        const renderedWidth = hasOtherKindAtTime ? Math.max(1, barWidth * 0.62) : barWidth;
        const xOffset = hasOtherKindAtTime ? (point.kind === "observed" ? -barWidth * 0.22 : barWidth * 0.22) : 0;
        const zeroY = yForValue(Math.max(0, yMin));
        const valueY = yForValue(value);
        return (
          <rect key={`${point.kind}-${point.time}-${index}`} x={x + xOffset - renderedWidth / 2} y={Math.min(zeroY, valueY)} width={renderedWidth} height={Math.max(1, Math.abs(zeroY - valueY))} fill={point.kind === "observed" ? metric.color : `url(#${modeledBarPatternId})`} stroke={metric.color} strokeWidth={point.kind === "observed" ? 0 : 0.8} />
        );
      }) : null}
      {!metric.bars && observedPaths.map((path, index) => <path key={`observed-${index}`} d={path} fill="none" stroke={metric.color} strokeWidth="2.25" vectorEffect="non-scaling-stroke" />)}
      {!metric.bars && modeledPaths.map((path, index) => <path key={`modeled-${index}`} d={path} fill="none" stroke={metric.color} strokeWidth="2.25" strokeDasharray="7 5" vectorEffect="non-scaling-stroke" />)}
      {observedSecondaryPaths.map((path, index) => <path key={`observed-secondary-${index}`} d={path} fill="none" stroke={metric.secondaryColor ?? metric.color} strokeWidth="1.8" strokeDasharray="2 3" vectorEffect="non-scaling-stroke" />)}
      {modeledSecondaryPaths.map((path, index) => <path key={`modeled-secondary-${index}`} d={path} fill="none" stroke={metric.secondaryColor ?? metric.color} strokeWidth="1.8" strokeDasharray="8 4 2 4" vectorEffect="non-scaling-stroke" />)}
      {nowMs >= startMs && nowMs <= endMs && (
        <g>
          <line x1={xForTime(nowMs)} x2={xForTime(nowMs)} y1={padding.top} y2={height - padding.bottom} stroke="#4f8cff" strokeWidth="1.5" vectorEffect="non-scaling-stroke" />
          <text x={xForTime(nowMs) + 4} y={padding.top + 10} fill="#245fae" fontSize="10" fontWeight="700">PRAEGU</text>
        </g>
      )}
      {inspectionInRange && inspectionMs !== null && (
        <g aria-hidden="true">
          <line x1={xForTime(inspectionMs)} x2={xForTime(inspectionMs)} y1={padding.top} y2={height - padding.bottom} stroke="#d68b20" strokeWidth="1.75" vectorEffect="non-scaling-stroke" />
          {inspectedPoints.map((point, index) => {
            const value = fieldValue(point, metric.field);
            if (value === null) return null;
            return <circle key={`${point.kind}-${point.source}-${index}`} cx={xForTime(inspectionMs)} cy={yForValue(value)} r="3.5" fill={point.kind === "observed" ? metric.color : "#f4f7f9"} stroke={metric.color} strokeWidth="1.75" vectorEffect="non-scaling-stroke" />;
          })}
        </g>
      )}
    </svg>
  );
}
