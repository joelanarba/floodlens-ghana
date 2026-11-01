import React from 'react';
import {
  Activity,
  AlertTriangle,
  Building2,
  Calendar,
  CheckCircle2,
  Compass,
  ExternalLink,
  Filter,
  Info,
  MapPin,
  Navigation,
  Radio,
  RotateCcw,
  Search,
  ShieldAlert,
  Sliders,
  Waves,
  X,
} from 'lucide-react';
import {
  CoordinatePrecision,
  DatasetSummary,
  FilterState,
  FloodEventProperties,
  GeoJSONFeatureCollection,
  GeoJSONPointFeature,
  IoTTelemetryLinkProperties,
  RegionSummaryProperties,
} from '../types/geospatial';
import { DynamicInsights, ProximityAnalysisResult } from '../utils/spatial';

export type SidePanelTab = 'events' | 'inspector' | 'insights' | 'limits';

interface SidePanelProps {
  activeTab: SidePanelTab;
  onChangeTab: (tab: SidePanelTab) => void;
  allFloodEvents: GeoJSONPointFeature<FloodEventProperties>[];
  filteredFloodEvents: GeoJSONPointFeature<FloodEventProperties>[];
  selectedEvent: GeoJSONPointFeature<FloodEventProperties> | null;
  onSelectEvent: (event: GeoJSONPointFeature<FloodEventProperties>) => void;
  filters: FilterState;
  onUpdateFilters: (partial: Partial<FilterState>) => void;
  onResetFilters: () => void;
  proximityRadiusKm: number;
  onChangeProximityRadius: (radiusKm: number) => void;
  proximityAnalysis: ProximityAnalysisResult | null;
  dynamicInsights: DynamicInsights;
  datasetSummary: DatasetSummary | null;
  iotLinks: GeoJSONFeatureCollection<{
    type: 'Feature';
    geometry: { type: 'LineString'; coordinates: [number, number][] };
    properties: IoTTelemetryLinkProperties;
  }> | null;
  onFlyToLocation: (center: [number, number], zoom?: number) => void;
  onOpenMethodologyModal: () => void;
  mobilePanelOpen: boolean;
  onCloseMobilePanel: () => void;
}

const PRECISION_LABELS: Record<
  CoordinatePrecision,
  { label: string; badgeClass: string }
> = {
  exact_locality: {
    label: 'Exact Locality / River Point',
    badgeClass: 'bg-[#E1F0EE] text-[#0F544C] border-[#A7D4CE]',
  },
  district_centroid: {
    label: 'ADM2 District Centroid',
    badgeClass: 'bg-[#F5EBD9] text-[#7D5315] border-[#DEC292]',
  },
  basin_polygon_centroid: {
    label: 'Basin Polygon Centroid',
    badgeClass: 'bg-[#E3EBF2] text-[#1D4E78] border-[#B3C8DC]',
  },
  regional_approximation: {
    label: 'Regional Approximation',
    badgeClass: 'bg-[#F4E3E1] text-[#8C322B] border-[#DEB2AD]',
  },
};

const SEVERITY_BADGE: Record<string, string> = {
  Extreme: 'bg-[#B64B43] text-white',
  High: 'bg-[#C58B35] text-[#142C38] font-bold',
  Moderate: 'bg-[#142C38] text-[#F6F7F3]',
};

const SOURCE_BADGE: Record<string, string> = {
  DFO: 'bg-[#1D4E78] text-white',
  GDACS: 'bg-[#18766B] text-white',
  IDMC: 'bg-[#7D5315] text-white',
  GLIDE: 'bg-[#3C525E] text-white',
};

export const SidePanel: React.FC<SidePanelProps> = ({
  activeTab,
  onChangeTab,
  allFloodEvents,
  filteredFloodEvents,
  selectedEvent,
  onSelectEvent,
  filters,
  onUpdateFilters,
  onResetFilters,
  proximityRadiusKm,
  onChangeProximityRadius,
  proximityAnalysis,
  dynamicInsights,
  datasetSummary,
  iotLinks,
  onFlyToLocation,
  onOpenMethodologyModal,
  mobilePanelOpen,
  onCloseMobilePanel,
}) => {
  const regionsList = React.useMemo(() => {
    const set = new Set(allFloodEvents.map((e) => e.properties.region));
    if (datasetSummary?.regions) {
      datasetSummary.regions.forEach((r) => set.add(r.adm1_name));
    }
    return Array.from(set).sort();
  }, [allFloodEvents, datasetSummary]);

  const hasActiveFilters =
    filters.searchQuery.trim() !== '' ||
    filters.selectedRegion !== 'ALL' ||
    filters.selectedSource !== 'ALL' ||
    filters.selectedSeverity !== 'ALL' ||
    filters.yearRange[0] !== 1988 ||
    filters.yearRange[1] !== 2026 ||
    filters.onlyUnmonitored15km;

  const sortedEvents = React.useMemo(() => {
    return [...filteredFloodEvents].sort((a, b) =>
      b.properties.start_date.localeCompare(a.properties.start_date)
    );
  }, [filteredFloodEvents]);

  return (
    <aside
      id="exploration-side-panel"
      aria-label="FloodLens Ghana analysis and exploration controls"
      className={`
        fixed lg:static inset-x-0 bottom-0 top-[53px] z-20
        w-full lg:w-[440px] xl:w-[470px] shrink-0
        bg-[#F6F7F3] border-r border-[#C8D1CD]
        flex flex-col h-[calc(100vh-53px)] overflow-hidden
        transition-transform duration-200 ease-out
        ${mobilePanelOpen ? 'translate-y-0' : 'translate-y-full lg:translate-y-0'}
      `}
    >
      {/* Mobile Drawer Header */}
      <div className="lg:hidden bg-[#142C38] text-[#F6F7F3] px-4 py-2 flex items-center justify-between border-b border-[#244352]">
        <span className="text-xs font-semibold uppercase tracking-wider text-[#9BD5CD]">
          Exploration &amp; Spatial Analysis Panel
        </span>
        <button
          type="button"
          onClick={onCloseMobilePanel}
          className="p-1 rounded text-[#B5C2C9] hover:text-white cursor-pointer"
          aria-label="Close panel and return to map"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Persistent Core Geographic Insight Banner */}
      <div className="bg-[#EBECE6] border-b border-[#CFD6D2] px-3.5 py-2.5 shrink-0">
        <div className="flex items-center justify-between gap-2">
          <span className="text-[11px] font-bold uppercase tracking-wider text-[#18766B] flex items-center gap-1.5">
            <Waves className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
            Core Geographic Finding ({dynamicInsights.eventCount} Events in Scope)
          </span>
          <span className="font-mono-code text-[11px] font-semibold text-[#142C38] bg-[#DCE3DF] px-1.5 py-0.5 rounded">
            {dynamicInsights.yearSpanText}
          </span>
        </div>

        <div className="grid grid-cols-3 gap-2 mt-2">
          <div className="bg-[#F6F7F3] border border-[#D4DBD7] rounded p-2">
            <div className="text-[10px] uppercase font-semibold text-[#526875]">
              No Gauge &le;15 km
            </div>
            <div
              className="text-base font-bold text-[#B64B43] font-mono-code mt-0.5"
              data-testid="metric-unmonitored-pct"
            >
              {dynamicInsights.unmonitored15kmPct}%
            </div>
            <div className="text-[10px] text-[#526875]">
              {dynamicInsights.unmonitored15kmCount} of {dynamicInsights.eventCount} floods
            </div>
          </div>

          <div className="bg-[#F6F7F3] border border-[#D4DBD7] rounded p-2">
            <div className="text-[10px] uppercase font-semibold text-[#526875]">
              Avg Dist to Gauge
            </div>
            <div
              className="text-base font-bold text-[#142C38] font-mono-code mt-0.5"
              data-testid="metric-avg-station-km"
            >
              {dynamicInsights.avgNearestGroundtruthedKm} km
            </div>
            <div className="text-[10px] text-[#526875]">
              Groundtruthed river gauge
            </div>
          </div>

          <div className="bg-[#F6F7F3] border border-[#D4DBD7] rounded p-2">
            <div className="text-[10px] uppercase font-semibold text-[#526875]">
              Avg Dist to Hospital
            </div>
            <div
              className="text-base font-bold text-[#1D4E78] font-mono-code mt-0.5"
              data-testid="metric-avg-hospital-km"
            >
              {dynamicInsights.avgNearestHospitalKm} km
            </div>
            <div className="text-[10px] text-[#526875]">
              6x closer than gauges
            </div>
          </div>
        </div>
      </div>

      {/* Navigation Tabs */}
      <nav
        className="grid grid-cols-4 bg-[#E2E6E1] border-b border-[#C8D1CD] shrink-0"
        aria-label="Analysis panel tabs"
      >
        {(
          [
            {
              id: 'events',
              label: `Events (${filteredFloodEvents.length})`,
              icon: Filter,
            },
            {
              id: 'inspector',
              label: 'Inspector',
              icon: Compass,
            },
            {
              id: 'insights',
              label: 'Insights',
              icon: Activity,
            },
            {
              id: 'limits',
              label: 'Caveats',
              icon: ShieldAlert,
            },
          ] as { id: SidePanelTab; label: string; icon: React.ElementType }[]
        ).map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => onChangeTab(tab.id)}
              data-testid={`tab-${tab.id}`}
              className={`py-2.5 px-1.5 text-xs font-semibold flex items-center justify-center gap-1.5 border-b-2 transition-colors cursor-pointer ${
                isActive
                  ? 'border-[#18766B] bg-[#F6F7F3] text-[#142C38]'
                  : 'border-transparent text-[#526875] hover:text-[#142C38] hover:bg-[#ECEFEA]'
              }`}
              aria-current={isActive ? 'page' : undefined}
            >
              <Icon className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
              <span className="truncate">{tab.label}</span>
            </button>
          );
        })}
      </nav>

      {/* Tab Content Container */}
      <div className="flex-1 overflow-y-auto p-3.5 space-y-3.5">
        {/* TAB 1: EVENTS EXPLORER & FILTERS */}
        {activeTab === 'events' && (
          <>
            {/* Search and Filter Controls Card */}
            <div className="bg-white border border-[#D4DBD7] rounded p-3 space-y-2.5 shadow-2xs">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-[#142C38] flex items-center gap-1.5">
                  <Sliders className="w-3.5 h-3.5 text-[#18766B]" />
                  Search &amp; Filter Records
                </span>
                {hasActiveFilters && (
                  <button
                    type="button"
                    onClick={onResetFilters}
                    data-testid="reset-filters-btn"
                    className="inline-flex items-center gap-1 text-xs font-semibold text-[#B64B43] hover:underline cursor-pointer"
                  >
                    <RotateCcw className="w-3 h-3" />
                    Reset Filters
                  </button>
                )}
              </div>

              {/* Search Input */}
              <div className="relative">
                <Search className="w-4 h-4 text-[#667782] absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="text"
                  value={filters.searchQuery}
                  onChange={(e) =>
                    onUpdateFilters({ searchQuery: e.target.value })
                  }
                  placeholder="Search river, district, city, cause, or GLIDE ID..."
                  aria-label="Search flood events"
                  data-testid="search-events-input"
                  className="w-full pl-8 pr-7 py-1.5 text-xs bg-[#F6F7F3] border border-[#C8D1CD] rounded text-[#142C38] placeholder-[#667782] focus:outline-none focus:border-[#18766B]"
                />
                {filters.searchQuery && (
                  <button
                    type="button"
                    onClick={() => onUpdateFilters({ searchQuery: '' })}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-[#667782] hover:text-[#142C38] cursor-pointer"
                    aria-label="Clear search query"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              {/* Region, Source, Severity Dropdowns */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                <div>
                  <label
                    htmlFor="filter-region"
                    className="block text-[10px] font-semibold uppercase text-[#526875] mb-1"
                  >
                    Region
                  </label>
                  <select
                    id="filter-region"
                    data-testid="filter-region-select"
                    value={filters.selectedRegion}
                    onChange={(e) =>
                      onUpdateFilters({ selectedRegion: e.target.value })
                    }
                    className="w-full text-xs bg-[#F6F7F3] border border-[#C8D1CD] rounded px-2 py-1.5 text-[#142C38] focus:outline-none focus:border-[#18766B]"
                  >
                    <option value="ALL">All 16 Regions</option>
                    {regionsList.map((reg) => (
                      <option key={reg} value={reg}>
                        {reg}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label
                    htmlFor="filter-source"
                    className="block text-[10px] font-semibold uppercase text-[#526875] mb-1"
                  >
                    Source Catalog
                  </label>
                  <select
                    id="filter-source"
                    data-testid="filter-source-select"
                    value={filters.selectedSource}
                    onChange={(e) =>
                      onUpdateFilters({ selectedSource: e.target.value })
                    }
                    className="w-full text-xs bg-[#F6F7F3] border border-[#C8D1CD] rounded px-2 py-1.5 text-[#142C38] focus:outline-none focus:border-[#18766B]"
                  >
                    <option value="ALL">All Sources (65)</option>
                    <option value="GDACS">GDACS / GloFAS</option>
                    <option value="DFO">Dartmouth Flood Obs (DFO)</option>
                    <option value="IDMC">IDMC GIDD</option>
                    <option value="GLIDE">UN OCHA GLIDE</option>
                  </select>
                </div>

                <div>
                  <label
                    htmlFor="filter-severity"
                    className="block text-[10px] font-semibold uppercase text-[#526875] mb-1"
                  >
                    Severity Class
                  </label>
                  <select
                    id="filter-severity"
                    data-testid="filter-severity-select"
                    value={filters.selectedSeverity}
                    onChange={(e) =>
                      onUpdateFilters({ selectedSeverity: e.target.value })
                    }
                    className="w-full text-xs bg-[#F6F7F3] border border-[#C8D1CD] rounded px-2 py-1.5 text-[#142C38] focus:outline-none focus:border-[#18766B]"
                  >
                    <option value="ALL">All Severities</option>
                    <option value="Extreme">Extreme</option>
                    <option value="High">High</option>
                    <option value="Moderate">Moderate</option>
                  </select>
                </div>
              </div>

              {/* Temporal Period Presets */}
              <div>
                <span className="block text-[10px] font-semibold uppercase text-[#526875] mb-1">
                  Temporal Window ({filters.yearRange[0]} to {filters.yearRange[1]})
                </span>
                <div className="grid grid-cols-4 gap-1.5">
                  {(
                    [
                      { label: 'All (1988-2026)', range: [1988, 2026] },
                      { label: '1988-2009', range: [1988, 2009] },
                      { label: '2010-2019', range: [2010, 2019] },
                      { label: '2020-2026', range: [2020, 2026] },
                    ] as { label: string; range: [number, number] }[]
                  ).map((preset) => {
                    const active =
                      filters.yearRange[0] === preset.range[0] &&
                      filters.yearRange[1] === preset.range[1];
                    return (
                      <button
                        key={preset.label}
                        type="button"
                        onClick={() =>
                          onUpdateFilters({ yearRange: preset.range })
                        }
                        className={`px-1.5 py-1 text-[11px] font-medium rounded border transition-colors cursor-pointer ${
                          active
                            ? 'bg-[#142C38] text-white border-[#142C38]'
                            : 'bg-[#F6F7F3] text-[#425560] border-[#C8D1CD] hover:bg-[#E5EAE6]'
                        }`}
                      >
                        {preset.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Monitoring Gap Quick Toggle */}
              <label className="flex items-center justify-between gap-2 pt-1.5 border-t border-[#E6EBE8] cursor-pointer">
                <span className="text-xs font-medium text-[#142C38]">
                  Only show floods &gt;15 km from any groundtruthed river gauge
                </span>
                <input
                  type="checkbox"
                  checked={filters.onlyUnmonitored15km}
                  onChange={(e) =>
                    onUpdateFilters({ onlyUnmonitored15km: e.target.checked })
                  }
                  data-testid="filter-unmonitored-checkbox"
                  className="accent-[#18766B] w-4 h-4 cursor-pointer"
                />
              </label>
            </div>

            {/* Filtered Event List */}
            {sortedEvents.length === 0 ? (
              <div
                className="bg-white border border-[#D4DBD7] rounded p-6 text-center space-y-2"
                data-testid="empty-events-state"
              >
                <AlertTriangle className="w-7 h-7 text-[#C58B35] mx-auto" />
                <div className="text-sm font-bold text-[#142C38]">
                  No Documented Flood Events Match Active Filters
                </div>
                <p className="text-xs text-[#526875]">
                  Try broadening your search keywords, selecting all regions, or resetting the temporal window.
                </p>
                <button
                  type="button"
                  onClick={onResetFilters}
                  className="mt-2 inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded bg-[#18766B] text-white hover:bg-[#135E55] cursor-pointer"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  Reset All Filters
                </button>
              </div>
            ) : (
              <div className="space-y-2" data-testid="events-list-container">
                {sortedEvents.map((ev) => {
                  const p = ev.properties;
                  const isSelected = selectedEvent?.properties.id === p.id;
                  const unmonitored = p.groundtruthed_stations_within_15km === 0;
                  return (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => onSelectEvent(ev)}
                      data-testid={`event-card-${p.id}`}
                      className={`w-full text-left rounded border p-3 transition-all cursor-pointer block ${
                        isSelected
                          ? 'bg-[#E9F2F0] border-[#18766B] ring-1 ring-[#18766B]'
                          : 'bg-white border-[#D4DBD7] hover:border-[#8FA69E] hover:bg-[#FAFBF9]'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span
                            className={`px-1.5 py-0.5 text-[10px] font-bold uppercase rounded ${
                              SEVERITY_BADGE[p.severity_label] ||
                              'bg-[#142C38] text-white'
                            }`}
                          >
                            {p.severity_label}
                          </span>
                          <span
                            className={`px-1.5 py-0.5 text-[10px] font-mono-code font-semibold rounded ${
                              SOURCE_BADGE[p.primary_source] ||
                              'bg-[#3C525E] text-white'
                            }`}
                          >
                            {p.primary_source}
                          </span>
                          {unmonitored && (
                            <span className="px-1.5 py-0.5 text-[10px] font-semibold rounded bg-[#F4E3E1] text-[#8C322B] border border-[#DEB2AD]">
                              No Gauge &le;15 km
                            </span>
                          )}
                        </div>
                        <span className="text-[11px] font-mono-code text-[#526875] shrink-0 flex items-center gap-1">
                          <Calendar className="w-3 h-3" />
                          {p.start_date}
                        </span>
                      </div>

                      <div className="text-xs font-bold text-[#142C38] mt-1.5 leading-snug">
                        {p.title}
                      </div>

                      <div className="text-[11px] text-[#526875] mt-1 flex items-center justify-between gap-2">
                        <span className="truncate">
                          {p.district}, {p.region} Region ({p.rivers})
                        </span>
                      </div>

                      <div className="mt-2 pt-2 border-t border-[#ECEFEA] grid grid-cols-2 gap-2 text-[11px]">
                        <div className="text-[#425560]">
                          Nearest Gauge:{' '}
                          <strong className="font-mono-code text-[#142C38]">
                            {p.nearest_groundtruthed_station_km} km
                          </strong>
                        </div>
                        <div className="text-[#425560]">
                          Nearest Hospital:{' '}
                          <strong className="font-mono-code text-[#1D4E78]">
                            {p.nearest_hospital_km} km
                          </strong>
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </>
        )}

        {/* TAB 2: EVENT & PROXIMITY INSPECTOR */}
        {activeTab === 'inspector' && (
          <>
            {!selectedEvent ? (
              <div className="bg-white border border-[#D4DBD7] rounded p-4 space-y-3">
                <div className="flex items-center gap-2 text-[#142C38] font-bold text-sm">
                  <Compass className="w-4 h-4 text-[#18766B]" />
                  <span>Select a Documented Flood Event to Inspect</span>
                </div>
                <p className="text-xs text-[#526875] leading-relaxed">
                  Click any flood marker on the map or choose one of the landmark historical flood events below to inspect coordinate precision, nearby clinical infrastructure, and river gauge coverage.
                </p>
                <div className="space-y-1.5 pt-1">
                  <div className="text-[10px] font-bold uppercase tracking-wider text-[#667782]">
                    Landmark Ghana Flood Records
                  </div>
                  {allFloodEvents.slice(0, 4).map((ev) => (
                    <button
                      key={ev.properties.id}
                      type="button"
                      onClick={() => onSelectEvent(ev)}
                      className="w-full text-left p-2 rounded bg-[#F6F7F3] hover:bg-[#E7ECE9] border border-[#D4DBD7] text-xs flex items-center justify-between gap-2 cursor-pointer"
                    >
                      <span className="font-semibold text-[#142C38] truncate">
                        {ev.properties.title}
                      </span>
                      <span className="font-mono-code text-[11px] text-[#18766B] shrink-0">
                        {ev.properties.start_date}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <div className="space-y-3" data-testid="event-inspector-detail">
                {/* Event Header Card */}
                <div className="bg-white border border-[#D4DBD7] rounded p-3.5 space-y-2.5 shadow-2xs">
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span
                        className={`px-2 py-0.5 text-[10px] font-bold uppercase rounded ${
                          SEVERITY_BADGE[
                            selectedEvent.properties.severity_label
                          ]
                        }`}
                      >
                        {selectedEvent.properties.severity_label} Severity
                      </span>
                      {selectedEvent.properties.all_sources.map((src) => (
                        <span
                          key={src}
                          className={`px-1.5 py-0.5 text-[10px] font-mono-code font-semibold rounded ${
                            SOURCE_BADGE[src] || 'bg-[#3C525E] text-white'
                          }`}
                        >
                          {src}
                        </span>
                      ))}
                      <span className="font-mono-code text-[11px] text-[#526875]">
                        ID: {selectedEvent.properties.id}
                      </span>
                    </div>

                    <button
                      type="button"
                      onClick={() =>
                        onFlyToLocation(
                          selectedEvent.geometry.coordinates,
                          9.5
                        )
                      }
                      className="inline-flex items-center gap-1 px-2 py-1 text-[11px] font-semibold rounded bg-[#18766B] text-white hover:bg-[#135E55] cursor-pointer"
                    >
                      <Navigation className="w-3 h-3" />
                      Center on Map
                    </button>
                  </div>

                  <h2 className="text-sm font-bold text-[#142C38] leading-snug">
                    {selectedEvent.properties.title}
                  </h2>

                  <p className="text-xs text-[#425560] leading-relaxed">
                    {selectedEvent.properties.description}
                  </p>

                  <div className="grid grid-cols-2 gap-2 pt-2 border-t border-[#E6EBE8] text-xs">
                    <div>
                      <span className="text-[10px] uppercase font-semibold text-[#667782] block">
                        Event Dates
                      </span>
                      <span className="font-mono-code text-[#142C38] font-medium">
                        {selectedEvent.properties.start_date} to{' '}
                        {selectedEvent.properties.end_date}
                      </span>
                    </div>
                    <div>
                      <span className="text-[10px] uppercase font-semibold text-[#667782] block">
                        Admin Location
                      </span>
                      <span className="text-[#142C38] font-medium">
                        {selectedEvent.properties.district},{' '}
                        {selectedEvent.properties.region}
                      </span>
                    </div>
                    <div>
                      <span className="text-[10px] uppercase font-semibold text-[#667782] block">
                        River / Catchment
                      </span>
                      <span className="text-[#142C38] font-medium">
                        {selectedEvent.properties.rivers}
                      </span>
                    </div>
                    <div>
                      <span className="text-[10px] uppercase font-semibold text-[#667782] block">
                        Documented Cause
                      </span>
                      <span className="text-[#142C38] font-medium">
                        {selectedEvent.properties.cause}
                      </span>
                    </div>
                    <div>
                      <span className="text-[10px] uppercase font-semibold text-[#667782] block">
                        Displaced / Affected
                      </span>
                      <span className="font-mono-code text-[#142C38] font-semibold">
                        {selectedEvent.properties.displaced_or_affected > 0
                          ? selectedEvent.properties.displaced_or_affected.toLocaleString()
                          : 'Not quantified'}
                      </span>
                    </div>
                    <div>
                      <span className="text-[10px] uppercase font-semibold text-[#667782] block">
                        Reported Fatalities
                      </span>
                      <span className="font-mono-code text-[#142C38] font-semibold">
                        {selectedEvent.properties.fatalities > 0
                          ? selectedEvent.properties.fatalities.toLocaleString()
                          : '0 or unconfirmed'}
                      </span>
                    </div>
                  </div>

                  {/* Coordinate Precision & Caveat Box */}
                  <div className="bg-[#F6F7F3] border border-[#D4DBD7] rounded p-2.5 space-y-1">
                    <div className="flex items-center justify-between gap-2 flex-wrap">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-[#526875]">
                        Geographic Coordinate Precision
                      </span>
                      <span
                        className={`px-1.5 py-0.5 text-[10px] font-semibold rounded border ${
                          PRECISION_LABELS[
                            selectedEvent.properties.coordinate_precision
                          ].badgeClass
                        }`}
                      >
                        {
                          PRECISION_LABELS[
                            selectedEvent.properties.coordinate_precision
                          ].label
                        }
                      </span>
                    </div>
                    <p className="text-[11px] text-[#425560] leading-normal">
                      {selectedEvent.properties.precision_note.replace(/`/g, '')}
                    </p>
                    <div className="text-[10px] font-mono-code text-[#667782]">
                      Coordinates:{' '}
                      {selectedEvent.geometry.coordinates[1].toFixed(4)}N,{' '}
                      {selectedEvent.geometry.coordinates[0].toFixed(4)}E
                      {selectedEvent.properties.glide_number
                        ? ` | GLIDE: ${selectedEvent.properties.glide_number}`
                        : ''}
                    </div>
                  </div>

                  {/* External Source Verification */}
                  <div className="flex items-center justify-between pt-1 text-xs">
                    <span className="text-[11px] text-[#526875] truncate">
                      Source: <strong>{selectedEvent.properties.source_org}</strong>
                    </span>
                    <a
                      href={selectedEvent.properties.source_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-xs font-semibold text-[#18766B] hover:underline shrink-0"
                    >
                      <span>Verify Source Catalog</span>
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  </div>
                </div>

                {/* Proximity Buffer Selector & Distance Analysis */}
                {proximityAnalysis && (
                  <div className="bg-white border border-[#D4DBD7] rounded p-3.5 space-y-3 shadow-2xs">
                    <div className="flex items-center justify-between gap-2 flex-wrap">
                      <span className="text-xs font-bold uppercase tracking-wider text-[#142C38]">
                        Proximity Buffer Radius
                      </span>
                      <div
                        className="inline-flex rounded border border-[#C8D1CD] bg-[#F6F7F3] p-0.5"
                        role="group"
                        aria-label="Select proximity buffer radius in kilometers"
                      >
                        {[5, 10, 15, 25, 50].map((rad) => (
                          <button
                            key={rad}
                            type="button"
                            onClick={() => onChangeProximityRadius(rad)}
                            data-testid={`radius-btn-${rad}`}
                            className={`px-2 py-1 text-xs font-mono-code font-semibold rounded transition-colors cursor-pointer ${
                              proximityRadiusKm === rad
                                ? 'bg-[#18766B] text-white'
                                : 'text-[#425560] hover:text-[#142C38]'
                            }`}
                          >
                            {rad}km
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Nearest Gauge vs Nearest Hospital Comparison */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                      {/* Nearest Groundtruthed Station */}
                      <div className="bg-[#F6F7F3] border border-[#D4DBD7] rounded p-2.5 space-y-1">
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] font-bold uppercase text-[#18766B]">
                            Nearest Groundtruthed Gauge
                          </span>
                          {proximityAnalysis.nearestGroundtruthedStation &&
                          proximityAnalysis.nearestGroundtruthedStation
                            .straightLineKm <= 15 ? (
                            <CheckCircle2 className="w-3.5 h-3.5 text-[#18766B]" />
                          ) : (
                            <AlertTriangle className="w-3.5 h-3.5 text-[#B64B43]" />
                          )}
                        </div>
                        {proximityAnalysis.nearestGroundtruthedStation ? (
                          <>
                            <div className="text-xs font-bold text-[#142C38] truncate">
                              {
                                proximityAnalysis.nearestGroundtruthedStation
                                  .feature.properties.name
                              }
                            </div>
                            <div className="text-sm font-mono-code font-bold text-[#142C38]">
                              {
                                proximityAnalysis.nearestGroundtruthedStation
                                  .straightLineKm
                              }{' '}
                              km{' '}
                              <span className="text-[10px] font-normal text-[#526875]">
                                (straight-line)
                              </span>
                            </div>
                            <button
                              type="button"
                              onClick={() =>
                                onFlyToLocation(
                                  proximityAnalysis.nearestGroundtruthedStation!
                                    .feature.geometry.coordinates,
                                  11
                                )
                              }
                              className="text-[11px] font-semibold text-[#18766B] hover:underline inline-flex items-center gap-1 cursor-pointer"
                            >
                              <MapPin className="w-3 h-3" />
                              Pan to Gauge
                            </button>
                          </>
                        ) : (
                          <div className="text-xs text-[#526875]">
                            No station found
                          </div>
                        )}
                      </div>

                      {/* Nearest Hospital */}
                      <div className="bg-[#F6F7F3] border border-[#D4DBD7] rounded p-2.5 space-y-1">
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] font-bold uppercase text-[#1D4E78]">
                            Nearest Clinical Hospital
                          </span>
                          <Building2 className="w-3.5 h-3.5 text-[#1D4E78]" />
                        </div>
                        {proximityAnalysis.nearestHospital ? (
                          <>
                            <div className="text-xs font-bold text-[#142C38] truncate">
                              {
                                proximityAnalysis.nearestHospital.feature
                                  .properties.name
                              }
                            </div>
                            <div className="text-sm font-mono-code font-bold text-[#1D4E78]">
                              {proximityAnalysis.nearestHospital.straightLineKm}{' '}
                              km{' '}
                              <span className="text-[10px] font-normal text-[#526875]">
                                (straight-line)
                              </span>
                            </div>
                            <div className="text-[10px] text-[#526875] font-mono-code">
                              Est. road distance:{' '}
                              {
                                proximityAnalysis.nearestHospital
                                  .estimatedRoadRangeKm[0]
                              }
                              -
                              {
                                proximityAnalysis.nearestHospital
                                  .estimatedRoadRangeKm[1]
                              }{' '}
                              km
                            </div>
                            <button
                              type="button"
                              onClick={() =>
                                onFlyToLocation(
                                  proximityAnalysis.nearestHospital!.feature
                                    .geometry.coordinates,
                                  12
                                )
                              }
                              className="text-[11px] font-semibold text-[#1D4E78] hover:underline inline-flex items-center gap-1 cursor-pointer"
                            >
                              <MapPin className="w-3 h-3" />
                              Pan to Hospital
                            </button>
                          </>
                        ) : (
                          <div className="text-xs text-[#526875]">
                            No hospital found
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Counts within Selected Radius */}
                    <div className="grid grid-cols-4 gap-1.5 text-center">
                      <div className="bg-[#F6F7F3] border border-[#DCE2DF] rounded p-2">
                        <div className="text-sm font-bold font-mono-code text-[#1D4E78]">
                          {proximityAnalysis.hospitalsInRadiusCount}
                        </div>
                        <div className="text-[10px] text-[#526875]">
                          Hospitals &le;{proximityRadiusKm}km
                        </div>
                      </div>
                      <div className="bg-[#F6F7F3] border border-[#DCE2DF] rounded p-2">
                        <div className="text-sm font-bold font-mono-code text-[#4A7A9E]">
                          {proximityAnalysis.clinicsInRadiusCount}
                        </div>
                        <div className="text-[10px] text-[#526875]">
                          Clinics &le;{proximityRadiusKm}km
                        </div>
                      </div>
                      <div className="bg-[#F6F7F3] border border-[#DCE2DF] rounded p-2">
                        <div className="text-sm font-bold font-mono-code text-[#18766B]">
                          {proximityAnalysis.groundtruthedStationsInRadiusCount}
                        </div>
                        <div className="text-[10px] text-[#526875]">
                          Verified Gauges
                        </div>
                      </div>
                      <div className="bg-[#F6F7F3] border border-[#DCE2DF] rounded p-2">
                        <div className="text-sm font-bold font-mono-code text-[#C58B35]">
                          {proximityAnalysis.iotStationsInRadiusCount}
                        </div>
                        <div className="text-[10px] text-[#526875]">
                          IoT Nodes &le;{proximityRadiusKm}km
                        </div>
                      </div>
                    </div>

                    {/* Nearby Facilities & Stations List */}
                    <div className="space-y-2 pt-1">
                      <div className="text-[11px] font-bold uppercase tracking-wider text-[#526875]">
                        Facilities &amp; Stations Within {proximityRadiusKm} km (
                        {proximityAnalysis.facilitiesInRadius.length +
                          proximityAnalysis.stationsInRadius.length}
                        )
                      </div>

                      {proximityAnalysis.facilitiesInRadius.length === 0 &&
                      proximityAnalysis.stationsInRadius.length === 0 ? (
                        <div className="text-xs text-[#526875] bg-[#F6F7F3] p-2.5 rounded border border-[#DCE2DF]">
                          No registered healthcare facilities or monitoring stations lie within {proximityRadiusKm} km straight-line distance of this coordinate. Increase the buffer radius to 25 km or 50 km to inspect regional coverage.
                        </div>
                      ) : (
                        <div className="max-h-48 overflow-y-auto space-y-1.5 pr-1">
                          {proximityAnalysis.stationsInRadius
                            .slice(0, 8)
                            .map((st) => (
                              <button
                                key={st.feature.properties.id}
                                type="button"
                                onClick={() =>
                                  onFlyToLocation(
                                    st.feature.geometry.coordinates,
                                    12
                                  )
                                }
                                className="w-full text-left p-2 rounded bg-[#F1F6F5] hover:bg-[#E2EFEA] border border-[#C6DDD8] flex items-center justify-between gap-2 text-xs cursor-pointer"
                              >
                                <div className="min-w-0">
                                  <div className="font-semibold text-[#142C38] truncate">
                                    {st.feature.properties.name}
                                  </div>
                                  <div className="text-[10px] text-[#18766B] font-medium">
                                    {st.feature.properties.category_label}
                                  </div>
                                </div>
                                <span className="font-mono-code text-xs font-bold text-[#18766B] shrink-0">
                                  {st.straightLineKm} km
                                </span>
                              </button>
                            ))}

                          {proximityAnalysis.facilitiesInRadius
                            .slice(0, 12)
                            .map((fac) => (
                              <button
                                key={fac.feature.properties.id}
                                type="button"
                                onClick={() =>
                                  onFlyToLocation(
                                    fac.feature.geometry.coordinates,
                                    13
                                  )
                                }
                                className="w-full text-left p-2 rounded bg-[#F6F7F3] hover:bg-[#EAECE7] border border-[#DCE2DF] flex items-center justify-between gap-2 text-xs cursor-pointer"
                              >
                                <div className="min-w-0">
                                  <div className="font-semibold text-[#142C38] truncate">
                                    {fac.feature.properties.name}
                                  </div>
                                  <div className="text-[10px] text-[#526875]">
                                    {fac.feature.properties.facility_type} | Est. road:{' '}
                                    {fac.estimatedRoadRangeKm[0]}-
                                    {fac.estimatedRoadRangeKm[1]} km
                                  </div>
                                </div>
                                <span className="font-mono-code text-xs font-bold text-[#1D4E78] shrink-0">
                                  {fac.straightLineKm} km
                                </span>
                              </button>
                            ))}
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}
          </>
        )}

        {/* TAB 3: DATA-DRIVEN GEOGRAPHIC INSIGHTS */}
        {activeTab === 'insights' && (
          <div className="space-y-3" data-testid="insights-tab-content">
            {/* Insight 1: Central Question Synthesis */}
            <div className="bg-white border border-[#D4DBD7] rounded p-3.5 space-y-2 shadow-2xs">
              <div className="text-[11px] font-bold uppercase tracking-wider text-[#18766B]">
                1. The Monitoring vs. Clinical Proximity Asymmetry
              </div>
              <p className="text-xs text-[#1A262D] leading-relaxed">
                Across Ghana&apos;s{' '}
                <strong>{datasetSummary?.counts.flood_events_total || 65}</strong>{' '}
                harmonized flood events (1988 to 2026), communities and clinical facilities are consistently much closer to documented flood centroids than field-verified river gauges:
              </p>
              <ul className="text-xs text-[#425560] space-y-1.5 pl-4 list-disc">
                <li>
                  <strong>73.8% (48 of 65 events)</strong> occurred more than{' '}
                  <strong>15 km</strong> from any groundtruthed river-level gauge.
                </li>
                <li>
                  The mean distance from a documented flood centroid to the nearest hospital is{' '}
                  <strong className="font-mono-code text-[#1D4E78]">11.0 km</strong>, compared to{' '}
                  <strong className="font-mono-code text-[#B64B43]">67.7 km</strong> to the nearest groundtruthed river gauge.
                </li>
                <li>
                  Of the <strong>229</strong> in-country river gauge stations listed in the UNESCO IHP-WINS catalog, only{' '}
                  <strong>36 (15.7%)</strong> are field-verified as groundtruthed, while{' '}
                  <strong>193</strong> remain unverified legacy catalog entries.
                </li>
              </ul>
            </div>

            {/* Insight 2: UNESCO / GMet / GARNET IoT Telemetry Links */}
            <div className="bg-white border border-[#D4DBD7] rounded p-3.5 space-y-2.5 shadow-2xs">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold uppercase tracking-wider text-[#18766B] flex items-center gap-1.5">
                  <Radio className="w-3.5 h-3.5" />
                  2. UNESCO / GMet LoRaWAN IoT Telemetry Links (14)
                </span>
              </div>
              <p className="text-xs text-[#425560] leading-relaxed">
                To close the White Volta, Oti, and Black Volta monitoring gap, the UNESCO IHP-WINS field mission engineered 14 LoRaWAN radio links pairing river sensors with secondary school and institute gateways. Click any link to inspect it on the map:
              </p>
              <div className="max-h-52 overflow-y-auto border border-[#DCE2DF] rounded divide-y divide-[#E6EBE8]">
                {(iotLinks?.features || []).map((lk) => {
                  const lp = lk.properties;
                  const midCoord = lk.geometry.coordinates[0];
                  return (
                    <button
                      key={lp.id}
                      type="button"
                      onClick={() => onFlyToLocation(midCoord, 10.5)}
                      className="w-full text-left px-2.5 py-2 bg-[#F6F7F3] hover:bg-[#E7ECE9] flex items-center justify-between gap-2 text-xs cursor-pointer"
                    >
                      <div className="min-w-0">
                        <div className="font-bold text-[#142C38] truncate">
                          {lp.package_area}: {lp.sensor_name}
                        </div>
                        <div className="text-[10px] text-[#526875] truncate">
                          Gateway: {lp.gateway_name} ({lp.distance_km} km)
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <span
                          className={`px-1.5 py-0.5 text-[10px] font-bold rounded ${
                            lp.potential.includes('GOOD')
                              ? 'bg-[#E1F0EE] text-[#0F544C]'
                              : lp.potential === 'OK'
                              ? 'bg-[#F5EBD9] text-[#7D5315]'
                              : 'bg-[#F4E3E1] text-[#8C322B]'
                          }`}
                        >
                          {lp.potential}
                        </span>
                        {lp.itwom_path_loss_db && (
                          <div className="text-[10px] font-mono-code text-[#667782] mt-0.5">
                            {lp.itwom_path_loss_db} dB loss
                          </div>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Insight 3: Regional Flood & 100-Year Return Period Exposure Table */}
            <div className="bg-white border border-[#D4DBD7] rounded p-3.5 space-y-2.5 shadow-2xs">
              <div className="text-[11px] font-bold uppercase tracking-wider text-[#18766B]">
                3. Regional Breakdown &amp; HeiGIT RP100 (&ge;30 cm) Exposure
              </div>
              <p className="text-xs text-[#425560]">
                Click any administrative region to filter flood events or compare historical records with modeled 100-year return period (RP100) infrastructure exposure:
              </p>
              <div className="overflow-x-auto border border-[#DCE2DF] rounded">
                <table className="w-full text-left border-collapse text-[11px]">
                  <thead>
                    <tr className="bg-[#142C38] text-[#F6F7F3]">
                      <th className="py-1.5 px-2 font-semibold">Region</th>
                      <th className="py-1.5 px-1.5 font-semibold text-right">
                        Floods
                      </th>
                      <th className="py-1.5 px-1.5 font-semibold text-right">
                        Gauges
                      </th>
                      <th className="py-1.5 px-1.5 font-semibold text-right">
                        Hosp
                      </th>
                      <th className="py-1.5 px-2 font-semibold text-right">
                        RP100 Schools
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#E6EBE8]">
                    {(datasetSummary?.regions || []).map(
                      (r: RegionSummaryProperties) => (
                        <tr
                          key={r.adm1_pcode}
                          onClick={() => {
                            onUpdateFilters({ selectedRegion: r.adm1_name });
                            onFlyToLocation([r.center_lon, r.center_lat], 7.8);
                          }}
                          className="hover:bg-[#E9F2F0] cursor-pointer transition-colors"
                        >
                          <td className="py-1.5 px-2 font-semibold text-[#142C38]">
                            {r.adm1_name}
                          </td>
                          <td className="py-1.5 px-1.5 text-right font-mono-code font-bold text-[#B64B43]">
                            {r.flood_event_count}
                          </td>
                          <td className="py-1.5 px-1.5 text-right font-mono-code text-[#18766B]">
                            {r.groundtruthed_station_count}
                            {r.iot_node_count > 0
                              ? ` (+${r.iot_node_count} IoT)`
                              : ''}
                          </td>
                          <td className="py-1.5 px-1.5 text-right font-mono-code text-[#1D4E78]">
                            {r.hospital_count}
                          </td>
                          <td className="py-1.5 px-2 text-right font-mono-code text-[#425560]">
                            {r.rp100_exposed_schools}
                          </td>
                        </tr>
                      )
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* TAB 4: METHODOLOGY & ANALYTICAL LIMITATIONS */}
        {activeTab === 'limits' && (
          <div className="space-y-3" data-testid="limits-tab-content">
            <div className="bg-white border border-[#D4DBD7] rounded p-3.5 space-y-2.5 shadow-2xs">
              <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-[#B64B43]">
                <ShieldAlert className="w-4 h-4 shrink-0" />
                <span>What This Map Does and Does Not Show</span>
              </div>
              <p className="text-xs text-[#1A262D] leading-relaxed">
                FloodLens Ghana is an evidence-based geographic exploration platform built from official public catalogs. It is <strong>not</strong> an automated flood-forecasting or parcel-level safety certification system.
              </p>
              <div className="space-y-2 text-xs text-[#425560]">
                <div className="bg-[#F6F7F3] p-2.5 rounded border border-[#DCE2DF]">
                  <strong className="text-[#142C38] block">
                    1. Event Centroids vs. Inundation Polygons
                  </strong>
                  Historical flood markers represent documented event centroids (exact river towns, district centroids, or satellite basin centroids). They do not depict street-by-street water depth boundaries.
                </div>
                <div className="bg-[#F6F7F3] p-2.5 rounded border border-[#DCE2DF]">
                  <strong className="text-[#142C38] block">
                    2. Proximity Does Not Prove Facility Inundation
                  </strong>
                  When a hospital or clinic lies within a 5 km or 10 km proximity buffer of a historical flood record, that indicates service-area proximity rather than proof that the building itself flooded.
                </div>
                <div className="bg-[#F6F7F3] p-2.5 rounded border border-[#DCE2DF]">
                  <strong className="text-[#142C38] block">
                    3. Absence of Records Does Not Prove Safety
                  </strong>
                  Reporting density in global catalogs (DFO, GDACS, IDMC, GLIDE) is higher in major river basins (White Volta, Lower Volta, Greater Accra) than in smaller rural catchments. Unmarked areas may still experience localized flash flooding.
                </div>
                <div className="bg-[#F6F7F3] p-2.5 rounded border border-[#DCE2DF]">
                  <strong className="text-[#142C38] block">
                    4. Straight-Line vs. Road Network Distance
                  </strong>
                  Proximity buffers are computed via spherical Haversine distance. The Inspector also reports a 1.35x to 1.85x road-detour range to reflect real-world Ghanaian highway and feeder-road geometry.
                </div>
              </div>

              <button
                type="button"
                onClick={onOpenMethodologyModal}
                className="w-full py-2 px-3 rounded bg-[#142C38] hover:bg-[#1E3F50] text-[#F6F7F3] text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
              >
                <Info className="w-3.5 h-3.5 text-[#9BD5CD]" />
                <span>Open Full Data Sources &amp; AWS Architecture Modal</span>
              </button>
            </div>
          </div>
        )}
      </div>
    </aside>
  );
};
