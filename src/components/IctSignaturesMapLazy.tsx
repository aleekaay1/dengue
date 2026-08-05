import React, { useEffect, useState } from 'react';

/** Leaflet is browser-only — never import IctSignaturesMap during SSR. */
export const IctSignaturesMapLazy: React.FC<{ gridEpoch?: number }> = ({
  gridEpoch = 0,
}) => {
  const [Map, setMap] = useState<React.ComponentType<{
    gridEpoch?: number;
  }> | null>(null);

  useEffect(() => {
    let cancelled = false;
    void import('./IctSignaturesMap').then((mod) => {
      if (!cancelled) setMap(() => mod.IctSignaturesMap);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  if (!Map) {
    return (
      <div className="bg-white border border-[var(--line)] rounded-xl min-h-[560px] h-[min(72vh,720px)] flex flex-col items-center justify-center text-[var(--muted)] gap-2">
        <div className="w-2.5 h-2.5 bg-[var(--brand)] rounded-full animate-pulse" />
        <p className="font-heading font-semibold text-sm">Loading hotspots…</p>
      </div>
    );
  }

  return <Map gridEpoch={gridEpoch} />;
};
