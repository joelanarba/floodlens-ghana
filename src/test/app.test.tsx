import React from 'react';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import App from '../App';

const MOCK_FLOODS = {
  type: 'FeatureCollection',
  features: [
    {
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [0.058, 6.124] },
      properties: {
        id: 'GDACS-1102198',
        title: '2023 Lower Volta Akosombo & Kpong Dam Spillage Flood',
        start_date: '2023-10-12',
        end_date: '2023-11-15',
        year: 2023,
        region: 'Volta',
        region_pcode: 'GH15',
        district: 'North Tongu',
        district_pcode: 'GH1512',
        location_description: 'Mepe, Battor, Sogakope, Lower Volta Basin',
        rivers: 'Lower Volta River',
        primary_source: 'GDACS',
        all_sources: ['GDACS', 'GLIDE'],
        source_org: 'EC JRC GDACS',
        source_url: 'https://www.gdacs.org/',
        glide_number: 'FL-2023-000201-GHA',
        cause: 'Controlled Dam Spillage and Heavy Rainfall',
        severity_label: 'Extreme',
        fatalities: 0,
        displaced_or_affected: 35857,
        reported_area_sqkm: 1850,
        bbox: null,
        coordinate_precision: 'exact_locality',
        precision_note: 'Snapped to Mepe/Battor corridor on the Lower Volta.',
        original_source_coords: [0.058, 6.124],
        description:
          'Controlled spillage from Akosombo and Kpong Hydroelectric Dams displaced over 35,800 residents across North, Central, and South Tongu.',
        nearest_station_km: 19.4,
        nearest_station_name: 'Sogakope Bridge Gauge',
        nearest_groundtruthed_station_km: 41.2,
        nearest_groundtruthed_station_name: 'Senchi Ferry Gauge',
        stations_within_15km: 0,
        groundtruthed_stations_within_15km: 0,
        nearest_facility_km: 2.3,
        nearest_facility_name: 'Battor Catholic Hospital',
        nearest_hospital_km: 2.3,
        nearest_hospital_name: 'Battor Catholic Hospital',
        facilities_within_10km: 6,
        hospitals_within_10km: 2,
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
  ],
};

const MOCK_STATIONS = {
  type: 'FeatureCollection',
  features: [
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
  ],
};

const MOCK_FACILITIES = {
  type: 'FeatureCollection',
  features: [
    {
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [0.06, 6.08] },
      properties: {
        id: 'FAC-1',
        osm_id: '101',
        name: 'Battor Catholic Hospital',
        facility_type: 'Hospital',
        raw_amenity: 'hospital',
        operator_type: 'public',
        region: 'Volta',
        region_pcode: 'GH15',
        district: 'North Tongu',
        district_pcode: 'GH1512',
        source_url: 'https://data.humdata.org/',
      },
    },
  ],
};

const MOCK_SUMMARY = {
  generated_at: '2026-11-01T00:00:00Z',
  counts: {
    flood_events_total: 2,
    flood_events_by_primary_source: { DFO: 0, GDACS: 2, IDMC: 0, GLIDE: 0 },
    year_min: 2019,
    year_max: 2023,
    monitoring_stations_total: 1,
    hydro_groundtruthed_count: 1,
    hydro_legacy_catalog_count: 0,
    iot_telemetry_nodes_count: 0,
    iot_telemetry_links_count: 0,
    health_facilities_total: 1,
    hospitals_total: 1,
    clinics_and_centres_total: 0,
    road_segments_total: 0,
    regions_total: 2,
    districts_total: 2,
  },
  national_insights: {
    events_without_groundtruthed_station_within_15km: 1,
    pct_events_without_groundtruthed_station_within_15km: 50,
    events_without_any_station_within_15km: 1,
    pct_events_without_any_station_within_15km: 50,
    avg_nearest_groundtruthed_station_km: 23.7,
    avg_nearest_hospital_km: 2.8,
    groundtruthed_ratio_pct: 100,
    rp100_exposed_hospitals_national: 12,
    rp100_exposed_primary_care_national: 11,
    rp100_exposed_schools_national: 142,
    rp100_exposed_children_u5_national: 194777,
  },
  regions: [
    {
      adm1_name: 'Volta',
      adm1_pcode: 'GH15',
      area_sqkm: 9500,
      center_lon: 0.45,
      center_lat: 6.5,
      flood_event_count: 1,
      health_facility_count: 1,
      hospital_count: 1,
      monitoring_station_count: 0,
      groundtruthed_station_count: 0,
      iot_node_count: 0,
      total_population: 1659040,
      rp100_exposed_hospitals: 2,
      rp100_exposed_primary_care: 1,
      rp100_exposed_schools: 15,
      rp100_exposed_crops_km2: 40,
      rp100_exposed_children_u5: 18500,
    },
  ],
};

describe('FloodLens Ghana Application UI & Interaction Suite', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.stubGlobal(
      'fetch',
      vi.fn((url: string) => {
        if (url.includes('flood_events.geojson')) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve(MOCK_FLOODS),
          });
        }
        if (url.includes('monitoring_stations.geojson')) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve(MOCK_STATIONS),
          });
        }
        if (url.includes('health_facilities.geojson')) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve(MOCK_FACILITIES),
          });
        }
        if (url.includes('dataset_summary.json')) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve(MOCK_SUMMARY),
          });
        }
        return Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({ type: 'FeatureCollection', features: [] }),
        });
      })
    );
  });

  it('renders the application, displays flood events, and supports search, filtering, and empty state reset', async () => {
    render(<App />);

    await waitFor(() => {
      expect(screen.getByText('FloodLens Ghana')).toBeInTheDocument();
    });

    // Check core insight metrics
    expect(screen.getByTestId('metric-unmonitored-pct')).toHaveTextContent(
      '50%'
    );

    // Search for an event
    const searchInput = screen.getByTestId('search-events-input');
    fireEvent.change(searchInput, { target: { value: 'Akosombo' } });
    expect(screen.getByTestId('metric-unmonitored-pct')).toHaveTextContent(
      '100%'
    );

    // Search for a non-existent keyword to verify empty state
    fireEvent.change(searchInput, {
      target: { value: 'NonExistentFloodQuery999' },
    });
    expect(screen.getByTestId('empty-events-state')).toBeInTheDocument();

    // Click Reset Filters
    fireEvent.click(screen.getByTestId('reset-filters-btn'));
    expect(screen.getByTestId('events-list-container')).toBeInTheDocument();
  });

  it('opens the Event Inspector when an event card is clicked and updates proximity buffer radii', async () => {
    render(<App />);

    await waitFor(() => {
      expect(
        screen.getByTestId('event-card-GDACS-1102198')
      ).toBeInTheDocument();
    });

    fireEvent.click(screen.getByTestId('event-card-GDACS-1102198'));

    expect(screen.getByTestId('event-inspector-detail')).toBeInTheDocument();
    expect(
      screen.getByText(/Controlled spillage from Akosombo/i)
    ).toBeInTheDocument();
    expect(
      screen.getAllByText('Battor Catholic Hospital').length
    ).toBeGreaterThanOrEqual(1);

    // Change proximity radius to 25 km
    fireEvent.click(screen.getByTestId('radius-btn-25'));
    expect(
      screen.getByText(/Facilities & Stations Within 25 km/i)
    ).toBeInTheDocument();
  });

  it('toggles map layer checkboxes and opens the Sources & Methodology modal', async () => {
    render(<App />);

    await waitFor(() => {
      expect(screen.getByTestId('map-legend-panel')).toBeInTheDocument();
    });

    const groundtruthedCheckbox = screen.getByTestId(
      'toggle-layer-monitoringGroundtruthed'
    ) as HTMLInputElement;
    expect(groundtruthedCheckbox.checked).toBe(true);
    fireEvent.click(groundtruthedCheckbox);
    expect(groundtruthedCheckbox.checked).toBe(false);

    // Open Methodology Modal
    fireEvent.click(screen.getByText(/Sources & Methodology/i));
    expect(screen.getByTestId('methodology-modal')).toBeInTheDocument();
    expect(
      screen.getByText(/1. Authentic Geospatial Datasets & Attribution/i)
    ).toBeInTheDocument();

    // Close Modal
    fireEvent.click(screen.getByTestId('close-methodology-modal'));
    expect(screen.queryByTestId('methodology-modal')).not.toBeInTheDocument();
  });

  it('renders a clean error state when dataset fetching fails', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() => Promise.resolve({ ok: false, status: 500 }))
    );

    render(<App />);

    await waitFor(() => {
      expect(screen.getByTestId('error-screen')).toBeInTheDocument();
    });
    expect(
      screen.getByText(/Unable to Load Geospatial Datasets/i)
    ).toBeInTheDocument();
  });
});
