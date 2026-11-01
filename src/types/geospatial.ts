export type FloodSource = 'DFO' | 'GDACS' | 'IDMC' | 'GLIDE';

export type SeverityLabel = 'Moderate' | 'High' | 'Extreme';

export type CoordinatePrecision =
  | 'exact_locality'
  | 'district_centroid'
  | 'basin_polygon_centroid'
  | 'regional_approximation';

export interface FloodEventProperties {
  id: string;
  title: string;
  start_date: string;
  end_date: string;
  year: number;
  region: string;
  region_pcode: string;
  district: string;
  district_pcode: string;
  location_description: string;
  rivers: string;
  primary_source: FloodSource;
  all_sources: FloodSource[];
  source_org: string;
  source_url: string;
  glide_number: string | null;
  cause: string;
  severity_label: SeverityLabel;
  fatalities: number;
  displaced_or_affected: number;
  reported_area_sqkm: number | null;
  bbox: [number, number, number, number] | null;
  coordinate_precision: CoordinatePrecision;
  precision_note: string;
  original_source_coords: [number, number];
  description: string;
  nearest_station_km: number | null;
  nearest_station_name: string | null;
  nearest_groundtruthed_station_km: number | null;
  nearest_groundtruthed_station_name: string | null;
  stations_within_15km: number;
  groundtruthed_stations_within_15km: number;
  nearest_facility_km: number | null;
  nearest_facility_name: string | null;
  nearest_hospital_km: number | null;
  nearest_hospital_name: string | null;
  facilities_within_10km: number;
  hospitals_within_10km: number;
}

export interface GeoJSONPointFeature<P> {
  type: 'Feature';
  geometry: {
    type: 'Point';
    coordinates: [number, number];
  };
  properties: P;
}

export interface GeoJSONFeatureCollection<F> {
  type: 'FeatureCollection';
  features: F[];
}

export type StationCategory =
  | 'hydro_groundtruthed'
  | 'iot_telemetry_node'
  | 'hydro_legacy_catalog';

export interface MonitoringStationProperties {
  id: string;
  station_number: string;
  name: string;
  river_or_site: string;
  station_category: StationCategory;
  category_label: string;
  sensor_types: string[];
  groundtruthed: boolean;
  existing_infrastructure: string;
  elevation_m: number | null;
  basin_area_sqkm: number | null;
  organization: string;
  package_area: string | null;
  telemetry_potential: string | null;
  path_loss_db: number | null;
  region: string;
  region_pcode: string;
  district: string;
  district_pcode: string;
  source_dataset: string;
  source_url: string;
}

export interface IoTTelemetryLinkProperties {
  id: string;
  package_area: string;
  sensor_id: string;
  sensor_name: string;
  gateway_name: string;
  distance_km: number;
  free_path_loss_db: number | null;
  itwom_path_loss_db: number | null;
  potential: string;
}

export interface HealthFacilityProperties {
  id: string;
  osm_id: string | null;
  name: string;
  facility_type: string;
  raw_amenity: string;
  operator_type: string;
  region: string;
  region_pcode: string;
  district: string;
  district_pcode: string;
  source_url: string;
}

export interface RoadProperties {
  id: string;
  name: string;
  axis: string;
  road_type: string;
  category: string;
  distance_km: number | null;
}

export interface RegionSummaryProperties {
  adm1_name: string;
  adm1_pcode: string;
  area_sqkm: number;
  center_lon: number;
  center_lat: number;
  flood_event_count: number;
  health_facility_count: number;
  hospital_count: number;
  monitoring_station_count: number;
  groundtruthed_station_count: number;
  iot_node_count: number;
  total_population: number;
  rp100_exposed_hospitals: number;
  rp100_exposed_primary_care: number;
  rp100_exposed_schools: number;
  rp100_exposed_crops_km2: number;
  rp100_exposed_children_u5: number;
}

export interface DistrictSummary {
  adm2_pcode: string;
  adm2_name: string;
  adm1_name: string;
  adm1_pcode: string;
  center_lon: number;
  center_lat: number;
  area_sqkm: number;
  total_pop: number;
  hospitals_total: number;
  primary_care_total: number;
  rp100_exposed_hospitals: number;
  rp100_exposed_primary_care: number;
  rp100_exposed_schools: number;
  rp100_exposed_crops_km2: number;
  rp100_exposed_children_u5: number;
}

export interface DatasetSummary {
  generated_at: string;
  counts: {
    flood_events_total: number;
    flood_events_by_primary_source: Record<FloodSource, number>;
    year_min: number;
    year_max: number;
    monitoring_stations_total: number;
    hydro_groundtruthed_count: number;
    hydro_legacy_catalog_count: number;
    iot_telemetry_nodes_count: number;
    iot_telemetry_links_count: number;
    health_facilities_total: number;
    hospitals_total: number;
    clinics_and_centres_total: number;
    road_segments_total: number;
    regions_total: number;
    districts_total: number;
  };
  national_insights: {
    events_without_groundtruthed_station_within_15km: number;
    pct_events_without_groundtruthed_station_within_15km: number;
    events_without_any_station_within_15km: number;
    pct_events_without_any_station_within_15km: number;
    avg_nearest_groundtruthed_station_km: number;
    avg_nearest_hospital_km: number;
    groundtruthed_ratio_pct: number;
    rp100_exposed_hospitals_national: number;
    rp100_exposed_primary_care_national: number;
    rp100_exposed_schools_national: number;
    rp100_exposed_children_u5_national: number;
  };
  regions: RegionSummaryProperties[];
}

export interface FilterState {
  searchQuery: string;
  selectedRegion: string;
  selectedSource: string;
  selectedSeverity: string;
  yearRange: [number, number];
  onlyUnmonitored15km: boolean;
}

export interface LayerVisibilityState {
  floodEvents: boolean;
  monitoringGroundtruthed: boolean;
  monitoringIoT: boolean;
  monitoringLegacy: boolean;
  iotTelemetryLinks: boolean;
  healthFacilities: boolean;
  roadNetwork: boolean;
  regionChoropleth: boolean;
}

export type BaseMapStyleId = 'aws-light' | 'aws-dark' | 'carto-positron';
