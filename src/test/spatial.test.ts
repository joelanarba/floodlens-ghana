import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import {
  computeFilteredInsights,
  computeProximityAnalysis,
  createCirclePolygon,
  filterFloodEvents,
  haversineDistanceKm,
  validateGhanaCoordinate,
} from '../utils/spatial';
import {
  DatasetSummary,
  FilterState,
  FloodEventProperties,
  GeoJSONFeatureCollection,
  GeoJSONPointFeature,
  HealthFacilityProperties,
  MonitoringStationProperties,
} from '../types/geospatial';

const SAMPLE_FLOODS: GeoJSONPointFeature<FloodEventProperties>[] = [
  {
    type: 'Feature',
    geometry: { type: 'Point', coordinates: [-0.205, 5.56] },
    properties: {
      id: 'DFO-4254',
      title: '2015 Greater Accra Flood (Odaw Basin)',
      start_date: '2015-06-03',
      end_date: '2015-06-06',
      year: 2015,
      region: 'Greater Accra',
      region_pcode: 'GH03',
      district: 'Accra Metropolis',
      district_pcode: 'GH0301',
      location_description: 'Accra, Odaw River, Circle',
      rivers: 'Odaw River',
      primary_source: 'DFO',
      all_sources: ['DFO', 'GLIDE'],
      source_org: 'Dartmouth Flood Observatory',
      source_url: 'https://floodobservatory.colorado.edu/',
      glide_number: 'FL-2015-000064-GHA',
      cause: 'Torrential Rain',
      severity_label: 'Extreme',
      fatalities: 150,
      displaced_or_affected: 52622,
      reported_area_sqkm: 1200,
      bbox: null,
      coordinate_precision: 'exact_locality',
      precision_note: 'Exact locality in Accra.',
      original_source_coords: [-0.205, 5.56],
      description: 'Severe urban flash flood in Accra.',
      nearest_station_km: 4.2,
      nearest_station_name: 'Weija Gauge',
      nearest_groundtruthed_station_km: 18.5,
      nearest_groundtruthed_station_name: 'Nsawam Densu Gauge',
      stations_within_15km: 2,
      groundtruthed_stations_within_15km: 0,
      nearest_facility_km: 0.8,
      nearest_facility_name: 'Ridge Regional Hospital',
      nearest_hospital_km: 0.8,
      nearest_hospital_name: 'Ridge Regional Hospital',
      facilities_within_10km: 45,
      hospitals_within_10km: 18,
    },
  },
  {
    type: 'Feature',
    geometry: { type: 'Point', coordinates: [-0.85, 10.78] },
    properties: {
      id: 'GDACS-1100228',
      title: '2019 Upper East White Volta Flood',
      start_date: '2019-10-12',
      end_date: '2019-10-25',
      year: 2019,
      region: 'Upper East',
      region_pcode: 'GH11',
      district: 'Bolgatanga Municipal',
      district_pcode: 'GH1104',
      location_description: 'Bolgatanga, Pwalugu, White Volta',
      rivers: 'White Volta',
      primary_source: 'GDACS',
      all_sources: ['GDACS'],
      source_org: 'EC JRC GDACS',
      source_url: 'https://www.gdacs.org/',
      glide_number: 'FL-2019-000135-GHA',
      cause: 'Heavy Rain and Bagre Dam Spillage',
      severity_label: 'High',
      fatalities: 29,
      displaced_or_affected: 26083,
      reported_area_sqkm: 4500,
      bbox: null,
      coordinate_precision: 'exact_locality',
      precision_note: 'Snapped to Pwalugu/Bolgatanga corridor.',
      original_source_coords: [-0.85, 10.78],
      description: 'White Volta riverine flood.',
      nearest_station_km: 6.1,
      nearest_station_name: 'Pwalugu Bridge Gauge',
      nearest_groundtruthed_station_km: 6.1,
      nearest_groundtruthed_station_name: 'Pwalugu Bridge Gauge',
      stations_within_15km: 3,
      groundtruthed_stations_within_15km: 1,
      nearest_facility_km: 3.2,
      nearest_facility_name: 'Bolgatanga Regional Hospital',
      nearest_hospital_km: 3.2,
      nearest_hospital_name: 'Bolgatanga Regional Hospital',
      facilities_within_10km: 12,
      hospitals_within_10km: 4,
    },
  },
];

const SAMPLE_STATIONS: GeoJSONPointFeature<MonitoringStationProperties>[] = [
  {
    type: 'Feature',
    geometry: { type: 'Point', coordinates: [-0.84, 10.73] },
    properties: {
      id: 'STA-1',
      station_number: '001',
      name: 'Pwalugu Bridge Gauge',
      river_or_site: 'White Volta',
      station_category: 'hydro_groundtruthed',
      category_label: 'Groundtruthed Hydrological Station',
      sensor_types: ['River Gauge'],
      groundtruthed: true,
      existing_infrastructure: 'Automatic Radar Gauge',
      elevation_m: 132,
      basin_area_sqkm: 63350,
      organization: 'Ghana Hydrological Authority',
      package_area: 'Pwalugu',
      telemetry_potential: 'VERY GOOD',
      path_loss_db: 112.4,
      region: 'Upper East',
      region_pcode: 'GH11',
      district: 'Talensi',
      district_pcode: 'GH1112',
      source_dataset: 'UNESCO IHP-WINS',
      source_url: 'https://ihp-wins.unesco.org/',
    },
  },
  {
    type: 'Feature',
    geometry: { type: 'Point', coordinates: [-0.21, 5.57] },
    properties: {
      id: 'STA-2',
      station_number: '002',
      name: 'Accra Legacy Gauge',
      river_or_site: 'Odaw',
      station_category: 'hydro_legacy_catalog',
      category_label: 'Legacy Catalog Station (Unverified)',
      sensor_types: ['Staff Gauge'],
      groundtruthed: false,
      existing_infrastructure: 'Manual Staff',
      elevation_m: 15,
      basin_area_sqkm: 250,
      organization: 'GHA',
      package_area: null,
      telemetry_potential: null,
      path_loss_db: null,
      region: 'Greater Accra',
      region_pcode: 'GH03',
      district: 'Accra Metropolis',
      district_pcode: 'GH0301',
      source_dataset: 'UNESCO IHP-WINS',
      source_url: 'https://ihp-wins.unesco.org/',
    },
  },
];

const SAMPLE_FACILITIES: GeoJSONPointFeature<HealthFacilityProperties>[] = [
  {
    type: 'Feature',
    geometry: { type: 'Point', coordinates: [-0.2, 5.562] },
    properties: {
      id: 'FAC-1',
      osm_id: '101',
      name: 'Ridge Regional Hospital',
      facility_type: 'Hospital',
      raw_amenity: 'hospital',
      operator_type: 'public',
      region: 'Greater Accra',
      region_pcode: 'GH03',
      district: 'Accra Metropolis',
      district_pcode: 'GH0301',
      source_url: 'https://data.humdata.org/',
    },
  },
  {
    type: 'Feature',
    geometry: { type: 'Point', coordinates: [-0.22, 5.58] },
    properties: {
      id: 'FAC-2',
      osm_id: '102',
      name: 'Kaneshie Polyclinic',
      facility_type: 'Clinic / Health Centre',
      raw_amenity: 'clinic',
      operator_type: 'public',
      region: 'Greater Accra',
      region_pcode: 'GH03',
      district: 'Accra Metropolis',
      district_pcode: 'GH0301',
      source_url: 'https://data.humdata.org/',
    },
  },
];

describe('Geospatial Coordinate Validation & Distance Utilities', () => {
  it('validates authentic Ghana coordinates and rejects out-of-bounds or Null Island coordinates', () => {
    expect(validateGhanaCoordinate(-0.187, 5.603)).toBe(true); // Accra
    expect(validateGhanaCoordinate(-1.624, 6.688)).toBe(true); // Kumasi
    expect(validateGhanaCoordinate(-0.853, 9.403)).toBe(true); // Tamale
    expect(validateGhanaCoordinate(0, 0)).toBe(false); // Null Island in Atlantic Ocean
    expect(validateGhanaCoordinate(2.5, 6.5)).toBe(false); // Benin/Nigeria
    expect(validateGhanaCoordinate(Number.NaN, 7.5)).toBe(false);
  });

  it('computes accurate spherical Haversine distances in kilometers', () => {
    const accra: [number, number] = [-0.187, 5.6037];
    const kumasi: [number, number] = [-1.6244, 6.6885];
    expect(haversineDistanceKm(accra, accra)).toBe(0);
    const dist = haversineDistanceKm(accra, kumasi);
    expect(dist).toBeGreaterThan(195);
    expect(dist).toBeLessThan(205);
    expect(haversineDistanceKm(accra, kumasi)).toBe(
      haversineDistanceKm(kumasi, accra)
    );
  });

  it('generates a closed geodesic circle polygon with vertices at the requested radius', () => {
    const center: [number, number] = [-1.05, 7.92];
    const poly = createCirclePolygon(center, 15, 32);
    expect(poly.type).toBe('Feature');
    expect(poly.geometry.type).toBe('Polygon');
    const ring = poly.geometry.coordinates[0];
    expect(ring.length).toBe(33);
    expect(ring[0]).toEqual(ring[ring.length - 1]);

    // Check distance of sample vertex from center is ~15 km
    const vertexDist = haversineDistanceKm(center, ring[8]);
    expect(vertexDist).toBeGreaterThan(14.8);
    expect(vertexDist).toBeLessThan(15.2);
  });
});

describe('Flood Event Multi-Criteria Filtering & Proximity Analysis', () => {
  const baseFilters: FilterState = {
    searchQuery: '',
    selectedRegion: 'ALL',
    selectedSource: 'ALL',
    selectedSeverity: 'ALL',
    yearRange: [1988, 2026],
    onlyUnmonitored15km: false,
  };

  it('filters flood events by region, source, severity, year range, unmonitored status, and search query', () => {
    expect(filterFloodEvents(SAMPLE_FLOODS, baseFilters)).toHaveLength(2);

    // Filter by region
    expect(
      filterFloodEvents(SAMPLE_FLOODS, {
        ...baseFilters,
        selectedRegion: 'Upper East',
      })
    ).toHaveLength(1);

    // Filter by secondary cross-linked source (GLIDE)
    expect(
      filterFloodEvents(SAMPLE_FLOODS, {
        ...baseFilters,
        selectedSource: 'GLIDE',
      })
    ).toHaveLength(1);

    // Filter by severity
    expect(
      filterFloodEvents(SAMPLE_FLOODS, {
        ...baseFilters,
        selectedSeverity: 'Extreme',
      })
    ).toHaveLength(1);

    // Filter by unmonitored <= 15 km
    const unmonitoredOnly = filterFloodEvents(SAMPLE_FLOODS, {
      ...baseFilters,
      onlyUnmonitored15km: true,
    });
    expect(unmonitoredOnly).toHaveLength(1);
    expect(unmonitoredOnly[0].properties.id).toBe('DFO-4254');

    // Filter by search query matching river or GLIDE ID
    expect(
      filterFloodEvents(SAMPLE_FLOODS, {
        ...baseFilters,
        searchQuery: 'bagre dam',
      })
    ).toHaveLength(1);
  });

  it('computes proximity analysis with straight-line and estimated road travel distance intervals', () => {
    const prox = computeProximityAnalysis(
      SAMPLE_FLOODS[0],
      10,
      SAMPLE_FACILITIES,
      SAMPLE_STATIONS
    );
    expect(prox.radiusKm).toBe(10);
    expect(prox.facilitiesInRadius).toHaveLength(2);
    expect(prox.hospitalsInRadiusCount).toBe(1);
    expect(prox.clinicsInRadiusCount).toBe(1);
    expect(prox.nearestHospital?.feature.properties.name).toBe(
      'Ridge Regional Hospital'
    );
    expect(prox.nearestHospital?.estimatedRoadRangeKm[0]).toBeGreaterThan(0);
    expect(prox.nearestHospital?.estimatedRoadRangeKm[1]).toBeGreaterThan(
      prox.nearestHospital!.estimatedRoadRangeKm[0]
    );
    expect(prox.groundtruthedStationsInRadiusCount).toBe(0);
  });

  it('computes dynamic filtered insights accurately', () => {
    const insights = computeFilteredInsights(
      SAMPLE_FLOODS,
      SAMPLE_STATIONS,
      SAMPLE_FACILITIES,
      [],
      'ALL'
    );
    expect(insights.eventCount).toBe(2);
    expect(insights.unmonitored15kmCount).toBe(1);
    expect(insights.unmonitored15kmPct).toBe(50);
    expect(insights.totalFatalitiesReported).toBe(179);
  });
});

describe('Production Geospatial Dataset Integrity Gate', () => {
  it('verifies all processed GeoJSON datasets in public/data/ contain authentic, in-bounds Ghana records', () => {
    const dataDir = path.resolve(process.cwd(), 'public', 'data');
    const floodsRaw = fs.readFileSync(
      path.join(dataDir, 'flood_events.geojson'),
      'utf-8'
    );
    const stationsRaw = fs.readFileSync(
      path.join(dataDir, 'monitoring_stations.geojson'),
      'utf-8'
    );
    const facilitiesRaw = fs.readFileSync(
      path.join(dataDir, 'health_facilities.geojson'),
      'utf-8'
    );
    const summaryRaw = fs.readFileSync(
      path.join(dataDir, 'dataset_summary.json'),
      'utf-8'
    );

    const floods = JSON.parse(
      floodsRaw
    ) as GeoJSONFeatureCollection<GeoJSONPointFeature<FloodEventProperties>>;
    const stations = JSON.parse(
      stationsRaw
    ) as GeoJSONFeatureCollection<
      GeoJSONPointFeature<MonitoringStationProperties>
    >;
    const facilities = JSON.parse(
      facilitiesRaw
    ) as GeoJSONFeatureCollection<GeoJSONPointFeature<HealthFacilityProperties>>;
    const summary = JSON.parse(summaryRaw) as DatasetSummary;

    expect(floods.features.length).toBe(65);
    expect(stations.features.length).toBe(253);
    expect(facilities.features.length).toBe(1226);
    expect(summary.counts.flood_events_total).toBe(65);

    // Every single flood event must lie within Ghana's territorial bounding box
    for (const f of floods.features) {
      const [lon, lat] = f.geometry.coordinates;
      expect(validateGhanaCoordinate(lon, lat)).toBe(true);
      expect(f.properties.region).toBeTruthy();
      expect(f.properties.district).toBeTruthy();
    }
  });
});
