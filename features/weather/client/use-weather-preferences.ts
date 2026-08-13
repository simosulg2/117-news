"use client";

import { useCallback, useEffect, useState } from "react";

import { dateInputFormatter } from "@/features/weather/client/weather-formatters";
import {
  METRICS,
  WEATHER_PREFERENCES_KEY,
  type WeatherRange,
  type WeatherView,
} from "@/features/weather/model/weather-client-model";

export function useWeatherPreferences() {
  const [view, setView] = useState<WeatherView>("now");
  const [range, setRange] = useState<WeatherRange>("24h");
  const [selectedDate, setSelectedDate] = useState("");
  const [selectedEndDate, setSelectedEndDate] = useState("");
  const [periodStart, setPeriodStart] = useState("");
  const [periodEnd, setPeriodEnd] = useState("");
  const [visibleMetricIds, setVisibleMetricIds] = useState(() => METRICS.map((metric) => metric.id));
  const [preferencesLoaded, setPreferencesLoaded] = useState(false);

  useEffect(() => {
    let restoredSelectedDate = false;
    let restoredSelectedEndDate = false;
    let restoredSelectedDateValue: string | null = null;
    try {
      const raw = localStorage.getItem(WEATHER_PREFERENCES_KEY);
      if (raw) {
        const saved = JSON.parse(raw) as Record<string, unknown>;
        if (saved.view === "history" || saved.view === "now" || saved.view === "forecast") setView(saved.view);
        if (saved.range === "24h" || saved.range === "3d" || saved.range === "7d" || saved.range === "30d" || saved.range === "90d" || saved.range === "date") setRange(saved.range);
        if (typeof saved.selectedDate === "string" && /^\d{4}-\d{2}-\d{2}$/.test(saved.selectedDate)) {
          setSelectedDate(saved.selectedDate);
          restoredSelectedDate = true;
          restoredSelectedDateValue = saved.selectedDate;
        }
        if (typeof saved.selectedEndDate === "string" && /^\d{4}-\d{2}-\d{2}$/.test(saved.selectedEndDate)) {
          setSelectedEndDate(saved.selectedEndDate);
          restoredSelectedEndDate = true;
        }
        const savedPeriodStart = typeof saved.periodStart === "string" ? saved.periodStart : saved.runStart;
        const savedPeriodEnd = typeof saved.periodEnd === "string" ? saved.periodEnd : saved.runEnd;
        if (typeof savedPeriodStart === "string") setPeriodStart(savedPeriodStart);
        if (typeof savedPeriodEnd === "string") setPeriodEnd(savedPeriodEnd);
        if (Array.isArray(saved.visibleMetricIds)) {
          const validIds = saved.visibleMetricIds.filter(
            (id): id is string => typeof id === "string" && METRICS.some((metric) => metric.id === id),
          );
          if (validIds.length > 0) setVisibleMetricIds([...new Set(validIds)]);
        }
      }
    } catch {
      // Defaults remain usable if preferences are corrupt or storage is blocked.
    } finally {
      const today = dateInputFormatter.format(new Date());
      if (!restoredSelectedDate) setSelectedDate(today);
      if (!restoredSelectedEndDate) setSelectedEndDate(restoredSelectedDateValue ?? today);
      setPreferencesLoaded(true);
    }
  }, []);

  useEffect(() => {
    if (!preferencesLoaded) return;
    try {
      localStorage.setItem(
        WEATHER_PREFERENCES_KEY,
        JSON.stringify({ view, range, selectedDate, selectedEndDate, periodStart, periodEnd, visibleMetricIds }),
      );
    } catch {
      // Weather controls remain usable for the current visit without storage.
    }
  }, [periodEnd, periodStart, preferencesLoaded, range, selectedDate, selectedEndDate, view, visibleMetricIds]);

  const toggleMetric = useCallback((id: string) => {
    setVisibleMetricIds((current) => {
      if (current.includes(id)) return current.length === 1 ? current : current.filter((item) => item !== id);
      return METRICS.filter((metric) => current.includes(metric.id) || metric.id === id).map((metric) => metric.id);
    });
  }, []);

  return {
    view, setView, range, setRange, selectedDate, setSelectedDate, selectedEndDate, setSelectedEndDate,
    periodStart, setPeriodStart, periodEnd, setPeriodEnd, visibleMetricIds, toggleMetric,
  };
}
