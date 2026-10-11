# AirGap on AWS

Everything stays inside the free tier for a hackathon-scale audience.

```
browser ──► Amplify Hosting (HTTPS, CDN, SPA rewrite) ── static site: Vite build + public/data/*.json|geojson
   │
   └──► Lambda Function URL (python3.12, 256 MB, ~2 MB zip, no API Gateway)
              GET /?lat=&lon=  → fetch today's CAMS + weather from Open-Meteo
                               → pure-Python LightGBM eval (model.txt ×3 + calibration.json)
                               → {pred, lo, hi, cams, date}
```

| Piece | Service | Why |
|---|---|---|
| Site hosting | Amplify Hosting (manual zip deploy) | HTTPS + CDN with no account verification step. `deploy.sh --site` targets S3 + CloudFront instead, which AWS blocks on new accounts until Support verifies them ("Your account must be verified before you can add new CloudFront resources") |
| Live prediction | Lambda + Function URL | One endpoint anyone can hit for any point in India. No API Gateway keeps it free and simple |
| Model | Files in the Lambda zip | `data/model*.txt` + `data/calibration.json` evaluated by `ml/lgb_pure.py`, verified equal to lightgbm in `ml/test_pipeline.py` |

Deployed (2026-10-11): site `https://main.d3cvwqcst393r5.amplifyapp.com`, Lambda `https://2gd4u767a54mvulo4cqwsnhshq0iwbjh.lambda-url.ap-south-1.on.aws/`, region ap-south-1.

## Deploy

```bash
aws configure                 # IAM user with S3, Lambda, Amplify, and iam:CreateRole/AttachRolePolicy/PassRole on role/airgap-lambda-role
python ml/run_all.py          # produces data/model*.txt, data/calibration.json and public/data/*
infra/deploy.sh --lambda      # creates role, function, public URL (both InvokeFunctionUrl and InvokeFunction permissions)
infra/deploy_amplify.sh       # builds the site with the Lambda URL baked in and deploys it to Amplify
```

Re-run `infra/deploy_amplify.sh` after any site change; `infra/deploy.sh --lambda` after retraining.
State (bucket, function URL, Amplify app id, site URL) lives in `infra/.deploy-state.json`, which is gitignored.

Gotcha we hit: a Function URL with auth type NONE returns 403 unless the resource policy grants **both** `lambda:InvokeFunctionUrl` and `lambda:InvokeFunction` (the latter scoped with `--invoked-via-function-url`). The deploy script adds both.

## Verify

```bash
aws sts get-caller-identity
curl "$(python -c "import json;print(json.load(open('infra/.deploy-state.json'))['lambda_url'])")?lat=26.9&lon=75.8"
curl -I "$(python -c "import json;print(json.load(open('infra/.deploy-state.json'))['site_url'])")"
```

## Tear down

```bash
aws lambda delete-function --function-name airgap-predict --region ap-south-1
aws amplify delete-app --app-id <appId> --region ap-south-1
aws s3 rb s3://<bucket> --force
aws iam detach-role-policy --role-name airgap-lambda-role --policy-arn arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole && aws iam delete-role --role-name airgap-lambda-role
```

## Cost notes (as of Oct 2026, verify against your account)

Amplify Hosting's free allowance covers a few GB of transfer a month, Lambda under 1 M requests/month is free, and the S3 bucket holds ~3 MB. The Lambda makes two outbound HTTPS calls per request to Open-Meteo (no key, generous free tier); responses carry `Cache-Control: max-age=900`.
