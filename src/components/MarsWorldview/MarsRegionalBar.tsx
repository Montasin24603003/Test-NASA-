import React from 'react';
import { MARS_REGIONAL_PROFILES, type MarsRegionProfile } from '@/lib/mars-trek';
import { Mountain, Droplets, ShieldAlert, Sparkles, ChevronRight } from 'lucide-react';

export interface MarsRegionalBarProps {
  selectedRegionId?: string;
  onSelectRegion: (region: MarsRegionProfile) => void;
}

export function MarsRegionalBar({
  selectedRegionId,
  onSelectRegion,
}: MarsRegionalBarProps) {
  return (
    <div className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-3 shadow-sm">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <Mountain className="size-4 text-amber-500" />
          <h3 className="font-display text-xs font-semibold uppercase tracking-wider text-slate-800 dark:text-slate-200">
            Martian Regional Exploration Sectors (7 Key Provinces)
          </h3>
        </div>
        <span className="text-[10px] font-mono text-slate-400">
          Click region to focus camera &amp; load regional geology
        </span>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2">
        {MARS_REGIONAL_PROFILES.map((region) => {
          const isSelected = selectedRegionId === region.id;
          return (
            <button
              key={region.id}
              type="button"
              onClick={() => onSelectRegion(region)}
              className={`p-2.5 rounded-xl border text-left transition-all ${
                isSelected
                  ? 'border-amber-500 bg-amber-500/10 text-amber-900 dark:text-amber-100 shadow-sm ring-1 ring-amber-500'
                  : 'border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-850/50 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="font-display text-xs font-bold truncate">{region.name.split(' ')[0]}</span>
                <span className="text-[9px] font-mono px-1 rounded bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300">
                  {region.elevationMeters >= 0 ? `+${(region.elevationMeters / 1000).toFixed(1)}k` : `${(region.elevationMeters / 1000).toFixed(1)}k`}
                </span>
              </div>
              <p className="text-[10px] text-slate-500 dark:text-slate-400 truncate mt-0.5">
                {region.tagline}
              </p>
              <div className="mt-2 flex items-center justify-between text-[9px] font-mono text-slate-400">
                <span>{region.center[0]}°, {region.center[1]}°</span>
                <ChevronRight className="size-3 text-slate-400" />
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
