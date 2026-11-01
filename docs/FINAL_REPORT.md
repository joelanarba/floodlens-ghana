# Final Project Delivery Report: FloodLens Ghana

## 1. Project Summary

**FloodLens Ghana** is an evidence-based geospatial exploration platform built for the **[AWS Builder Center Weekend Challenge: Map It](https://builder.aws.com/build/hackathons/e7a301ea-4d84-3b9e-95be-7340a70f7781/weekend-challenge-map-it)** (Deadline: Monday, November 2, 2026 at 1:00 PM PST).

The application answers the central geographic question:

> *"What can documented flood events tell us about the geographic relationship between flooding, infrastructure, and monitoring coverage in Ghana?"*

Using **Amazon Location Service**, **Amazon S3**, **Amazon CloudFront**, **React 19**, **TypeScript**, and **MapLibre GL JS**, FloodLens Ghana harmonizes **65 documented historical flood events (1988 to 2026)**, **1,226 clinical healthcare facilities**, **253 hydrometeorological and LoRaWAN IoT monitoring stations**, **14 LoRaWAN telemetry links**, **382 primary road corridors**, and **260 district-level 100-year return period (`RP100`) exposure indicators** into a fast, transparent, public-interest observatory.

---

## 2. Live URL

- **Public Live URL (Amazon CloudFront HTTPS):** **[https://d278ej7a4gd3yf.cloudfront.net](https://d278ej7a4gd3yf.cloudfront.net)**

---

## 3. Repository Status

- **Workspace Path:** `c:\dev\Projects\FloodLens`
- **Git Author Identity:** `joelanarba` (`anarbajoel@gmail.com`)
- **Repository Hygiene:**
  - `.env.local`, `data/raw/`, `node_modules/`, `dist/`, `test-results/`, and `playwright-report/` are gitignored.
  - Zero AWS credentials, API keys, LoRaWAN device keys (`Application Key`, `Device EUI`), or personal contact fields (`Focal Point Name`, `WhatsApp`, `Email`) are committed to the repository.

---

## 4. Datasets Used

| Dataset Layer | Output File (`public/data/`) | Publisher & Source URL | Total Raw Records | Validated Ghana Records Used | License |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **1. Historical Flood Events (1988 to 2026)** | [`flood_events.geojson`](../public/data/flood_events.geojson) | Dartmouth Flood Observatory (`DFO` / USGS GFID `10.5066/P135ARGI`), EC JRC `GDACS`/GloFAS (`gdacs.org`), `IDMC` GIDD (`idmc.org`), & UN OCHA `GLIDE` (`glidenumber.net`) | `4,728` DFO global + `41` GDACS Ghana + `9` IDMC Ghana + `15` GLIDE Ghana | **65** deduplicated Ghana flood events (`25 DFO`, `28 GDACS`, `7 IDMC`, `5 GLIDE` + `10` cross-linked GLIDEs) | CC BY 4.0 / Public Domain (USGS) / EC JRC Open |
| **2. Hydrometeorological & IoT Monitoring Stations** | [`monitoring_stations.geojson`](../public/data/monitoring_stations.geojson) | UNESCO IHP-WINS, Ghana Meteorological Agency (`GMet`), Ghana Hydrological Authority (`GHA`), & `GARNET` ([Source](https://ihp-wins.unesco.org/dataset/potential-internet-of-things-set-up-ghana)) | `248` river gauges (incl. `19` transboundary) + `32` IoT mission rows | **253** in-country stations (`36` groundtruthed river gauges, `24` IoT telemetry sites, `193` unverified legacy catalog gauges) | CC BY-SA 3.0 IGO (PII & device keys stripped) |
| **3. LoRaWAN Telemetry Propagation Links** | [`iot_telemetry_links.geojson`](../public/data/iot_telemetry_links.geojson) | UNESCO IHP-WINS (*Potential IoT Set-Up in Ghana*) | `32` mission rows across `10` package areas | **14** unique sensor-to-school gateway LoRaWAN links with `Free_Path_Loss_dB`, `ITWOM_Path_Loss_dB`, & `Potential` | CC BY-SA 3.0 IGO |
| **4. Clinical Healthcare Facilities** | [`health_facilities.geojson`](../public/data/health_facilities.geojson) | Humanitarian OpenStreetMap Team (`HOTOSM`) & Ghana Health Service ([HDX](https://data.humdata.org/dataset/hotosm_gha_health_facilities)) | `2,592` raw OSM health points | **1,226** clinical facilities (`481` hospitals, `745` clinics/CHPS centres; `1,366` retail pharmacies excluded) | ODbL 1.0 (OpenStreetMap Contributors) |
| **5. Classified Primary Road Network** | [`roads.geojson`](../public/data/roads.geojson) | AmeriGEOSS / WFP / DCW ([AmeriGEOSS](https://data.amerigeoss.org/dataset/ghana-road-network-main-roads)) | `1,075` raw line segments | **382** classified `National`, `Inter-Regional`, and `Regional` highway segments | CC BY-IGO / Open Humanitarian |
| **6. Administrative Boundaries & `RP100` Flood Exposure** | [`admin_regions.geojson`](../public/data/admin_regions.geojson), [`admin_districts_summary.json`](../public/data/admin_districts_summary.json) | Ghana Statistical Service (`COD-AB`) & Heidelberg Institute (`HeiGIT` / [HDX](https://data.humdata.org/dataset/ghana-flood-risk-indicators)) | `16` ADM1 Regions + `260` ADM2 Districts | **16** Regions & **260** Districts enriched with flood counts, station counts, and `RP100` ($\ge 30\text{ cm}$) hazard indicators | CC BY 4.0 |

---

## 5. AWS Services Used

All AWS resources were provisioned in **`us-east-1`** under the authorized **`Builder-challenges`** profile (`Account 694069618970`) using the isolated prefix **`floodlens-mapit-2026`**:

1. **Amazon Location Service:**
   - `floodlens-mapit-2026-light` (`arn:aws:geo:us-east-1:694069618970:map/floodlens-mapit-2026-light`, style `VectorOpenDataVisualizationLight`)
   - `floodlens-mapit-2026-dark` (`arn:aws:geo:us-east-1:694069618970:map/floodlens-mapit-2026-dark`, style `VectorOpenDataVisualizationDark`)
   - `floodlens-mapit-2026-tile-key` (`arn:aws:geo:us-east-1:694069618970:api-key/floodlens-mapit-2026-tile-key`, restricted strictly to `geo:GetMap*` actions and allowed referers, expiring `2026-12-01T00:00:00Z`)
2. **Amazon S3 (Private Bucket with Block Public Access):**
   - `floodlens-mapit-2026-694069618970` (`arn:aws:s3:::floodlens-mapit-2026-694069618970`), hosting the static build and `/data/*.geojson` files.
3. **Amazon CloudFront (Global CDN with Origin Access Control):**
   - Origin Access Control: `floodlens-mapit-2026-oac` (`E236XC6V66VPUK`, `sigv4` signing)
   - Distribution: `ES0WZ9I518VV6` (`arn:aws:cloudfront::694069618970:distribution/ES0WZ9I518VV6`, live domain `https://d278ej7a4gd3yf.cloudfront.net`)
4. **Estimated Incremental Cost:** `< $0.75` total for the challenge and judging period (`RequestBasedUsage` pay-per-request, zero idle compute, well below the `$5.00` budget target).

---

## 6. Key Features Implemented

1. **Interactive Multi-Layer WebGL Map (`src/components/GhanaMap.tsx`):**
   - Renders 7 synchronized geospatial layers over Amazon Location Service vector tiles (`AWS Light`, `AWS Dark`, and `Open Vector` fallback), including severity-scaled flood markers, groundtruthed river gauges (`36`), UNESCO/GMet IoT nodes (`24`), LoRaWAN radio propagation links (`14`), clustered clinical healthcare facilities (`1,226`), classified national/regional roads (`382`), and regional flood density choropleth shading (`16` Regions).
2. **Multi-Criteria Search & Monitoring-Gap Filter (`src/components/SidePanel.tsx`):**
   - Instant filtering by keyword (river, district, town, cause, GLIDE ID), administrative region (`16` Regions), primary catalog source (`DFO`, `GDACS`, `IDMC`, `GLIDE`), severity class (`Extreme`, `High`, `Moderate`), temporal window (`1988 to 2026`), and a one-click toggle to isolate the **48 flood events occurring `> 15 km` from any groundtruthed river gauge**.
3. **Geodesic Proximity Analyzer & Coordinate Precision Inspector:**
   - Selecting any flood event draws a live geodesic buffer (`5 km`, `10 km`, `15 km`, `25 km`, `50 km`) and dashed nearest-neighbor connector lines to the closest groundtruthed gauge and closest hospital, displaying both spherical Haversine distance and a `1.35x to 1.85x` road travel distance interval alongside the event's explicit `coordinate_precision` badge and external source verification link.
4. **Dynamic Geographic Insights & UNESCO LoRaWAN Telemetry Explorer:**
   - Real-time summary metrics derived from filtered records, interactive click-to-pan table of all 14 UNESCO/GMet LoRaWAN telemetry links with ITWOM terrain path loss (`dB`), and a 16-Region table pairing historical flood counts with HeiGIT `RP100` ($\ge 30\text{ cm}$) infrastructure exposure.
5. **Accessible Data Provenance & Methodology Modal (`src/components/MethodologyModal.tsx`):**
   - Full dataset attribution table, license links, spatial methodology equations, and explicit interpretation boundaries.

---

## 7. Automated Tests & Browser Verification

1. **Unit & Component Test Suite (`Vitest` + `React Testing Library`):**
   - `npm test` executed **2 test suites / 11 tests** (`src/test/spatial.test.ts` and `src/test/app.test.tsx`), verifying Ghana coordinate bounds validation, Haversine distance math, geodesic polygon generation, multi-criteria filtering, proximity buffer analysis, UI state transitions, layer toggles, error/empty states, and 100% coordinate validity across all 65 production flood records, 253 stations, and 1,226 facilities (**11/11 passed**).
2. **Production Build Verification (`TypeScript` + `Vite`):**
   - `npm run build` (`tsc -b && vite build`) completed with **0 errors and 0 warnings**.
3. **End-to-End & Multi-Viewport Browser Verification (`Playwright`):**
   - `npx playwright test` (`e2e/floodlens.spec.ts`) executed **7 end-to-end tests** in real headless Chromium across viewports **`360px`**, **`390px`**, **`768px`**, **`1024px`**, **`1440px`**, and **`1920px`**, verifying map rendering, zero horizontal overflow, filter interactions, proximity radius changes, modal accessibility, and zero uncaught page errors (**7/7 passed** both locally and against the live CloudFront URL `https://d278ej7a4gd3yf.cloudfront.net`).

---

## 8. Known Limitations

1. **Centroid Representation:** Flood markers represent documented event centroids (`exact_locality`, `district_centroid`, `basin_polygon_centroid`, or `regional_approximation`) rather than parcel-level inundation polygons.
2. **Service-Area Proximity vs. Structural Inundation:** Proximity within a buffer radius (`5-50 km`) measures service-area relationship and does not prove that a specific healthcare facility building was physically inundated.
3. **Catalog Reporting Bias:** Global disaster catalogs under-report small, localized flash floods compared to major basin floods along the White Volta, Black Volta, Oti, Lower Volta, and Odaw rivers.
4. **Static Telemetry Metadata:** The UNESCO IHP-WINS dataset provides verified station coordinates, sensor types, and LoRaWAN radio link budgets (`dB` path loss), rather than live real-time stream-stage water level feeds.
