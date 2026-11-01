# Spatial Methodology & Analytical Boundaries: FloodLens Ghana

## 1. Purpose and Epistemic Scope

**FloodLens Ghana** is an evidence-based geographic exploration platform designed to answer a specific research question:

> *"What can documented flood events tell us about the geographic relationship between flooding, infrastructure, and monitoring coverage in Ghana?"*

To answer this question credibly, the platform harmonizes seven real geospatial datasets into an interactive cartographic interface while enforcing strict methodological transparency. FloodLens Ghana is **not** an operational flood-forecasting model, hydraulic inundation simulator, or parcel-level safety certification tool.

---

## 2. What the Map Shows vs. What It Does Not Show

| Dimension | What FloodLens Ghana Shows | What FloodLens Ghana Does NOT Show |
| :--- | :--- | :--- |
| **Historical Flood Records** | 65 documented historical flood events (1988 to 2026) from DFO, GDACS/GloFAS, IDMC, and UN OCHA GLIDE, mapped to their verified Ghanaian locality, district, or river-basin centroid. | Street-by-street inundation polygons or parcel-level water depth footprints. Point markers represent event centroids, not maximum flood extents. |
| **Healthcare Infrastructure** | 1,226 clinical healthcare facilities (481 hospitals and 745 clinics, polyclinics, and CHPS health centres) extracted from HOTOSM / Ghana Health Service open data after removing 1,366 retail pharmacies. | Verified structural elevation, flood-proofing status, or real-time emergency bed capacity of individual hospital buildings. |
| **Hydrological Monitoring** | 253 river gauges and telemetry sites from UNESCO IHP-WINS, GMet, GHA, and GARNET, separated into 36 field-groundtruthed gauges, 24 LoRaWAN IoT telemetry nodes (with 14 engineered radio links), and 193 unverified legacy catalog gauges. | Live real-time stream-stage water level feeds (which remain proprietary to GHA/GMet internal telemetry servers). |
| **Infrastructure Proximity** | Exact spherical Haversine straight-line distances (`km`) and estimated road travel distance intervals (`1.35x` to `1.85x` detour factor) around any selected flood event centroid (`5 km` to `50 km` buffer radii). | Proof that a facility inside a buffer was physically inundated during that historical flood event, or real-time turn-by-turn routing across washed-out bridges. |
| **100-Year Hazard Context** | District-level (`ADM2`) and Regional (`ADM1`) aggregated counts of hospitals, clinics, schools, cropland, and children under 5 exposed to modeled 100-year return period (`RP100`, $\ge 30\text{ cm}$ depth) flood zones (HeiGIT / HDX). | Individual building footprints inside the raster hazard layer. |

---

## 3. Coordinate Validation, Harmonization, and Precision Classification

Global disaster catalogs frequently assign country-level or multi-country polygon centroids to flood events. Plotting raw catalog centroids without validation creates severe cartographic distortions (for example, placing a White Volta flood in the middle of the forest belt or in the Atlantic Ocean).

In [`scripts/build_geospatial_datasets.py`](../scripts/build_geospatial_datasets.py), every candidate flood event underwent a four-stage spatial validation pipeline:

1. **Territorial Bounding Box & Polygon Containment Gate:**
   - Every coordinate is checked against Ghana's territorial bounding box ($\text{lon} \in [-3.35^\circ, 1.25^\circ]$, $\text{lat} \in [4.70^\circ, 11.25^\circ]$) and spatially joined (`point-in-polygon`) against the official Ghana Statistical Service (GSS / HDX COD-AB) `ADM2` (260 Districts) and `ADM1` (16 Regions) boundaries.
2. **Correction of Source Coordinate Errors:**
   - **`IDMC-516061` (2026-09-23 North East Gonja Flood, Savannah Region):** The raw IDMC GIDD API returned `+0.528` longitude (which falls in Togo) instead of `-0.528` West longitude (North East Gonja District, Savannah Region, Ghana). The pipeline corrected the sign error and recorded the correction in the event's `precision_note`.
   - **`GLIDE-FL-2019-000135-GHA` & `GLIDE-FL-2018-000153-GHA`:** Both UN OCHA GLIDE records carried placeholder `(0.0, 0.0)` Null Island coordinates. `FL-2019-000135-GHA` was cross-linked and merged into the matching October 2019 Upper East flood (`GDACS-1100228`), while the empty `FL-2018-000153-GHA` stub (superseded by `FL-2018-000154-GHA` in Bawku) was excluded and documented.
3. **Locality Grounding of Coarse Satellite Centroids:**
   - When a GDACS or DFO multi-basin polygon centroid fell on a generic national center (such as `(-1.0, 8.0)`) despite the official alert bulletin naming a specific river basin or municipality (e.g., *Akosombo/Mepe Lower Volta*, *Pwalugu/Bolgatanga White Volta*, *Accra Odaw Basin*, *Tamale*, *Buipe*), the point was grounded to the documented Ghanaian river-corridor locality while preserving `original_source_coords` in the GeoJSON properties for full auditability.
4. **Explicit Coordinate Precision Classes:**
   - Every flood feature carries a `coordinate_precision` field displayed as a badge in the Event Inspector:
     - `exact_locality` (**24 events**): Grounded to a specific town, dam spillage corridor, or urban river basin named in the primary report.
     - `district_centroid` (**12 events**): Placed at the verified `ADM2` district centroid named in the displacement or disaster report.
     - `basin_polygon_centroid` (**28 events**): Derived from the satellite-observed flood polygon centroid within the affected Ghanaian river catchment.
     - `regional_approximation` (**1 event**): Multi-region event represented at the primary affected regional centroid.

---

## 4. Distance & Proximity Methodology

### 4.1 Great-Circle Haversine Distance

For both precomputed dataset metrics and live interactive buffer calculations (`5 km`, `10 km`, `15 km`, `25 km`, `50 km`), straight-line distance $d_{\text{hav}}$ between two coordinates $(\lambda_1, \phi_1)$ and $(\lambda_2, \phi_2)$ is computed using the spherical Haversine formula with mean Earth radius $R = 6371.0088\text{ km}$:

$$a = \sin^2\left(\frac{\Delta \phi}{2}\right) + \cos(\phi_1)\cos(\phi_2)\sin^2\left(\frac{\Delta \lambda}{2}\right)$$

$$d_{\text{hav}} = 2 R \arctan2\left(\sqrt{a}, \sqrt{1 - a}\right)$$

### 4.2 Straight-Line vs. Road Travel Distance Estimation

Straight-line distance systematically underestimates real-world travel distance, especially in riverine basins (such as the White Volta, Black Volta, Oti, and Pra) where bridge crossings are sparse. To prevent users from interpreting Euclidean proximity as actual ambulance or emergency-response travel distance, [`computeProximityAnalysis`](../src/utils/spatial.ts) computes an explicit road-network detour interval for every nearby healthcare facility:

$$d_{\text{road}} \in \left[1.35 \times d_{\text{hav}},\; 1.85 \times d_{\text{hav}}\right]$$

This interval reflects empirical road-circuity factors across primary trunk roads (`1.35x` in urban/inter-regional corridors) and rural feeder networks (`1.85x` in northern river basins).

---

## 5. Key Interpretation Rules

1. **Proximity $\neq$ Physical Inundation:** Finding 18 hospitals within 10 km of the 2015 Accra Odaw flood centroid demonstrates high clinical density in the affected metropolitan catchment; it does **not** mean all 18 hospital compounds were physically flooded.
2. **Absence of Evidence $\neq$ Evidence of Safety:** Global disaster catalogs under-report small, high-frequency rural flash floods that do not trigger international satellite alerts or national emergency declarations. A district with zero cataloged events in `flood_events.geojson` can still face substantial localized flood risk, which is why FloodLens Ghana pairs historical event points with the national 260-district HeiGIT `RP100` flood hazard exposure indicators.
3. **Cataloged Station $\neq$ Active Groundtruthed Telemetry:** Out of 229 in-country river gauge stations in the UNESCO IHP-WINS catalog, only **36 (15.7%)** are field-verified as groundtruthed (`Groundtruthed = YES`). FloodLens Ghana separates groundtruthed gauges (`36`), new UNESCO/GMet/GARNET LoRaWAN IoT nodes (`24`), and unverified legacy catalog gauges (`193`) into distinct map layers so analysts do not overestimate operational monitoring coverage.
