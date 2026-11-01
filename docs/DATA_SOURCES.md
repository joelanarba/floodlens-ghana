# FloodLens Ghana: Data Sources, Validation, and Provenance

**Retrieval Date:** November 1, 2026  
**Geographic Scope:** Republic of Ghana (16 Administrative Regions, 260 Districts; Bounding Box: `3.26°W to 1.20°E`, `4.74°N to 11.17°N`)  
**Processing Pipeline:** [`scripts/build_geospatial_datasets.py`](../scripts/build_geospatial_datasets.py)

---

## 1. Summary of Processed Datasets

| Layer / Dataset | Original Publisher(s) | License | Raw Records | Ghana / Usable Records | Output File (`public/data/`) |
| :--- | :--- | :--- | ---: | ---: | :--- |
| **1. Historical Flood Events (1988–2026)** | Dartmouth Flood Observatory (DFO) / USGS GFID (`10.5066/P135ARGI`), European Commission JRC / UN OCHA GDACS (Copernicus GloFAS), UN OCHA GLIDE, and IDMC | CC BY 4.0 / CC BY-IGO / Public Domain (USGS) | 4,825 (DFO) + 41 (GDACS GHA) + 36 (GLIDE GHA) + 18 (IDMC GHA) | **65 harmonized flood events** (25 DFO, 28 GDACS/GloFAS, 7 IDMC, 5 standalone GLIDE + 10 cross-linked GLIDE IDs) | `flood_events.geojson` (116 KB) |
| **2. Hydrometeorological Monitoring Stations & IoT Network** | UNESCO IHP-WINS, Ghana Hydrological Authority (GHA), Ghana Meteorological Agency (GMet), GARNET, ICTP | Open Access / UNESCO IHP-WINS Terms (CC BY-SA / IGO) | 262 (river gauges) + 54 (groundtruthed subset) + 50 (IoT telemetry devices) | **253 stations inside Ghana** (36 groundtruthed gauges, 193 legacy catalog gauges, 24 colocated IoT telemetry sites) + **14 LoRaWAN links** | `monitoring_stations.geojson` (216 KB), `iot_telemetry_links.geojson` (5 KB) |
| **3. Clinical Healthcare Facilities** | Humanitarian OpenStreetMap Team (HOTOSM) / HDX | Open Database License (ODC-ODbL) | 2,592 features | **1,226 clinical healthcare facilities** (481 hospitals, 745 clinics/health centres/CHPS posts) | `health_facilities.geojson` (530 KB) |
| **4. Classified Primary & Regional Road Network** | Humanitarian Data Exchange (HDX) / Digital Chart of the World (DCW) Ghana Roads | Open Humanitarian Use | 1,075 segments | **382 classified main & regional road segments** (114 National Routes, 105 Major Regional, 35 Inter-Regional, 20 Minor Regional, 108 Secondary/Tertiary) | `roads.geojson` (199 KB) |
| **5. Administrative Boundaries (ADM1 & ADM2)** | Ghana Statistical Service (GSS) / UN OCHA COD-AB | CC BY-IGO | 16 regions (ADM1), 260 districts (ADM2) | **16 regions**, **260 districts** | `admin_regions.geojson` (75 KB), `admin_districts_summary.json` (94 KB) |
| **6. District Flood Exposure & Vulnerability Indicators** | Heidelberg Institute for Geoinformation Technology (HeiGIT) / HDX | CC BY-SA 4.0 | 260 district records | **260 district records** (100-year return period $\ge 30\text{ cm}$ flood exposure for hospitals, primary care, schools, cropland, and children under 5) | Joined into `admin_regions.geojson` & `admin_districts_summary.json` |

---

## 2. Detailed Source Provenance & Transformations

### 2.1 Historical Flood Events (`flood_events.geojson`)

Following the cross-database harmonization design documented by the **USGS Global Flood Impacts Database (GFID)** (*Magers et al., 2026, USGS Data Release, DOI: `10.5066/P135ARGI`, Catalog ID: `USGS.69e7d2bab66b0164d0f72e1c`*), FloodLens Ghana compiles, cross-references, and deduplicates four complementary public disaster archives covering Ghana from **1988 to September 2026**:

1. **Dartmouth Flood Observatory (DFO) Global Active Archive (`1988–2019`)**
   - **Publishers:** University of Colorado / Dartmouth Flood Observatory; spatial polygons distributed via Cloud-to-Street (`MODIS_GlobalFloodDatabase/data/shp_files/dfo_polys_20191203.shp`) and HDX (`global-active-archive-of-large-flood-events-dfo` / `wlf_nhr_fl_dfomasterlist_20190418.zip`).
   - **Source URLs:**
     - `https://catalog.data.gov/dataset/the-global-flood-impacts-database-gfid-a-globally-aggregated-and-geocoded-flood-disaster-i`
     - `https://data.humdata.org/dataset/global-active-archive-of-large-flood-events-dfo`
     - `https://github.com/cloudtostreet/MODIS_GlobalFloodDatabase`
   - **License:** Creative Commons Attribution 4.0 International (CC BY 4.0) / USGS Public Domain metadata.
   - **Record Counts & Transformations:**
     - Out of `4,825` global polygon records in `dfo_polys_20191203` and `4,029` tabular masterlist records in `wlf_nhr_fl_dfomasterlist_20190418`, **25 flood records** explicitly list `Ghana` in `Country` or `OtherCount`.
     - Three non-Ghana bounding-box intersections (`DFO #2576` and `#3349` in Togo; `DFO #3829` in Côte d'Ivoire) were excluded because neither their country attributes nor their location descriptions reference Ghana.
     - Five broad/transboundary DFO polygons (`#1551`, `#1560`, `#3166`, `#3663`, `#4260`) had raw multi-country or full-country polygon centroids falling outside the documented Ghana locality (e.g., `#1551` Builsa/Kassena Nankana had its multi-country polygon centroid at `1.79°E, 11.16°N`; `#4260` June 2015 Accra flood had a regional polygon centroid in Sene West). For these 5 events, the original DFO centroid is preserved in `original_source_coords` and `bbox`, while the map point is placed at the documented Ghana district/municipality centroid with an explicit `precision_note`.

2. **Global Disaster Alert and Coordination System (GDACS / Copernicus GloFAS, `2001–2026`)**
   - **Publishers:** European Commission Joint Research Centre (JRC) and UN OCHA (Copernicus Emergency Management Service GloFAS hydrological alerts).
   - **Source URL:** `https://www.gdacs.org/gdacsapi/api/events/geteventlist/SEARCH?eventlist=FL&country=Ghana&fromDate=2000-01-01&toDate=2026-11-01&alertlevel=Green;Orange;Red`
   - **License:** Open public scientific and humanitarian use with attribution to GDACS / EC JRC.
   - **Record Counts & Transformations:**
     - Returned `41` flood alert features for `country=Ghana`.
     - `13` features (`eventid < 10000`) are historical DFO records (`source="DFO"`). Twelve of these match our 25 Ghana DFO events and were merged into those DFO features (adding `"GDACS"` to `all_sources` and attaching the direct GDACS report URL); one (`eventid=3487`, `MS-2009-000115-CIV` at `-4.202°E, 5.569°N` in Côte d'Ivoire) was excluded as outside Ghana.
     - The remaining **28 modern GDACS/GloFAS flood events (`2019–2026`, `eventid >= 1000000`)** lie inside Ghana with validated basin/locality coordinates and direct report links (`https://www.gdacs.org/report.aspx?eventid=...`).

3. **UN OCHA GLIDE Disaster Events for Ghana (`1999–2023`)**
   - **Publisher:** Asian Disaster Reduction Center (ADRC) / UN OCHA via Humanitarian Data Exchange (`gha-glide-events`).
   - **Source URL:** `https://data.humdata.org/dataset/gha-glide-events`
   - **License:** Creative Commons Attribution for Intergovernmental Organisations (CC BY-IGO).
   - **Record Counts & Transformations:**
     - Out of `36` total disaster records for Ghana, `15` are flood (`FL`) records (`21` epidemic/other records excluded).
     - `8` GLIDE flood records (`FL-1999-000315-GHA`, `FL-2001-000314-GHA`, `FL-2002-000373-GHA`, `FL-2007-000153-GHA`, `FL-2009-000132-GHA`, `FL-2010-000118-GHA`, `FL-2011-000106-GHA`, `FL-2015-000065-GHA`) correspond directly to DFO events and were merged to enrich DFO records with GLIDE numbers and UN OCHA situation narratives.
     - `1` GLIDE record (`FL-2019-000135-GHA`, Oct 6–12, 2019 Upper East Region flood, which had un-geocoded `0.0, 0.0` coordinates in the raw GLIDE CSV) matched `GDACS-1100228` (`2019-10-12` Upper East Region) and was merged into `GDACS-1100228`.
     - `1` GLIDE record (`FL-2018-000153-GHA`, `0.0, 0.0`, empty comment) was excluded as an empty duplicate stub superseded by `FL-2018-000154-GHA` (`Bawku`, `-0.2385°E, 11.0541°N`, full Bagre Dam spillage report).
     - The remaining **5 standalone GLIDE flood events** (`FL-2023-000215-GHA` October 2023 Akosombo/Kpong Dam Spillage in Lower Volta, `FL-2018-000154-GHA` August 2018 Bagre Dam Spillage in Bawku/Upper East, `FL-2017-000095-GHA` July 2017 4-Region Southern Flood Emergency, `FL-2013-000041-GHA` March 2013 Northern Ghana Floods, and `FL-2002-000215-GHA` April 2002 Greater Accra Flood) are retained as distinct events. Where raw GLIDE entries used Ghana's generic national centroid `(-1.023194, 7.946527)`, coordinates were assigned to the documented impact region/district and flagged in `precision_note`.

4. **Internal Displacement Monitoring Centre (IDMC) Internal Displacement Updates (`2025–2026`)**
   - **Publisher:** Internal Displacement Monitoring Centre (IDMC) via HDX (`gha-idmc-idu-events`).
   - **Source URL:** `https://data.humdata.org/dataset/gha-idmc-idu-events`
   - **License:** Creative Commons Attribution for Intergovernmental Organisations (CC BY-IGO).
   - **Record Counts & Transformations:**
     - Out of `17` displacement records in the raw CSV, `6` non-flood communal violence records and `2` windstorm-only records were excluded, leaving `9` flood and coastal storm-surge displacement rows.
     - `1` triangulation row (`516059`, 8 people) was excluded as a duplicate of the recommended figure row (`516058`, 5,285 people displaced in Hohoe on 2026-09-29).
     - `1` row (`516058`, Hohoe flood, `2026-09-29`, `0.4777°E, 7.1532°N`) matched `GDACS-1104196` (`2026-09-23` to `2026-09-30`, `0.4777°E, 7.1532°N`) and was merged to enrich `GDACS-1104196` with the verified IDMC displacement figure (`5,285 displaced`).
     - In row `516061` (`North East Gonja`, Savannah Region, `2026-09-23`), the raw CSV contained a sign error on longitude (`+0.528` East in Togo instead of `-0.528` West in North East Gonja District); this was corrected to `-0.528` and documented in `precision_note`.
     - The remaining **7 distinct IDMC flood and coastal surge displacement events** (`2025–2026`) are retained as standalone events.

---

### 2.2 Hydrometeorological Monitoring Stations & IoT Network (`monitoring_stations.geojson`, `iot_telemetry_links.geojson`)

- **Publisher:** UNESCO Intergovernmental Hydrological Programme Water Information Network System (IHP-WINS), developed jointly with the Ghana Meteorological Agency (GMet), Ghana Hydrological Authority (GHA), Ghanaian Academic and Research Network (GARNET), and the Abdus Salam International Centre for Theoretical Physics (ICTP).
- **Source URL:** `https://ihp-wins.unesco.org/en/dataset/potential-internet-of-things-set-up-ghana`
- **Downloaded Resources:**
  1. `4-9-2025-coordinates-water-level-sensor-locations.csv` (`262` river gauge records across the Volta and coastal basins).
  2. `groundtruthed_water_level_locations.csv` (`54` field-verified river gauge records with existing bridge/stilling-well metadata).
  3. `packages-ghana-official-mission-2-4.csv` (`50` IoT device records across 9 telemetry clusters: `Afienya`, `Tamale`, `Bamboi`, `Bazui`, `Pwalugu`, `Buipe`, `Loagri`, `Sherigu`, and `Saboba`).
- **Transformations & Privacy Sanitization:**
  - Out of `262` river gauge locations in `4-9-2025-coordinates-water-level-sensor-locations.csv` (and `54` in `groundtruthed_water_level_locations.csv`), `33` gauges (`18` groundtruthed, `15` unverified) lie upstream outside Ghana's national borders in Burkina Faso, Togo, or Côte d'Ivoire along transboundary Volta tributaries. Filtering strictly to Ghana's territory yields **229 river gauge locations inside Ghana** (**36 groundtruthed gauges** and **193 unverified catalog gauges**).
  - In `packages-ghana-official-mission-2-4.csv`, prior to any git staging or frontend packaging, all personal focal-point columns (`Focal Point Name`, `Focal Point WhatsApp`, `Focal Point Email`) and hardware/cryptographic identifiers (`Serial Number`, `Device EUI`, `Application Key`) were permanently stripped.
  - Colocated sensors at the same physical coordinates (e.g., `MeteoHelix`, `MeteoRain`, `MeteoWind`, and `Gateway` hosted at the same school or technical institute) were grouped into **24 distinct IoT telemetry site features**, bringing the total in-country monitoring layer to **253 stations**.
  - Fourteen `Water Level Sensor` nodes were paired with their cluster's LoRaWAN `Gateway` to generate **14 radio-propagation link vectors** (`iot_telemetry_links.geojson`) carrying `Free_Path_Loss_dB`, `ITWOM_Path_Loss_dB`, and `Potential` (`VERY GOOD`, `GOOD`, `OK`, `VERY BAD`).

---

### 2.3 Clinical Healthcare Facilities (`health_facilities.geojson`)

- **Publisher:** Humanitarian OpenStreetMap Team (HOTOSM) via HDX (`hotosm_gha_health_facilities`).
- **Source URL:** `https://data.humdata.org/dataset/hotosm_gha_health_facilities`
- **License:** Open Database License (ODC-ODbL).
- **Transformations:**
  - Raw dataset contained `2,592` features (`1,973` Points, `618` Polygons, `1` MultiPolygon).
  - Filtered to clinical care delivery facilities (`hospital`: 481, `clinic`: 514, `health_post` / `CHPs`: 152, `doctors`: 55, `centre`: 21, `birthing_centre`: 2, `rehabilitation`: 1 = **1,226 clinical facilities**).
  - Excluded `1,366` retail pharmacies (`1,202`), laboratories (`34`), dentists (`32`), optometrists (`4`), and untagged generic nodes (`94`) so proximity metrics reflect emergency and primary medical care rather than retail storefronts.
  - Polygon building footprints were converted to geometric centroids `[lon, lat]`.

---

### 2.4 Classified Primary & Regional Road Network (`roads.geojson`)

- **Publisher:** Humanitarian Data Exchange (HDX) / Digital Chart of the World (`ghana-roads` / `GHA_rds_1m_dcw.shp`).
- **Source URL:** `https://data.humdata.org/dataset/ghana-roads`
- **Transformations:**
  - Raw shapefile contained `1,075` polyline records.
  - Filtered out `693` unmapped rural `Track` / `Other` segments to retain all **382 classified National, Inter-Regional, Major Regional, Minor Regional, Main, Secondary, and Tertiary road segments** (`roads.geojson`, 199 KB).

---

### 2.5 Administrative Boundaries & District Flood Exposure (`admin_regions.geojson`, `admin_districts_summary.json`)

- **Publishers:**
  - Boundaries: Ghana Statistical Service (GSS) & UN OCHA (`cod-ab-gha`, CC BY-IGO).
  - Flood Exposure & Vulnerability: Heidelberg Institute for Geoinformation Technology (HeiGIT) via HDX (`ghana---risk-assessment-indicators`, CC BY-SA 4.0).
- **Source URLs:**
  - `https://data.humdata.org/dataset/cod-ab-gha`
  - `https://data.humdata.org/dataset/ghana---risk-assessment-indicators`
- **Transformations:**
  - Joined all `260` ADM2 districts by `ADM2_PCODE` (`GH0101`–`GH1609`) with `GHA_ADM2_flood_exposure.csv`, `GHA_ADM2_vulnerability.csv`, and `GHA_ADM2_facilities.csv`.
  - Aggregated 100-year return period ($\ge 30\text{ cm}$ inundation depth) exposure metrics (`RP100_hospitals_30cm_count`, `RP100_primary_healthcare_30cm_count`, `RP100_education_30cm_count`, `RP100_crops_30cm_km2`, `RP100_children_u5_30cm`) to both the 260-district summary table and the 16-region boundary polygons.

---

## 3. Known Limitations & Analytical Guardrails

1. **Representative Coordinates vs. Flood Inundation Footprints:** Point markers in `flood_events.geojson` represent documented locality coordinates, hydrological alert centroids (`GDACS/GloFAS`), or basin/district centroids (`DFO`, `GLIDE`). **They do not represent exact inundation boundaries or street-level flood extents.**
2. **Proximity Does Not Prove Facility Inundation:** Straight-line (Haversine) distance between a flood event coordinate and a nearby hospital, clinic, or road indicates **geographic co-location within the same watershed or administrative corridor**, not proof that a specific facility was physically flooded during that historical event.
3. **Reporting & Urban Bias:** International disaster databases (`DFO`, `GLIDE`, `IDMC`) disproportionately capture large-scale or urban flood events (e.g., Greater Accra and White Volta spillages). A low count of historical flood markers in a rural district **does not establish that the area is safe from flooding**.
4. **Haversine vs. Road-Network Travel Distance:** All proximity radii (`5 km` to `50 km`) and nearest-facility metrics in the application use great-circle Haversine distance (`km`). Actual road-network travel distance during a flood is typically $1.3\times$ to $2.0\times$ longer and may be severed entirely if bridge crossings are submerged.
