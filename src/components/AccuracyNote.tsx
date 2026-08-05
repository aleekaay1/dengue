import React, { useState } from 'react';
import { ChevronDown, Info } from 'lucide-react';

/** Honest note: what feeds are real vs heuristic — parks/standing water caveats. */
export const AccuracyNote: React.FC = () => {
  const [open, setOpen] = useState(false);

  return (
    <div className="bg-white border border-[var(--line)] rounded-xl overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between gap-3 px-4 py-3 text-left hover:bg-[var(--bg)]"
      >
        <span className="flex items-center gap-2 text-sm font-heading font-semibold text-[var(--ink)]">
          <Info className="w-4 h-4 text-[var(--brand)]" />
          Is this real data? How to read parks & standing water
        </span>
        <ChevronDown
          className={`w-4 h-4 text-[var(--muted)] transition-transform ${open ? 'rotate-180' : ''}`}
        />
      </button>
      {open && (
        <div className="px-4 pb-4 text-sm text-[var(--muted)] space-y-2 leading-relaxed border-t border-[var(--line)] pt-3">
          <p>
            <strong className="text-[var(--ink)]">Real inputs:</strong> live
            weather (Open-Meteo temperature, humidity, rain), satellite
            vegetation &amp; land surface heat from your Earth Engine export,
            and terrain low-spots from a DEM depression seed.
          </p>
          <p>
            <strong className="text-[var(--ink)]">Not a hospital feed:</strong>{' '}
            dengue case counts are still demo placeholders until an official
            source is connected.
          </p>
          <p>
            <strong className="text-[var(--ink)]">Score is a transparent
            heuristic</strong> (weighted factors), not a trained ML model and
            not lab-validated. Click a block to see each factor’s points.
          </p>
          <p>
            <strong className="text-[var(--ink)]">Parks / trees:</strong>{' '}
            dense vegetation &amp; shade raise risk (resting habitat).{' '}
            <em>Standing water in a park</em> only raises the terrain term if
            the DEM marks a sink — small puddles or ornamental ponds are often
            too fine for ~90 m elevation data, so a green park can look
            “medium/low” even when field officers see water. After rain, the
            rainfall term rises city-wide (weather cells are coarse, ~9–11 km).
          </p>
          <p>
            <strong className="text-[var(--ink)]">How to check:</strong> open a
            block → compare Temperature, Humidity, Rain, Vegetation, Low ground.
            Use “Open block center” against Google Maps. Re-run{' '}
            <span className="font-mono-data text-xs">Update data</span> after
            connecting Supabase service role to refresh weather into the cache.
          </p>
        </div>
      )}
    </div>
  );
};
