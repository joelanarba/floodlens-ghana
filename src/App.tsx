import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  BaseMapStyleId,
  DatasetSummary,
  FilterState,
  FloodEventProperties,
  GeoJSONFeatureCollection,
  GeoJSONPointFeature,
  HealthFacilityProperties,
  IoTTelemetryLinkProperties,
  LayerVisibilityState,
  MonitoringStationProperties,
  RegionSummaryProperties,
  RoadProperties,
} from './types/geospatial';
import {
  computeFilteredInsights,
  computeProximityAnalysis,
  filterFloodEvents,
} from './utils/spatial';
import { HeaderBar } from './components/HeaderBar';
import { SidePanel, SidePanelTab } from './components/SidePanel';
import { GhanaMap } from './components/GhanaMap';
import { MethodologyModal } from './components/MethodologyModal';
import { AlertTriangle, Compass, RefreshCw } from 'lucide-react';

const INITIAL_FILTERS: FilterState = {
  searchQuery: '',
  selectedRegion: 'ALL',
  selectedSource: 'ALL',
  selectedSeverity: 'ALL',
  yearRange: [1988, 2026],
  onlyUnmonitored15km: false,
};

const INITIAL_LAYER_VISIBILITY: LayerVisibilityState = {
  floodEvents: true,
  monitoringGroundtruthed: true,
  monitoringIoT: true,
  monitoringLegacy: false,
  iotTelemetryLinks: true,
  healthFacilities: true,
  roadNetwork: true,
  regionChoropleth: true,
};

export const App: React.FC = () => {
  const [loading, setLoading] = useState<boolean>(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [floodEvents, setFloodEvents] = useState<
    GeoJSONPointFeature<FloodEventProperties>[]
  >([]);
  const [monitoringStations, setMonitoringStations] = useState<
    GeoJSONPointFeature<MonitoringStationProperties>[]
  >([]);
  const [iotLinks, setIotLinks] = useState<GeoJSONFeatureCollection<{
    type: 'Feature';
    geometry: { type: 'LineString'; coordinates: [number, number][] };
    properties: IoTTelemetryLinkProperties;
  }> | null>(null);
  const [healthFacilities, setHealthFacilities] = useState<
    GeoJSONPointFeature<HealthFacilityProperties>[]
  >([]);
  const [roads, setRoads] = useState<GeoJSONFeatureCollection<{
    type: 'Feature';
    geometry: {
      type: 'LineString' | 'MultiLineString';
      coordinates: number[][] | number[][][];
    };
    properties: RoadProperties;
  }> | null>(null);
  const [adminRegions, setAdminRegions] = useState<GeoJSONFeatureCollection<{
    type: 'Feature';
    geometry: { type: 'Polygon' | 'MultiPolygon'; coordinates: unknown };
    properties: RegionSummaryProperties;
  }> | null>(null);
  const [datasetSummary, setDatasetSummary] = useState<DatasetSummary | null>(
    null
  );

  // Interactive UI State
  const [baseMapStyle, setBaseMapStyle] = useState<BaseMapStyleId>('aws-light');
  const [activeTab, setActiveTab] = useState<SidePanelTab>('events');
  const [filters, setFilters] = useState<FilterState>(INITIAL_FILTERS);
  const [selectedEvent, setSelectedEvent] =
    useState<GeoJSONPointFeature<FloodEventProperties> | null>(null);
  const [proximityRadiusKm, setProximityRadiusKm] = useState<number>(15);
  const [layerVisibility, setLayerVisibility] = useState<LayerVisibilityState>(
    INITIAL_LAYER_VISIBILITY
  );
  const [methodologyOpen, setMethodologyOpen] = useState<boolean>(false);
  const [mobilePanelOpen, setMobilePanelOpen] = useState<boolean>(false);
  const [resetTrigger, setResetTrigger] = useState<number>(0);
  const [flyToTarget, setFlyToTarget] = useState<{
    center: [number, number];
    zoom: number;
    ts: number;
  } | null>(null);

  const loadGeospatialData = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const [
        floodRes,
        stationRes,
        linksRes,
        facRes,
        roadsRes,
        regionsRes,
        summaryRes,
      ] = await Promise.all([
        fetch('/data/flood_events.geojson'),
        fetch('/data/monitoring_stations.geojson'),
        fetch('/data/iot_telemetry_links.geojson'),
        fetch('/data/health_facilities.geojson'),
        fetch('/data/roads.geojson'),
        fetch('/data/admin_regions.geojson'),
        fetch('/data/dataset_summary.json'),
      ]);

      if (
        !floodRes.ok ||
        !stationRes.ok ||
        !linksRes.ok ||
        !facRes.ok ||
        !roadsRes.ok ||
        !regionsRes.ok ||
        !summaryRes.ok
      ) {
        throw new Error(
          'One or more geospatial datasets returned a non-200 HTTP status.'
        );
      }

      const [
        floodJson,
        stationJson,
        linksJson,
        facJson,
        roadsJson,
        regionsJson,
        summaryJson,
      ] = await Promise.all([
        floodRes.json(),
        stationRes.json(),
        linksRes.json(),
        facRes.json(),
        roadsRes.json(),
        regionsRes.json(),
        summaryRes.json(),
      ]);

      const loadedFloods = (floodJson.features ||
        []) as GeoJSONPointFeature<FloodEventProperties>[];
      setFloodEvents(loadedFloods);
      setMonitoringStations(stationJson.features || []);
      setIotLinks(linksJson);
      setHealthFacilities(facJson.features || []);
      setRoads(roadsJson);
      setAdminRegions(regionsJson);
      setDatasetSummary(summaryJson);

      // Pre-select a landmark flood event without overriding the initial national camera view
      if (loadedFloods.length > 0) {
        const akosombo =
          loadedFloods.find((f) =>
            f.properties.title.toLowerCase().includes('akosombo')
          ) || loadedFloods[0];
        setSelectedEvent(akosombo);
      }
    } catch (err) {
      const message =
        err instanceof Error
          ? err.message
          : 'Failed to load geospatial datasets.';
      setLoadError(message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadGeospatialData();
  }, [loadGeospatialData]);

  const filteredFloodEvents = useMemo(
    () => filterFloodEvents(floodEvents, filters),
    [floodEvents, filters]
  );

  const proximityAnalysis = useMemo(() => {
    if (!selectedEvent) return null;
    return computeProximityAnalysis(
      selectedEvent,
      proximityRadiusKm,
      healthFacilities,
      monitoringStations
    );
  }, [selectedEvent, proximityRadiusKm, healthFacilities, monitoringStations]);

  const dynamicInsights = useMemo(() => {
    return computeFilteredInsights(
      filteredFloodEvents,
      monitoringStations,
      healthFacilities,
      datasetSummary?.regions || [],
      filters.selectedRegion
    );
  }, [
    filteredFloodEvents,
    monitoringStations,
    healthFacilities,
    datasetSummary,
    filters.selectedRegion,
  ]);

  const handleUpdateFilters = useCallback((partial: Partial<FilterState>) => {
    setFilters((prev) => ({ ...prev, ...partial }));
  }, []);

  const handleResetFilters = useCallback(() => {
    setFilters(INITIAL_FILTERS);
  }, []);

  const handleSelectEvent = useCallback(
    (ev: GeoJSONPointFeature<FloodEventProperties>) => {
      setSelectedEvent(ev);
      setActiveTab('inspector');
      setFlyToTarget({
        center: ev.geometry.coordinates,
        zoom: 9.2,
        ts: Date.now(),
      });
    },
    []
  );

  const handleToggleLayer = useCallback(
    (layerKey: keyof LayerVisibilityState) => {
      setLayerVisibility((prev) => ({
        ...prev,
        [layerKey]: !prev[layerKey],
      }));
    },
    []
  );

  const handleResetView = useCallback(() => {
    setResetTrigger((prev) => prev + 1);
  }, []);

  const handleFlyToLocation = useCallback(
    (center: [number, number], zoom = 10) => {
      setFlyToTarget({ center, zoom, ts: Date.now() });
      setMobilePanelOpen(false);
    },
    []
  );

  if (loading) {
    return (
      <div
        className="h-screen w-screen bg-[#142C38] text-[#F6F7F3] flex flex-col items-center justify-center p-6"
        data-testid="loading-screen"
      >
        <div className="w-12 h-12 rounded bg-[#18766B] flex items-center justify-center border border-[#299488] animate-pulse mb-4">
          <Compass className="w-6 h-6 text-[#F6F7F3]" />
        </div>
        <h1 className="text-lg font-bold tracking-tight">
          Loading FloodLens Ghana Geospatial Catalog...
        </h1>
        <p className="text-xs text-[#9BD5CD] mt-1 font-mono-code">
          Initializing historical flood records, UNESCO/GMet telemetry, and clinical infrastructure
        </p>
      </div>
    );
  }

  if (loadError) {
    return (
      <div
        className="h-screen w-screen bg-[#F6F7F3] text-[#142C38] flex flex-col items-center justify-center p-6"
        data-testid="error-screen"
      >
        <div className="max-w-md w-full bg-white border border-[#DEB2AD] rounded p-6 text-center space-y-3 shadow-md">
          <AlertTriangle className="w-8 h-8 text-[#B64B43] mx-auto" />
          <h1 className="text-base font-bold text-[#142C38]">
            Unable to Load Geospatial Datasets
          </h1>
          <p className="text-xs text-[#526875] font-mono-code">{loadError}</p>
          <button
            type="button"
            onClick={loadGeospatialData}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded bg-[#18766B] hover:bg-[#135E55] text-white text-xs font-semibold cursor-pointer"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            Retry Loading Datasets
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen w-screen flex flex-col overflow-hidden bg-[#F6F7F3] text-[#1A262D]">
      <HeaderBar
        baseMapStyle={baseMapStyle}
        onChangeBaseMapStyle={setBaseMapStyle}
        onResetView={handleResetView}
        onOpenMethodology={() => setMethodologyOpen(true)}
        filteredCount={filteredFloodEvents.length}
        totalCount={floodEvents.length}
        mobilePanelOpen={mobilePanelOpen}
        onToggleMobilePanel={() => setMobilePanelOpen((prev) => !prev)}
      />

      <main className="flex-1 flex overflow-hidden relative">
        <SidePanel
          activeTab={activeTab}
          onChangeTab={setActiveTab}
          allFloodEvents={floodEvents}
          filteredFloodEvents={filteredFloodEvents}
          selectedEvent={selectedEvent}
          onSelectEvent={handleSelectEvent}
          filters={filters}
          onUpdateFilters={handleUpdateFilters}
          onResetFilters={handleResetFilters}
          proximityRadiusKm={proximityRadiusKm}
          onChangeProximityRadius={setProximityRadiusKm}
          proximityAnalysis={proximityAnalysis}
          dynamicInsights={dynamicInsights}
          datasetSummary={datasetSummary}
          iotLinks={iotLinks}
          onFlyToLocation={handleFlyToLocation}
          onOpenMethodologyModal={() => setMethodologyOpen(true)}
          mobilePanelOpen={mobilePanelOpen}
          onCloseMobilePanel={() => setMobilePanelOpen(false)}
        />

        <GhanaMap
          baseMapStyle={baseMapStyle}
          filteredFloodEvents={filteredFloodEvents}
          selectedEvent={selectedEvent}
          onSelectEvent={handleSelectEvent}
          monitoringStations={monitoringStations}
          iotLinks={iotLinks}
          healthFacilities={healthFacilities}
          roads={roads}
          adminRegions={adminRegions}
          proximityRadiusKm={proximityRadiusKm}
          proximityAnalysis={proximityAnalysis}
          layerVisibility={layerVisibility}
          onToggleLayer={handleToggleLayer}
          resetTrigger={resetTrigger}
          flyToTarget={flyToTarget}
        />
      </main>

      <MethodologyModal
        isOpen={methodologyOpen}
        onClose={() => setMethodologyOpen(false)}
        datasetSummary={datasetSummary}
      />
    </div>
  );
};

export default App;
