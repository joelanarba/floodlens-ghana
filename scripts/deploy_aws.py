"""
Deploys FloodLens Ghana to a private Amazon S3 bucket behind an Amazon CloudFront
Origin Access Control (OAC) distribution under the authorized Builder-challenges profile.
"""

import json
import mimetypes
import os
import subprocess
import sys
import time
from pathlib import Path

PROFILE = "Builder-challenges"
REGION = "us-east-1"
ACCOUNT_ID = "694069618970"
BUCKET_NAME = f"floodlens-mapit-2026-{ACCOUNT_ID}"
OAC_NAME = "floodlens-mapit-2026-oac"
CALLER_REF = "floodlens-mapit-2026-cf-v1"

CONTENT_TYPES = {
    ".html": "text/html; charset=utf-8",
    ".css": "text/css; charset=utf-8",
    ".js": "application/javascript; charset=utf-8",
    ".json": "application/json; charset=utf-8",
    ".geojson": "application/geo+json; charset=utf-8",
    ".svg": "image/svg+xml",
    ".png": "image/png",
    ".ico": "image/x-icon",
    ".webm": "video/webm",
}


def run_aws(args: list[str], parse_json: bool = True):
    cmd = ["aws"] + args + ["--profile", PROFILE, "--region", REGION]
    if parse_json:
        cmd += ["--output", "json"]
    res = subprocess.run(cmd, capture_output=True, text=True, check=False)
    if res.returncode != 0:
        raise RuntimeError(f"AWS CLI command failed: {' '.join(cmd)}\nSTDERR: {res.stderr}")
    if parse_json and res.stdout.strip():
        return json.loads(res.stdout)
    return res.stdout.strip()


def verify_identity():
    ident = run_aws(["sts", "get-caller-identity"])
    if ident.get("Account") != ACCOUNT_ID:
        raise RuntimeError(f"Unexpected AWS Account: {ident}")
    print(f"[OK] Verified AWS Identity: {ident['Arn']}")


def ensure_private_s3_bucket():
    # Check if bucket exists
    check = subprocess.run(
        ["aws", "s3api", "head-bucket", "--bucket", BUCKET_NAME, "--profile", PROFILE, "--region", REGION],
        capture_output=True,
        text=True,
    )
    if check.returncode != 0:
        print(f"Creating private S3 bucket: {BUCKET_NAME}...")
        run_aws(["s3api", "create-bucket", "--bucket", BUCKET_NAME], parse_json=False)
    else:
        print(f"[OK] S3 bucket already exists: {BUCKET_NAME}")

    # Enforce Block Public Access
    run_aws(
        [
            "s3api",
            "put-public-access-block",
            "--bucket",
            BUCKET_NAME,
            "--public-access-block-configuration",
            "BlockPublicAcls=true,IgnorePublicAcls=true,BlockPublicPolicy=true,RestrictPublicBuckets=true",
        ],
        parse_json=False,
    )
    print(f"[OK] Verified S3 BlockPublicAccess on {BUCKET_NAME}")


def ensure_oac() -> str:
    oac_list = run_aws(["cloudfront", "list-origin-access-controls"])
    items = oac_list.get("OriginAccessControlList", {}).get("Items", [])
    for item in items:
        if item.get("Name") == OAC_NAME:
            print(f"[OK] Found existing CloudFront OAC: {item['Id']}")
            return item["Id"]

    oac_config = {
        "Name": OAC_NAME,
        "Description": "Origin Access Control for FloodLens Ghana S3 bucket (floodlens-mapit-2026)",
        "SigningProtocol": "sigv4",
        "SigningBehavior": "always",
        "OriginAccessControlOriginType": "s3",
    }
    created = run_aws(
        [
            "cloudfront",
            "create-origin-access-control",
            "--origin-access-control-config",
            json.dumps(oac_config),
        ]
    )
    oac_id = created["OriginAccessControl"]["Id"]
    print(f"[OK] Created CloudFront OAC: {oac_id}")
    return oac_id


def ensure_cloudfront_distribution(oac_id: str) -> tuple[str, str, str]:
    dist_list = run_aws(["cloudfront", "list-distributions"])
    items = dist_list.get("DistributionList", {}).get("Items", [])
    for item in items:
        if item.get("Comment") == "FloodLens Ghana (floodlens-mapit-2026)":
            dist_id = item["Id"]
            domain = item["DomainName"]
            arn = item["ARN"]
            print(f"[OK] Found existing CloudFront Distribution: {dist_id} ({domain})")
            return dist_id, domain, arn

    origin_id = f"S3-{BUCKET_NAME}"
    dist_config = {
        "CallerReference": CALLER_REF,
        "Aliases": {"Quantity": 0},
        "DefaultRootObject": "index.html",
        "Origins": {
            "Quantity": 1,
            "Items": [
                {
                    "Id": origin_id,
                    "DomainName": f"{BUCKET_NAME}.s3.{REGION}.amazonaws.com",
                    "OriginPath": "",
                    "CustomHeaders": {"Quantity": 0},
                    "S3OriginConfig": {"OriginAccessIdentity": ""},
                    "ConnectionAttempts": 3,
                    "ConnectionTimeout": 10,
                    "OriginShield": {"Enabled": False},
                    "OriginAccessControlId": oac_id,
                }
            ],
        },
        "OriginGroups": {"Quantity": 0},
        "DefaultCacheBehavior": {
            "TargetOriginId": origin_id,
            "TrustedSigners": {"Enabled": False, "Quantity": 0},
            "TrustedKeyGroups": {"Enabled": False, "Quantity": 0},
            "ViewerProtocolPolicy": "redirect-to-https",
            "AllowedMethods": {
                "Quantity": 2,
                "Items": ["HEAD", "GET"],
                "CachedMethods": {"Quantity": 2, "Items": ["HEAD", "GET"]},
            },
            "SmoothStreaming": False,
            "Compress": True,
            "LambdaFunctionAssociations": {"Quantity": 0},
            "FunctionAssociations": {"Quantity": 0},
            "FieldLevelEncryptionId": "",
            " CachePolicyId": "658327ea-f89d-4fab-a63d-7e88639e58f6",
        },
        "CacheBehaviors": {"Quantity": 0},
        "CustomErrorResponses": {
            "Quantity": 2,
            "Items": [
                {
                    "ErrorCode": 403,
                    "ResponsePagePath": "/index.html",
                    "ResponseCode": "200",
                    "ErrorCachingMinTTL": 60,
                },
                {
                    "ErrorCode": 404,
                    "ResponsePagePath": "/index.html",
                    "ResponseCode": "200",
                    "ErrorCachingMinTTL": 60,
                },
            ],
        },
        "Comment": "FloodLens Ghana (floodlens-mapit-2026)",
        "Logging": {
            "Enabled": False,
            "IncludeCookies": False,
            "Bucket": "",
            "Prefix": "",
        },
        "PriceClass": "PriceClass_100",
        "Enabled": True,
        "ViewerCertificate": {
            "CloudFrontDefaultCertificate": True,
            "MinimumProtocolVersion": "TLSv1.2_2021",
            "CertificateSource": "cloudfront",
        },
        "Restrictions": {
            "GeoRestriction": {"RestrictionType": "none", "Quantity": 0}
        },
        "WebACLId": "",
        "HttpVersion": "http2and3",
        "IsIPV6Enabled": True,
        "Staging": False,
    }
    # Fix key typo in DefaultCacheBehavior
    dist_config["DefaultCacheBehavior"]["CachePolicyId"] = dist_config[
        "DefaultCacheBehavior"
    ].pop(" CachePolicyId")

    print("Creating CloudFront Distribution (floodlens-mapit-2026)...")
    created = run_aws(
        [
            "cloudfront",
            "create-distribution",
            "--distribution-config",
            json.dumps(dist_config),
        ]
    )
    dist = created["Distribution"]
    dist_id = dist["Id"]
    domain = dist["DomainName"]
    arn = dist["ARN"]
    print(f"[OK] Created CloudFront Distribution: {dist_id} -> https://{domain}")
    return dist_id, domain, arn


def attach_s3_oac_policy(dist_arn: str):
    policy = {
        "Version": "2012-10-17",
        "Statement": [
            {
                "Sid": "AllowCloudFrontServicePrincipalReadOnly",
                "Effect": "Allow",
                "Principal": {"Service": "cloudfront.amazonaws.com"},
                "Action": "s3:GetObject",
                "Resource": f"arn:aws:s3:::{BUCKET_NAME}/*",
                "Condition": {"StringEquals": {"AWS:SourceArn": dist_arn}},
            }
        ],
    }
    run_aws(
        [
            "s3api",
            "put-bucket-policy",
            "--bucket",
            BUCKET_NAME,
            "--policy",
            json.dumps(policy),
        ],
        parse_json=False,
    )
    print(f"[OK] Attached least-privilege CloudFront OAC bucket policy to {BUCKET_NAME}")


def upload_dist_files():
    dist_dir = Path(__file__).resolve().parent.parent / "dist"
    if not dist_dir.exists():
        raise RuntimeError(f"dist directory not found at {dist_dir}")

    files = [p for p in dist_dir.rglob("*") if p.is_file()]
    print(f"Uploading {len(files)} build artifacts from {dist_dir} to s3://{BUCKET_NAME}/...")
    for file_path in files:
        rel_key = file_path.relative_to(dist_dir).as_posix()
        ext = file_path.suffix.lower()
        content_type = CONTENT_TYPES.get(
            ext, mimetypes.guess_type(file_path.name)[0] or "application/octet-stream"
        )
        cache_control = (
            "public, max-age=31536000, immutable"
            if rel_key.startswith("assets/")
            else "public, max-age=300, must-revalidate"
        )
        run_aws(
            [
                "s3api",
                "put-object",
                "--bucket",
                BUCKET_NAME,
                "--key",
                rel_key,
                "--body",
                str(file_path),
                "--content-type",
                content_type,
                "--cache-control",
                cache_control,
            ]
        )
    print(f"[OK] Uploaded all {len(files)} files to s3://{BUCKET_NAME}/")


def main():
    verify_identity()
    ensure_private_s3_bucket()
    oac_id = ensure_oac()
    dist_id, domain, dist_arn = ensure_cloudfront_distribution(oac_id)
    attach_s3_oac_policy(dist_arn)
    upload_dist_files()

    meta = {
        "account_id": ACCOUNT_ID,
        "region": REGION,
        "bucket_name": BUCKET_NAME,
        "oac_id": oac_id,
        "distribution_id": dist_id,
        "distribution_arn": dist_arn,
        "cloudfront_domain": domain,
        "live_url": f"https://{domain}",
    }
    print("\n=== DEPLOYMENT SUMMARY ===")
    print(json.dumps(meta, indent=2))


if __name__ == "__main__":
    main()
