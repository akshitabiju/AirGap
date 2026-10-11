# AirGap on AWS

Everything stays inside the free tier for a hackathon-scale audience.

```
browser ──► CloudFront (HTTPS, cache, SPA fallback) ──► S3 (private bucket, OAC)
   │              static site: Vite build + public/data/*.json|geojson
   │
   └──► Lambda Function URL  (python3.12, 256 MB, ~100 KB zip, no API Gateway)
              GET /?lat=&lon=  → fetch today's CAMS + weather from Open-Meteo
                               → pure-Python LightGBM eval (model.txt ×3)
                               → {pred, lo, hi, cams, date}
```

| Piece | Service | Why |
|---|---|---|
| Site hosting | S3 + CloudFront | Static files, global edge cache, free HTTPS; 403/404 rewrite to `index.html` for client-side routes |
| Live prediction | Lambda + Function URL | One endpoint anyone can hit for any point in India. No API Gateway keeps it free and simple |
| Model | Files in the Lambda zip | `data/model*.txt` evaluated by `ml/lgb_pure.py`, verified equal to lightgbm in `ml/test_pipeline.py` |

## Deploy

```bash
aws configure                 # IAM user with S3, CloudFront, Lambda, IAM role permissions
python ml/run_all.py          # produces data/model*.txt and public/data/*
infra/deploy.sh --dry-run     # see what would happen
infra/deploy.sh               # Lambda first, then site (site build embeds the Function URL)
```

Re-run `infra/deploy.sh --site` after `npm run build`-affecting changes; `--lambda` after retraining.
State (bucket, distribution id, function URL) lives in `infra/.deploy-state.json`, which is gitignored.

## Verify

```bash
aws sts get-caller-identity
curl "$(python -c "import json;print(json.load(open('infra/.deploy-state.json'))['lambda_url'])")?lat=26.9&lon=75.8"
```

## Tear down

```bash
aws lambda delete-function --function-name airgap-predict
aws s3 rb s3://<bucket> --force
aws cloudfront get-distribution-config ... (disable, wait, delete)
aws iam detach-role-policy --role-name airgap-lambda-role --policy-arn arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole && aws iam delete-role --role-name airgap-lambda-role
```

## Cost notes (as of Oct 2026, verify against your account)

S3 storage for ~3 MB of site, CloudFront under 1 TB/month, and Lambda under 1 M requests/month are all inside the free allowance. The Lambda makes two outbound HTTPS calls per request to Open-Meteo (no key, generous free tier); responses are cached 15 min at the edge via `Cache-Control`.
