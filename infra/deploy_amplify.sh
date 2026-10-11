#!/usr/bin/env bash
# Deploy the built site to AWS Amplify Hosting (manual zip deploy, HTTPS, free tier).
# Used instead of CloudFront because new AWS accounts cannot create CloudFront
# distributions until AWS Support verifies the account.
#
#   infra/deploy_amplify.sh          # build (with the Lambda URL from state) + deploy
set -euo pipefail
cd "$(dirname "$0")/.."
REGION="${AWS_REGION:-$(aws configure get region || echo ap-south-1)}"
STATE="infra/.deploy-state.json"
state_get() { [ -f "$STATE" ] && python -c "import json; print(json.load(open('$STATE')).get('$1',''))" || echo ""; }
state_set() { python -c "import json,os; p='$STATE'; d=json.load(open(p)) if os.path.exists(p) else {}; d['$1']='$2'; json.dump(d,open(p,'w'),indent=2)"; }

FN_URL=$(state_get lambda_url)
echo "building with VITE_PREDICT_URL=${FN_URL:-<none>}"
VITE_PREDICT_URL="$FN_URL" npm run build --silent

rm -f infra/site.zip
python -c "
import zipfile,os
z=zipfile.ZipFile('infra/site.zip','w',zipfile.ZIP_DEFLATED)
for root,_,files in os.walk('dist'):
    for f in files:
        p=os.path.join(root,f); z.write(p, os.path.relpath(p,'dist'))
z.close(); print('site.zip', round(os.path.getsize('infra/site.zip')/1e6,2), 'MB')"

APP=$(state_get amplify_app)
if [ -z "$APP" ]; then
  APP=$(aws amplify create-app --name airgap --region "$REGION" --platform WEB --query 'app.appId' --output text)
  aws amplify update-app --app-id "$APP" --region "$REGION" --custom-rules file://infra/amplify-rules.json >/dev/null   # SPA rewrite
  aws amplify create-branch --app-id "$APP" --branch-name main --region "$REGION" >/dev/null
  state_set amplify_app "$APP"
  echo "created Amplify app $APP"
fi

aws amplify create-deployment --app-id "$APP" --branch-name main --region "$REGION" > infra/.amplify-deploy.json
JOB=$(python -c "import json; print(json.load(open('infra/.amplify-deploy.json'))['jobId'])")
URL=$(python -c "import json; print(json.load(open('infra/.amplify-deploy.json'))['zipUploadUrl'])")
curl -s -o /dev/null -w "upload HTTP %{http_code}\n" -X PUT -T infra/site.zip -H "Content-Type: application/zip" "$URL"
aws amplify start-deployment --app-id "$APP" --branch-name main --job-id "$JOB" --region "$REGION" >/dev/null
until [ "$(aws amplify get-job --app-id "$APP" --branch-name main --job-id "$JOB" --region "$REGION" --query 'job.summary.status' --output text)" != "PENDING" ]; do sleep 3; done
STATUS=$(aws amplify get-job --app-id "$APP" --branch-name main --job-id "$JOB" --region "$REGION" --query 'job.summary.status' --output text)
SITE="https://main.$APP.amplifyapp.com"
state_set site_url "$SITE"
echo "deployment $JOB: $STATUS"
echo "site: $SITE"
