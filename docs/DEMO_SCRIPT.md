# Competition Video Demonstration Script: FloodLens Ghana

**Target Duration:** 2 minutes 30 seconds (Strictly `< 3:00` per AWS Builder Center Weekend Challenge: Map It rules)  
**Resolution:** `1440x900` / `1080p` HD  
**Recorded Browser Walkthrough Asset:** [`docs/demo/floodlens-ghana-walkthrough.webm`](demo/floodlens-ghana-walkthrough.webm)

---

## Scene-by-Scene Storyboard & Narration

### Scene 1: The Hook & Central Geographic Question (`0:00 - 0:28`)

- **On-Screen Action:**
  - Open **FloodLens Ghana** at the live Amazon CloudFront URL (`1440x900`).
  - Show the full Ghana national view rendered via **Amazon Location Service (`floodlens-mapit-2026-light`)** with all **65 documented historical flood events (1988 to 2026)**, **36 groundtruthed river gauges**, **24 UNESCO/GMet IoT telemetry nodes**, **14 LoRaWAN telemetry links**, and **1,226 clinical healthcare facilities** displayed.
  - Highlight the **Core Geographic Finding Banner** at the top of the left exploration panel (`73.8%` of floods occurred `> 15 km` from a groundtruthed gauge; `67.7 km` avg distance to a gauge vs. `11.0 km` to a hospital).
- **Narration:**
  > "When major floods strike Ghana, from the White Volta basin in the north to the Lower Volta and Greater Accra in the south, emergency planners face a critical question: *What can documented flood events tell us about the geographic relationship between flooding, clinical infrastructure, and river monitoring coverage?*
  >
  > Welcome to **FloodLens Ghana**, an evidence-based geospatial observatory built on **Amazon Location Service**, **Amazon S3**, and **Amazon CloudFront**. By harmonizing 65 verified flood events from DFO, GDACS, IDMC, and UN OCHA GLIDE with 1,226 clinical healthcare facilities and 253 UNESCO and Ghana Meteorological Agency monitoring stations, FloodLens reveals a striking spatial asymmetry: **73.8% of documented floods in Ghana occurred more than 15 kilometers from any field-groundtruthed river gauge**, and flood centroids sit on average **six times closer to a hospital (11.0 km) than to a verified river gauge (67.7 km)**."

---

### Scene 2: Filtering & Isolating Unmonitored Flood Corridors (`0:28 - 1:02`)

- **On-Screen Action:**
  - In the **Events** tab, toggle the checkbox: `"Only show floods >15 km from any groundtruthed river gauge"`.
  - Watch the map dynamically filter from **65 events** to the **48 unmonitored flood events**, updating the summary banner to `100%` unmonitored (`88.9 km` average distance to a verified gauge).
  - Uncheck the filter, select **Northern** or **Upper East** in the Region dropdown, and type `"Volta"` or `"Akosombo"` in the search bar.
- **Narration:**
  > "Every metric in FloodLens Ghana is dynamically computed from real geospatial records. With a single toggle, we can isolate the 48 historical flood events that occurred outside a 15-kilometer radius of any groundtruthed river gauge. We can also filter across all 16 administrative regions, filter by primary catalog source, or slice by decade from 1988 through 2026."

---

### Scene 3: Event Inspector, Coordinate Precision & Proximity Buffer (`1:02 - 1:42`)

- **On-Screen Action:**
  - Click the **2023 Lower Volta Akosombo & Kpong Dam Spillage Flood (`GDACS-1102198`)** card.
  - The map smoothly flies to the Mepe/Battor corridor on the Lower Volta River and renders the geodesic proximity buffer circle and dashed connector lines to the nearest hospital (`Battor Catholic Hospital`) and nearest groundtruthed river gauge.
  - In the **Inspector** tab, point out the **Coordinate Precision Badge (`Exact Locality / River Point`)**, the documented displacement figure (`35,857` people), and click through the proximity radius buttons: **`10km` -> `15km` -> `25km` -> `50km`**.
  - Point out the **Straight-Line Haversine vs. Estimated Road Distance (`1.35x to 1.85x`)** comparison on each nearby hospital and clinic.
- **Narration:**
  > "Selecting the October 2023 Lower Volta dam spillage flood zooms the map to the Mepe-Battor corridor and activates our geodesic proximity analyzer. Notice two methodological safeguards: first, every event displays its exact coordinate precision class and source verification link so users never confuse a point centroid with a street-level inundation footprint. Second, as we expand the buffer from 15 kilometers to 25 and 50 kilometers, FloodLens reports both spherical Haversine distance and a 1.35x-to-1.85x road travel distance interval to account for river crossings along Ghana's trunk road network."

---

### Scene 4: UNESCO LoRaWAN IoT Telemetry & 100-Year Exposure Insights (`1:42 - 2:12`)

- **On-Screen Action:**
  - Switch to the **Insights** tab.
  - Click on one of the **14 UNESCO/GMet LoRaWAN IoT Telemetry Links** (e.g., `Pwalugu` or `Tamale` package). The map pans to the dashed LoRaWAN radio link connecting the river water-level sensor to its secondary school gateway, showing the ITWOM path loss in decibels (`dB`) and `VERY GOOD` link potential.
  - Scroll down to the **Regional Breakdown & HeiGIT RP100 Exposure Table**, showing all 16 regions and the 12 hospitals, 11 primary care clinics, and 142 schools located inside modeled 100-year flood zones.
- **Narration:**
  > "In the Insights tab, we examine how new telemetry is closing this monitoring gap. Out of 229 legacy river gauges in the UNESCO catalog, only 36 are field-groundtruthed. Here we map the 24 new UNESCO, GMet, and GARNET LoRaWAN IoT nodes and 14 radio propagation links connecting river sensors in the White Volta and Oti basins to school gateways, complete with terrain path-loss measurements. Below, we pair historical flood counts with Heidelberg Institute 100-year return period exposure metrics across all 16 regions."

---

### Scene 5: Basemap Switching, Data Provenance & Conclusion (`2:12 - 2:30`)

- **On-Screen Action:**
  - Switch the basemap in the top header from **AWS Light** to **AWS Dark** (`floodlens-mapit-2026-dark` on Amazon Location Service) and click **Reset Ghana View**.
  - Click **Sources & Methodology** to display the full data attribution table, licenses, and serverless AWS architecture diagram.
- **Narration:**
  > "Visitors can switch between light and dark Amazon Location Service vector styles and inspect our full data provenance and analytical caveats at any time. FloodLens Ghana turns scattered humanitarian and hydrological catalogs into a transparent, actionable geographic lens for Ghana. Thank you."
