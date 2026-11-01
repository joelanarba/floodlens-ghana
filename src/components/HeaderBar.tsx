import React from 'react';
import {
  Compass,
  Database,
  Layers,
  MapPin,
  RotateCcw,
  ShieldCheck,
  SlidersHorizontal,
} from 'lucide-react';
import { BaseMapStyleId } from '../types/geospatial';
import { getBaseMapConfig } from '../utils/mapStyles';

interface HeaderBarProps {
  baseMapStyle: BaseMapStyleId;
  onChangeBaseMapStyle: (style: BaseMapStyleId) => void;
  onResetView: () => void;
  onOpenMethodology: () => void;
  filteredCount: number;
  totalCount: number;
  mobilePanelOpen: boolean;
  onToggleMobilePanel: () => void;
}

export const HeaderBar: React.FC<HeaderBarProps> = ({
  baseMapStyle,
  onChangeBaseMapStyle,
  onResetView,
  onOpenMethodology,
  filteredCount,
  totalCount,
  mobilePanelOpen,
  onToggleMobilePanel,
}) => {
  const mapConfig = getBaseMapConfig(baseMapStyle);

  return (
    <header className="bg-[#142C38] text-[#F6F7F3] border-b border-[#244352] px-3 sm:px-5 py-2.5 flex flex-wrap items-center justify-between gap-2 z-30 shrink-0">
      {/* Brand and Title */}
      <div className="flex items-center gap-3 min-w-0">
        <div className="w-9 h-9 rounded bg-[#18766B] flex items-center justify-center shrink-0 border border-[#299488]">
          <Compass className="w-5 h-5 text-[#F6F7F3]" aria-hidden="true" />
        </div>
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-base sm:text-lg font-bold tracking-tight text-[#F6F7F3] truncate">
              FloodLens Ghana
            </h1>
            <span className="hidden md:inline-flex items-center gap-1 px-2 py-0.5 text-[11px] font-medium bg-[#1D3B4A] text-[#9BD5CD] rounded border border-[#2C5568]">
              <ShieldCheck className="w-3 h-3" aria-hidden="true" />
              Evidence-Based Geospatial Observatory
            </span>
          </div>
          <p className="text-xs text-[#B5C2C9] truncate hidden sm:block">
            Historical flood records (1988 to 2026), clinical infrastructure proximity &amp; UNESCO/GMet hydrological telemetry
          </p>
        </div>
      </div>

      {/* Controls & AWS Status */}
      <div className="flex items-center gap-2 flex-wrap">
        {/* AWS Location Service Status Pill */}
        <div
          className="hidden xl:flex items-center gap-1.5 px-2.5 py-1 rounded bg-[#0E2029] border border-[#244352] text-xs text-[#C7D2D8]"
          title={`Active Map Provider: ${mapConfig.providerBadge}`}
        >
          <MapPin className="w-3.5 h-3.5 text-[#18766B]" aria-hidden="true" />
          <span className="font-mono-code text-[11px]">{mapConfig.providerBadge}</span>
        </div>

        {/* Basemap Style Selector */}
        <div
          className="inline-flex items-center bg-[#0E2029] p-0.5 rounded border border-[#244352]"
          role="group"
          aria-label="Base map style selector"
        >
          <Layers className="w-3.5 h-3.5 text-[#8FA3AE] ml-2 mr-1 hidden sm:inline" aria-hidden="true" />
          {(
            [
              { id: 'aws-light', label: 'AWS Light' },
              { id: 'aws-dark', label: 'AWS Dark' },
              { id: 'carto-positron', label: 'Open Vector' },
            ] as { id: BaseMapStyleId; label: string }[]
          ).map((opt) => (
            <button
              key={opt.id}
              type="button"
              onClick={() => onChangeBaseMapStyle(opt.id)}
              className={`px-2 py-1 text-xs font-medium rounded transition-colors cursor-pointer ${
                baseMapStyle === opt.id
                  ? 'bg-[#18766B] text-white'
                  : 'text-[#B5C2C9] hover:text-white'
              }`}
              aria-pressed={baseMapStyle === opt.id}
            >
              {opt.label}
            </button>
          ))}
        </div>

        {/* Reset Map View */}
        <button
          type="button"
          onClick={onResetView}
          className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium rounded bg-[#1D3B4A] hover:bg-[#274D60] text-[#F6F7F3] border border-[#2F596E] transition-colors cursor-pointer"
          title="Reset map camera to full Ghana extent"
        >
          <RotateCcw className="w-3.5 h-3.5" aria-hidden="true" />
          <span className="hidden sm:inline">Reset Ghana View</span>
        </button>

        {/* Data & Methodology Modal Trigger */}
        <button
          type="button"
          onClick={onOpenMethodology}
          className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium rounded bg-[#C58B35] hover:bg-[#B07A2A] text-[#142C38] font-semibold transition-colors cursor-pointer"
        >
          <Database className="w-3.5 h-3.5" aria-hidden="true" />
          <span>Sources &amp; Methodology</span>
        </button>

        {/* Mobile Panel Toggle Button */}
        <button
          type="button"
          onClick={onToggleMobilePanel}
          className="lg:hidden inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-semibold rounded bg-[#18766B] text-white border border-[#299488] cursor-pointer"
          aria-expanded={mobilePanelOpen}
          aria-controls="exploration-side-panel"
        >
          <SlidersHorizontal className="w-3.5 h-3.5" aria-hidden="true" />
          <span>
            {mobilePanelOpen ? 'Map View' : `Explore (${filteredCount}/${totalCount})`}
          </span>
        </button>
      </div>
    </header>
  );
};
