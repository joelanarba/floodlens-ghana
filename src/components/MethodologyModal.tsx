import React, { useEffect } from 'react';
import {
  Cloud,
  Database,
  ExternalLink,
  Scale,
  ShieldAlert,
  X,
} from 'lucide-react';
import { DatasetSummary } from '../types/geospatial';

interface MethodologyModalProps {
  isOpen: boolean;
  onClose: () => void;
  datasetSummary: DatasetSummary | null;
}

export const MethodologyModal: React.FC<MethodologyModalProps> = ({
  isOpen,
  onClose,
  datasetSummary,
}) => {
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-[#0E2029]/75 backdrop-blur-xs"
      role="dialog"
      aria-modal="true"
      aria-labelledby="methodology-modal-title"
      data-testid="methodology-modal"
      onClick={onClose}
    >
      <div
        className="bg-[#F6F7F3] border border-[#244352] rounded-md shadow-2xl w-full max-w-4xl max-h-[88vh] flex flex-col overflow-hidden text-[#142C38]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="bg-[#142C38] text-[#F6F7F3] px-5 py-3.5 flex items-center justify-between border-b border-[#244352] shrink-0">
          <div className="flex items-center gap-2.5">
            <Database className="w-5 h-5 text-[#9BD5CD]" aria-hidden="true" />
            <div>
              <h2
                id="methodology-modal-title"
                className="text-base font-bold tracking-tight"
              >
                Data Provenance, Spatial Methodology &amp; AWS Architecture
              </h2>
              <p className="text-xs text-[#B5C2C9]">
                Transparent documentation of datasets, licenses, coordinate validation, and analytical boundaries
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            data-testid="close-methodology-modal"
            className="p-1.5 rounded bg-[#1D3B4A] hover:bg-[#2A5266] text-[#F6F7F3] cursor-pointer"
            aria-label="Close methodology dialog"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-5 overflow-y-auto space-y-5 text-xs leading-relaxed">
          {/* Section 1: Verified Datasets & Provenance */}
          <section className="space-y-2.5">
            <h3 className="text-sm font-bold text-[#142C38] flex items-center gap-2 border-b border-[#CFD6D2] pb-1.5">
              <Database className="w-4 h-4 text-[#18766B]" />
              <span>1. Authentic Geospatial Datasets &amp; Attribution</span>
            </h3>
            <p className="text-[#425560]">
              Every marker, line, and boundary in FloodLens Ghana is derived from published, non-fabricated scientific and humanitarian datasets. All raw records were validated against Ghana&apos;s administrative boundaries (<code>ADM1</code> 16 Regions and <code>ADM2</code> 260 Districts) in{' '}
              <code>scripts/build_geospatial_datasets.py</code>.
            </p>

            <div className="overflow-x-auto border border-[#C8D1CD] rounded bg-white">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-[#142C38] text-[#F6F7F3]">
                    <th className="py-2 px-3 font-semibold">Dataset Layer</th>
                    <th className="py-2 px-3 font-semibold">Publisher &amp; Source</th>
                    <th className="py-2 px-3 font-semibold">Ghana Records</th>
                    <th className="py-2 px-3 font-semibold">License</th>
                    <th className="py-2 px-3 font-semibold">Source Link</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E6EBE8]">
                  <tr>
                    <td className="py-2 px-3 font-bold text-[#142C38]">
                      Historical Flood Events (1988 to 2026)
                    </td>
                    <td className="py-2 px-3 text-[#425560]">
                      Dartmouth Flood Observatory (DFO / USGS GFID), EC JRC GDACS/GloFAS, IDMC GIDD, &amp; UN OCHA GLIDE
                    </td>
                    <td className="py-2 px-3 font-mono-code font-bold text-[#B64B43]">
                      {datasetSummary?.counts.flood_events_total || 65} events
                    </td>
                    <td className="py-2 px-3 text-[#425560]">
                      CC BY 4.0 / Public Domain (USGS) / EC JRC Open
                    </td>
                    <td className="py-2 px-3">
                      <a
                        href="https://www.gdacs.org/"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-[#18766B] font-semibold hover:underline inline-flex items-center gap-1"
                      >
                        GDACS / DFO <ExternalLink className="w-3 h-3" />
                      </a>
                    </td>
                  </tr>

                  <tr>
                    <td className="py-2 px-3 font-bold text-[#142C38]">
                      Hydrometeorological &amp; IoT Telemetry Stations
                    </td>
                    <td className="py-2 px-3 text-[#425560]">
                      UNESCO IHP-WINS, Ghana Meteorological Agency (GMet), Ghana Hydrological Authority (GHA), &amp; GARNET
                    </td>
                    <td className="py-2 px-3 font-mono-code font-bold text-[#18766B]">
                      {datasetSummary?.counts.monitoring_stations_total || 253} stations (36 groundtruthed, 24 IoT, 14 links)
                    </td>
                    <td className="py-2 px-3 text-[#425560]">
                      CC BY-SA 3.0 IGO (PII &amp; device keys stripped)
                    </td>
                    <td className="py-2 px-3">
                      <a
                        href="https://ihp-wins.unesco.org/dataset/potential-internet-of-things-set-up-ghana"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-[#18766B] font-semibold hover:underline inline-flex items-center gap-1"
                      >
                        UNESCO IHP-WINS <ExternalLink className="w-3 h-3" />
                      </a>
                    </td>
                  </tr>

                  <tr>
                    <td className="py-2 px-3 font-bold text-[#142C38]">
                      Clinical Healthcare Facilities
                    </td>
                    <td className="py-2 px-3 text-[#425560]">
                      Humanitarian OpenStreetMap Team (HOTOSM) &amp; Ghana Health Service (via HDX)
                    </td>
                    <td className="py-2 px-3 font-mono-code font-bold text-[#1D4E78]">
                      {datasetSummary?.counts.health_facilities_total || 1226} clinical facilities (481 hospitals, 745 clinics)
                    </td>
                    <td className="py-2 px-3 text-[#425560]">
                      ODbL 1.0 (OpenStreetMap Contributors)
                    </td>
                    <td className="py-2 px-3">
                      <a
                        href="https://data.humdata.org/dataset/hotosm_gha_health_facilities"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-[#18766B] font-semibold hover:underline inline-flex items-center gap-1"
                      >
                        HDX HOTOSM <ExternalLink className="w-3 h-3" />
                      </a>
                    </td>
                  </tr>

                  <tr>
                    <td className="py-2 px-3 font-bold text-[#142C38]">
                      Primary Road Network
                    </td>
                    <td className="py-2 px-3 text-[#425560]">
                      Ghana Road Network Main Roads (AmeriGEOSS / WFP / DCW)
                    </td>
                    <td className="py-2 px-3 font-mono-code font-bold text-[#9E6B25]">
                      {datasetSummary?.counts.road_segments_total || 382} classified highway segments
                    </td>
                    <td className="py-2 px-3 text-[#425560]">
                      CC BY-IGO / Open Humanitarian
                    </td>
                    <td className="py-2 px-3">
                      <a
                        href="https://data.amerigeoss.org/dataset/ghana-road-network-main-roads"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-[#18766B] font-semibold hover:underline inline-flex items-center gap-1"
                      >
                        AmeriGEOSS <ExternalLink className="w-3 h-3" />
                      </a>
                    </td>
                  </tr>

                  <tr>
                    <td className="py-2 px-3 font-bold text-[#142C38]">
                      Admin Boundaries &amp; RP100 Flood Exposure
                    </td>
                    <td className="py-2 px-3 text-[#425560]">
                      Ghana Statistical Service (COD-AB) &amp; Heidelberg Institute for Geoinformation Technology (HeiGIT)
                    </td>
                    <td className="py-2 px-3 font-mono-code font-bold text-[#142C38]">
                      16 Regions &amp; 260 Districts
                    </td>
                    <td className="py-2 px-3 text-[#425560]">
                      CC BY 4.0
                    </td>
                    <td className="py-2 px-3">
                      <a
                        href="https://data.humdata.org/dataset/ghana-flood-risk-indicators"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-[#18766B] font-semibold hover:underline inline-flex items-center gap-1"
                      >
                        HeiGIT / HDX <ExternalLink className="w-3 h-3" />
                      </a>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </section>

          {/* Section 2: Spatial Methodology & Limitations */}
          <section className="space-y-2.5">
            <h3 className="text-sm font-bold text-[#142C38] flex items-center gap-2 border-b border-[#CFD6D2] pb-1.5">
              <Scale className="w-4 h-4 text-[#18766B]" />
              <span>2. Spatial Calculation Methodology &amp; Limitations</span>
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="bg-white p-3 rounded border border-[#D4DBD7] space-y-1">
                <div className="font-bold text-[#142C38]">
                  Coordinate Validation &amp; Precision Classes
                </div>
                <p className="text-[#425560]">
                  Every flood event is tagged with one of four explicit coordinate precision classes: <code>exact_locality</code> (24 events), <code>district_centroid</code> (12 events), <code>basin_polygon_centroid</code> (28 events), or <code>regional_approximation</code> (1 event). Coarse national centroids from multi-country satellite polygons were snapped to their documented Ghanaian river-basin locality while preserving <code>original_source_coords</code> for auditability.
                </p>
              </div>

              <div className="bg-white p-3 rounded border border-[#D4DBD7] space-y-1">
                <div className="font-bold text-[#142C38]">
                  Haversine vs. Road Network Detour Estimation
                </div>
                <p className="text-[#425560]">
                  Interactive proximity buffers (5 km to 50 km) use spherical Haversine distance (<code>R = 6371.0088 km</code>). Because river crossings restrict direct travel during flood events, the Inspector also computes an explicit <code>1.35x to 1.85x</code> road travel distance interval for every nearby healthcare facility.
                </p>
              </div>
            </div>

            <div className="bg-[#F4E3E1] border border-[#DEB2AD] rounded p-3 flex items-start gap-2.5 text-[#8C322B]">
              <ShieldAlert className="w-4 h-4 shrink-0 mt-0.5" />
              <div>
                <strong>Critical Interpretation Boundary:</strong> Proximity to a documented flood centroid does not prove that a specific hospital or clinic was physically inundated, and absence of a historical flood marker does not certify that a location is safe from future flooding.
              </div>
            </div>
          </section>

          {/* Section 3: AWS Architecture */}
          <section className="space-y-2.5">
            <h3 className="text-sm font-bold text-[#142C38] flex items-center gap-2 border-b border-[#CFD6D2] pb-1.5">
              <Cloud className="w-4 h-4 text-[#18766B]" />
              <span>3. Serverless AWS Cloud Architecture</span>
            </h3>
            <p className="text-[#425560]">
              FloodLens Ghana uses a low-cost, security-hardened serverless AWS architecture in <code>us-east-1</code> under the isolated resource prefix <code>floodlens-mapit-2026</code>:
            </p>
            <ul className="list-disc pl-5 space-y-1 text-[#425560]">
              <li>
                <strong>Amazon Location Service:</strong> Provides vector basemap styles (<code>floodlens-mapit-2026-light</code> using <code>VectorOpenDataVisualizationLight</code> and <code>floodlens-mapit-2026-dark</code> using <code>VectorOpenDataVisualizationDark</code>) authenticated via a read-only tile API key restricted strictly to <code>geo:GetMap*</code> actions.
              </li>
              <li>
                <strong>Amazon S3 (Private Origin Bucket):</strong> Stores the compiled static web application and validated GeoJSON/JSON data layers with S3 Block Public Access enabled.
              </li>
              <li>
                <strong>Amazon CloudFront (Global CDN with Origin Access Control):</strong> Serves the application and geospatial datasets over HTTPS via Origin Access Control (OAC) with Brotli/Gzip compression.
              </li>
            </ul>
          </section>
        </div>

        {/* Modal Footer */}
        <div className="bg-[#EBECE6] border-t border-[#CFD6D2] px-5 py-3 flex items-center justify-between shrink-0">
          <span className="text-[11px] text-[#526875] font-mono-code">
            AWS Builder Center Weekend Challenge: Map It (Nov 2026)
          </span>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 rounded bg-[#18766B] hover:bg-[#135E55] text-white text-xs font-semibold cursor-pointer"
          >
            Return to Interactive Map
          </button>
        </div>
      </div>
    </div>
  );
};
