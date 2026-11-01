# AWS Deployment & Operations Guide: FloodLens Ghana

## 1. Live Production URL & Resource Inventory

- **Live Public URL (Amazon CloudFront HTTPS):** [https://d278ej7a4gd3yf.cloudfront.net](https://d278ej7a4gd3yf.cloudfront.net)
- **AWS Account ID:** `694069618970`
- **Authorized AWS CLI Profile:** `Builder-challenges` (`arn:aws:iam::694069618970:user/Builder-challenges`)
- **AWS Region:** `us-east-1` (US East, N. Virginia)
- **Resource Isolation Prefix:** `floodlens-mapit-2026`

### Provisioned AWS Resources

| Service | Resource Name / ID | ARN / Endpoint | Purpose & Security Configuration |
| :--- | :--- | :--- | :--- |
| **Amazon Location Service** | `floodlens-mapit-2026-light` | `arn:aws:geo:us-east-1:694069618970:map/floodlens-mapit-2026-light` | Primary light cartographic vector basemap (`VectorOpenDataVisualizationLight`, `RequestBasedUsage`). |
| **Amazon Location Service** | `floodlens-mapit-2026-dark` | `arn:aws:geo:us-east-1:694069618970:map/floodlens-mapit-2026-dark` | Dark cartographic vector basemap (`VectorOpenDataVisualizationDark`, `RequestBasedUsage`). |
| **Amazon Location Service** | `floodlens-mapit-2026-tile-key` | `arn:aws:geo:us-east-1:694069618970:api-key/floodlens-mapit-2026-tile-key` | Scoped read-only tile API key (`geo:GetMap*` only, restricted to `floodlens-mapit-2026-*` maps and `*.cloudfront.net` / `localhost` referers, expires `2026-12-01T00:00:00Z`). |
| **Amazon S3** | `floodlens-mapit-2026-694069618970` | `arn:aws:s3:::floodlens-mapit-2026-694069618970` | Private static asset and GeoJSON catalog bucket (`BlockPublicAcls=true`, `IgnorePublicAcls=true`, `BlockPublicPolicy=true`, `RestrictPublicBuckets=true`). |
| **Amazon CloudFront OAC** | `floodlens-mapit-2026-oac` (`E236XC6V66VPUK`) | Origin Access Control (`sigv4`, `always`) | Authenticates CloudFront edge requests to the private S3 bucket without making the S3 bucket public. |
| **Amazon CloudFront** | `ES0WZ9I518VV6` | `arn:aws:cloudfront::694069618970:distribution/ES0WZ9I518VV6` (`https://d278ej7a4gd3yf.cloudfront.net`) | Global HTTPS CDN (`PriceClass_100`, `http2and3`, Brotli/Gzip compression, SPA `index.html` routing). |

---

## 2. Pre-Deployment Account Safety Verification

Before running any deployment command, verify that the active AWS profile resolves to the dedicated `Builder-challenges` account (`694069618970`) and never to an unrelated profile:

```bash
aws configure list-profiles
aws sts get-caller-identity --profile Builder-challenges --region us-east-1
```

Expected output:

```json
{
  "UserId": "AIDAZ5TC6FJVH7SZZI4AF",
  "Account": "694069618970",
  "Arn": "arn:aws:iam::694069618970:user/Builder-challenges"
}
```

---

## 3. Reproducible Build & Deployment Workflow

### Step 1: Rebuild Processed Geospatial Datasets (Optional if already generated)

```bash
python scripts/build_geospatial_datasets.py
```

This script reads the raw datasets in `data/raw/`, validates all coordinates against Ghana's 16 Regions (`ADM1`) and 260 Districts (`ADM2`), computes Haversine distances, and writes the 8 production GeoJSON/JSON files into `public/data/`.

### Step 2: Run Automated Tests & Production Bundle Build

```bash
npm test
npm run build
```

### Step 3: Deploy to Private S3 + CloudFront OAC

Run the idempotent deployment script [`scripts/deploy_aws.py`](../scripts/deploy_aws.py):

```bash
python scripts/deploy_aws.py
```

What [`scripts/deploy_aws.py`](../scripts/deploy_aws.py) does:
1. Verifies `aws sts get-caller-identity` matches Account `694069618970`.
2. Ensures S3 bucket `floodlens-mapit-2026-694069618970` exists with `PublicAccessBlockConfiguration` enabled.
3. Ensures CloudFront Origin Access Control `floodlens-mapit-2026-oac` (`E236XC6V66VPUK`) exists.
4. Ensures CloudFront Distribution `ES0WZ9I518VV6` exists and points to `floodlens-mapit-2026-694069618970.s3.us-east-1.amazonaws.com`.
5. Attaches a least-privilege S3 bucket policy allowing `s3:GetObject` exclusively from `cloudfront.amazonaws.com` where `AWS:SourceArn == arn:aws:cloudfront::694069618970:distribution/ES0WZ9I518VV6`.
6. Uploads all compiled assets and GeoJSON files from `dist/` with explicit MIME types (`application/geo+json`, `application/javascript`, `text/css`, `text/html`) and cache headers.

### Step 4: Invalidate CloudFront Cache (When Updating `index.html` or `/data/*.geojson`)

```bash
aws cloudfront create-invalidation \
  --distribution-id ES0WZ9I518VV6 \
  --paths "/index.html" "/data/*" \
  --profile Builder-challenges \
  --region us-east-1
```

---

## 4. Safe Post-Competition Teardown Procedure

To remove **only** the `floodlens-mapit-2026` resources after competition judging concludes (without affecting any other resources in Account `694069618970`):

1. **Disable and Delete the CloudFront Distribution (`ES0WZ9I518VV6`):**
   - Disable distribution `ES0WZ9I518VV6`, wait for `aws cloudfront wait distribution-deployed --id ES0WZ9I518VV6 --profile Builder-challenges`, and run `aws cloudfront delete-distribution --id ES0WZ9I518VV6 --if-match <ETag> --profile Builder-challenges`.
2. **Delete the CloudFront OAC (`E236XC6V66VPUK`):**
   - `aws cloudfront delete-origin-access-control --id E236XC6V66VPUK --if-match <ETag> --profile Builder-challenges`
3. **Empty and Delete the Private S3 Bucket (`floodlens-mapit-2026-694069618970`):**
   - `aws s3 rb s3://floodlens-mapit-2026-694069618970 --force --profile Builder-challenges --region us-east-1`
4. **Delete the Amazon Location Service Maps and API Key:**
   - `aws location delete-key --key-name floodlens-mapit-2026-tile-key --profile Builder-challenges --region us-east-1`
   - `aws location delete-map --map-name floodlens-mapit-2026-light --profile Builder-challenges --region us-east-1`
   - `aws location delete-map --map-name floodlens-mapit-2026-dark --profile Builder-challenges --region us-east-1`
