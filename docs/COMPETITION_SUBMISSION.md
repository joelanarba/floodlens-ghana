# AWS Builder Center Weekend Challenge: Map It
## Official Submission Write-Up: FloodLens Ghana

- **Project Title:** FloodLens Ghana
- **Tagline:** An evidence-based geospatial observatory exploring the relationship between historical flood events (1988 to 2026), clinical healthcare infrastructure, and UNESCO/GMet hydrological monitoring coverage across Ghana.
- **Competition:** [AWS Builder Center Weekend Challenge: Map It](https://builder.aws.com/build/hackathons/e7a301ea-4d84-3b9e-95be-7340a70f7781/weekend-challenge-map-it)
- **Author:** Joel Anarba (`@joelanarba`)
- **AWS Account & Region:** Account `694069618970` (`us-east-1`, isolated prefix `floodlens-mapit-2026`)

---

## 1. The Central Question & Problem Statement

Every rainy season and dam-spillage cycle in West Africa tests the resilience of riverine and coastal communities across Ghana. Yet historical flood alerts, clinical infrastructure registries, and hydrometeorological sensor inventories live in separate institutional silos.

**FloodLens Ghana** was built to answer one central geographic question using verifiable public records:

> *"What can documented flood events tell us about the geographic relationship between flooding, infrastructure, and monitoring coverage in Ghana?"*

Rather than presenting a speculative "flood prediction" black box, FloodLens Ghana harmonizes seven real geospatial datasets into an interactive WebGL observatory powered by **Amazon Location Service**, **Amazon S3**, and **Amazon CloudFront**.

---

## 2. Key Geographic Findings Discovered Through the Data

By cross-analyzing **65 documented historical flood events (1988 to 2026)**, **1,226 clinical healthcare facilities**, **253 hydrometeorological monitoring stations**, **14 LoRaWAN telemetry links**, **382 primary road segments**, and **260 district-level 100-year return period (`RP100`) exposure indicators**, FloodLens Ghana surfaces four concrete insights:

1. **The 6x Monitoring-to-Clinical Proximity Gap:**
   - Out of **65 documented flood events in Ghana**, **48 events (73.8%)** occurred more than **15 km** from any field-groundtruthed river-level monitoring station.
   - Across all 65 events, the mean straight-line distance from a flood centroid to the nearest hospital is **11.0 km**, whereas the mean distance to the nearest groundtruthed river gauge is **67.7 km** (over **6x farther**).
2. **Paper Catalog vs. Field-Verified Telemetry Reality:**
   - Although the UNESCO IHP-WINS hydrological catalog lists **229 in-country river gauge stations** across Ghana's river basins, field verification (`Groundtruthed = YES`) confirms only **36 stations (15.7%)** as groundtruthed, leaving **193 legacy catalog gauges** unverified.
3. **Targeted LoRaWAN IoT Telemetry in the Northern Volta Basins:**
   - FloodLens maps the **24 new UNESCO / GMet / GHA / GARNET IoT telemetry sites** and **14 LoRaWAN radio propagation links** connecting river water-level sensors to secondary school and research institute gateways across `Tamale`, `Pwalugu`, `Bolgatanga/Sherigu`, `Saboba`, `Buipe`, `Bamboi`, `Loagri`, `Bazui`, and `Afienya`, complete with Free Space and ITWOM terrain path-loss measurements (`106.0 dB` to `141.7 dB`).
4. **100-Year Return Period (`RP100`) Infrastructure Exposure:**
   - Integrating Heidelberg Institute (`HeiGIT / HDX`) district risk indicators reveals that **12 hospitals**, **11 primary healthcare facilities**, **142 schools**, and **194,777 children under 5** across Ghana's 260 districts sit within modeled 100-year return period ($\ge 30\text{ cm}$ water depth) flood zones.

---

## 3. Authentic Datasets & Spatial Hygiene

No synthetic flood events, fabricated coordinates, or random hotspots are used anywhere in FloodLens Ghana:

1. **Historical Flood Events (`public/data/flood_events.geojson`, 65 records):** Harmonized from the **Dartmouth Flood Observatory (`DFO` / USGS GFID)** (`25` events), **EC JRC Global Disaster Alert and Coordination System (`GDACS` / GloFAS)** (`28` events), **Internal Displacement Monitoring Centre (`IDMC` GIDD)** (`7` events), and **UN OCHA `GLIDE`** (`5` standalone + `10` cross-linked event IDs).
2. **Hydrological & IoT Monitoring Stations (`public/data/monitoring_stations.geojson`, 253 records) & LoRaWAN Links (`public/data/iot_telemetry_links.geojson`, 14 links):** Extracted from the **UNESCO IHP-WINS** dataset (*Potential Internet of Things Set-Up in Ghana*, contributed by **GMet**, **GHA**, and **GARNET**). All personal contact fields (`Focal Point Name`, `WhatsApp`, `Email`) and LoRaWAN security keys (`Application Key`, `Device EUI`) were stripped prior to processing.
3. **Clinical Healthcare Infrastructure (`public/data/health_facilities.geojson`, 1,226 records):** Extracted from **HOTOSM / Ghana Health Service** via HDX (`481` hospitals and `745` clinics/CHPS centres after filtering out `1,366` retail pharmacies).
4. **Classified Road Network (`public/data/roads.geojson`, 382 records):** Extracted from **AmeriGEOSS / WFP / DCW** (`National`, `Inter-Regional`, and `Regional` trunk corridors).
5. **Administrative Boundaries & `RP100` Indicators (`public/data/admin_regions.geojson`, 16 Regions & `public/data/admin_districts_summary.json`, 260 Districts):** Extracted from **Ghana Statistical Service (`COD-AB`)** and **HeiGIT / HDX**.

---

## 4. AWS Architecture & Technical Innovation

FloodLens Ghana uses a serverless, security-hardened AWS architecture in **`us-east-1`**:

- **Amazon Location Service (`floodlens-mapit-2026-light` & `floodlens-mapit-2026-dark`):** Serves vector basemap tiles (`VectorOpenDataVisualizationLight` and `VectorOpenDataVisualizationDark`) to MapLibre GL JS via a restricted API key (`floodlens-mapit-2026-tile-key`) scoped exclusively to read-only `geo:GetMap*` actions.
- **Amazon S3 (`floodlens-mapit-2026-694069618970`):** Stores the production static bundle and validated GeoJSON/JSON data catalog with **S3 Block Public Access** enabled across all four settings.
- **Amazon CloudFront (Origin Access Control):** Distributes the application and geospatial catalog globally over HTTPS using SigV4 Origin Access Control (OAC) and edge compression, keeping total incremental AWS costs below **`$0.75`** (`< $5.00` budget target).

---

## 5. Methodological Honesty & User Experience

FloodLens Ghana was designed like a serious public-interest observatory:
- **Explicit Coordinate Precision Badges:** Every flood event displays whether its coordinate is an `exact_locality`, `district_centroid`, `basin_polygon_centroid`, or `regional_approximation`, along with its original catalog coordinate.
- **Straight-Line vs. Road Distance Transparency:** When inspecting nearby hospitals within a `5 km` to `50 km` geodesic buffer, FloodLens displays both spherical Haversine distance and an estimated `1.35x to 1.85x` road travel distance range so analysts never mistake Euclidean proximity for road routing across rivers.
- **Clear Epistemic Boundaries:** The interface explicitly states that proximity to a historical flood centroid does not prove a facility was physically inundated, and absence of a historical record does not certify that a parcel is safe from flooding.
