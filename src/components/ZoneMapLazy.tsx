import React, { useEffect, useState } from 'react';
import type { ZoneData, MapOverlay } from '../types';

interface ZoneMapLazyProps {
  zones: ZoneData[];
  selectedZoneId: string | null;
  onSelectZone: (zone: ZoneData) => void;
  overlay: MapOverlay;
  setOverlay: (overlay: MapOverlay) => void;
  fullscreen: boolean;
  onToggleFullscreen: () => void;
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
      <div className="bg-[#14291F] border-2 border-[#2D5843] rounded-xs min-h-[520px] flex flex-col items-center justify-center text-[#EDE6D6] gap-2">
        <div className="w-2.5 h-2.5 bg-[#D9A441] rounded-full animate-pulse" />
        <p className="font-heading font-bold text-sm uppercase tracking-wide">
          Loading ICT risk map…
        </p>
        <p className="font-mono-data text-[11px] text-[#EDE6D6]/60">
          {props.zones.length} zones ready · OpenStreetMap hydrates in browser
        </p>
      </div>
    );
  }

  return <Map {...props} />;
};
