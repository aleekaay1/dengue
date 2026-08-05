import React, { useEffect, useState } from 'react';
import type { ZoneData, MapOverlay } from '../types';
import type { GridCellDto } from './gridMapUtils';

interface ZoneMapLazyProps {
  zones: ZoneData[];
  selectedZoneId: string | null;
  onSelectZone: (zone: ZoneData) => void;
  selectedBlockId: string | null;
  onSelectBlock: (cell: GridCellDto | null) => void;
  overlay: MapOverlay;
  setOverlay: (overlay: MapOverlay) => void;
  fullscreen: boolean;
  onToggleFullscreen: () => void;
  gridEpoch?: number;
}

/** Leaflet is browser-only — load the map after mount so SSR stays clean. */
export const ZoneMapLazy: React.FC<ZoneMapLazyProps> = (props) => {
  const [Map, setMap] = useState<React.ComponentType<ZoneMapLazyProps> | null>(
    null
  );

  useEffect(() => {
    let cancelled = false;
    void import('./ZoneMap').then((mod) => {
      if (!cancelled) setMap(() => mod.ZoneMap);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  if (!Map) {
    return (
      <div className="bg-white border border-[var(--line)] rounded-xl min-h-[480px] h-[min(70vh,640px)] flex flex-col items-center justify-center text-[var(--muted)] gap-2">
        <div className="w-2.5 h-2.5 bg-[var(--brand)] rounded-full animate-pulse" />
        <p className="font-heading font-semibold text-sm">Loading map…</p>
      </div>
    );
  }

  return <Map {...props} />;
};
