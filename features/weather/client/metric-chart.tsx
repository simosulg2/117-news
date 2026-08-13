"use client";

import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";

import { MetricChartDetails } from "@/features/weather/client/metric-chart-details";
import { MetricChartSvg } from "@/features/weather/client/metric-chart-svg";
import { dateTimeFormatter, formatNumber, sourceLabel, weatherSourceLabel } from "@/features/weather/client/weather-formatters";
import { DAY_MS, HOUR_MS, fieldValue, maximum as max, minimum as min, pathSegments, type MetricDefinition } from "@/features/weather/model/weather-client-model";
import { nearestTimestamp, stepTimestamp, uniqueSortedTimestamps } from "@/lib/weather-chart";
import type { WeatherPoint } from "@/lib/weather-types";

function ChartLegendLine({ color, dashed = false }: { color: string; dashed?: boolean }) {
  return (
    <span
      aria-hidden="true"
      className="inline-block w-7 border-t-2"
      style={{ borderColor: color, borderTopStyle: dashed ? "dashed" : "solid" }}
    />
  );
}

function ChartLegendBar({ color, modeled = false }: { color: string; modeled?: boolean }) {
  return (
    <span
      aria-hidden="true"
      className="inline-block h-3 w-5 border"
      style={modeled
        ? {
            borderColor: color,
            backgroundImage: `repeating-linear-gradient(135deg, transparent 0 2px, ${color} 2px 4px)`,
          }
        : { borderColor: color, backgroundColor: color }}
    />
  );
}

export type MetricChartProps = {
  metric: MetricDefinition;
  points: WeatherPoint[];
  startMs: number;
  endMs: number;
  nowMs: number;
  periodStartMs: number | null;
  periodEndMs: number | null;
  inspectionMs: number | null;
  inspectionPinned: boolean;
  onInspectionPreview: (value: number | null) => void;
  onInspectionPin: (value: number | null) => void;
};

export function MetricChart({
  metric,
  points,
  startMs,
  endMs,
  nowMs,
  periodStartMs,
  periodEndMs,
  inspectionMs,
  inspectionPinned,
  onInspectionPreview,
  onInspectionPin,
}: MetricChartProps) {
  const titleId = useId();
  const interactionHintId = `${titleId}-interaction-hint`;
  const inspectionReadoutId = `${titleId}-inspection-readout`;
  const modeledBarPatternId = `${titleId.replace(/:/g, "")}-modeled-bars`;
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const activeTouchPointerRef = useRef<number | null>(null);
  const previewFrameRef = useRef<number | null>(null);
  const [chartWidth, setChartWidth] = useState(720);

  useEffect(() => {
    const container = chartContainerRef.current;
    if (!container) return;

    const updateWidth = (nextWidth: number) => {
      if (!Number.isFinite(nextWidth) || nextWidth <= 0) return;
      const roundedWidth = Math.max(280, Math.round(nextWidth));
      setChartWidth((current) => current === roundedWidth ? current : roundedWidth);
    };

    updateWidth(container.getBoundingClientRect().width);
    if (typeof ResizeObserver === "undefined") {
      const handleResize = () => updateWidth(container.getBoundingClientRect().width);
      window.addEventListener("resize", handleResize);
      return () => window.removeEventListener("resize", handleResize);
    }

    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (entry) updateWidth(entry.contentRect.width);
    });
    observer.observe(container);
    return () => observer.disconnect();
  }, []);

  useEffect(() => () => {
    if (previewFrameRef.current !== null) cancelAnimationFrame(previewFrameRef.current);
    onInspectionPreview(null);
  }, [onInspectionPreview]);

  const queueInspectionPreview = useCallback((value: number | null) => {
    if (previewFrameRef.current !== null) cancelAnimationFrame(previewFrameRef.current);
    previewFrameRef.current = requestAnimationFrame(() => {
      previewFrameRef.current = null;
      onInspectionPreview(value);
    });
  }, [onInspectionPreview]);

  const chartPoints = useMemo(
    () => points.filter((point) => {
      const time = Date.parse(point.time);
      return Number.isFinite(time) && time >= startMs && time <= endMs;
    }),
    [endMs, points, startMs],
  );
  const numericValues = chartPoints.flatMap((point) => {
    const primary = fieldValue(point, metric.field);
    const secondary = metric.secondaryField ? fieldValue(point, metric.secondaryField) : null;
    return [primary, secondary].filter((value): value is number => value !== null);
  });
  const hasObserved = chartPoints.some((point) => point.kind === "observed" && fieldValue(point, metric.field) !== null);
  const hasModeled = chartPoints.some((point) => point.kind === "modeled" && fieldValue(point, metric.field) !== null);
  const width = chartWidth;
  const height = 174;
  const padding = { top: 12, right: width < 480 ? 7 : 12, bottom: 34, left: width < 480 ? 43 : 50 };
  const plotWidth = width - padding.left - padding.right;
  const plotHeight = height - padding.top - padding.bottom;
  const rawMin = metric.fixedMin ?? min(numericValues) ?? 0;
  const rawMax = metric.fixedMax ?? max(numericValues) ?? 1;
  const dataSpan = Math.max(rawMax - rawMin, metric.id === "pressure" ? 2 : 1);
  const yMin = metric.fixedMin ?? rawMin - dataSpan * 0.12;
  const yMax = metric.fixedMax ?? rawMax + dataSpan * 0.12;
  const timeSpan = Math.max(endMs - startMs, 1);
  const xForTime = (value: number) => padding.left + ((value - startMs) / timeSpan) * plotWidth;
  const yForValue = (value: number) => padding.top + (1 - (value - yMin) / Math.max(yMax - yMin, 1)) * plotHeight;
  const maximumGapMs = timeSpan > 2 * DAY_MS ? 4 * HOUR_MS : 2 * HOUR_MS;
  const yTicks = [yMax, (yMin + yMax) / 2, yMin];
  const xTickFractions = width < 480 ? [0, 0.5, 1] : width < 680 ? [0, 1 / 3, 2 / 3, 1] : [0, 0.25, 0.5, 0.75, 1];
  const xTicks = xTickFractions.map((portion) => startMs + timeSpan * portion);
  const observedPaths = pathSegments(chartPoints, "observed", metric.field, xForTime, yForValue, maximumGapMs);
  const modeledPaths = pathSegments(chartPoints, "modeled", metric.field, xForTime, yForValue, maximumGapMs);
  const observedSecondaryPaths = metric.secondaryField
    ? pathSegments(chartPoints, "observed", metric.secondaryField, xForTime, yForValue, maximumGapMs)
    : [];
  const modeledSecondaryPaths = metric.secondaryField
    ? pathSegments(chartPoints, "modeled", metric.secondaryField, xForTime, yForValue, maximumGapMs)
    : [];
  const timesWithBothKinds = useMemo(() => {
    const kindsByTime = new Map<string, Set<WeatherPoint["kind"]>>();
    for (const point of chartPoints) {
      if (fieldValue(point, metric.field) === null) continue;
      const kinds = kindsByTime.get(point.time) ?? new Set<WeatherPoint["kind"]>();
      kinds.add(point.kind);
      kindsByTime.set(point.time, kinds);
    }
    return new Set(
      [...kindsByTime.entries()].filter(([, kinds]) => kinds.size > 1).map(([time]) => time),
    );
  }, [chartPoints, metric.field]);
  const selectedStart = periodStartMs === null ? null : Math.max(startMs, periodStartMs);
  const selectedEnd = periodEndMs === null ? null : Math.min(endMs, periodEndMs);
  const selectableTimestamps = useMemo(
    () => uniqueSortedTimestamps(
      chartPoints
        .filter((point) => (
          fieldValue(point, metric.field) !== null
          || (metric.secondaryField ? fieldValue(point, metric.secondaryField) !== null : false)
        ))
        .map((point) => Date.parse(point.time)),
    ),
    [chartPoints, metric.field, metric.secondaryField],
  );
  const typicalSelectableGap = useMemo(() => {
    const gaps = selectableTimestamps.slice(1).map((value, index) => value - selectableTimestamps[index]);
    return gaps.length > 0
      ? [...gaps].sort((left, right) => left - right)[Math.floor(gaps.length / 2)]
      : timeSpan;
  }, [selectableTimestamps, timeSpan]);
  const inspectedPoints = inspectionMs === null
    ? []
    : chartPoints.filter((point) => (
        Date.parse(point.time) === inspectionMs
        && (fieldValue(point, metric.field) !== null
          || (metric.secondaryField ? fieldValue(point, metric.secondaryField) !== null : false))
      ));
  const inspectionInRange = inspectionMs !== null && inspectionMs >= startMs && inspectionMs <= endMs;
  const inspectionLabel = inspectionInRange
    ? dateTimeFormatter.format(new Date(inspectionMs))
    : null;
  const inspectionValueText = inspectionLabel
    ? `${inspectionLabel}; ${inspectedPoints.map((point) => (
        `${sourceLabel(point.kind)} ${formatNumber(fieldValue(point, metric.field), metric.unit)}`
        + `${metric.secondaryField && fieldValue(point, metric.secondaryField) !== null
          ? `; ${metric.secondaryLabel} ${formatNumber(fieldValue(point, metric.secondaryField), metric.unit)}`
          : ""} ${weatherSourceLabel(point.source)}`
      )).join("; ") || "väärtus puudub"}`
    : "Aeg pole valitud";

  const timestampForClientX = useCallback((clientX: number): number | null => {
    const container = chartContainerRef.current;
    if (!container || selectableTimestamps.length === 0) return null;
    const bounds = container.getBoundingClientRect();
    if (bounds.width <= 0) return null;
    const viewX = ((clientX - bounds.left) / bounds.width) * width;
    const plotPortion = Math.max(0, Math.min(1, (viewX - padding.left) / Math.max(plotWidth, 1)));
    const target = startMs + plotPortion * timeSpan;
    return nearestTimestamp(selectableTimestamps, target, Math.max(typicalSelectableGap * 2, 30 * 60_000));
  }, [padding.left, plotWidth, selectableTimestamps, startMs, timeSpan, typicalSelectableGap, width]);

  const handleKeyDown = useCallback((event: React.KeyboardEvent<HTMLDivElement>) => {
    let next: number | null | undefined;
    if (event.key === "ArrowLeft") next = stepTimestamp(selectableTimestamps, inspectionMs, "previous");
    else if (event.key === "ArrowRight") next = stepTimestamp(selectableTimestamps, inspectionMs, "next");
    else if (event.key === "Home") next = stepTimestamp(selectableTimestamps, inspectionMs, "first");
    else if (event.key === "End") next = stepTimestamp(selectableTimestamps, inspectionMs, "last");
    else if (event.key === "Escape") next = null;
    else return;
    event.preventDefault();
    onInspectionPreview(null);
    onInspectionPin(next);
  }, [inspectionMs, onInspectionPin, onInspectionPreview, selectableTimestamps]);

  const tablePoints = chartPoints
    .filter((point) => fieldValue(point, metric.field) !== null || (metric.secondaryField && fieldValue(point, metric.secondaryField) !== null))
    .slice(-240);

  return (
    <article className="border border-[#9fb2c0] bg-[#f4f7f9] dark:border-[#35536a] dark:bg-[#0a1926]">
      <div className="flex flex-wrap items-start justify-between gap-2 border-b border-[#bdcad3] px-3 py-2 dark:border-[#294154]">
        <div>
          <h3 id={titleId} className="text-sm font-bold text-[#192630] dark:text-[#e5eef4]">
            {metric.title}
          </h3>
          <p className="mt-0.5 text-[11px] text-[#5b6f7d] dark:text-[#8da1b0]">Ühik: {metric.unit}</p>
        </div>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] font-semibold text-[#526878] dark:text-[#9aabb7]">
          {hasObserved && (
            <span className="inline-flex items-center gap-1.5">
              {metric.bars ? <ChartLegendBar color={metric.color} /> : <ChartLegendLine color={metric.color} />} Mõõdetud
            </span>
          )}
          {hasModeled && (
            <span className="inline-flex items-center gap-1.5">
              {metric.bars ? <ChartLegendBar color={metric.color} modeled /> : <ChartLegendLine color={metric.color} dashed />} Mudel
            </span>
          )}
          {metric.secondaryField && (
            <span className="inline-flex items-center gap-1.5">
              <ChartLegendLine color={metric.secondaryColor ?? metric.color} dashed /> {metric.secondaryLabel}
            </span>
          )}
        </div>
      </div>

      {numericValues.length === 0 ? (
        <div className="flex h-44 items-center justify-center px-4 text-center text-xs text-[#526878] dark:text-[#8da1b0]">
          Selle näitaja andmeid valitud ajavahemikus ei ole.
        </div>
      ) : (
        <div
          ref={chartContainerRef}
          role="slider"
          tabIndex={0}
          aria-label={`${metric.title}: täpse aja valik`}
          aria-describedby={`${interactionHintId} ${inspectionReadoutId}`}
          aria-valuemin={selectableTimestamps[0]}
          aria-valuemax={selectableTimestamps[selectableTimestamps.length - 1]}
          aria-valuenow={inspectionInRange
            ? Math.max(selectableTimestamps[0], Math.min(selectableTimestamps.at(-1)!, inspectionMs))
            : selectableTimestamps[0]}
          aria-valuetext={inspectionValueText}
          onKeyDown={handleKeyDown}
          onPointerMove={(event) => {
            const value = timestampForClientX(event.clientX);
            if (event.pointerType === "mouse") queueInspectionPreview(value);
            else if (activeTouchPointerRef.current === event.pointerId) onInspectionPin(value);
          }}
          onPointerLeave={(event) => {
            if (event.pointerType === "mouse") queueInspectionPreview(null);
          }}
          onPointerDown={(event) => {
            if (event.pointerType === "mouse") return;
            activeTouchPointerRef.current = event.pointerId;
            event.currentTarget.setPointerCapture?.(event.pointerId);
            onInspectionPreview(null);
            onInspectionPin(timestampForClientX(event.clientX));
          }}
          onPointerUp={(event) => {
            if (activeTouchPointerRef.current === event.pointerId) activeTouchPointerRef.current = null;
          }}
          onPointerCancel={(event) => {
            if (activeTouchPointerRef.current === event.pointerId) activeTouchPointerRef.current = null;
          }}
          onClick={(event) => {
            if (event.detail === 0) return;
            onInspectionPreview(null);
            onInspectionPin(timestampForClientX(event.clientX));
          }}
          className="overflow-hidden px-1 pb-1 pt-2 text-[#738795] outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-signal dark:text-[#7890a2]"
          style={{ touchAction: "pan-y" }}
        >
          <MetricChartSvg
            metric={metric}
            chartPoints={chartPoints}
            startMs={startMs}
            endMs={endMs}
            nowMs={nowMs}
            inspectionMs={inspectionMs}
            inspectionInRange={inspectionInRange}
            inspectedPoints={inspectedPoints}
            width={width}
            height={height}
            padding={padding}
            plotWidth={plotWidth}
            plotHeight={plotHeight}
            yMin={yMin}
            yTicks={yTicks}
            xTicks={xTicks}
            xForTime={xForTime}
            yForValue={yForValue}
            modeledBarPatternId={modeledBarPatternId}
            selectedStart={selectedStart}
            selectedEnd={selectedEnd}
            timesWithBothKinds={timesWithBothKinds}
            observedPaths={observedPaths}
            modeledPaths={modeledPaths}
            observedSecondaryPaths={observedSecondaryPaths}
            modeledSecondaryPaths={modeledSecondaryPaths}
            titleId={titleId}
          />
        </div>
      )}

      {numericValues.length > 0 && (
        <MetricChartDetails
          metric={metric}
          chartPoints={chartPoints}
          tablePoints={tablePoints}
          inspectedPoints={inspectedPoints}
          inspectionLabel={inspectionLabel}
          inspectionPinned={inspectionPinned}
          interactionHintId={interactionHintId}
          inspectionReadoutId={inspectionReadoutId}
        />
      )}
    </article>
  );
}
