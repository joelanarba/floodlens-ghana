import sys
import os
import csv
import json
import math
import struct

sys.stdout.reconfigure(encoding='utf-8')

os.makedirs("public/data", exist_ok=True)

def haversine_km(lon1, lat1, lon2, lat2):
    R = 6371.0088
    phi1, phi2 = math.radians(lat1), math.radians(lat2)
    dphi = math.radians(lat2 - lat1)
    dlambda = math.radians(lon2 - lon1)
    a = math.sin(dphi / 2.0) ** 2 + math.cos(phi1) * math.cos(phi2) * math.sin(dlambda / 2.0) ** 2
    return 2.0 * R * math.atan2(math.sqrt(a), math.sqrt(max(0.0, 1.0 - a)))

def point_in_ring(lon, lat, ring):
    inside = False
    n = len(ring)
    if n < 3:
        return False
    j = n - 1
    for i in range(n):
        xi, yi = ring[i][0], ring[i][1]
        xj, yj = ring[j][0], ring[j][1]
        intersect = ((yi > lat) != (yj > lat)) and (lon < (xj - xi) * (lat - yi) / ((yj - yi) + 1e-15) + xi)
        if intersect:
            inside = not inside
        j = i
    return inside

def point_in_geom(lon, lat, geom):
    gtype = geom.get("type")
    coords = geom.get("coordinates", [])
    if gtype == "Polygon":
        if not coords:
            return False
        if not point_in_ring(lon, lat, coords[0]):
            return False
        for hole in coords[1:]:
            if point_in_ring(lon, lat, hole):
                return False
        return True
    elif gtype == "MultiPolygon":
        for poly in coords:
            if poly and point_in_ring(lon, lat, poly[0]):
                in_hole = False
                for hole in poly[1:]:
                    if point_in_ring(lon, lat, hole):
                        in_hole = True
                        break
                if not in_hole:
                    return True
    return False

print("=== Step 1: Loading & Indexing Ghana Admin Boundaries (ADM1 & ADM2) ===")
with open("data/raw/admin_boundaries/gha_admin1.geojson", "r", encoding="utf-8") as f:
    adm1_raw = json.load(f)
with open("data/raw/admin_boundaries/gha_admin2.geojson", "r", encoding="utf-8") as f:
    adm2_raw = json.load(f)

# Load HeiGIT / HDX ADM2 Flood Exposure, Vulnerability, and Facility counts
adm2_exposure = {}
with open("data/raw/hdx_adm2_flood_exposure.csv", "r", encoding="utf-8-sig") as f:
    for r in csv.DictReader(f):
        adm2_exposure[r["ADM2_PCODE"]] = r

adm2_vuln = {}
with open("data/raw/hdx_adm2_vulnerability.csv", "r", encoding="utf-8-sig") as f:
    for r in csv.DictReader(f):
        adm2_vuln[r["ADM2_PCODE"]] = r

adm2_fac_counts = {}
with open("data/raw/hdx_adm2_facilities.csv", "r", encoding="utf-8-sig") as f:
    for r in csv.DictReader(f):
        adm2_fac_counts[r["ADM2_PCODE"]] = r

# Precompute bounding boxes for ADM2 features for fast spatial lookup
adm2_index = []
adm2_by_name = {}
for ft in adm2_raw["features"]:
    props = ft["properties"]
    geom = ft["geometry"]
    # compute bbox
    lons, lats = [], []
    def collect_coords(c):
        if isinstance(c[0], (int, float)):
            lons.append(c[0])
            lats.append(c[1])
        else:
            for sub in c:
                collect_coords(sub)
    collect_coords(geom["coordinates"])
    bbox = [min(lons), min(lats), max(lons), max(lats)]
    adm2_index.append((bbox, props, geom))
    adm2_by_name[props["adm2_name"].lower()] = props

def locate_admin(lon, lat):
    for bbox, props, geom in adm2_index:
        if bbox[0] <= lon <= bbox[2] and bbox[1] <= lat <= bbox[3]:
            if point_in_geom(lon, lat, geom):
                return {
                    "region": props["adm1_name"],
                    "region_pcode": props["adm1_pcode"],
                    "district": props["adm2_name"],
                    "district_pcode": props["adm2_pcode"]
                }
    # Fallback to nearest ADM2 centroid if point is slightly offshore/border
    best_dist = 1e9
    best_props = None
    for _, props, _ in adm2_index:
        d = haversine_km(lon, lat, props["center_lon"], props["center_lat"])
        if d < best_dist:
            best_dist = d
            best_props = props
    if best_props and best_dist <= 35.0:
        return {
            "region": best_props["adm1_name"],
            "region_pcode": best_props["adm1_pcode"],
            "district": best_props["adm2_name"],
            "district_pcode": best_props["adm2_pcode"]
        }
    return {"region": "National / Multi-Region", "region_pcode": "GH", "district": "Multi-District", "district_pcode": "GH00"}

print(f"Indexed {len(adm1_raw['features'])} regions and {len(adm2_index)} districts.")

print("\n=== Step 2: Processing UNESCO IHP-WINS Hydrometeorological Monitoring Stations & IoT Telemetry ===")
# 2a. Groundtruthed stations lookup by Station Number
groundtruthed_map = {}
with open("data/raw/unesco_groundtruthed_water_levels.csv", "r", encoding="utf-8-sig") as f:
    for r in csv.DictReader(f):
        num = (r.get("Number") or "").strip()
        if num:
            groundtruthed_map[num] = {
                "groundtruthed": (r.get("Groundtruthed") or "").strip().lower() == "yes",
                "existing_infrastructure": (r.get("Existing Infrastructure") or "Verified Gauge").strip() or "Verified Gauge",
                "station_name": (r.get("Station Name") or "").strip(),
                "lat": float(r["Latitude"]),
                "lon": float(r["Longitude"]),
                "elevation_m": float(r["Elevation (metres)"]) if r.get("Elevation (metres)") else None,
                "basin_area_sqkm": float(r["Area (km2)"]) if r.get("Area (km2)") else None,
            }

monitoring_features = []
seen_station_nums = set()

with open("data/raw/unesco_water_level_sensors.csv", "r", encoding="utf-8-sig") as f:
    for r in csv.DictReader(f):
        num = (r.get("Number") or "").strip()
        if not num or not r.get("Latitude") or not r.get("Longitude"):
            continue
        lat = float(r["Latitude"])
        lon = float(r["Longitude"])
        if not (-3.5 <= lon <= 1.5 and 4.5 <= lat <= 11.5):
            continue
        seen_station_nums.add(num)
        gt_info = groundtruthed_map.get(num)
        is_gt = bool(gt_info and gt_info["groundtruthed"])
        infra = gt_info["existing_infrastructure"] if gt_info else "Unverified Historical Gauge"
        sname = (r.get("Station Name") or (gt_info["station_name"] if gt_info else f"Station {num}")).strip()
        river = sname.split(" on ")[1].strip() if " on " in sname else "Volta / Coastal Basin"
        elev = float(r["Elevation (metres)"]) if r.get("Elevation (metres)") else None
        area = float(r["Area (km2)"]) if r.get("Area (km2)") else None
        adm = locate_admin(lon, lat)
        monitoring_features.append({
            "type": "Feature",
            "geometry": {"type": "Point", "coordinates": [round(lon, 6), round(lat, 6)]},
            "properties": {
                "id": f"HYDRO-{num}",
                "station_number": num,
                "name": sname,
                "river_or_site": river,
                "station_category": "hydro_groundtruthed" if is_gt else "hydro_legacy_catalog",
                "category_label": "Groundtruthed River Gauge" if is_gt else "Catalog River Gauge (Unverified)",
                "sensor_types": ["Water Level Gauge"],
                "groundtruthed": is_gt,
                "existing_infrastructure": infra,
                "elevation_m": elev,
                "basin_area_sqkm": area,
                "organization": "Ghana Hydrological Authority / UNESCO IHP-WINS",
                "package_area": None,
                "telemetry_potential": None,
                "path_loss_db": None,
                "region": adm["region"],
                "region_pcode": adm["region_pcode"],
                "district": adm["district"],
                "district_pcode": adm["district_pcode"],
                "source_dataset": "UNESCO IHP-WINS Ghana Hydrometeorological Monitoring Dataset",
                "source_url": "https://ihp-wins.unesco.org/dataset/potential-internet-of-things-set-up-ghana"
            }
        })

# Check any groundtruthed stations not in main sensor list
for num, gt in groundtruthed_map.items():
    if num not in seen_station_nums:
        lon, lat = gt["lon"], gt["lat"]
        adm = locate_admin(lon, lat)
        sname = gt["station_name"]
        river = sname.split(" on ")[1].strip() if " on " in sname else "Volta Basin"
        monitoring_features.append({
            "type": "Feature",
            "geometry": {"type": "Point", "coordinates": [round(lon, 6), round(lat, 6)]},
            "properties": {
                "id": f"HYDRO-{num}",
                "station_number": num,
                "name": sname,
                "river_or_site": river,
                "station_category": "hydro_groundtruthed",
                "category_label": "Groundtruthed River Gauge",
                "sensor_types": ["Water Level Gauge"],
                "groundtruthed": True,
                "existing_infrastructure": gt["existing_infrastructure"],
                "elevation_m": gt["elevation_m"],
                "basin_area_sqkm": gt["basin_area_sqkm"],
                "organization": "Ghana Hydrological Authority / UNESCO IHP-WINS",
                "package_area": None,
                "telemetry_potential": None,
                "path_loss_db": None,
                "region": adm["region"],
                "region_pcode": adm["region_pcode"],
                "district": adm["district"],
                "district_pcode": adm["district_pcode"],
                "source_dataset": "UNESCO IHP-WINS Ghana Hydrometeorological Monitoring Dataset",
                "source_url": "https://ihp-wins.unesco.org/dataset/potential-internet-of-things-set-up-ghana"
            }
        })

# 2b. Process UNESCO / GMet / GHA / GARNET IoT Telemetry Mission Nodes (group colocated sensors at same site)
iot_sites = {}
iot_gateways = {}
iot_water_sensors = []

with open("data/raw/unesco_iot_packages_mission.csv", "r", encoding="utf-8") as f:
    for r in csv.DictReader(f):
        if not r.get("Latitude") or not r.get("Longitude"):
            continue
        lat = float(r["Latitude"])
        lon = float(r["Longitude"])
        pkg = r["Package_Area"].strip()
        stype = r["Type"].strip()
        sname = r["Site_Name"].strip().replace("+G39:N39", "")
        org = r["Organization"].strip()
        pot = r["Potential"].strip() or None
        itwom = float(r["ITWOM_Path_Loss_dB"]) if r.get("ITWOM_Path_Loss_dB") else None
        fpl = float(r["Free_Path_Loss_dB"]) if r.get("Free_Path_Loss_dB") else None

        if stype == "Gateway":
            iot_gateways[pkg] = {"name": sname, "lon": lon, "lat": lat, "id": r["ID"].strip()}
        elif stype == "Water Level Sensor":
            iot_water_sensors.append({
                "pkg": pkg, "id": r["ID"].strip(), "name": sname,
                "lon": lon, "lat": lat, "potential": pot,
                "itwom_db": itwom, "fpl_db": fpl
            })

        site_key = f"{pkg}:{sname}:{round(lon,4)}:{round(lat,4)}"
        if site_key not in iot_sites:
            iot_sites[site_key] = {
                "id": f"IOT-{r['ID'].strip()}",
                "name": f"{sname} ({pkg} IoT Node)",
                "site_name": sname,
                "package_area": pkg,
                "lon": lon,
                "lat": lat,
                "sensor_types": [],
                "organizations": set(),
                "potential": pot,
                "path_loss_db": itwom
            }
        if stype not in iot_sites[site_key]["sensor_types"]:
            iot_sites[site_key]["sensor_types"].append(stype)
        if org:
            iot_sites[site_key]["organizations"].add(org)

for site_key, s in iot_sites.items():
    adm = locate_admin(s["lon"], s["lat"])
    is_water = "Water Level Sensor" in s["sensor_types"]
    monitoring_features.append({
        "type": "Feature",
        "geometry": {"type": "Point", "coordinates": [round(s["lon"], 6), round(s["lat"], 6)]},
        "properties": {
            "id": s["id"],
            "station_number": s["id"],
            "name": s["name"],
            "river_or_site": s["site_name"],
            "station_category": "iot_telemetry_node",
            "category_label": "UNESCO/GMet/Hydro IoT Radar & Telemetry Node",
            "sensor_types": s["sensor_types"],
            "groundtruthed": True,
            "existing_infrastructure": "LoRaWAN IoT Water-Level Sensor" if is_water else "Automated Weather & LoRaWAN Gateway Host",
            "elevation_m": None,
            "basin_area_sqkm": None,
            "organization": " / ".join(sorted(s["organizations"])) + " (UNESCO IHP-WINS)",
            "package_area": s["package_area"],
            "telemetry_potential": s["potential"],
            "path_loss_db": s["path_loss_db"],
            "region": adm["region"],
            "region_pcode": adm["region_pcode"],
            "district": adm["district"],
            "district_pcode": adm["district_pcode"],
            "source_dataset": "UNESCO IHP-WINS IoT Monitoring Network Design for Ghana",
            "source_url": "https://ihp-wins.unesco.org/en/dataset/potential-internet-of-things-set-up-ghana/resource/34b2eb70-fcc9-46c5-9c37-51ecc9c42f81"
        }
    })

iot_links_features = []
for ws in iot_water_sensors:
    gw = iot_gateways.get(ws["pkg"])
    if gw:
        dist_km = round(haversine_km(ws["lon"], ws["lat"], gw["lon"], gw["lat"]), 2)
        iot_links_features.append({
            "type": "Feature",
            "geometry": {
                "type": "LineString",
                "coordinates": [
                    [round(ws["lon"], 6), round(ws["lat"], 6)],
                    [round(gw["lon"], 6), round(gw["lat"], 6)]
                ]
            },
            "properties": {
                "id": f"LINK-{ws['id']}",
                "package_area": ws["pkg"],
                "sensor_id": ws["id"],
                "sensor_name": ws["name"],
                "gateway_name": gw["name"],
                "distance_km": dist_km,
                "free_path_loss_db": ws["fpl_db"],
                "itwom_path_loss_db": ws["itwom_db"],
                "potential": ws["potential"] or "UNKNOWN"
            }
        })

with open("public/data/monitoring_stations.geojson", "w", encoding="utf-8") as f:
    json.dump({"type": "FeatureCollection", "features": monitoring_features}, f, separators=(",", ":"))

with open("public/data/iot_telemetry_links.geojson", "w", encoding="utf-8") as f:
    json.dump({"type": "FeatureCollection", "features": iot_links_features}, f, separators=(",", ":"))

print(f"Saved {len(monitoring_features)} monitoring station features and {len(iot_links_features)} IoT telemetry links.")

print("\n=== Step 3: Processing HOTOSM / HDX Ghana Health Facilities ===")
with open("data/raw/health_facilities/health_facilities.geojson", "r", encoding="utf-8") as f:
    hf_raw = json.load(f)

CLINICAL_TYPES = {
    "hospital": "Hospital",
    "clinic": "Clinic / Health Centre",
    "health_post": "CHPS / Health Post",
    "CHPs": "CHPS / Health Post",
    "doctors": "Medical Practice / Clinic",
    "centre": "Clinic / Health Centre",
    "birthing_centre": "Maternity / Birthing Centre",
    "rehabilitation": "Rehabilitation Clinic"
}

health_features = []
discarded_non_clinical = 0
discarded_unnamed_or_invalid = 0

def get_geom_centroid(geom):
    gtype = geom.get("type")
    coords = geom.get("coordinates", [])
    if gtype == "Point":
        return coords[0], coords[1]
    lons, lats = [], []
    def collect(c):
        if isinstance(c[0], (int, float)):
            lons.append(c[0])
            lats.append(c[1])
        else:
            for s in c:
                collect(s)
    collect(coords)
    if not lons:
        return None, None
    return sum(lons) / len(lons), sum(lats) / len(lats)

for idx, ft in enumerate(hf_raw["features"]):
    p = ft.get("properties", {})
    raw_type = p.get("amenity") or p.get("healthcare") or ""
    if raw_type not in CLINICAL_TYPES:
        discarded_non_clinical += 1
        continue
    lon, lat = get_geom_centroid(ft.get("geometry", {}))
    if lon is None or not (-3.5 <= lon <= 1.5 and 4.5 <= lat <= 11.5):
        discarded_unnamed_or_invalid += 1
        continue
    name = (p.get("name") or p.get("name_en") or p.get("name_latin") or "").strip()
    if not name:
        name = f"{CLINICAL_TYPES[raw_type]} ({p.get('adm2_name') or 'Ghana'})"
    region = p.get("adm1_name")
    district = p.get("adm2_name")
    region_pcode = p.get("adm1_pcode")
    district_pcode = p.get("adm2_pcode")
    if not region or not district:
        adm = locate_admin(lon, lat)
        region = adm["region"]
        district = adm["district"]
        region_pcode = adm["region_pcode"]
        district_pcode = adm["district_pcode"]

    health_features.append({
        "type": "Feature",
        "geometry": {"type": "Point", "coordinates": [round(lon, 5), round(lat, 5)]},
        "properties": {
            "id": f"HF-{idx+1}",
            "osm_id": p.get("id"),
            "name": name,
            "facility_type": CLINICAL_TYPES[raw_type],
            "raw_amenity": raw_type,
            "operator_type": p.get("operator_type") or "Unspecified",
            "region": region,
            "region_pcode": region_pcode,
            "district": district,
            "district_pcode": district_pcode,
            "source_url": "https://data.humdata.org/dataset/hotosm_gha_health_facilities"
        }
    })

with open("public/data/health_facilities.geojson", "w", encoding="utf-8") as f:
    json.dump({"type": "FeatureCollection", "features": health_features}, f, separators=(",", ":"))

print(f"Saved {len(health_features)} clinical healthcare facilities (filtered out {discarded_non_clinical} retail pharmacies/non-clinical and {discarded_unnamed_or_invalid} invalid coords).")

print("\n=== Step 4: Processing Ghana Primary & Regional Road Network (HDX / DCW) ===")
dbf_path = "data/raw/roads_dcw/GHA_rds_1m_dcw.dbf"
shp_path = "data/raw/roads_dcw/GHA_rds_1m_dcw.shp"
shx_path = "data/raw/roads_dcw/GHA_rds_1m_dcw.shx"

road_features = []
with open(dbf_path, "rb") as fdbf, open(shx_path, "rb") as fshx, open(shp_path, "rb") as fshp:
    header = fdbf.read(32)
    num_records = struct.unpack("<I", header[4:8])[0]
    header_len = struct.unpack("<H", header[8:10])[0]
    record_len = struct.unpack("<H", header[10:12])[0]
    fields = []
    while True:
        fdesc = fdbf.read(32)
        if fdesc[0] == 0x0D or len(fdesc) < 32:
            break
        fname = fdesc[:11].split(b'\x00')[0].decode('ascii', 'ignore')
        ftype = chr(fdesc[11])
        flen = fdesc[16]
        fdec = fdesc[17]
        fields.append((fname, ftype, flen, fdec))
    fdbf.seek(header_len)
    fshx.seek(100)
    for idx in range(num_records):
        rec = fdbf.read(record_len)
        idx_bytes = fshx.read(8)
        offset_words, _ = struct.unpack(">II", idx_bytes)
        offset = 1
        row = {}
        for fname, ftype, flen, fdec in fields:
            row[fname] = rec[offset:offset+flen].decode('utf-8', 'ignore').strip()
            offset += flen
        # Keep classified primary/secondary/tertiary routes or named national/regional corridors
        rtype = row.get("TYPE", "")
        rcat = row.get("CATEGORY", "")
        if rtype == "Track" and rcat == "Other":
            continue
        fshp.seek(offset_words * 2 + 8)
        stype = struct.unpack("<I", fshp.read(4))[0]
        if stype != 3:
            continue
        _bbox = struct.unpack("<dddd", fshp.read(32))
        num_parts, num_points = struct.unpack("<II", fshp.read(8))
        parts = [struct.unpack("<I", fshp.read(4))[0] for _ in range(num_parts)]
        pts = [[round(x, 5), round(y, 5)] for x, y in (struct.unpack("<dd", fshp.read(16)) for _ in range(num_points))]
        if num_parts == 1:
            geom = {"type": "LineString", "coordinates": pts}
        else:
            lines = []
            for p_i in range(num_parts):
                start_idx = parts[p_i]
                end_idx = parts[p_i + 1] if p_i + 1 < num_parts else num_points
                lines.append(pts[start_idx:end_idx])
            geom = {"type": "MultiLineString", "coordinates": lines}
        road_features.append({
            "type": "Feature",
            "geometry": geom,
            "properties": {
                "id": f"RD-{idx+1}",
                "name": row.get("NAME") or rcat or rtype,
                "axis": row.get("AXIS") or "Regional Corridor",
                "road_type": rtype,
                "category": rcat,
                "distance_km": float(row["DISTANCE_K"]) if row.get("DISTANCE_K") and row["DISTANCE_K"].replace('.','',1).isdigit() else None
            }
        })

with open("public/data/roads.geojson", "w", encoding="utf-8") as f:
    json.dump({"type": "FeatureCollection", "features": road_features}, f, separators=(",", ":"))
print(f"Saved {len(road_features)} classified main/regional road segments (excluded {num_records - len(road_features)} unmapped rural tracks).")

print("\n=== Step 5: Harmonizing Multi-Source Historical Flood Events in Ghana (1988-2026) ===")
# 5a. Load DFO Masterlist narratives & rivers by Register ID
dfo_master_meta = {}
with open("data/raw/dfo_masterlist/wlf_nhr_fl_dfomasterlist_20190418.dbf", "rb") as f:
    header = f.read(32)
    num_rec = struct.unpack("<I", header[4:8])[0]
    hlen = struct.unpack("<H", header[8:10])[0]
    rlen = struct.unpack("<H", header[10:12])[0]
    fields = []
    while True:
        fdesc = f.read(32)
        if fdesc[0] == 0x0D or len(fdesc) < 32:
            break
        fields.append((fdesc[:11].split(b'\x00')[0].decode('ascii', 'ignore'), fdesc[16]))
    f.seek(hlen)
    for _ in range(num_rec):
        rec = f.read(rlen)
        if not rec or rec[0] == 0x2A:
            continue
        off = 1
        row = {}
        for fn, fl in fields:
            row[fn] = rec[off:off+fl].decode('utf-8', 'ignore').strip()
            off += fl
        reg_str = row.get("Register__", "").split(".")[0].strip()
        if reg_str:
            dfo_master_meta[reg_str] = row
            # Note: DFO #1192 in masterlist corresponds to #1242 in dfo_polys (1997-06-12 Accra/Tema)
            if reg_str == "1192":
                dfo_master_meta["1242"] = row

# 5b. Load GLIDE flood events for enrichment & standalone entries
glide_by_id = {}
glide_all_fl = []
with open("data/raw/hdx_glide_events.csv", "r", encoding="utf-8-sig") as f:
    for r in csv.DictReader(f):
        if r.get("event") == "FL":
            gid = r["glidenumber"].strip()
            glide_by_id[gid] = r
            glide_all_fl.append(r)

# 5c. Load GDACS Ghana flood events (separate pre-2017 DFO-linked IDs from 2019-2026 GloFAS/JRC events)
with open("data/raw/gdacs_ghana_floods.geojson", "r", encoding="utf-8") as f:
    gdacs_raw = json.load(f)

gdacs_by_dfo_id = {}
gdacs_modern_events = []
for ft in gdacs_raw["features"]:
    p = ft["properties"]
    ev_id = str(p["eventid"])
    if int(ev_id) < 10000:
        gdacs_by_dfo_id[ev_id] = ft
    else:
        gdacs_modern_events.append(ft)

# 5d. Parse DFO Polygons (1988-2019) for Ghana
flood_events = []
used_glide_ids = set()

def format_yyyymmdd(s):
    s = (s or "").strip()
    if len(s) == 8 and s.isdigit():
        return f"{s[:4]}-{s[4:6]}-{s[6:8]}"
    return s

with open("data/raw/dfo_polys_20191203.dbf", "rb") as fdbf, open("data/raw/dfo_polys_20191203.shx", "rb") as fshx, open("data/raw/dfo_polys_20191203.shp", "rb") as fshp:
    header = fdbf.read(32)
    num_rec = struct.unpack("<I", header[4:8])[0]
    hlen = struct.unpack("<H", header[8:10])[0]
    rlen = struct.unpack("<H", header[10:12])[0]
    fields = []
    while True:
        fdesc = fdbf.read(32)
        if fdesc[0] == 0x0D or len(fdesc) < 32:
            break
        fields.append((fdesc[:11].split(b'\x00')[0].decode('ascii', 'ignore'), fdesc[16]))
    fdbf.seek(hlen)
    fshx.seek(100)
    for idx in range(num_rec):
        rec = fdbf.read(rlen)
        idx_bytes = fshx.read(8)
        offset_words, _ = struct.unpack(">II", idx_bytes)
        if not rec or rec[0] == 0x2A:
            continue
        off = 1
        row = {}
        for fn, fl in fields:
            row[fn] = rec[off:off+fl].decode('utf-8', 'ignore').strip()
            off += fl
        dfo_id = row.get("ID", "").strip()
        country = row.get("Country", "").strip()
        other_c = row.get("OtherCount", "").strip()
        if "ghana" not in (country + " " + other_c).lower():
            continue
        fshp.seek(offset_words * 2 + 8)
        stype = struct.unpack("<I", fshp.read(4))[0]
        bbox = list(struct.unpack("<dddd", fshp.read(32))) if stype in (3, 5, 13, 15) else None
        lon = float(row.get("long") or 0)
        lat = float(row.get("lat") or 0)
        orig_coords = [round(lon, 5), round(lat, 5)]
        precision = "basin_polygon_centroid"
        precision_note = "Representative basin/polygon centroid from Dartmouth Flood Observatory (DFO) archive; indicates general flood region, not exact inundation boundary."

        # Handle transboundary or national-polygon DFO centroids where Detailed_L specifies exact Ghana localities
        if dfo_id == "1551":
            # Builsa and Kassena Nankana districts, Upper East Region
            lon, lat = -1.1600, 10.7800
            precision = "district_centroid"
            precision_note = "Transboundary DFO polygon centroid (1.79E, 11.16N) adjusted to documented Ghana impact area: Builsa & Kassena Nankana Districts, Upper East Region."
        elif dfo_id == "1560":
            # Northern, Upper East, Upper West regions (West Mamprusi, East/West Gonja, Nanumba, Bole)
            lon, lat = -0.8500, 9.9500
            precision = "regional_approximation"
            precision_note = "Multi-country West Africa flood (DFO #1560); placed at representative centroid of documented Northern/Upper East/Upper West Ghana impact zone."
        elif dfo_id == "3166":
            # 2007 Northern Ghana floods (Oti, Black & White Volta rivers, Upper East/Northern)
            lon, lat = -0.5500, 10.6500
            precision = "regional_approximation"
            precision_note = "Multi-country 2007 Volta Basin flood (DFO #3166 / GLIDE FL-2007-000153-GHA); placed in documented Northeast Ghana / White & Red Volta impact zone."
        elif dfo_id == "3663":
            # Tema, Ashaiman and Kpone, East Accra, Greater Accra
            lon, lat = -0.0150, 5.6950
            precision = "district_centroid"
            precision_note = "DFO regional polygon centroid (-0.981, 7.932) refined to documented impact municipalities: Tema, Ashaiman, and Kpone in Greater Accra."
        elif dfo_id == "4260":
            # June 2015 Accra flood disaster (GLIDE FL-2015-000065-GHA)
            lon, lat = -0.2070, 5.5690
            precision = "exact_locality"
            precision_note = "DFO broad polygon centroid (-0.546, 7.380) refined to documented primary disaster epicenter in Accra (Odaw channel / Kwame Nkrumah Circle)."

        meta = dfo_master_meta.get(dfo_id, {})
        began = format_yyyymmdd(row.get("Began") or meta.get("Began"))
        ended = format_yyyymmdd(row.get("Ended") or meta.get("Ended"))
        year = int(began[:4]) if began and len(began) >= 4 else 2000
        dead = int(float(row.get("Dead") or meta.get("Dead") or 0))
        displaced = int(float(row.get("Displaced") or meta.get("Displaced") or 0))
        area_sqkm = round(float(row.get("Area") or meta.get("Affected_s") or 0), 1)
        cause = (row.get("MainCause") or meta.get("Main_cause") or "Heavy Rain").strip()
        sev_num = float(row.get("Severity") or meta.get("Severity__") or 1.0)
        sev_label = "Extreme" if sev_num >= 2.0 else ("High" if sev_num >= 1.5 or dead >= 20 or displaced >= 20000 else "Moderate")

        loc_desc = (meta.get("Detailed_L") or "").replace("\xa0", " ").replace("\n", "; ").strip()
        rivers = (meta.get("Rivers") or "").replace("\n", ", ").strip()

        # Check matching GLIDE and GDACS records
        glide_id = (row.get("GlideNumbe") or "").strip()
        if glide_id in ("0", ""):
            glide_id = ""
        # Match known GLIDE IDs by year/event
        glide_match_map = {
            "1560": "FL-1999-000315-GHA",
            "1740": "FL-2001-000314-GHA",
            "1947": "FL-2002-000373-GHA",
            "3166": "FL-2007-000153-GHA",
            "3501": "FL-2009-000132-GHA",
            "3663": "FL-2010-000118-GHA",
            "3844": "FL-2011-000106-GHA",
            "4260": "FL-2015-000065-GHA"
        }
        if dfo_id in glide_match_map:
            glide_id = glide_match_map[dfo_id]
        glide_rec = glide_by_id.get(glide_id)
        if glide_id:
            used_glide_ids.add(glide_id)

        gdacs_ft = gdacs_by_dfo_id.get(dfo_id)
        sources = ["DFO"]
        source_url = "https://doi.org/10.5066/P135ARGI"
        if gdacs_ft:
            sources.append("GDACS")
            source_url = gdacs_ft["properties"]["url"]["report"]
        if glide_rec:
            sources.append("GLIDE")
            if not loc_desc and glide_rec.get("location"):
                loc_desc = glide_rec["location"].strip()
            if glide_rec.get("affected") and int(glide_rec["affected"]) > displaced:
                displaced = int(glide_rec["affected"])
            if glide_rec.get("killed") and int(glide_rec["killed"]) > dead:
                dead = int(glide_rec["killed"])

        adm = locate_admin(lon, lat)
        if not loc_desc:
            loc_desc = f"{adm['district']}, {adm['region']} Region"

        title_overrides = {
            "1560": "Northern, Upper East & Upper West Flood",
            "3166": "Northern & Upper East Volta Basin Flood",
            "3663": "Tema, Ashaiman & Kpone Flood",
            "4260": "Greater Accra (Odaw / Circle) Flood Disaster",
            "1551": "Builsa & Kassena Nankana Flood",
            "1740": "Accra (East Legon, Odawna & Kasoa) Flood",
            "3501": "Southern Coastal & Forest Belt Flood",
            "3542": "Northern Region & Dam Release Flood",
            "4683": "White Volta & Northern Region Flood"
        }
        if dfo_id in title_overrides:
            title = f"{title_overrides[dfo_id]} ({began[:7]})"
        else:
            title_loc = loc_desc.split(";")[0].split(",")[0].replace("Southern Ghana - ", "").replace("Coastal Ghana - ", "").replace(".", "").strip()
            if len(title_loc) > 38 or not title_loc:
                title_loc = f"{adm['district']} ({adm['region']})"
            title = f"{title_loc} Flood ({began[:7]})"

        desc_parts = [f"Documented historical flood event ({began} to {ended}) triggered by {cause.lower()}."]
        if loc_desc:
            desc_parts.append(f"Reported impact areas: {loc_desc}.")
        if rivers:
            desc_parts.append(f"Associated river systems: {rivers}.")
        if glide_rec and glide_rec.get("comments"):
            desc_parts.append(f"UN OCHA / GLIDE summary: {glide_rec['comments'].strip()}")

        flood_events.append({
            "id": f"DFO-{dfo_id}",
            "title": title,
            "start_date": began,
            "end_date": ended,
            "year": year,
            "region": adm["region"],
            "region_pcode": adm["region_pcode"],
            "district": adm["district"],
            "district_pcode": adm["district_pcode"],
            "location_description": loc_desc,
            "rivers": rivers or "Local drainage / Volta or Coastal watershed",
            "primary_source": "DFO",
            "all_sources": sources,
            "source_org": "Dartmouth Flood Observatory (DFO) / USGS GFID" + (" / GDACS" if gdacs_ft else "") + (" / UN OCHA GLIDE" if glide_rec else ""),
            "source_url": source_url,
            "glide_number": glide_id or None,
            "cause": cause.title(),
            "severity_label": sev_label,
            "fatalities": dead,
            "displaced_or_affected": displaced,
            "reported_area_sqkm": area_sqkm if area_sqkm > 0 else None,
            "bbox": [round(v, 4) for v in bbox] if bbox else None,
            "coordinate_precision": precision,
            "precision_note": precision_note,
            "original_source_coords": orig_coords,
            "description": " ".join(desc_parts),
            "lon": round(lon, 5),
            "lat": round(lat, 5)
        })

# 5e. Add standalone GLIDE Flood Events in Ghana not already merged with DFO
# Note: FL-2018-000153-GHA is an empty (0,0) stub superseded by FL-2018-000154-GHA (Bawku / Bagre Dam spillage)
# Note: FL-2019-000135-GHA (Oct 2019 Upper East flood) matches GDACS-1100228 (2019-10-12 Upper East)
used_glide_ids.add("FL-2018-000153-GHA")
used_glide_ids.add("FL-2019-000135-GHA")

for r in glide_all_fl:
    gid = r["glidenumber"].strip()
    if gid in used_glide_ids:
        continue
    used_glide_ids.add(gid)
    y = int(r["year"])
    m = int(r["month"]) if r.get("month") and int(r["month"]) > 0 else 1
    d = int(r["day"]) if r.get("day") and int(r["day"]) > 0 else 1
    date_str = f"{y:04d}-{m:02d}-{d:02d}"
    lon = float(r.get("longitude") or 0)
    lat = float(r.get("latitude") or 0)
    orig_coords = [round(lon, 5), round(lat, 5)]
    comments = (r.get("comments") or "").strip()
    loc_text = (r.get("location") or "").strip()

    precision = "exact_locality"
    precision_note = "Locality coordinate recorded in UN OCHA GLIDE disaster registry."
    if loc_text.lower() == "bakwu":
        loc_text = "Bawku & Upper East / Northern Regions (Bagre Dam Spillage)"
    if abs(lon - (-1.023194)) < 0.01 and abs(lat - 7.946527) < 0.01:
        if gid == "FL-2023-000215-GHA":
            # Akosombo and Kpong hydro dam spillage in South-Eastern Ghana (Mepe / North Tongu, Lower Volta)
            lon, lat = 0.3950, 6.0650
            loc_text = "North Tongu / Mepe & Lower Volta Basin (Akosombo & Kpong Dam Spillage)"
            precision = "district_centroid"
            precision_note = "Raw GLIDE record used national centroid (-1.023, 7.947); relocated to documented Lower Volta / North Tongu spillage impact zone."
        elif gid == "FL-2017-000095-GHA":
            lon, lat = -0.4500, 5.6500
            loc_text = "Southern Emergency Zone (Greater Accra, Central, Western & Eastern Regions)"
            precision = "regional_approximation"
            precision_note = "Raw GLIDE record used national centroid (-1.023, 7.947); placed in declared Southern Ghana 4-region flood emergency zone."
        elif gid == "FL-2013-000041-GHA":
            lon, lat = -0.8400, 9.4500
            loc_text = "Northern Ghana Rainstorm & Flood Zone"
            precision = "regional_approximation"
            precision_note = "Raw GLIDE record used national centroid (-1.023, 7.947); placed in documented Northern Region impact area."
        else:
            precision = "regional_approximation"
            precision_note = "Raw GLIDE record used national reference centroid (-1.023, 7.947); represents multi-district flood event."

    adm = locate_admin(lon, lat)
    killed = int(float(r.get("killed") or 0))
    affected = int(float(r.get("affected") or 0))
    if gid == "FL-2023-000215-GHA" and affected == 0:
        affected = 35800  # documented in UN OCHA situation reports for FL-2023-000215-GHA
    sev_label = "Extreme" if gid == "FL-2023-000215-GHA" or killed >= 20 or affected >= 20000 else ("High" if killed >= 5 or affected >= 2000 else "Moderate")
    cause = "Dam Spillage (Akosombo & Kpong)" if gid == "FL-2023-000215-GHA" else "Heavy Rain"

    title_prefix = loc_text.split(",")[0].strip() if loc_text else f"{adm['district']} ({adm['region']})"
    if len(title_prefix) > 42:
        title_prefix = title_prefix[:42].strip()
    flood_events.append({
        "id": f"GLIDE-{gid}",
        "title": f"{title_prefix} Flood ({date_str[:7]})",
        "start_date": date_str,
        "end_date": date_str,
        "year": y,
        "region": adm["region"],
        "region_pcode": adm["region_pcode"],
        "district": adm["district"],
        "district_pcode": adm["district_pcode"],
        "location_description": loc_text or f"{adm['district']}, {adm['region']} Region",
        "rivers": "Lower Volta River" if gid == "FL-2023-000215-GHA" else "Regional watershed",
        "primary_source": "GLIDE",
        "all_sources": ["GLIDE"],
        "source_org": "UN OCHA / GLIDE Disaster Registry (HDX)",
        "source_url": f"https://glidenumber.net/glide/public/search/details.jsp?glide={gid.split('-GHA')[0].split('-', 1)[1]}&record=1&last=1",
        "glide_number": gid,
        "cause": cause,
        "severity_label": sev_label,
        "fatalities": killed,
        "displaced_or_affected": affected,
        "reported_area_sqkm": None,
        "bbox": None,
        "coordinate_precision": precision,
        "precision_note": precision_note,
        "original_source_coords": orig_coords,
        "description": comments or f"UN OCHA GLIDE documented flood event ({gid}) in {loc_text or adm['region']}.",
        "lon": round(lon, 5),
        "lat": round(lat, 5)
    })

# 5f. Load IDMC Internal Displacement Updates (2025-2026 Flood & Storm Surge events)
idmc_events_by_coord_date = {}
with open("data/raw/hdx_idmc_idu_events.csv", "r", encoding="utf-8-sig") as f:
    for r in csv.DictReader(f):
        ev_name = (r.get("event_name") or "").strip()
        if not any(k in ev_name.lower() for k in ["flood", "storm surge"]):
            continue
        # Skip triangulation duplicate if Recommended figure exists for same event
        if r.get("id") == "516059":
            continue
        lon = float(r["longitude"])
        lat = float(r["latitude"])
        # Fix sign error on North East Gonja longitude in raw IDMC row 516061 (+0.528 -> -0.528)
        if r.get("id") == "516061" and lon > 0:
            lon = -lon
        dt = (r.get("displacement_date") or "")[:10]
        fig = int(float(r.get("figure") or 0))
        idmc_events_by_coord_date[r["id"]] = {
            "id": r["id"],
            "name": ev_name,
            "date": dt,
            "start_date": (r.get("event_start_date") or dt)[:10],
            "end_date": (r.get("event_end_date") or dt)[:10],
            "figure": fig,
            "lon": lon,
            "lat": lat,
            "locations_name": (r.get("locations_name") or "").strip(),
            "description": (r.get("description") or r.get("standard_popup_text") or ev_name).strip(),
            "link": (r.get("link") or r.get("source_url") or "https://data.humdata.org/dataset/gha-idmc-idu-events").strip(),
            "accuracy": (r.get("locations_accuracy") or "Admin2 / Locality").strip()
        }

matched_idmc_ids = set()

# 5g. Add 28 Modern GDACS / GloFAS Flood Events (2019-2026)
for ft in gdacs_modern_events:
    p = ft["properties"]
    ev_id = str(p["eventid"])
    lon, lat = ft["geometry"]["coordinates"][0], ft["geometry"]["coordinates"][1]
    from_dt = p["fromdate"][:10]
    to_dt = p["todate"][:10]
    year = int(from_dt[:4])
    adm = locate_admin(lon, lat)

    # Check if an IDMC event matches this GDACS event in time & space (e.g. GDACS 1104196 & IDMC 516058 Hohoe Sep 2026, or May 2025 Greater Accra)
    linked_idmc = None
    for iid, irec in idmc_events_by_coord_date.items():
        if iid in matched_idmc_ids:
            continue
        dist = haversine_km(lon, lat, irec["lon"], irec["lat"])
        if abs(int(irec["date"][:4]) - year) == 0 and irec["date"][:7] == from_dt[:7] and dist < 35.0:
            linked_idmc = irec
            matched_idmc_ids.add(iid)
            break

    sources = ["GDACS"]
    glide_num = None
    displaced = None
    loc_desc = f"{adm['district']}, {adm['region']} Region"
    desc = f"GDACS / Copernicus GloFAS satellite and hydrological flood alert (#{ev_id}, episode {p['episodeid']}) recorded in {adm['district']} ({adm['region']} Region) from {from_dt} to {to_dt}."
    if ev_id == "1100228" and "FL-2019-000135-GHA" in glide_by_id:
        sources.append("GLIDE")
        glide_num = "FL-2019-000135-GHA"
        desc += " " + glide_by_id["FL-2019-000135-GHA"]["comments"].strip()
    if linked_idmc:
        sources.append("IDMC")
        displaced = linked_idmc["figure"]
        loc_desc = linked_idmc["locations_name"] or loc_desc
        desc += f" Corroborated by IDMC displacement monitoring ({displaced:,} people displaced in {loc_desc}). {linked_idmc['description']}"

    sev_label = "High" if (displaced and displaced >= 2000) or p.get("alertlevel", "").lower() == "orange" else "Moderate"

    flood_events.append({
        "id": f"GDACS-{ev_id}",
        "title": f"{adm['district']} ({adm['region']}) Flood ({from_dt[:7]})",
        "start_date": from_dt,
        "end_date": to_dt,
        "year": year,
        "region": adm["region"],
        "region_pcode": adm["region_pcode"],
        "district": adm["district"],
        "district_pcode": adm["district_pcode"],
        "location_description": loc_desc,
        "rivers": f"GloFAS Hydrological Basin ({adm['region']} Region)",
        "primary_source": "GDACS",
        "all_sources": sources,
        "source_org": "GDACS / Copernicus GloFAS" + (" / IDMC" if linked_idmc else "") + (" / UN OCHA GLIDE" if glide_num else ""),
        "source_url": p["url"]["report"],
        "glide_number": glide_num,
        "cause": "Riverine / Heavy Rain (GloFAS Alert)",
        "severity_label": sev_label,
        "fatalities": 0,
        "displaced_or_affected": displaced or 0,
        "reported_area_sqkm": None,
        "bbox": None,
        "coordinate_precision": "exact_locality" if linked_idmc else "basin_polygon_centroid",
        "precision_note": "GDACS / GloFAS representative alert centroid coordinate (`Point_Centroid`). Indicates hydrological alert location, not street-level inundation footprint.",
        "original_source_coords": [round(lon, 5), round(lat, 5)],
        "description": desc,
        "lon": round(lon, 5),
        "lat": round(lat, 5)
    })

# 5h. Add remaining distinct IDMC Flood & Storm Surge Displacement Events (2025-2026)
for iid, irec in idmc_events_by_coord_date.items():
    if iid in matched_idmc_ids:
        continue
    lon, lat = irec["lon"], irec["lat"]
    adm = locate_admin(lon, lat)
    is_surge = "storm surge" in irec["name"].lower()
    cause = "Coastal Storm Surge" if is_surge else "Heavy Rain / Urban & Fluvial Flood"
    sev_label = "Extreme" if irec["figure"] >= 10000 else ("High" if irec["figure"] >= 1000 else "Moderate")
    flood_events.append({
        "id": f"IDMC-{iid}",
        "title": f"{adm['district']} {'Coastal Surge' if is_surge else 'Flood'} ({irec['date'][:7]})",
        "start_date": irec["start_date"],
        "end_date": irec["end_date"],
        "year": int(irec["date"][:4]),
        "region": adm["region"],
        "region_pcode": adm["region_pcode"],
        "district": adm["district"],
        "district_pcode": adm["district_pcode"],
        "location_description": irec["locations_name"] or f"{adm['district']}, {adm['region']} Region",
        "rivers": "Bight of Benin Coastal Zone" if is_surge else f"{adm['region']} Watershed",
        "primary_source": "IDMC",
        "all_sources": ["IDMC"],
        "source_org": "Internal Displacement Monitoring Centre (IDMC / HDX)",
        "source_url": "https://data.humdata.org/dataset/gha-idmc-idu-events",
        "glide_number": None,
        "cause": cause,
        "severity_label": sev_label,
        "fatalities": 0,
        "displaced_or_affected": irec["figure"],
        "reported_area_sqkm": None,
        "bbox": None,
        "coordinate_precision": "exact_locality",
        "precision_note": f"IDMC verified displacement location ({irec['accuracy']}).",
        "original_source_coords": [round(lon, 5), round(lat, 5)],
        "description": f"{irec['description']} Documented displacement: {irec['figure']:,} people.",
        "lon": round(lon, 5),
        "lat": round(lat, 5)
    })

# Sort flood events chronologically descending
flood_events.sort(key=lambda x: x["start_date"], reverse=True)

# 5i. Compute spatial proximity metrics for every flood event against monitoring stations & healthcare facilities
station_coords = [
    (
        ft["geometry"]["coordinates"][0],
        ft["geometry"]["coordinates"][1],
        ft["properties"]["groundtruthed"],
        ft["properties"]["name"],
        ft["properties"]["id"],
        ft["properties"]["station_category"]
    )
    for ft in monitoring_features
]

facility_coords = [
    (
        ft["geometry"]["coordinates"][0],
        ft["geometry"]["coordinates"][1],
        ft["properties"]["facility_type"],
        ft["properties"]["name"],
        ft["properties"]["id"]
    )
    for ft in health_features
]

flood_geojson_features = []
for ev in flood_events:
    elon, elat = ev["lon"], ev["lat"]
    # Station distances
    s_dists = []
    gt_dists = []
    within_15km_stations = 0
    within_15km_gt_stations = 0
    for slon, slat, is_gt, sname, sid, scat in station_coords:
        d = haversine_km(elon, elat, slon, slat)
        s_dists.append((d, sname, sid, is_gt, scat))
        if is_gt:
            gt_dists.append((d, sname, sid, scat))
        if d <= 15.0:
            within_15km_stations += 1
            if is_gt:
                within_15km_gt_stations += 1
    s_dists.sort(key=lambda x: x[0])
    gt_dists.sort(key=lambda x: x[0])

    # Facility distances
    f_dists = []
    hospitals_dists = []
    within_10km_fac = 0
    within_10km_hosp = 0
    for flon, flat, ftype, fname, fid in facility_coords:
        d = haversine_km(elon, elat, flon, flat)
        f_dists.append((d, fname, fid, ftype))
        if ftype == "Hospital":
            hospitals_dists.append((d, fname, fid))
        if d <= 10.0:
            within_10km_fac += 1
            if ftype == "Hospital":
                within_10km_hosp += 1
    f_dists.sort(key=lambda x: x[0])
    hospitals_dists.sort(key=lambda x: x[0])

    ev["nearest_station_km"] = round(s_dists[0][0], 2) if s_dists else None
    ev["nearest_station_name"] = s_dists[0][1] if s_dists else None
    ev["nearest_groundtruthed_station_km"] = round(gt_dists[0][0], 2) if gt_dists else None
    ev["nearest_groundtruthed_station_name"] = gt_dists[0][1] if gt_dists else None
    ev["stations_within_15km"] = within_15km_stations
    ev["groundtruthed_stations_within_15km"] = within_15km_gt_stations

    ev["nearest_facility_km"] = round(f_dists[0][0], 2) if f_dists else None
    ev["nearest_facility_name"] = f_dists[0][1] if f_dists else None
    ev["nearest_hospital_km"] = round(hospitals_dists[0][0], 2) if hospitals_dists else None
    ev["nearest_hospital_name"] = hospitals_dists[0][1] if hospitals_dists else None
    ev["facilities_within_10km"] = within_10km_fac
    ev["hospitals_within_10km"] = within_10km_hosp

    props = {k: v for k, v in ev.items() if k not in ("lon", "lat")}
    flood_geojson_features.append({
        "type": "Feature",
        "geometry": {"type": "Point", "coordinates": [elon, elat]},
        "properties": props
    })

with open("public/data/flood_events.geojson", "w", encoding="utf-8") as f:
    json.dump({"type": "FeatureCollection", "features": flood_geojson_features}, f, separators=(",", ":"))

print(f"Saved {len(flood_geojson_features)} harmonized historical flood events in Ghana (1988-2026).")

print("\n=== Step 6: Enriching & Simplifying Admin Regions (ADM1) & District Flood Exposure Summary (ADM2) ===")

def simplify_ring(ring, step=8):
    if len(ring) <= 25:
        return [[round(pt[0], 4), round(pt[1], 4)] for pt in ring]
    simplified = [[round(ring[i][0], 4), round(ring[i][1], 4)] for i in range(0, len(ring) - 1, step)]
    if simplified[0] != [round(ring[-1][0], 4), round(ring[-1][1], 4)]:
        simplified.append(simplified[0])
    if len(simplified) < 4:
        return [[round(pt[0], 4), round(pt[1], 4)] for pt in ring]
    return simplified

def simplify_geom(geom, step=8):
    gtype = geom["type"]
    coords = geom["coordinates"]
    if gtype == "Polygon":
        return {"type": "Polygon", "coordinates": [simplify_ring(r, step) for r in coords]}
    elif gtype == "MultiPolygon":
        return {"type": "MultiPolygon", "coordinates": [[simplify_ring(r, step) for r in poly] for poly in coords]}
    return geom

region_stats = {}
for ft in adm1_raw["features"]:
    p = ft["properties"]
    rname = p["adm1_name"]
    region_stats[rname] = {
        "adm1_name": rname,
        "adm1_pcode": p["adm1_pcode"],
        "area_sqkm": round(float(p["area_sqkm"] or 0), 1),
        "center_lon": round(float(p["center_lon"] or 0), 4),
        "center_lat": round(float(p["center_lat"] or 0), 4),
        "flood_event_count": 0,
        "health_facility_count": 0,
        "hospital_count": 0,
        "monitoring_station_count": 0,
        "groundtruthed_station_count": 0,
        "iot_node_count": 0,
        "total_population": 0,
        "rp100_exposed_hospitals": 0,
        "rp100_exposed_primary_care": 0,
        "rp100_exposed_schools": 0,
        "rp100_exposed_crops_km2": 0.0,
        "rp100_exposed_children_u5": 0
    }

for ft in flood_geojson_features:
    r = ft["properties"]["region"]
    if r in region_stats:
        region_stats[r]["flood_event_count"] += 1

for ft in health_features:
    r = ft["properties"]["region"]
    if r in region_stats:
        region_stats[r]["health_facility_count"] += 1
        if ft["properties"]["facility_type"] == "Hospital":
            region_stats[r]["hospital_count"] += 1

for ft in monitoring_features:
    r = ft["properties"]["region"]
    if r in region_stats:
        region_stats[r]["monitoring_station_count"] += 1
        if ft["properties"]["groundtruthed"]:
            region_stats[r]["groundtruthed_station_count"] += 1
        if ft["properties"]["station_category"] == "iot_telemetry_node":
            region_stats[r]["iot_node_count"] += 1

district_summaries = []
for _, props, _ in adm2_index:
    pcode = props["adm2_pcode"]
    rname = props["adm1_name"]
    exp = adm2_exposure.get(pcode, {})
    vul = adm2_vuln.get(pcode, {})
    fac = adm2_fac_counts.get(pcode, {})

    tot_pop = int(float(vul.get("total_pop") or 0))
    rp100_hosp = int(float(exp.get("RP100_hospitals_30cm_count") or 0))
    rp100_phc = int(float(exp.get("RP100_primary_healthcare_30cm_count") or 0))
    rp100_edu = int(float(exp.get("RP100_education_30cm_count") or 0))
    rp100_crops = round(float(exp.get("RP100_crops_30cm_km2") or 0.0), 2)
    rp100_u5 = int(float(exp.get("RP100_children_u5_30cm") or 0))

    if rname in region_stats:
        region_stats[rname]["total_population"] += tot_pop
        region_stats[rname]["rp100_exposed_hospitals"] += rp100_hosp
        region_stats[rname]["rp100_exposed_primary_care"] += rp100_phc
        region_stats[rname]["rp100_exposed_schools"] += rp100_edu
        region_stats[rname]["rp100_exposed_crops_km2"] = round(region_stats[rname]["rp100_exposed_crops_km2"] + rp100_crops, 2)
        region_stats[rname]["rp100_exposed_children_u5"] += rp100_u5

    district_summaries.append({
        "adm2_pcode": pcode,
        "adm2_name": props["adm2_name"],
        "adm1_name": rname,
        "adm1_pcode": props["adm1_pcode"],
        "center_lon": round(float(props["center_lon"]), 4),
        "center_lat": round(float(props["center_lat"]), 4),
        "area_sqkm": round(float(props["area_sqkm"]), 1),
        "total_pop": tot_pop,
        "hospitals_total": int(float(fac.get("hospitals_count") or 0)),
        "primary_care_total": int(float(fac.get("primary_healthcare_count") or 0)),
        "rp100_exposed_hospitals": rp100_hosp,
        "rp100_exposed_primary_care": rp100_phc,
        "rp100_exposed_schools": rp100_edu,
        "rp100_exposed_crops_km2": rp100_crops,
        "rp100_exposed_children_u5": rp100_u5
    })

adm1_out_features = []
for ft in adm1_raw["features"]:
    rname = ft["properties"]["adm1_name"]
    adm1_out_features.append({
        "type": "Feature",
        "geometry": simplify_geom(ft["geometry"], step=6),
        "properties": region_stats[rname]
    })

with open("public/data/admin_regions.geojson", "w", encoding="utf-8") as f:
    json.dump({"type": "FeatureCollection", "features": adm1_out_features}, f, separators=(",", ":"))

with open("public/data/admin_districts_summary.json", "w", encoding="utf-8") as f:
    json.dump(district_summaries, f, separators=(",", ":"))

print("\n=== Step 7: Generating National Dataset Summary & Key Insights JSON ===")
events_without_gt_station_15km = sum(1 for ft in flood_geojson_features if ft["properties"]["groundtruthed_stations_within_15km"] == 0)
events_without_any_station_15km = sum(1 for ft in flood_geojson_features if ft["properties"]["stations_within_15km"] == 0)
avg_dist_gt_station = round(sum(ft["properties"]["nearest_groundtruthed_station_km"] for ft in flood_geojson_features) / len(flood_geojson_features), 1)
avg_dist_hospital = round(sum(ft["properties"]["nearest_hospital_km"] for ft in flood_geojson_features) / len(flood_geojson_features), 1)

hydro_gt_count = sum(1 for ft in monitoring_features if ft["properties"]["station_category"] == "hydro_groundtruthed")
hydro_legacy_count = sum(1 for ft in monitoring_features if ft["properties"]["station_category"] == "hydro_legacy_catalog")
iot_node_count = sum(1 for ft in monitoring_features if ft["properties"]["station_category"] == "iot_telemetry_node")

summary_payload = {
    "generated_at": "2026-11-01T05:50:00Z",
    "counts": {
        "flood_events_total": len(flood_geojson_features),
        "flood_events_by_primary_source": {
            "DFO": sum(1 for ft in flood_geojson_features if ft["properties"]["primary_source"] == "DFO"),
            "GDACS": sum(1 for ft in flood_geojson_features if ft["properties"]["primary_source"] == "GDACS"),
            "IDMC": sum(1 for ft in flood_geojson_features if ft["properties"]["primary_source"] == "IDMC"),
            "GLIDE": sum(1 for ft in flood_geojson_features if ft["properties"]["primary_source"] == "GLIDE")
        },
        "year_min": min(ft["properties"]["year"] for ft in flood_geojson_features),
        "year_max": max(ft["properties"]["year"] for ft in flood_geojson_features),
        "monitoring_stations_total": len(monitoring_features),
        "hydro_groundtruthed_count": hydro_gt_count,
        "hydro_legacy_catalog_count": hydro_legacy_count,
        "iot_telemetry_nodes_count": iot_node_count,
        "iot_telemetry_links_count": len(iot_links_features),
        "health_facilities_total": len(health_features),
        "hospitals_total": sum(1 for ft in health_features if ft["properties"]["facility_type"] == "Hospital"),
        "clinics_and_centres_total": sum(1 for ft in health_features if ft["properties"]["facility_type"] != "Hospital"),
        "road_segments_total": len(road_features),
        "regions_total": len(adm1_out_features),
        "districts_total": len(district_summaries)
    },
    "national_insights": {
        "events_without_groundtruthed_station_within_15km": events_without_gt_station_15km,
        "pct_events_without_groundtruthed_station_within_15km": round(100.0 * events_without_gt_station_15km / len(flood_geojson_features), 1),
        "events_without_any_station_within_15km": events_without_any_station_15km,
        "pct_events_without_any_station_within_15km": round(100.0 * events_without_any_station_15km / len(flood_geojson_features), 1),
        "avg_nearest_groundtruthed_station_km": avg_dist_gt_station,
        "avg_nearest_hospital_km": avg_dist_hospital,
        "groundtruthed_ratio_pct": round(100.0 * hydro_gt_count / (hydro_gt_count + hydro_legacy_count), 1),
        "rp100_exposed_hospitals_national": sum(d["rp100_exposed_hospitals"] for d in district_summaries),
        "rp100_exposed_primary_care_national": sum(d["rp100_exposed_primary_care"] for d in district_summaries),
        "rp100_exposed_schools_national": sum(d["rp100_exposed_schools"] for d in district_summaries),
        "rp100_exposed_children_u5_national": sum(d["rp100_exposed_children_u5"] for d in district_summaries)
    },
    "regions": sorted(list(region_stats.values()), key=lambda x: x["flood_event_count"], reverse=True)
}

with open("public/data/dataset_summary.json", "w", encoding="utf-8") as f:
    json.dump(summary_payload, f, indent=2)

print("Summary counts:", json.dumps(summary_payload["counts"], indent=2))
print("National insights:", json.dumps(summary_payload["national_insights"], indent=2))
for fn in sorted(os.listdir("public/data")):
    p = os.path.join("public/data", fn)
    print(f"Output file: {fn} -> {os.path.getsize(p):,} bytes")
