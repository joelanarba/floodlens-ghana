# FloodLens Ghana: Execution Log

## Phase 1: Environment, Eligibility, and Account Safety Inspection
**Timestamp:** 2026-11-01T05:31:34Z

### 1. Local Environment & Tooling
- **Workspace:** `c:\dev\Projects\FloodLens` (initially empty)
- **OS:** Windows 11 (AMD64)
- **Node.js:** v24.13.1
- **npm:** 11.8.0
- **Python:** 3.14.3
- **Git:** 2.53.0.windows.3
- **AWS CLI:** 2.35.20
- **GitHub CLI:** 2.96.0 (`gh auth status` verified active account `joelanarba`)
- **Git Identity Configured:**
  - `user.name`: `joelanarba`
  - `user.email`: `anarbajoel@gmail.com`
  - Verified against authorized identity rule (`joelanarba`).

### 2. AWS Profile & Account Safety Verification
- Executed `aws configure list-profiles`:
  - Found two profiles: `default` and `Builder-challenges`.
- Checked `default` profile (`aws sts get-caller-identity`):
  - Returned `InvalidClientTokenId` (inactive/expired).
- Checked `Builder-challenges` profile (`aws sts get-caller-identity --profile Builder-challenges`):
  - **Account:** `694069618970` (masked in public docs as `6940****8970`)
  - **IAM User ARN:** `arn:aws:iam::694069618970:user/Builder-challenges`
  - **Authorization Assessment:** Unambiguously dedicated to AWS Builder Challenges (`Builder-challenges`), not associated with TEDx or unrelated workloads. All AWS CLI operations explicitly pass `--profile Builder-challenges --region us-east-1`.

---

## Phase 2: Data Research, Acquisition, Validation, and Processing
**Timestamp:** 2026-11-01T05:55:00Z

### 1. Datasets Evaluated & Acquired
- **USGS Global Flood Impacts Database (GFID) (`10.5066/P135ARGI`) / Dartmouth Flood Observatory (DFO)**:
  - Inspected FGDC XML metadata (`USGS.69e7d2bab66b0164d0f72e1c.xml`) from `data.usgs.gov` and retrieved the underlying DFO global flood polygon/point archives via HDX (`wlf_nhr_fl_dfomasterlist_20190418.zip`) and Cloud-to-Street (`dfo_polys_20191203.shp`/`.dbf`).
  - Extracted **25 Ghana historical flood events (1988 to 2019)** and refined 5 multi-country/full-country polygon centroids to their documented Ghana impact districts while preserving `original_source_coords` and `bbox`.
- **GDACS / Copernicus GloFAS Global Flood Alert API**:
  - Queried `https://www.gdacs.org/gdacsapi/api/events/geteventlist/SEARCH?eventlist=FL&country=Ghana&fromDate=2000-01-01&toDate=2026-11-01&alertlevel=Green;Orange;Red`.
  - Retrieved **41 flood alert features** (`12` linked to pre-2017 DFO Ghana records, `1` excluded in Cote d'Ivoire, and **28 distinct 2019 to 2026 GloFAS/JRC flood events** inside Ghana).
- **UN OCHA GLIDE Disaster Registry (`gha-glide-events`)**:
  - Retrieved `36` disaster records for Ghana (`15` flood `FL` events). Linked `10` overlapping records to DFO/GDACS events, excluded `1` empty `(0,0)` duplicate stub (`FL-2018-000153-GHA`), and retained **5 standalone GLIDE flood events** (including `FL-2023-000215-GHA`, the October 2023 Akosombo/Kpong Dam Spillage in Lower Volta).
- **IDMC Internal Displacement Updates (`gha-idmc-idu-events`)**:
  - Retrieved `17` displacement records (`9` flood and coastal storm surge rows). Excluded `1` triangulation duplicate, merged `1` overlapping event (`516058` Hohoe September 2026 flood) with `GDACS-1104196`, corrected a Prime Meridian longitude sign error (`+0.528` -> `-0.528`) on row `516061` (`North East Gonja`), and retained **7 standalone 2025 to 2026 flood and coastal storm-surge events**.
- **UNESCO IHP-WINS Ghana Hydrometeorological Monitoring Dataset**:
  - Downloaded `4-9-2025-coordinates-water-level-sensor-locations.csv` (`248` gauges), `groundtruthed_water_level_locations.csv` (`54` groundtruthed gauges), and `packages-ghana-official-mission-2-4.csv` (`32` IoT rows).
  - Stripped all personal contact columns (`Focal Point Name`, `WhatsApp`, `Email`) and hardware keys (`Application Key`, `Device EUI`, `Serial Number`) from `unesco_iot_packages_mission.csv` in-place.
  - Filtered to Ghana's territory (`229` river gauges: `36` groundtruthed, `193` unverified catalog gauges) plus `24` colocated IoT telemetry sites (**253 total monitoring stations**) and **14 LoRaWAN telemetry links** (`iot_telemetry_links.geojson`).
- **HOTOSM / HDX Ghana Health Facilities (`hotosm_gha_health_facilities`)**:
  - Filtered `2,592` raw features to **1,226 clinical healthcare facilities** (`481` hospitals, `745` clinics/health centres/CHPS posts), excluding `1,366` retail pharmacies and non-clinical storefronts.
- **HDX / DCW Ghana Road Network (`GHA_rds_1m_dcw.shp`)**:
  - Filtered `1,075` raw segments to **382 classified National, Inter-Regional, Regional, and Main/Secondary/Tertiary road segments**.
- **GSS / UN OCHA Admin Boundaries (`cod-ab-gha`) & HeiGIT Flood Exposure Indicators (`ghana---risk-assessment-indicators`)**:
  - Joined **16 Regions (`ADM1`)** and **260 Districts (`ADM2`)** with 100-year return period ($\ge 30\text{ cm}$ depth) flood exposure metrics for hospitals, primary healthcare, schools, cropland, and children under 5.

### 2. Dataset Validation Gate Decision
- **Outcome:** **PASS: FloodLens Ghana Confirmed.**
- With **65 harmonized, verified historical flood events (1988 to 2026)**, **253 monitoring stations**, **1,226 clinical healthcare facilities**, **382 classified road corridors**, and **260 district flood exposure profiles**, the dataset provides a strong, authentic evidentiary foundation without any synthetic or fabricated records.

---

## Phase 3: Amazon Location Service Provisioning & Frontend Implementation
**Timestamp:** 2026-11-01T06:08:00Z

### 1. Amazon Location Service Resources (`us-east-1`)
- Provisioned two vector map resources using `RequestBasedUsage` pricing:
  - `floodlens-mapit-2026-light` (`arn:aws:geo:us-east-1:694069618970:map/floodlens-mapit-2026-light`, `VectorOpenDataVisualizationLight`)
  - `floodlens-mapit-2026-dark` (`arn:aws:geo:us-east-1:694069618970:map/floodlens-mapit-2026-dark`, `VectorOpenDataVisualizationDark`)
- Provisioned restricted read-only tile API key `floodlens-mapit-2026-tile-key` (`arn:aws:geo:us-east-1:694069618970:api-key/floodlens-mapit-2026-tile-key`) scoped to `geo:GetMap*` actions and `http://localhost:*`, `http://127.0.0.1:*`, `https://*.cloudfront.net/*`, expiring `2026-12-01T00:00:00Z`.
- Verified `https://maps.geo.us-east-1.amazonaws.com/maps/v0/maps/floodlens-mapit-2026-light/style-descriptor` returns `200 OK` (`dataviz-light`, 100 vector layers).

### 2. Frontend Modules Implemented
- Built React 19 + TypeScript + Vite + Tailwind CSS v4 + MapLibre GL JS application:
  - `src/types/geospatial.ts`: Strict TypeScript interfaces for all 7 GeoJSON/JSON layers and filter states.
  - `src/utils/spatial.ts`: Pure functions for Ghana coordinate validation, spherical Haversine distance, geodesic circle polygon generation, `1.35x to 1.85x` road detour intervals, multi-criteria filtering, and dynamic insight aggregation.
  - `src/utils/mapStyles.ts`: Amazon Location Service style URL resolver with open-vector fallback.
  - `src/components/HeaderBar.tsx`: Top navigation with Amazon Location Service provider status badge, basemap style switcher (`AWS Light`, `AWS Dark`, `Open Vector`), `Reset Ghana View`, `Sources & Methodology` trigger, and mobile drawer toggle.
  - `src/components/GhanaMap.tsx`: WebGL map engine synchronizing 7 layers (`ghana-regions`, `ghana-roads`, `proximity-circle`, `proximity-connectors`, `iot-telemetry-links`, clustered `health-facilities`, 3-category `monitoring-stations`, and severity-scaled `flood-events`), plus interactive popups and collapsible layer legend.
  - `src/components/SidePanel.tsx`: 4-tab analytical panel (`Events`, `Inspector`, `Insights`, `Caveats`) with live Core Geographic Finding banner (`73.8%` of floods `> 15 km` from a groundtruthed gauge; `67.7 km` avg distance to gauge vs. `11.0 km` to hospital).
  - `src/components/MethodologyModal.tsx`: Accessible modal dialog detailing data sources, licenses, coordinate precision classes, and AWS architecture.

---

## Phase 4: Automated Testing & Multi-Viewport Browser Verification
**Timestamp:** 2026-11-01T06:16:00Z

1. **Unit & Component Tests (`Vitest` + `React Testing Library`):**
   - Executed `npm test` (`src/test/spatial.test.ts` and `src/test/app.test.tsx`): **2 test files passed, 11/11 tests passed**.
2. **Production Bundle Verification (`TypeScript` + `Vite`):**
   - Executed `npm run build` (`tsc -b && vite build`): **0 errors, 0 warnings** (`dist/index.html`, `dist/assets/index-*.css`, `dist/assets/index-*.js`, `dist/assets/maplibre-*.js`).
3. **End-to-End & Responsive Viewport Verification (`Playwright`):**
   - Executed `npx playwright test` (`e2e/floodlens.spec.ts`) across `360px`, `390px`, `768px`, `1024px`, `1440px`, and `1920px`: **7/7 tests passed** with zero horizontal overflow and zero uncaught page errors.
   - Inspected captured screenshots (`docs/screenshots/01-desktop-overview.png` through `05-mobile-390px-map.png`), identified literal markdown backticks in `MethodologyModal.tsx` and `precision_note`, replaced them with clean JSX `<code>` elements, rebuilt, and verified clean rendering.
   - Recorded browser walkthrough video (`docs/demo/floodlens-ghana-walkthrough.webm`, `6.65 MB`, `< 3 minutes`).

---

## Phase 5: AWS S3 + CloudFront OAC Deployment & Live Verification
**Timestamp:** 2026-11-01T06:26:00Z

1. **Infrastructure Provisioned (`scripts/deploy_aws.py`):**
   - Created private S3 bucket `floodlens-mapit-2026-694069618970` in `us-east-1` with all four `PublicAccessBlock` controls enabled.
   - Created CloudFront Origin Access Control `floodlens-mapit-2026-oac` (`Id: E236XC6V66VPUK`, `sigv4`, `always`).
   - Created CloudFront Distribution `ES0WZ9I518VV6` (`arn:aws:cloudfront::694069618970:distribution/ES0WZ9I518VV6`, Domain: `https://d278ej7a4gd3yf.cloudfront.net`).
   - Attached least-privilege S3 bucket policy allowing `s3:GetObject` strictly from `cloudfront.amazonaws.com` for distribution `ES0WZ9I518VV6`.
   - Uploaded all 12 production build artifacts and GeoJSON files to `s3://floodlens-mapit-2026-694069618970/`.
2. **Live CloudFront Browser Verification:**
   - Verified `https://d278ej7a4gd3yf.cloudfront.net` in Playwright across all viewports (`360px` to `1920px`).
