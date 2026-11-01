import {
  FloodEventProperties,
  FilterState,
  GeoJSONPointFeature,
  HealthFacilityProperties,
  MonitoringStationProperties,
  RegionSummaryProperties,
} from '../types/geospatial';

const EARTH_RADIUS_KM = 6371.0088;

/**
 * Validates whether a [longitude, latitude] coordinate lies within Ghana's territorial bounding box.
 */
export function validateGhanaCoordinate(lon: number, lat: number): boolean {
  if (!Number.isFinite(lon) || !Number.isFinite(lat)) {
    return false;
  }
  return lon >= -3.35 && lon <= 1.25 && lat >= 4.7 && lat <= 11.25;
}

/**
 * Calculates great-circle Haversine straight-line distance in kilometers between two [lon, lat] points.
 */
export function haversineDistanceKm(
  coord1: [number, number],
  coord2: [number, number]
): number {
  const [lon1, lat1] = coord1;
  const [lon2, lat2] = coord2;
  const toRad = (deg: number) => (deg * Math.PI) / 180;

  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const phi1 = toRad(lat1);
  const phi2 = toRad(lat2);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(phi1) * Math.cos(phi2) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(Math.max(0, 1 - a)));
  return Number((EARTH_RADIUS_KM * c).toFixed(2));
}

/**
 * Generates a geodesic polygon circle around a [lon, lat] center for a given radius in km.
 */
export function createCirclePolygon(
  center: [number, number],
  radiusKm: number,
  steps = 64
): {
  type: 'Feature';
  geometry: { type: 'Polygon'; coordinates: [number, number][][] };
  properties: { radiusKm: number };
} {
  const [lon, lat] = center;
  const coords: [number, number][] = [];
  const latRad = (lat * Math.PI) / 180;
  const lonRad = (lon * Math.PI) / 180;
  const angularDistance = radiusKm / EARTH_RADIUS_KM;

  for (let i = 0; i <= steps; i++) {
    const bearing = (i * 2 * Math.PI) / steps;
    const sinLat2 =
      Math.sin(latRad) * Math.cos(angularDistance) +
      Math.cos(latRad) * Math.sin(angularDistance) * Math.cos(bearing);
    const lat2 = Math.asin(Math.max(-1, Math.min(1, sinLat2)));
    const y = Math.sin(bearing) * Math.sin(angularDistance) * Math.cos(latRad);
    const x = Math.cos(angularDistance) - Math.sin(latRad) * Math.sin(lat2);
    const lon2 = lonRad + Math.atan2(y, x);

    coords.push([
      Number(((lon2 * 180) / Math.PI).toFixed(5)),
      Number(((lat2 * 180) / Math.PI).toFixed(5)),
    ]);
  }

  return {
    type: 'Feature',
    geometry: {
      type: 'Polygon',
      coordinates: [coords],
    },
    properties: { radiusKm },
  };
}

/**
 * Filters documented flood events based on active user filter controls.
 */
export function filterFloodEvents(
  events: GeoJSONPointFeature<FloodEventProperties>[],
  filters: FilterState
): GeoJSONPointFeature<FloodEventProperties>[] {
  const query = filters.searchQuery.trim().toLowerCase();

  return events.filter((ft) => {
    const p = ft.properties;

    if (p.year < filters.yearRange[0] || p.year > filters.yearRange[1]) {
      return false;
    }

    if (filters.selectedRegion !== 'ALL' && p.region !== filters.selectedRegion) {
      return false;
    }

    if (
      filters.selectedSource !== 'ALL' &&
      p.primary_source !== filters.selectedSource &&
      !p.all_sources.includes(filters.selectedSource as FloodEventProperties['primary_source'])
    ) {
      return false;
    }

    if (filters.selectedSeverity !== 'ALL' && p.severity_label !== filters.selectedSeverity) {
      return false;
    }

    if (filters.onlyUnmonitored15km && p.groundtruthed_stations_within_15km > 0) {
      return false;
    }

    if (query.length > 0) {
      const searchable = [
        p.id,
        p.title,
        p.region,
        p.district,
        p.location_description,
        p.rivers,
        p.cause,
        p.glide_number || '',
        p.description,
      ]
        .join(' ')
        .toLowerCase();
      if (!searchable.includes(query)) {
        return false;
      }
    }

    return true;
  });
}

export interface NearbyFacilityItem {
  feature: GeoJSONPointFeature<HealthFacilityProperties>;
  straightLineKm: number;
  estimatedRoadRangeKm: [number, number];
}

export interface NearbyStationItem {
  feature: GeoJSONPointFeature<MonitoringStationProperties>;
  straightLineKm: number;
}

export interface ProximityAnalysisResult {
  radiusKm: number;
  facilitiesInRadius: NearbyFacilityItem[];
  hospitalsInRadiusCount: number;
  clinicsInRadiusCount: number;
  nearestHospital: NearbyFacilityItem | null;
  nearestFacility: NearbyFacilityItem | null;
  stationsInRadius: NearbyStationItem[];
  groundtruthedStationsInRadiusCount: number;
  iotStationsInRadiusCount: number;
  nearestGroundtruthedStation: NearbyStationItem | null;
  nearestAnyStation: NearbyStationItem | null;
}

/**
 * Computes transparent straight-line Haversine proximity metrics around a selected flood event.
 * Also provides an explicit road-detour estimation interval (1.35x - 1.85x straight-line distance)
 * so users never conflate Euclidean/great-circle distance with actual road travel distance.
 */
export function computeProximityAnalysis(
  eventFeature: GeoJSONPointFeature<FloodEventProperties>,
  radiusKm: number,
  facilities: GeoJSONPointFeature<HealthFacilityProperties>[],
  stations: GeoJSONPointFeature<MonitoringStationProperties>[]
): ProximityAnalysisResult {
  const center = eventFeature.geometry.coordinates;

  const allFacilitiesWithDist: NearbyFacilityItem[] = facilities.map((f) => {
    const d = haversineDistanceKm(center, f.geometry.coordinates);
    return {
      feature: f,
      straightLineKm: d,
      estimatedRoadRangeKm: [
        Number((d * 1.35).toFixed(1)),
        Number((d * 1.85).toFixed(1)),
      ],
    };
  });
  allFacilitiesWithDist.sort((a, b) => a.straightLineKm - b.straightLineKm);

  const facilitiesInRadius = allFacilitiesWithDist.filter(
    (item) => item.straightLineKm <= radiusKm
  );
  const hospitalsInRadiusCount = facilitiesInRadius.filter(
    (item) => item.feature.properties.facility_type === 'Hospital'
  ).length;
  const clinicsInRadiusCount = facilitiesInRadius.length - hospitalsInRadiusCount;

  const nearestFacility = allFacilitiesWithDist[0] || null;
  const nearestHospital =
    allFacilitiesWithDist.find(
      (item) => item.feature.properties.facility_type === 'Hospital'
    ) || null;

  const allStationsWithDist: NearbyStationItem[] = stations.map((s) => ({
    feature: s,
    straightLineKm: haversineDistanceKm(center, s.geometry.coordinates),
  }));
  allStationsWithDist.sort((a, b) => a.straightLineKm - b.straightLineKm);

  const stationsInRadius = allStationsWithDist.filter(
    (item) => item.straightLineKm <= radiusKm
  );
  const groundtruthedStationsInRadiusCount = stationsInRadius.filter(
    (item) => item.feature.properties.groundtruthed
  ).length;
  const iotStationsInRadiusCount = stationsInRadius.filter(
    (item) => item.feature.properties.station_category === 'iot_telemetry_node'
  ).length;

  const nearestAnyStation = allStationsWithDist[0] || null;
  const nearestGroundtruthedStation =
    allStationsWithDist.find((item) => item.feature.properties.groundtruthed) || null;

  return {
    radiusKm,
    facilitiesInRadius,
    hospitalsInRadiusCount,
    clinicsInRadiusCount,
    nearestHospital,
    nearestFacility,
    stationsInRadius,
    groundtruthedStationsInRadiusCount,
    iotStationsInRadiusCount,
    nearestGroundtruthedStation,
    nearestAnyStation,
  };
}

export interface DynamicInsights {
  eventCount: number;
  yearSpanText: string;
  uniqueRegionsCount: number;
  uniqueDistrictsCount: number;
  unmonitored15kmCount: number;
  unmonitored15kmPct: number;
  avgNearestGroundtruthedKm: number;
  avgNearestHospitalKm: number;
  totalDisplacedReported: number;
  totalFatalitiesReported: number;
  regionStationsCount: number;
  regionGroundtruthedCount: number;
  regionIoTCount: number;
  regionFacilitiesCount: number;
  regionHospitalsCount: number;
  rp100ExposedHospitals: number;
  rp100ExposedPrimaryCare: number;
  rp100ExposedSchools: number;
  rp100ExposedChildrenU5: number;
}

/**
 * Computes real-time summary statistics directly from the currently filtered flood events
 * and selected administrative region.
 */
export function computeFilteredInsights(
  filteredEvents: GeoJSONPointFeature<FloodEventProperties>[],
  allStations: GeoJSONPointFeature<MonitoringStationProperties>[],
  allFacilities: GeoJSONPointFeature<HealthFacilityProperties>[],
  regionSummaries: RegionSummaryProperties[],
  selectedRegion: string
): DynamicInsights {
  const eventCount = filteredEvents.length;
  const years = filteredEvents.map((e) => e.properties.year);
  const yearSpanText =
    years.length > 0
      ? `${Math.min(...years)} to ${Math.max(...years)}`
      : 'No records';

  const uniqueRegions = new Set(filteredEvents.map((e) => e.properties.region));
  const uniqueDistricts = new Set(filteredEvents.map((e) => e.properties.district));

  const unmonitored15kmCount = filteredEvents.filter(
    (e) => e.properties.groundtruthed_stations_within_15km === 0
  ).length;
  const unmonitored15kmPct =
    eventCount > 0 ? Number(((100 * unmonitored15kmCount) / eventCount).toFixed(1)) : 0;

  const avgNearestGroundtruthedKm =
    eventCount > 0
      ? Number(
          (
            filteredEvents.reduce(
              (acc, e) => acc + (e.properties.nearest_groundtruthed_station_km || 0),
              0
            ) / eventCount
          ).toFixed(1)
        )
      : 0;

  const avgNearestHospitalKm =
    eventCount > 0
      ? Number(
          (
            filteredEvents.reduce(
              (acc, e) => acc + (e.properties.nearest_hospital_km || 0),
              0
            ) / eventCount
          ).toFixed(1)
        )
      : 0;

  const totalDisplacedReported = filteredEvents.reduce(
    (acc, e) => acc + (e.properties.displaced_or_affected || 0),
    0
  );
  const totalFatalitiesReported = filteredEvents.reduce(
    (acc, e) => acc + (e.properties.fatalities || 0),
    0
  );

  const scopedStations =
    selectedRegion === 'ALL'
      ? allStations
      : allStations.filter((s) => s.properties.region === selectedRegion);
  const scopedFacilities =
    selectedRegion === 'ALL'
      ? allFacilities
      : allFacilities.filter((f) => f.properties.region === selectedRegion);
  const scopedRegionSummaries =
    selectedRegion === 'ALL'
      ? regionSummaries
      : regionSummaries.filter((r) => r.adm1_name === selectedRegion);

  return {
    eventCount,
    yearSpanText,
    uniqueRegionsCount: uniqueRegions.size,
    uniqueDistrictsCount: uniqueDistricts.size,
    unmonitored15kmCount,
    unmonitored15kmPct,
    avgNearestGroundtruthedKm,
    avgNearestHospitalKm,
    totalDisplacedReported,
    totalFatalitiesReported,
    regionStationsCount: scopedStations.length,
    regionGroundtruthedCount: scopedStations.filter((s) => s.properties.groundtruthed)
      .length,
    regionIoTCount: scopedStations.filter(
      (s) => s.properties.station_category === 'iot_telemetry_node'
    ).length,
    regionFacilitiesCount: scopedFacilities.length,
    regionHospitalsCount: scopedFacilities.filter(
      (f) => f.properties.facility_type === 'Hospital'
    ).length,
    rp100ExposedHospitals: scopedRegionSummaries.reduce(
      (acc, r) => acc + r.rp100_exposed_hospitals,
      0
    ),
    rp100ExposedPrimaryCare: scopedRegionSummaries.reduce(
      (acc, r) => acc + r.rp100_exposed_primary_care,
      0
    ),
    rp100ExposedSchools: scopedRegionSummaries.reduce(
      (acc, r) => acc + r.rp100_exposed_schools,
      0
    ),
    rp100ExposedChildrenU5: scopedRegionSummaries.reduce(
      (acc, r) => acc + r.rp100_exposed_children_u5,
      0
    ),
  };
}
