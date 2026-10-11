# I built a PM2.5 model for the half of India with no air monitor, and shipped it on AWS in 48 hours

India has about 570 public PM2.5 monitors for 1.4 billion people. When I counted, 368 of the 735 districts had no monitor within 50 km. For the people there, every air-quality app shows a blank, or quietly interpolates between faraway dots without saying how wrong that is.

So for the MakeDevs Bharat Builds Tour (Track 1: Air) I built **AirGap**: a daily PM2.5 estimate for every district, with an error bar you can check, the safest hours to go outside, advice in English and Hindi, a 3-day forecast, and a ranked list of where the next 20 monitors should go. Live: https://main.d3cvwqcst393r5.amplifyapp.com · Code: https://github.com/akshitabiju/AirGap

Here is how it works, what I ran on AWS, and what broke.

## The idea in one paragraph

You can't measure where there's no sensor, but you can learn. For each of the 571 real monitors on OpenAQ, I have daily PM2.5 readings for the last 92 days, and for the same place and day I have what Copernicus's CAMS model says about aerosol over it (satellite-assimilated PM2.5, AOD, dust) plus ERA5 weather, all via Open-Meteo with no key. A LightGBM model learns the mapping. For a district with no monitor, it reads today's satellite and weather and returns the number a monitor there would likely have shown.

## Validation that answers the real question

A random train/test split would let the model see Delhi on Monday and be tested on Delhi on Tuesday. That's not the question. I used leave-cities-out cross-validation: group monitors by city, hold out whole cities, predict them cold, five folds. On cities the model never saw: mean absolute error 10.2 µg/m³ versus 16.0 for the raw CAMS baseline scored on identical rows, better in every fold. Two quantile models give a 68 % interval, and a single multiplier fitted out-of-fold scales it so the interval really covers 68 % of held-out values (it covered 48 % before calibration; an error bar you can't check is decoration).

## The AWS part

**AWS Lambda with a Function URL** is the live piece. When a user pins any district, the browser calls `GET /?lat=&lon=`. The function fetches today's CAMS and weather features for that exact coordinate, evaluates the three LightGBM model files with a pure-Python evaluator of about 79 lines (verified equal to lightgbm in tests, so the package is 2 MB instead of 100 MB), and returns the prediction and interval in about a second. No API Gateway, no containers.

**AWS Amplify Hosting** serves the React site and its generated data files over HTTPS with a CDN. I deploy with manual zip uploads from a script; a retrained model goes live with one command.

**Amazon S3 and IAM** round it out: S3 for the build artefacts (with an S3 + CloudFront path scripted for accounts that have it), IAM for a least-privilege Lambda execution role. Everything is driven by the open-source AWS CLI v2 in idempotent scripts.

## What broke, honestly

- **CloudFront refused.** New accounts can't create distributions until AWS Support verifies them. There's no self-service path, so I moved hosting to Amplify in half an hour and kept the CloudFront script for later.
- **The public Lambda URL returned 403** with a correct-looking policy. Auth type NONE needs *both* `lambda:InvokeFunctionUrl` and `lambda:InvokeFunction` (scoped with `--invoked-via-function-url`). The CLI error gives no hint. One `add-permission` fixed it.
- **IAM onboarding.** The hackathon user needed `iam:CreateRole`, `iam:AttachRolePolicy` and `iam:PassRole` just to give a Lambda a role. The AccessDenied message names the action but not the minimal policy to add.
- **Not AWS, but worth sharing:** Open-Meteo's archive endpoint has an hourly cap that a 1,300-point backfill hits, so cache every response and build a resume mode before the fetch, not after. And I got an OpenAQ key suspended by retrying through 429s with three workers. Respect `Retry-After`. One worker.

## What I'd change with another week

Hourly ground truth so the "best hours" are learned rather than borrowed from the CAMS diurnal shape; a winter retrain (monsoon PM2.5 is low and flat, so R² is modest even though the error beats the baseline by 36 %); NASA FIRMS fire detections as a feature for stubble-burning season; and a scheduled daily run on AWS instead of a laptop.

If you work on air quality in India and want the model's outputs for your district, the pipeline re-runs from open data with one command. Issues and PRs welcome.
