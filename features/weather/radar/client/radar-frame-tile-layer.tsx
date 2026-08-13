"use client";

import type { CSSProperties } from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import type { RadarFrameTile, RadarTilePlan } from "../model/radar-types";
import { TILE_SIZE } from "../model/radar-map-model";

type LayerSlot = "first" | "second";
type LayerState = {
  active: LayerSlot | null;
  plans: Record<LayerSlot, RadarTilePlan | null>;
};

const INITIAL_LAYERS: LayerState = {
  active: null,
  plans: { first: null, second: null },
};

function RadarTileImage({
  tile,
  priority,
  onLoaded,
  onFailed,
}: {
  tile: RadarFrameTile;
  priority: "high" | "low" | "auto";
  onLoaded: () => void;
  onFailed: () => void;
}) {
  const [source, setSource] = useState(tile.url);
  const mountedRef = useRef(true);
  useEffect(() => () => {
    mountedRef.current = false;
  }, []);
  return (
    <img
      src={source}
      alt=""
      aria-hidden="true"
      draggable={false}
      decoding="async"
      fetchPriority={priority}
      onLoad={(event) => {
        const image = event.currentTarget;
        void image.decode().then(() => {
          if (mountedRef.current) onLoaded();
        }).catch(() => {
          if (mountedRef.current) onFailed();
        });
      }}
      onError={() => {
        if (source === tile.url && tile.fallbackUrl) setSource(tile.fallbackUrl);
        else onFailed();
      }}
      style={{
        position: "absolute",
        left: tile.left,
        top: tile.top,
        width: TILE_SIZE,
        height: TILE_SIZE,
        maxWidth: "none",
        userSelect: "none",
      }}
    />
  );
}

function RadarTileSet({
  plan,
  active,
  opacity,
  transform,
  onReady,
  onFailure,
}: {
  plan: RadarTilePlan;
  active: boolean;
  opacity: number;
  transform: CSSProperties;
  onReady: (plan: RadarTilePlan) => void;
  onFailure: (requestId: string) => void;
}) {
  const loadedRef = useRef(new Set<string>());
  const finishedRef = useRef(false);

  const markLoaded = useCallback((tileKey: string) => {
    if (active || finishedRef.current) return;
    loadedRef.current.add(tileKey);
    if (loadedRef.current.size !== plan.tiles.length) return;
    finishedRef.current = true;
    onReady(plan);
  }, [active, onReady, plan]);

  const markFailed = useCallback(() => {
    if (active || finishedRef.current) return;
    finishedRef.current = true;
    onFailure(plan.id);
  }, [active, onFailure, plan.id]);

  return (
    <div
      className="pointer-events-none absolute inset-0"
      aria-hidden="true"
      style={{ ...transform, opacity: active ? opacity / 100 : 0 }}
    >
      {plan.tiles.map((tile) => (
        <RadarTileImage
          key={`${tile.key}:${tile.url}`}
          tile={tile}
          priority={active ? "auto" : "high"}
          onLoaded={() => markLoaded(tile.key)}
          onFailed={markFailed}
        />
      ))}
    </div>
  );
}

export function RadarFrameTileLayer({
  desiredPlan,
  prefetchPlans,
  opacity,
  dragOffset,
  onCommitted,
  onFailure,
}: {
  desiredPlan: RadarTilePlan | null;
  prefetchPlans: RadarTilePlan[];
  opacity: number;
  dragOffset: { x: number; y: number };
  onCommitted: (plan: RadarTilePlan) => void;
  onFailure: (requestId: string) => void;
}) {
  const [layers, setLayers] = useState<LayerState>(INITIAL_LAYERS);
  const desiredPlanRef = useRef(desiredPlan);
  desiredPlanRef.current = desiredPlan;

  const activePlan = layers.active ? layers.plans[layers.active] : null;
  const desiredIsActive = Boolean(activePlan && desiredPlan?.id === activePlan.id);
  const stagingSlot: LayerSlot = layers.active === "first" ? "second" : "first";
  const stagingPlan = desiredPlan && !desiredIsActive ? desiredPlan : null;

  const commit = useCallback((plan: RadarTilePlan) => {
    if (desiredPlanRef.current?.id !== plan.id) return;
    setLayers((current) => {
      const target: LayerSlot = current.active === "first" ? "second" : "first";
      return {
        active: target,
        plans: { ...current.plans, [target]: plan },
      };
    });
    onCommitted(plan);
  }, [onCommitted]);

  const transform: CSSProperties = useMemo(() => ({
    transform: `translate3d(${dragOffset.x}px, ${dragOffset.y}px, 0)`,
  }), [dragOffset.x, dragOffset.y]);

  const desiredSharesGrid = Boolean(
    activePlan && desiredPlan?.tileSetKey === activePlan.tileSetKey,
  );
  const displayedActivePlan = desiredIsActive && desiredPlan ? desiredPlan : activePlan;
  const keepActiveVisible = !stagingPlan || desiredSharesGrid;
  const plansBySlot: Record<LayerSlot, RadarTilePlan | null> = {
    first: layers.active === "first"
      ? displayedActivePlan
      : stagingSlot === "first" ? stagingPlan : null,
    second: layers.active === "second"
      ? displayedActivePlan
      : stagingSlot === "second" ? stagingPlan : null,
  };

  return (
    <>
      {(["first", "second"] as const).map((slot) => {
        const plan = plansBySlot[slot];
        if (!plan) return null;
        return (
          <RadarTileSet
            key={`${slot}:${plan.id}`}
            plan={plan}
            active={layers.active === slot && keepActiveVisible}
            opacity={opacity}
            transform={transform}
            onReady={commit}
            onFailure={onFailure}
          />
        );
      })}

      <div className="pointer-events-none absolute h-px w-px overflow-hidden opacity-0" aria-hidden="true">
        {prefetchPlans.flatMap((plan) => plan.tiles.map((tile) => (
          <RadarTileImage
            key={`warm:${plan.id}:${tile.key}:${tile.url}`}
            tile={{ ...tile, fallbackUrl: null }}
            priority="low"
            onLoaded={() => undefined}
            onFailed={() => undefined}
          />
        )))}
      </div>
    </>
  );
}
