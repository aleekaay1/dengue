import React from 'react';
import {
  BookOpen,
  Bug,
  Droplets,
  Trees,
  ShieldAlert,
  GitPullRequest,
  CheckCircle2,
  Compass,
  HeartPulse,
  Activity,
  Layers,
} from 'lucide-react';

export const MethodologyPage: React.FC = () => {
  return (
    <div className="max-w-5xl mx-auto space-y-6">
      
      {/* Title Header Banner */}
      <div className="bg-[#1F3D2E] text-[#EDE6D6] p-6 rounded-xs border-2 border-[#14291F] shadow-lg relative overflow-hidden">
        <div className="w-full h-1.5 absolute top-0 left-0 aedes-stripe-accent" />

        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-xs bg-[#D9A441] text-[#23241F] font-mono-data text-xs font-bold uppercase mb-2">
              Public Health Thesis Framework
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold font-heading text-white uppercase tracking-tight">
              Model Methodology & One Health Approach
            </h1>
            <p className="text-xs sm:text-sm text-[#EDE6D6]/80 mt-1 max-w-2xl leading-relaxed">
              Predicting adult female <em>Aedes aegypti</em> biting activity through environmental microclimates, canopy density, and epidemiological transmission history in Islamabad Capital Territory, Pakistan.
            </p>
          </div>
          <Bug className="w-16 h-16 text-[#D9A441]/40 shrink-0 hidden sm:block" />
        </div>
      </div>

      {/* CORE EXPLAINER 1: WHY ADULT BITING ACTIVITY VS STANDING WATER */}
      <div className="bg-[#F7F4EC] border-2 border-[#1F3D2E] p-5 rounded-xs shadow-md space-y-3">
        <h2 className="font-heading font-extrabold text-lg text-[#1F3D2E] uppercase flex items-center gap-2 border-b border-[#DDD3C1] pb-2">
          <ShieldAlert className="w-5 h-5 text-[#B5432A]" />
          <span>1. Why Adult Mosquito Activity vs. Standing Water Alerts?</span>
        </h2>

        <div className="grid md:grid-cols-2 gap-4 text-xs leading-relaxed text-[#23241F]">
          <div className="bg-white p-4 rounded-xs border border-[#DDD3C1] space-y-2">
            <h3 className="font-heading font-bold text-sm text-[#B5432A] uppercase flex items-center gap-1.5">
              <span>Traditional Larvae / Standing-Water Alerts</span>
            </h3>
            <p className="text-[#5C5E54]">
              Conventional surveillance counts standing water or larval dip samples. While helpful for long-term sanitation, it has key limitations:
            </p>
            <ul className="list-disc pl-4 space-y-1 text-[#5C5E54]">
              <li>Larvae do not bite humans or transmit dengue virus directly.</li>
              <li>Water can exist without mosquito eggs, or contain non-dengue species.</li>
              <li>High lag time: larvae take 8-12 days to mature into biting adults.</li>
            </ul>
          </div>

          <div className="bg-[#1F3D2E] text-[#EDE6D6] p-4 rounded-xs border border-[#14291F] space-y-2">
            <h3 className="font-heading font-bold text-sm text-[#D9A441] uppercase flex items-center gap-1.5">
              <span>This Model: Adult Biting Risk Signal</span>
            </h3>
            <p className="text-[#EDE6D6]/90">
              This dashboard models <strong>where adult, biting mosquitoes are actively feeding right now</strong> based on microclimates:
            </p>
            <ul className="list-disc pl-4 space-y-1 text-[#EDE6D6]/80">
              <li><strong>Humidity (&gt;65%)</strong> prolongs adult mosquito lifespan and accelerates viral replication.</li>
              <li><strong>Canopy Shade (NDVI)</strong> shelters mosquitoes from deadly daytime heat (&gt;35°C).</li>
              <li>Provides an immediate, actionable signal for neighborhood spray teams and morning/evening repellents.</li>
            </ul>
          </div>
        </div>
      </div>

      {/* CORE EXPLAINER 2: HOW THE SCORE IS CALCULATED */}
      <div className="bg-[#F7F4EC] border-2 border-[#1F3D2E] p-5 rounded-xs shadow-md space-y-4">
        <h2 className="font-heading font-extrabold text-lg text-[#1F3D2E] uppercase flex items-center gap-2 border-b border-[#DDD3C1] pb-2">
          <Activity className="w-5 h-5 text-[#4C8C6B]" />
          <span>2. How the Zone Activity Score (0 - 100) is Calculated</span>
        </h2>

        <p className="text-xs text-[#23241F] leading-relaxed">
          The Activity Score combines four real-time environmental and epidemiological variables into a single 0-100 index:
        </p>

        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs font-mono-data">
          
          <div className="bg-white p-3 rounded-xs border-t-3 border-[#D9A441] border border-[#DDD3C1]">
            <div className="font-heading font-bold text-xs text-[#1F3D2E] uppercase mb-1">
              Humidity Factor (35%)
            </div>
            <p className="text-[11px] font-sans text-[#5C5E54] leading-normal">
              Relative humidity &gt;65% increases feeding frequency from once every 3 days to every 24 hours.
            </p>
          </div>

          <div className="bg-white p-3 rounded-xs border-t-3 border-[#4C8C6B] border border-[#DDD3C1]">
            <div className="font-heading font-bold text-xs text-[#1F3D2E] uppercase mb-1">
              Vegetation / Shade (30%)
            </div>
            <p className="text-[11px] font-sans text-[#5C5E54] leading-normal">
              Satellite NDVI index measures tree canopy cover where adult mosquitoes rest during peak heat hours.
            </p>
          </div>

          <div className="bg-white p-3 rounded-xs border-t-3 border-[#B5432A] border border-[#DDD3C1]">
            <div className="font-heading font-bold text-xs text-[#1F3D2E] uppercase mb-1">
              Temperature Window (20%)
            </div>
            <p className="text-[11px] font-sans text-[#5C5E54] leading-normal">
              Optimal viral incubation occurs between 26°C and 30°C. Extreme cold (&lt;15°C) or heat (&gt;38°C) halts flight.
            </p>
          </div>

          <div className="bg-white p-3 rounded-xs border-t-3 border-[#23241F] border border-[#DDD3C1]">
            <div className="font-heading font-bold text-xs text-[#1F3D2E] uppercase mb-1">
              Case Reservoir (15%)
            </div>
            <p className="text-[11px] font-sans text-[#5C5E54] leading-normal">
              Recent human dengue cases in the neighborhood supply the viral reservoir for mosquito-to-human transmission.
            </p>
          </div>

        </div>
      </div>

      {/* CORE EXPLAINER 3: ONE HEALTH FRAMEWORK */}
      <div className="bg-[#1F3D2E] text-[#EDE6D6] p-5 rounded-xs border-2 border-[#14291F] shadow-md space-y-4 relative overflow-hidden">
        <div className="w-full h-1 absolute top-0 left-0 aedes-stripe-accent" />

        <h2 className="font-heading font-extrabold text-lg text-[#D9A441] uppercase flex items-center gap-2 border-b border-[#2D5843] pb-2">
          <HeartPulse className="w-5 h-5 text-[#B5432A]" />
          <span>3. The One Health Triad (Environment + Vector + Human Health)</span>
        </h2>

        <p className="text-xs text-[#EDE6D6]/90 leading-relaxed">
          Dengue control requires looking at the interconnected system rather than isolated medical treatments alone:
        </p>

        <div className="grid md:grid-cols-3 gap-3 text-xs">
          <div className="bg-[#14291F] p-3.5 rounded-xs border border-[#2D5843] space-y-1">
            <div className="font-heading font-bold text-xs text-[#4C8C6B] uppercase flex items-center gap-1">
              <Trees className="w-4 h-4" />
              <span>1. Environment</span>
            </div>
            <p className="text-[11px] text-[#EDE6D6]/80 leading-normal">
              Rainfall accumulation, urban heat islands, tree canopy shade, and humidity microclimates dictate mosquito survival.
            </p>
          </div>

          <div className="bg-[#14291F] p-3.5 rounded-xs border border-[#2D5843] space-y-1">
            <div className="font-heading font-bold text-xs text-[#D9A441] uppercase flex items-center gap-1">
              <Bug className="w-4 h-4" />
              <span>2. Vector Ecology</span>
            </div>
            <p className="text-[11px] text-[#EDE6D6]/80 leading-normal">
              <em>Aedes aegypti</em> bites during daylight (dawn and dusk), flies within 100-200m of its origin, and prefers indoor dark corners.
            </p>
          </div>

          <div className="bg-[#14291F] p-3.5 rounded-xs border border-[#2D5843] space-y-1">
            <div className="font-heading font-bold text-xs text-[#B5432A] uppercase flex items-center gap-1">
              <HeartPulse className="w-4 h-4" />
              <span>3. Human Health</span>
            </div>
            <p className="text-[11px] text-[#EDE6D6]/80 leading-normal">
              Early fever screening, protective clothing, window screens, and rapid hospital reporting halt community outbreak clusters.
            </p>
          </div>
        </div>
      </div>

      {/* THESIS CREDITS & FOOTNOTE */}
      <div className="bg-[#EDE6D6] p-4 rounded-xs border border-[#DDD3C1] text-xs text-[#5C5E54] flex flex-col sm:flex-row items-center justify-between gap-3 font-mono-data">
        <div>
          <strong>Surveillance system:</strong> Dengue risk monitoring for Islamabad / ICT Health.
        </div>
        <div>
          Designed for swap-in with live PMD Weather & Sentinel-2 Satellite APIs.
        </div>
      </div>

    </div>
  );
};
