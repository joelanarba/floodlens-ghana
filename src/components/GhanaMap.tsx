import React, { useEffect, useRef, useState } from 'react';
import maplibregl from 'maplibre-gl';
import {
  BaseMapStyleId,
  FloodEventProperties,
  GeoJSONFeatureCollection,
  GeoJSONPointFeature,
  HealthFacilityProperties,
  IoTTelemetryLinkProperties,
  LayerVisibilityState,
  MonitoringStationProperties,
  RegionSummaryProperties,
  RoadProperties,
} from '../types/geospatial';
import { createCirclePolygon, ProximityAnalysisResult } from '../utils/spatial';
import { getBaseMapConfig, getFallbackStyleUrl } from '../utils/mapStyles';
import {
  ChevronDown,
  ChevronUp,
  Eye,
  EyeOff,
  Info,
  Layers,
  Radio,
} from 'lucide-react';

interface GhanaMapProps {
  baseMapStyle: BaseMapStyleId;
  filteredFloodEvents: GeoJSONPointFeature<FloodEventProperties>[];
  selectedEvent: GeoJSONPointFeature<FloodEventProperties> | null;
  onSelectEvent: (event: GeoJSONPointFeature<FloodEventProperties>) => void;
  monitoringStations: GeoJSONPointFeature<MonitoringStationProperties>[];
  iotLinks: GeoJSONFeatureCollection<{
    type: 'Feature';
    geometry: { type: 'LineString'; coordinates: [number, number][] };
    properties: IoTTelemetryLinkProperties;
  }> | null;
  healthFacilities: GeoJSONPointFeature<HealthFacilityProperties>[];
  roads: GeoJSONFeatureCollection<{
    type: 'Feature';
    geometry: {
      type: 'LineString' | 'MultiLineString';
      coordinates: number[][] | number[][][];
    };
    properties: RoadProperties;
  }> | null;
  adminRegions: GeoJSONFeatureCollection<{
    type: 'Feature';
    geometry: { type: 'Polygon' | 'MultiPolygon'; coordinates: unknown };
    properties: RegionSummaryProperties;
  }> | null;
  proximityRadiusKm: number;
  proximityAnalysis: ProximityAnalysisResult | null;
  layerVisibility: LayerVisibilityState;
  onToggleLayer: (layerKey: keyof LayerVisibilityState) => void;
  resetTrigger: number;
  flyToTarget: { center: [number, number]; zoom: number; ts: number } | null;
}

const GHANA_DEFAULT_CENTER: [number, number] = [-1.05, 7.92];
const GHANA_DEFAULT_ZOOM = 6.15;
type MapGeoJSONData = Parameters<maplibregl.GeoJSONSource['setData']>[0];

export const GhanaMap: React.FC<GhanaMapProps> = ({
  baseMapStyle,
  filteredFloodEvents,
  selectedEvent,
  onSelectEvent,
  monitoringStations,
  iotLinks,
  healthFacilities,
  roads,
  adminRegions,
  proximityRadiusKm,
  proximityAnalysis,
  layerVisibility,
  onToggleLayer,
  resetTrigger,
  flyToTarget,
}) => {
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const popupRef = useRef<maplibregl.Popup | null>(null);
  const [styleLoaded, setStyleLoaded] = useState(false);
  const [legendExpanded, setLegendExpanded] = useState(true);
  const [usingFallbackTiles, setUsingFallbackTiles] = useState(false);

  // Keep latest callbacks/data in refs for MapLibre event handlers
  const eventsRef = useRef(filteredFloodEvents);
  eventsRef.current = filteredFloodEvents;
  const onSelectRef = useRef(onSelectEvent);
  onSelectRef.current = onSelectEvent;

  // Initialize MapLibre instance
  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return;

    const initialConfig = getBaseMapConfig(baseMapStyle);
    const map = new maplibregl.Map({
      container: mapContainerRef.current,
      style: initialConfig.styleUrl,
      center: GHANA_DEFAULT_CENTER,
      zoom: GHANA_DEFAULT_ZOOM,
      minZoom: 4.8,
      maxZoom: 16,
      attributionControl: false,
    });

    map.addControl(
      new maplibregl.NavigationControl({ showCompass: true, showZoom: true }),
      'top-right'
    );
    map.addControl(
      new maplibregl.ScaleControl({ maxWidth: 120, unit: 'metric' }),
      'bottom-right'
    );
    map.addControl(
      new maplibregl.AttributionControl({ compact: true }),
      'bottom-right'
    );

    map.on('load', () => {
      setStyleLoaded(true);
    });

    map.on('error', (err) => {
      const msg = String(err?.error?.message || '');
      if (
        msg.includes('maps.geo') ||
        msg.includes('403') ||
        msg.includes('Failed to fetch')
      ) {
        if (!usingFallbackTiles) {
          setUsingFallbackTiles(true);
          map.setStyle(getFallbackStyleUrl(baseMapStyle));
        }
      }
    });

    mapRef.current = map;

    return () => {
      if (popupRef.current) {
        popupRef.current.remove();
      }
      map.remove();
      mapRef.current = null;
    };
  }, []);

  // Handle basemap style switch
  const prevStyleRef = useRef<BaseMapStyleId>(baseMapStyle);
  useEffect(() => {
    const map = mapRef.current;
    if (!map || prevStyleRef.current === baseMapStyle) return;
    prevStyleRef.current = baseMapStyle;
    setStyleLoaded(false);
    setUsingFallbackTiles(false);
    const cfg = getBaseMapConfig(baseMapStyle);
    map.setStyle(cfg.styleUrl);
    map.once('styledata', () => {
      setStyleLoaded(true);
    });
  }, [baseMapStyle]);

  // Reset camera trigger
  useEffect(() => {
    if (resetTrigger === 0 || !mapRef.current) return;
    mapRef.current.flyTo({
      center: GHANA_DEFAULT_CENTER,
      zoom: GHANA_DEFAULT_ZOOM,
      pitch: 0,
      bearing: 0,
      duration: 900,
    });
  }, [resetTrigger]);

  // Explicit flyTo target (when user clicks a region, station, or facility)
  useEffect(() => {
    if (!flyToTarget || !mapRef.current) return;
    mapRef.current.flyTo({
      center: flyToTarget.center,
      zoom: flyToTarget.zoom,
      duration: 850,
    });
  }, [flyToTarget]);

  // Build proximity circle and nearest-distance connector vectors
  const buildProximityGeoJSON = () => {
    if (!selectedEvent) {
      return {
        circle: { type: 'FeatureCollection' as const, features: [] },
        connectors: { type: 'FeatureCollection' as const, features: [] },
      };
    }
    const center = selectedEvent.geometry.coordinates;
    const circleFeat = createCirclePolygon(center, proximityRadiusKm, 64);
    const connectors: unknown[] = [];

    if (proximityAnalysis?.nearestGroundtruthedStation) {
      connectors.push({
        type: 'Feature',
        geometry: {
          type: 'LineString',
          coordinates: [
            center,
            proximityAnalysis.nearestGroundtruthedStation.feature.geometry
              .coordinates,
          ],
        },
        properties: {
          kind: 'station',
          label: `Nearest Groundtruthed Gauge: ${proximityAnalysis.nearestGroundtruthedStation.straightLineKm} km`,
        },
      });
    }

    if (proximityAnalysis?.nearestHospital) {
      connectors.push({
        type: 'Feature',
        geometry: {
          type: 'LineString',
          coordinates: [
            center,
            proximityAnalysis.nearestHospital.feature.geometry.coordinates,
          ],
        },
        properties: {
          kind: 'hospital',
          label: `Nearest Hospital: ${proximityAnalysis.nearestHospital.straightLineKm} km`,
        },
      });
    }

    return {
      circle: { type: 'FeatureCollection' as const, features: [circleFeat] },
      connectors: { type: 'FeatureCollection' as const, features: connectors },
    };
  };

  // Sync sources and layers with MapLibre whenever style or data updates
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !styleLoaded) return;

    // 1. Admin Regions Source & Layers
    const regionsData = adminRegions || {
      type: 'FeatureCollection',
      features: [],
    };
    const existingRegions = map.getSource(
      'ghana-regions'
    ) as maplibregl.GeoJSONSource;
    if (existingRegions) {
      existingRegions.setData(regionsData as unknown as MapGeoJSONData);
    } else {
      map.addSource('ghana-regions', {
        type: 'geojson',
        data: regionsData as unknown as MapGeoJSONData,
      });

      map.addLayer({
        id: 'ghana-regions-fill',
        type: 'fill',
        source: 'ghana-regions',
        layout: {
          visibility: layerVisibility.regionChoropleth ? 'visible' : 'none',
        },
        paint: {
          'fill-color': [
            'interpolate',
            ['linear'],
            ['get', 'flood_event_count'],
            0,
            '#E6ECE8',
            2,
            '#B9D6D0',
            5,
            '#5DA69C',
            10,
            '#18766B',
            16,
            '#142C38',
          ],
          'fill-opacity': 0.22,
        },
      });

      map.addLayer({
        id: 'ghana-regions-outline',
        type: 'line',
        source: 'ghana-regions',
        paint: {
          'line-color': '#526875',
          'line-width': 1.1,
          'line-dasharray': [2, 2],
          'line-opacity': 0.65,
        },
      });
    }

    // 2. Road Network Source & Layer
    const roadsData = roads || { type: 'FeatureCollection', features: [] };
    const existingRoads = map.getSource('ghana-roads') as maplibregl.GeoJSONSource;
    if (existingRoads) {
      existingRoads.setData(roadsData as unknown as MapGeoJSONData);
    } else {
      map.addSource('ghana-roads', {
        type: 'geojson',
        data: roadsData as unknown as MapGeoJSONData,
      });

      map.addLayer({
        id: 'ghana-roads-line',
        type: 'line',
        source: 'ghana-roads',
        layout: {
          visibility: layerVisibility.roadNetwork ? 'visible' : 'none',
          'line-cap': 'round',
          'line-join': 'round',
        },
        paint: {
          'line-color': [
            'match',
            ['get', 'category'],
            'National Routes',
            '#9E6B25',
            'Inter-Regional Routes',
            '#B38648',
            '#7A8B94',
          ],
          'line-width': [
            'match',
            ['get', 'category'],
            'National Routes',
            2.1,
            'Inter-Regional Routes',
            1.5,
            1.0,
          ],
          'line-opacity': 0.65,
        },
      });
    }

    // 3. Proximity Circle & Connectors
    const proxGeo = buildProximityGeoJSON();
    const existingCircle = map.getSource(
      'proximity-circle'
    ) as maplibregl.GeoJSONSource;
    if (existingCircle) {
      existingCircle.setData(proxGeo.circle as unknown as MapGeoJSONData);
    } else {
      map.addSource('proximity-circle', {
        type: 'geojson',
        data: proxGeo.circle as unknown as MapGeoJSONData,
      });

      map.addLayer({
        id: 'proximity-circle-fill',
        type: 'fill',
        source: 'proximity-circle',
        paint: {
          'fill-color': '#18766B',
          'fill-opacity': 0.11,
        },
      });

      map.addLayer({
        id: 'proximity-circle-stroke',
        type: 'line',
        source: 'proximity-circle',
        paint: {
          'line-color': '#18766B',
          'line-width': 2,
          'line-dasharray': [3, 2],
        },
      });
    }

    const existingConnectors = map.getSource(
      'proximity-connectors'
    ) as maplibregl.GeoJSONSource;
    if (existingConnectors) {
      existingConnectors.setData(proxGeo.connectors as unknown as MapGeoJSONData);
    } else {
      map.addSource('proximity-connectors', {
        type: 'geojson',
        data: proxGeo.connectors as unknown as MapGeoJSONData,
      });

      map.addLayer({
        id: 'proximity-connectors-line',
        type: 'line',
        source: 'proximity-connectors',
        paint: {
          'line-color': [
            'match',
            ['get', 'kind'],
            'station',
            '#18766B',
            '#2A5C8A',
          ],
          'line-width': 2,
          'line-dasharray': [2, 2],
        },
      });
    }

    // 4. IoT Telemetry Propagation Links
    const linksData = iotLinks || { type: 'FeatureCollection', features: [] };
    const existingLinks = map.getSource(
      'iot-telemetry-links'
    ) as maplibregl.GeoJSONSource;
    if (existingLinks) {
      existingLinks.setData(linksData as unknown as MapGeoJSONData);
    } else {
      map.addSource('iot-telemetry-links', {
        type: 'geojson',
        data: linksData as unknown as MapGeoJSONData,
      });

      map.addLayer({
        id: 'iot-telemetry-links-line',
        type: 'line',
        source: 'iot-telemetry-links',
        layout: {
          visibility: layerVisibility.iotTelemetryLinks ? 'visible' : 'none',
        },
        paint: {
          'line-color': [
            'match',
            ['get', 'potential'],
            'VERY GOOD',
            '#18766B',
            'GOOD',
            '#18766B',
            'OK',
            '#C58B35',
            'VERY BAD',
            '#B64B43',
            '#667782',
          ],
          'line-width': 2.2,
          'line-dasharray': [2, 1.5],
          'line-opacity': 0.85,
        },
      });
    }

    // 5. Clinical Healthcare Facilities (Clustered GeoJSON source)
    const facilitiesCollection = {
      type: 'FeatureCollection',
      features: healthFacilities,
    };
    const existingFacilities = map.getSource(
      'health-facilities'
    ) as maplibregl.GeoJSONSource;
    if (existingFacilities) {
      existingFacilities.setData(
        facilitiesCollection as unknown as MapGeoJSONData
      );
    } else {
      map.addSource('health-facilities', {
        type: 'geojson',
        data: facilitiesCollection as unknown as MapGeoJSONData,
        cluster: true,
        clusterMaxZoom: 10,
        clusterRadius: 38,
      });

      map.addLayer({
        id: 'health-facilities-clusters',
        type: 'circle',
        source: 'health-facilities',
        filter: ['has', 'point_count'],
        layout: {
          visibility: layerVisibility.healthFacilities ? 'visible' : 'none',
        },
        paint: {
          'circle-color': '#2A5C8A',
          'circle-radius': [
            'step',
            ['get', 'point_count'],
            11,
            25,
            14,
            100,
            18,
          ],
          'circle-opacity': 0.78,
          'circle-stroke-width': 1.5,
          'circle-stroke-color': '#F6F7F3',
        },
      });

      map.addLayer({
        id: 'health-facilities-cluster-count',
        type: 'symbol',
        source: 'health-facilities',
        filter: ['has', 'point_count'],
        layout: {
          visibility: layerVisibility.healthFacilities ? 'visible' : 'none',
          'text-field': '{point_count_abbreviated}',
          'text-size': 10,
        },
        paint: {
          'text-color': '#FFFFFF',
        },
      });

      map.addLayer({
        id: 'health-facilities-points',
        type: 'circle',
        source: 'health-facilities',
        filter: ['!', ['has', 'point_count']],
        layout: {
          visibility: layerVisibility.healthFacilities ? 'visible' : 'none',
        },
        paint: {
          'circle-color': [
            'match',
            ['get', 'facility_type'],
            'Hospital',
            '#1D4E78',
            '#4A7A9E',
          ],
          'circle-radius': [
            'match',
            ['get', 'facility_type'],
            'Hospital',
            5.5,
            3.8,
          ],
          'circle-stroke-width': 1.2,
          'circle-stroke-color': '#FFFFFF',
          'circle-opacity': 0.88,
        },
      });

      map.on('click', 'health-facilities-points', (e) => {
        const feat = e.features?.[0];
        if (!feat || feat.geometry.type !== 'Point') return;
        const p = feat.properties as Record<string, string>;
        const coords = (
          feat.geometry as { type: 'Point'; coordinates: [number, number] }
        ).coordinates.slice() as [
          number,
          number,
        ];
        if (popupRef.current) popupRef.current.remove();
        popupRef.current = new maplibregl.Popup({ closeButton: true, offset: 8 })
          .setLngLat(coords)
          .setHTML(
            `<div style="max-width:230px;">
              <div style="font-size:10px;font-weight:700;text-transform:uppercase;color:#2A5C8A;letter-spacing:0.04em;">${p.facility_type}</div>
              <div style="font-size:13px;font-weight:700;margin-top:2px;color:#142C38;">${p.name}</div>
              <div style="font-size:11px;color:#526875;margin-top:3px;">${p.district}, ${p.region} Region</div>
              <div style="font-size:10px;color:#667782;margin-top:4px;font-family:monospace;">Coords: ${coords[1].toFixed(4)}N, ${coords[0].toFixed(4)}E</div>
            </div>`
          )
          .addTo(map);
      });
    }

    // 6. Hydrometeorological Monitoring Stations (split by category for independent toggling)
    const stationsCollection = {
      type: 'FeatureCollection',
      features: monitoringStations,
    };
    const existingStations = map.getSource(
      'monitoring-stations'
    ) as maplibregl.GeoJSONSource;
    if (existingStations) {
      existingStations.setData(stationsCollection as unknown as MapGeoJSONData);
    } else {
      map.addSource('monitoring-stations', {
        type: 'geojson',
        data: stationsCollection as unknown as MapGeoJSONData,
      });

      // 6a. Legacy Unverified Gauges
      map.addLayer({
        id: 'stations-legacy-layer',
        type: 'circle',
        source: 'monitoring-stations',
        filter: ['==', ['get', 'station_category'], 'hydro_legacy_catalog'],
        layout: {
          visibility: layerVisibility.monitoringLegacy ? 'visible' : 'none',
        },
        paint: {
          'circle-color': '#F6F7F3',
          'circle-radius': 4.2,
          'circle-stroke-color': '#667782',
          'circle-stroke-width': 1.6,
          'circle-opacity': 0.85,
        },
      });

      // 6b. Groundtruthed Hydrological Stations
      map.addLayer({
        id: 'stations-groundtruthed-layer',
        type: 'circle',
        source: 'monitoring-stations',
        filter: ['==', ['get', 'station_category'], 'hydro_groundtruthed'],
        layout: {
          visibility: layerVisibility.monitoringGroundtruthed
            ? 'visible'
            : 'none',
        },
        paint: {
          'circle-color': '#18766B',
          'circle-radius': 6.5,
          'circle-stroke-color': '#FFFFFF',
          'circle-stroke-width': 2,
        },
      });

      // 6c. UNESCO / GMet / Hydro IoT Telemetry Nodes
      map.addLayer({
        id: 'stations-iot-layer',
        type: 'circle',
        source: 'monitoring-stations',
        filter: ['==', ['get', 'station_category'], 'iot_telemetry_node'],
        layout: {
          visibility: layerVisibility.monitoringIoT ? 'visible' : 'none',
        },
        paint: {
          'circle-color': '#0F544C',
          'circle-radius': 7,
          'circle-stroke-color': '#C58B35',
          'circle-stroke-width': 2.4,
        },
      });

      const stationLayers = [
        'stations-legacy-layer',
        'stations-groundtruthed-layer',
        'stations-iot-layer',
      ];
      stationLayers.forEach((layerId) => {
        map.on('click', layerId, (e) => {
          const feat = e.features?.[0];
          if (!feat || feat.geometry.type !== 'Point') return;
          const p = feat.properties as Record<string, unknown>;
          const coords = (
            feat.geometry as { type: 'Point'; coordinates: [number, number] }
          ).coordinates.slice() as [number, number];
          if (popupRef.current) popupRef.current.remove();
          const badgeColor =
            p.station_category === 'hydro_groundtruthed'
              ? '#18766B'
              : p.station_category === 'iot_telemetry_node'
              ? '#C58B35'
              : '#667782';
          const extra =
            p.basin_area_sqkm && p.basin_area_sqkm !== 'null'
              ? `<div style="font-size:11px;color:#526875;margin-top:2px;">Catchment Area: <strong>${Number(
                  p.basin_area_sqkm
                ).toLocaleString()} km²</strong></div>`
              : '';
          const potHtml =
            p.telemetry_potential && p.telemetry_potential !== 'null'
              ? `<div style="font-size:11px;color:#142C38;margin-top:2px;">LoRaWAN Link Potential: <strong>${p.telemetry_potential}</strong> ${
                  p.path_loss_db && p.path_loss_db !== 'null'
                    ? `(${p.path_loss_db} dB)`
                    : ''
                }</div>`
              : '';
          popupRef.current = new maplibregl.Popup({
            closeButton: true,
            offset: 8,
          })
            .setLngLat(coords)
            .setHTML(
              `<div style="max-width:250px;">
                <div style="font-size:10px;font-weight:700;text-transform:uppercase;color:${badgeColor};letter-spacing:0.04em;">${p.category_label}</div>
                <div style="font-size:13px;font-weight:700;margin-top:2px;color:#142C38;">${p.name}</div>
                <div style="font-size:11px;color:#526875;margin-top:2px;">${p.district}, ${p.region} Region</div>
                <div style="font-size:11px;color:#526875;margin-top:2px;">Infrastructure: <strong>${p.existing_infrastructure}</strong></div>
                ${extra}
                ${potHtml}
                <div style="font-size:10px;color:#667782;margin-top:4px;font-family:monospace;">UNESCO IHP-WINS (${coords[1].toFixed(
                  4
                )}N, ${coords[0].toFixed(4)}E)</div>
              </div>`
            )
            .addTo(map);
        });

        map.on('mouseenter', layerId, () => {
          map.getCanvas().style.cursor = 'pointer';
        });
        map.on('mouseleave', layerId, () => {
          map.getCanvas().style.cursor = '';
        });
      });
    }

    // 7. Documented Historical Flood Events Layer (Top interactive priority)
    const floodCollection = {
      type: 'FeatureCollection',
      features: filteredFloodEvents,
    };
    const existingFloods = map.getSource(
      'flood-events'
    ) as maplibregl.GeoJSONSource;
    if (existingFloods) {
      existingFloods.setData(floodCollection as unknown as MapGeoJSONData);
    } else {
      map.addSource('flood-events', {
        type: 'geojson',
        data: floodCollection as unknown as MapGeoJSONData,
      });

      // Outer halo for selected event
      map.addLayer({
        id: 'flood-events-selected-halo',
        type: 'circle',
        source: 'flood-events',
        filter: ['==', ['get', 'id'], selectedEvent?.properties.id || ''],
        layout: {
          visibility: layerVisibility.floodEvents ? 'visible' : 'none',
        },
        paint: {
          'circle-radius': 17,
          'circle-color': '#C58B35',
          'circle-opacity': 0.28,
          'circle-stroke-width': 2.5,
          'circle-stroke-color': '#142C38',
        },
      });

      // Main flood event circle markers scaled/colored by severity
      map.addLayer({
        id: 'flood-events-points',
        type: 'circle',
        source: 'flood-events',
        layout: {
          visibility: layerVisibility.floodEvents ? 'visible' : 'none',
        },
        paint: {
          'circle-color': [
            'match',
            ['get', 'severity_label'],
            'Extreme',
            '#B64B43',
            'High',
            '#C58B35',
            '#142C38',
          ],
          'circle-radius': [
            'match',
            ['get', 'severity_label'],
            'Extreme',
            9.5,
            'High',
            8,
            6.8,
          ],
          'circle-stroke-color': '#F6F7F3',
          'circle-stroke-width': 2,
          'circle-opacity': 0.94,
        },
      });

      map.on('click', 'flood-events-points', (e) => {
        const feat = e.features?.[0];
        if (!feat) return;
        const clickedId = feat.properties?.id;
        const found = eventsRef.current.find(
          (ev) => ev.properties.id === clickedId
        );
        if (found) {
          onSelectRef.current(found);
        }
      });

      map.on('mouseenter', 'flood-events-points', () => {
        map.getCanvas().style.cursor = 'pointer';
      });
      map.on('mouseleave', 'flood-events-points', () => {
        map.getCanvas().style.cursor = '';
      });
    }

    // Update visibility and selected filter whenever state changes
    const setVis = (layerId: string, visible: boolean) => {
      if (map.getLayer(layerId)) {
        map.setLayoutProperty(
          layerId,
          'visibility',
          visible ? 'visible' : 'none'
        );
      }
    };

    setVis('ghana-regions-fill', layerVisibility.regionChoropleth);
    setVis('ghana-roads-line', layerVisibility.roadNetwork);
    setVis('iot-telemetry-links-line', layerVisibility.iotTelemetryLinks);
    setVis('health-facilities-clusters', layerVisibility.healthFacilities);
    setVis('health-facilities-cluster-count', layerVisibility.healthFacilities);
    setVis('health-facilities-points', layerVisibility.healthFacilities);
    setVis('stations-legacy-layer', layerVisibility.monitoringLegacy);
    setVis(
      'stations-groundtruthed-layer',
      layerVisibility.monitoringGroundtruthed
    );
    setVis('stations-iot-layer', layerVisibility.monitoringIoT);
    setVis('flood-events-points', layerVisibility.floodEvents);
    setVis('flood-events-selected-halo', layerVisibility.floodEvents);

    if (map.getLayer('flood-events-selected-halo')) {
      map.setFilter('flood-events-selected-halo', [
        '==',
        ['get', 'id'],
        selectedEvent?.properties.id || '',
      ]);
    }
  }, [
    styleLoaded,
    filteredFloodEvents,
    selectedEvent,
    monitoringStations,
    iotLinks,
    healthFacilities,
    roads,
    adminRegions,
    proximityRadiusKm,
    proximityAnalysis,
    layerVisibility,
  ]);

  return (
    <div className="relative w-full h-full flex-1 bg-[#E5EAE6] overflow-hidden">
      {/* MapLibre Canvas Container */}
      <div
        ref={mapContainerRef}
        className="w-full h-full"
        data-testid="ghana-map-canvas"
        aria-label="Interactive geospatial map of Ghana flood events, infrastructure, and monitoring stations"
      />

      {/* Top-Left Analytical Context & Selected Radius Status Pill */}
      <div className="absolute top-3 left-3 z-10 max-w-xs sm:max-w-md pointer-events-none flex flex-col gap-1.5">
        <div className="bg-[#142C38]/95 text-[#F6F7F3] px-3 py-2 rounded shadow-md border border-[#2C5568] pointer-events-auto">
          <div className="flex items-center justify-between gap-3">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-[#9BD5CD]">
              Active Map Scope
            </span>
            <span className="font-mono-code text-xs bg-[#18766B] text-white px-1.5 py-0.5 rounded">
              {filteredFloodEvents.length} Events Shown
            </span>
          </div>
          {selectedEvent ? (
            <div className="mt-1 text-xs text-[#E2E8EC]">
              <span className="font-semibold text-white">
                {selectedEvent.properties.title}
              </span>{' '}
              <span className="text-[#9BD5CD] font-mono-code">
                ({proximityRadiusKm} km proximity buffer active)
              </span>
            </div>
          ) : (
            <div className="mt-1 text-xs text-[#C7D2D8]">
              Select any flood marker on the map or list to inspect proximity to hospitals and river gauges.
            </div>
          )}
        </div>
      </div>

      {/* Bottom-Left Interactive Legend & Layer Visibility Controls */}
      <div
        className="absolute bottom-3 left-3 z-10 w-64 sm:w-72 bg-[#F6F7F3]/95 backdrop-blur-xs rounded border border-[#C8D1CD] shadow-lg text-[#142C38]"
        data-testid="map-legend-panel"
      >
        <button
          type="button"
          onClick={() => setLegendExpanded((prev) => !prev)}
          className="w-full px-3 py-2 flex items-center justify-between border-b border-[#DCE2DF] text-xs font-bold uppercase tracking-wider text-[#142C38] hover:bg-[#EAEDE8] transition-colors cursor-pointer"
          aria-expanded={legendExpanded}
        >
          <span className="flex items-center gap-1.5">
            <Layers className="w-3.5 h-3.5 text-[#18766B]" aria-hidden="true" />
            Map Layers &amp; Legend
          </span>
          {legendExpanded ? (
            <ChevronDown className="w-4 h-4 text-[#667782]" />
          ) : (
            <ChevronUp className="w-4 h-4 text-[#667782]" />
          )}
        </button>

        {legendExpanded && (
          <div className="p-2.5 space-y-2 text-xs max-h-[52vh] overflow-y-auto">
            {/* Flood Event Severity Legend + Toggle */}
            <div className="pb-1.5 border-b border-[#E2E7E4]">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-[#142C38]">
                  Documented Flood Events ({filteredFloodEvents.length})
                </span>
                <button
                  type="button"
                  onClick={() => onToggleLayer('floodEvents')}
                  data-testid="toggle-layer-floodEvents"
                  className="p-1 rounded hover:bg-[#E2E7E4] text-[#142C38] cursor-pointer"
                  title="Toggle flood event markers"
                >
                  {layerVisibility.floodEvents ? (
                    <Eye className="w-3.5 h-3.5 text-[#18766B]" />
                  ) : (
                    <EyeOff className="w-3.5 h-3.5 text-[#667782]" />
                  )}
                </button>
              </div>
              <div className="grid grid-cols-3 gap-1 mt-1.5 text-[11px] text-[#425560]">
                <div className="flex items-center gap-1.5">
                  <span className="w-3 h-3 rounded-full bg-[#B64B43] border border-white inline-block shrink-0" />
                  <span>Extreme</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="w-3 h-3 rounded-full bg-[#C58B35] border border-white inline-block shrink-0" />
                  <span>High</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="w-3 h-3 rounded-full bg-[#142C38] border border-white inline-block shrink-0" />
                  <span>Moderate</span>
                </div>
              </div>
            </div>

            {/* Monitoring Layers */}
            <div className="space-y-1.5 pb-1.5 border-b border-[#E2E7E4]">
              <div className="text-[10px] font-bold uppercase tracking-wider text-[#667782]">
                UNESCO / GMet / Hydro Telemetry
              </div>

              <label className="flex items-center justify-between gap-2 cursor-pointer hover:bg-[#ECEFEA] px-1 py-0.5 rounded">
                <span className="flex items-center gap-2">
                  <span className="w-3 h-3 rounded-full bg-[#18766B] border-2 border-white shadow-xs inline-block shrink-0" />
                  <span>Groundtruthed River Gauges (36)</span>
                </span>
                <input
                  type="checkbox"
                  checked={layerVisibility.monitoringGroundtruthed}
                  onChange={() => onToggleLayer('monitoringGroundtruthed')}
                  data-testid="toggle-layer-monitoringGroundtruthed"
                  className="accent-[#18766B] cursor-pointer"
                />
              </label>

              <label className="flex items-center justify-between gap-2 cursor-pointer hover:bg-[#ECEFEA] px-1 py-0.5 rounded">
                <span className="flex items-center gap-2">
                  <span className="w-3 h-3 rounded-full bg-[#0F544C] border-2 border-[#C58B35] inline-block shrink-0" />
                  <span>UNESCO/GMet IoT Nodes (24)</span>
                </span>
                <input
                  type="checkbox"
                  checked={layerVisibility.monitoringIoT}
                  onChange={() => onToggleLayer('monitoringIoT')}
                  data-testid="toggle-layer-monitoringIoT"
                  className="accent-[#18766B] cursor-pointer"
                />
              </label>

              <label className="flex items-center justify-between gap-2 cursor-pointer hover:bg-[#ECEFEA] px-1 py-0.5 rounded">
                <span className="flex items-center gap-2">
                  <Radio className="w-3 h-3 text-[#18766B] shrink-0" />
                  <span>LoRaWAN Telemetry Links (14)</span>
                </span>
                <input
                  type="checkbox"
                  checked={layerVisibility.iotTelemetryLinks}
                  onChange={() => onToggleLayer('iotTelemetryLinks')}
                  data-testid="toggle-layer-iotTelemetryLinks"
                  className="accent-[#18766B] cursor-pointer"
                />
              </label>

              <label className="flex items-center justify-between gap-2 cursor-pointer hover:bg-[#ECEFEA] px-1 py-0.5 rounded">
                <span className="flex items-center gap-2">
                  <span className="w-3 h-3 rounded-full bg-[#F6F7F3] border-2 border-[#667782] inline-block shrink-0" />
                  <span>Unverified Catalog Gauges (193)</span>
                </span>
                <input
                  type="checkbox"
                  checked={layerVisibility.monitoringLegacy}
                  onChange={() => onToggleLayer('monitoringLegacy')}
                  data-testid="toggle-layer-monitoringLegacy"
                  className="accent-[#18766B] cursor-pointer"
                />
              </label>
            </div>

            {/* Infrastructure & Admin Layers */}
            <div className="space-y-1.5">
              <div className="text-[10px] font-bold uppercase tracking-wider text-[#667782]">
                Infrastructure &amp; Boundaries
              </div>

              <label className="flex items-center justify-between gap-2 cursor-pointer hover:bg-[#ECEFEA] px-1 py-0.5 rounded">
                <span className="flex items-center gap-2">
                  <span className="w-3 h-3 rounded-full bg-[#1D4E78] border border-white inline-block shrink-0" />
                  <span>Hospitals &amp; Clinics (1,226)</span>
                </span>
                <input
                  type="checkbox"
                  checked={layerVisibility.healthFacilities}
                  onChange={() => onToggleLayer('healthFacilities')}
                  data-testid="toggle-layer-healthFacilities"
                  className="accent-[#18766B] cursor-pointer"
                />
              </label>

              <label className="flex items-center justify-between gap-2 cursor-pointer hover:bg-[#ECEFEA] px-1 py-0.5 rounded">
                <span className="flex items-center gap-2">
                  <span className="w-3.5 h-0.5 bg-[#9E6B25] inline-block shrink-0" />
                  <span>National &amp; Regional Roads (382)</span>
                </span>
                <input
                  type="checkbox"
                  checked={layerVisibility.roadNetwork}
                  onChange={() => onToggleLayer('roadNetwork')}
                  data-testid="toggle-layer-roadNetwork"
                  className="accent-[#18766B] cursor-pointer"
                />
              </label>

              <label className="flex items-center justify-between gap-2 cursor-pointer hover:bg-[#ECEFEA] px-1 py-0.5 rounded">
                <span className="flex items-center gap-2">
                  <span className="w-3 h-3 rounded-xs bg-[#5DA69C]/50 border border-[#18766B] inline-block shrink-0" />
                  <span>Regional Flood Density Shading</span>
                </span>
                <input
                  type="checkbox"
                  checked={layerVisibility.regionChoropleth}
                  onChange={() => onToggleLayer('regionChoropleth')}
                  data-testid="toggle-layer-regionChoropleth"
                  className="accent-[#18766B] cursor-pointer"
                />
              </label>
            </div>

            <div className="pt-1 text-[10px] text-[#667782] flex items-start gap-1 leading-tight">
              <Info className="w-3 h-3 shrink-0 mt-0.5 text-[#18766B]" />
              <span>
                Flood markers indicate documented event centroids, not inundation footprints.
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
