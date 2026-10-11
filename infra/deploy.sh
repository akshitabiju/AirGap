#!/usr/bin/env bash
# AirGap AWS deploy: S3 + CloudFront for the static site, Lambda Function URL for live predictions.
# Idempotent: re-running updates in place. Free-tier friendly (S3, CloudFront, Lambda, no API Gateway).
#
#   infra/deploy.sh            # deploy everything
#   infra/deploy.sh --dry-run  # print what would happen
#   infra/deploy.sh --site     # only rebuild + upload the site
#   infra/deploy.sh --lambda   # only the Lambda
#
# Requires: aws CLI v2 (configured), node, python, zip. State is kept in infra/.deploy-state.json (gitignored).
set -euo pipefail
cd "$(dirname "$0")/.."

REGION="${AWS_REGION:-$(aws configure get region || echo ap-south-1)}"
APP="airgap"
STATE="infra/.deploy-state.json"
DRY=0; DO_SITE=1; DO_LAMBDA=1
for a in "$@"; do
  case "$a" in
    --dry-run) DRY=1 ;; --site) DO_LAMBDA=0 ;; --lambda) DO_SITE=0 ;;
    *) echo "unknown flag $a"; exit 2 ;;
  esac
done
run() { if [ "$DRY" = 1 ]; then echo "[dry-run] $*"; else "$@"; fi; }
state_get() { [ -f "$STATE" ] && python -c "import json,sys; print(json.load(open('$STATE')).get('$1',''))" || echo ""; }
state_set() { python -c "import json,os; p='$STATE'; d=json.load(open(p)) if os.path.exists(p) else {}; d['$1']='$2'; json.dump(d,open(p,'w'),indent=2)"; }

echo "== AirGap deploy (region $REGION) =="
ACCOUNT=$(aws sts get-caller-identity --query Account --output text)
echo "account: $ACCOUNT"
BUCKET=$(state_get bucket); [ -z "$BUCKET" ] && BUCKET="$APP-site-$ACCOUNT-$(date +%s | tail -c 5)"

# ---------- Lambda ----------
if [ "$DO_LAMBDA" = 1 ]; then
  echo "-- Lambda"
  for f in data/model.txt data/model_q16.txt data/model_q84.txt; do [ -f "$f" ] || { echo "missing $f; run python ml/run_all.py first"; exit 1; }; done
  rm -rf infra/lambda_build && mkdir -p infra/lambda_build
  cp infra/lambda/handler.py ml/lgb_pure.py data/model.txt data/model_q16.txt data/model_q84.txt data/calibration.json infra/lambda_build/
  (cd infra/lambda_build && python -c "import zipfile,os; z=zipfile.ZipFile('../lambda.zip','w',zipfile.ZIP_DEFLATED); [z.write(f) for f in os.listdir('.')]; z.close()")
  echo "package: $(du -h infra/lambda.zip | cut -f1)"

  ROLE_NAME="$APP-lambda-role"
  if ! aws iam get-role --role-name "$ROLE_NAME" >/dev/null 2>&1; then
    run aws iam create-role --role-name "$ROLE_NAME" --assume-role-policy-document '{"Version":"2012-10-17","Statement":[{"Effect":"Allow","Principal":{"Service":"lambda.amazonaws.com"},"Action":"sts:AssumeRole"}]}' >/dev/null
    run aws iam attach-role-policy --role-name "$ROLE_NAME" --policy-arn arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole
    echo "created role $ROLE_NAME; waiting for IAM propagation"; [ "$DRY" = 1 ] || sleep 10
  fi
  ROLE_ARN="arn:aws:iam::$ACCOUNT:role/$ROLE_NAME"
  FN="$APP-predict"
  if aws lambda get-function --function-name "$FN" --region "$REGION" >/dev/null 2>&1; then
    run aws lambda update-function-code --function-name "$FN" --zip-file fileb://infra/lambda.zip --region "$REGION" >/dev/null
    [ "$DRY" = 1 ] || aws lambda wait function-updated --function-name "$FN" --region "$REGION"
  else
    run aws lambda create-function --function-name "$FN" --runtime python3.12 --handler handler.lambda_handler \
      --role "$ROLE_ARN" --zip-file fileb://infra/lambda.zip --timeout 20 --memory-size 256 --region "$REGION" \
      --description "AirGap: PM2.5 + 68% interval for any lat/lon in India from live CAMS + weather" >/dev/null
    [ "$DRY" = 1 ] || aws lambda wait function-active --function-name "$FN" --region "$REGION"
  fi
  if ! aws lambda get-function-url-config --function-name "$FN" --region "$REGION" >/dev/null 2>&1; then
    run aws lambda create-function-url-config --function-name "$FN" --auth-type NONE --region "$REGION" \
      --cors '{"AllowOrigins":["*"],"AllowMethods":["GET"],"MaxAge":3600}' >/dev/null
    run aws lambda add-permission --function-name "$FN" --statement-id public-url --action lambda:InvokeFunctionUrl \
      --principal '*' --function-url-auth-type NONE --region "$REGION" >/dev/null || true
    # Public URLs also need InvokeFunction (scoped to calls arriving via the URL), otherwise they return 403.
    run aws lambda add-permission --function-name "$FN" --statement-id public-url-invoke --action lambda:InvokeFunction \
      --principal '*' --invoked-via-function-url --region "$REGION" >/dev/null || true
  fi
  FN_URL=$(aws lambda get-function-url-config --function-name "$FN" --region "$REGION" --query FunctionUrl --output text 2>/dev/null || echo "")
  echo "function url: $FN_URL"
  [ "$DRY" = 1 ] || state_set lambda_url "$FN_URL"
  if [ -n "$FN_URL" ] && [ "$DRY" = 0 ]; then
    echo "smoke test:"; curl -s --max-time 25 "${FN_URL}?lat=26.9124&lon=75.7873" | head -c 400; echo
  fi
fi

# ---------- Site ----------
if [ "$DO_SITE" = 1 ]; then
  echo "-- Site"
  FN_URL=$(state_get lambda_url)
  echo "building with VITE_PREDICT_URL=${FN_URL:-<none>}"
  VITE_PREDICT_URL="$FN_URL" run npm run build --silent
  if ! aws s3api head-bucket --bucket "$BUCKET" 2>/dev/null; then
    if [ "$REGION" = "us-east-1" ]; then run aws s3api create-bucket --bucket "$BUCKET" --region "$REGION" >/dev/null
    else run aws s3api create-bucket --bucket "$BUCKET" --region "$REGION" --create-bucket-configuration LocationConstraint="$REGION" >/dev/null; fi
    [ "$DRY" = 1 ] || state_set bucket "$BUCKET"
  fi
  # Upload: hashed assets long cache, data + html short cache.
  run aws s3 sync dist/ "s3://$BUCKET/" --delete --exclude "index.html" --exclude "data/*" --cache-control "public,max-age=31536000,immutable" --region "$REGION" --only-show-errors
  run aws s3 sync dist/data/ "s3://$BUCKET/data/" --delete --cache-control "public,max-age=300" --region "$REGION" --only-show-errors
  run aws s3 cp dist/index.html "s3://$BUCKET/index.html" --cache-control "public,max-age=60" --content-type "text/html" --region "$REGION" --only-show-errors

  DIST_ID=$(state_get dist_id)
  if [ -z "$DIST_ID" ]; then
    OAC_ID=$(aws cloudfront list-origin-access-controls --query "OriginAccessControlList.Items[?Name=='$APP-oac'].Id | [0]" --output text 2>/dev/null || echo "None")
    if [ "$OAC_ID" = "None" ] || [ -z "$OAC_ID" ]; then
      OAC_ID=$(aws cloudfront create-origin-access-control --origin-access-control-config "Name=$APP-oac,SigningProtocol=sigv4,SigningBehavior=always,OriginAccessControlOriginType=s3" --query OriginAccessControl.Id --output text)
    fi
    cat > infra/.cf-config.json <<JSON
{"CallerReference":"$APP-$(date +%s)","Comment":"AirGap static site","Enabled":true,"DefaultRootObject":"index.html",
 "Origins":{"Quantity":1,"Items":[{"Id":"s3","DomainName":"$BUCKET.s3.$REGION.amazonaws.com","OriginAccessControlId":"$OAC_ID","S3OriginConfig":{"OriginAccessIdentity":""}}]},
 "DefaultCacheBehavior":{"TargetOriginId":"s3","ViewerProtocolPolicy":"redirect-to-https","Compress":true,
   "CachePolicyId":"658327ea-f89d-4fab-a63d-7e88639e58f6","AllowedMethods":{"Quantity":2,"Items":["GET","HEAD"]}},
 "CustomErrorResponses":{"Quantity":2,"Items":[{"ErrorCode":403,"ResponsePagePath":"/index.html","ResponseCode":"200","ErrorCachingMinTTL":10},{"ErrorCode":404,"ResponsePagePath":"/index.html","ResponseCode":"200","ErrorCachingMinTTL":10}]},
 "PriceClass":"PriceClass_200","HttpVersion":"http2and3"}
JSON
    if [ "$DRY" = 1 ]; then echo "[dry-run] aws cloudfront create-distribution"; DIST_ID="DRYRUN"; DOMAIN="dryrun.cloudfront.net"
    else
      OUT=$(aws cloudfront create-distribution --distribution-config file://infra/.cf-config.json)
      DIST_ID=$(echo "$OUT" | python -c "import sys,json; print(json.load(sys.stdin)['Distribution']['Id'])")
      DOMAIN=$(echo "$OUT" | python -c "import sys,json; print(json.load(sys.stdin)['Distribution']['DomainName'])")
      state_set dist_id "$DIST_ID"; state_set domain "$DOMAIN"
      # Allow only CloudFront to read the bucket.
      aws s3api put-public-access-block --bucket "$BUCKET" --public-access-block-configuration BlockPublicAcls=true,IgnorePublicAcls=true,BlockPublicPolicy=true,RestrictPublicBuckets=true
      aws s3api put-bucket-policy --bucket "$BUCKET" --policy "{\"Version\":\"2012-10-17\",\"Statement\":[{\"Effect\":\"Allow\",\"Principal\":{\"Service\":\"cloudfront.amazonaws.com\"},\"Action\":\"s3:GetObject\",\"Resource\":\"arn:aws:s3:::$BUCKET/*\",\"Condition\":{\"StringEquals\":{\"AWS:SourceArn\":\"arn:aws:cloudfront::$ACCOUNT:distribution/$DIST_ID\"}}}]}"
    fi
    rm -f infra/.cf-config.json
  else
    DOMAIN=$(state_get domain)
    run aws cloudfront create-invalidation --distribution-id "$DIST_ID" --paths "/*" >/dev/null
  fi
  echo "site: https://$DOMAIN  (distribution $DIST_ID; first deploy takes ~5 min to propagate)"
fi
echo "== done =="
