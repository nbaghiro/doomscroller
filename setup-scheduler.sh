#!/bin/bash

# Setup Cloud Scheduler jobs for automated video generation
set -e

PROJECT_ID="${GCP_PROJECT_ID}"
REGION="${GCP_REGION:-us-central1}"

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo -e "${GREEN}Setting up Cloud Scheduler jobs${NC}"

# Get function URLs
GENERATE_VIDEOS_URL=$(gcloud functions describe generateVideos --gen2 --region=$REGION --project=$PROJECT_ID --format='value(serviceConfig.uri)')
COLLECT_ANALYTICS_URL=$(gcloud functions describe collectAnalytics --gen2 --region=$REGION --project=$PROJECT_ID --format='value(serviceConfig.uri)')

# Create job to generate videos 3 times per day (9 AM, 2 PM, 6 PM EST)
echo -e "\n${YELLOW}Creating scheduler job: generate-videos-morning${NC}"
gcloud scheduler jobs create http generate-videos-morning \
  --location=$REGION \
  --schedule="0 9 * * *" \
  --uri="$GENERATE_VIDEOS_URL" \
  --http-method=POST \
  --oidc-service-account-email="${PROJECT_ID}@appspot.gserviceaccount.com" \
  --time-zone="America/New_York" \
  --project=$PROJECT_ID \
  --attempt-deadline=540s || echo "Job may already exist"

echo -e "${YELLOW}Creating scheduler job: generate-videos-afternoon${NC}"
gcloud scheduler jobs create http generate-videos-afternoon \
  --location=$REGION \
  --schedule="0 14 * * *" \
  --uri="$GENERATE_VIDEOS_URL" \
  --http-method=POST \
  --oidc-service-account-email="${PROJECT_ID}@appspot.gserviceaccount.com" \
  --time-zone="America/New_York" \
  --project=$PROJECT_ID \
  --attempt-deadline=540s || echo "Job may already exist"

echo -e "${YELLOW}Creating scheduler job: generate-videos-evening${NC}"
gcloud scheduler jobs create http generate-videos-evening \
  --location=$REGION \
  --schedule="0 18 * * *" \
  --uri="$GENERATE_VIDEOS_URL" \
  --http-method=POST \
  --oidc-service-account-email="${PROJECT_ID}@appspot.gserviceaccount.com" \
  --time-zone="America/New_York" \
  --project=$PROJECT_ID \
  --attempt-deadline=540s || echo "Job may already exist"

# Create job to collect analytics once per day (11 PM EST)
echo -e "${YELLOW}Creating scheduler job: collect-analytics${NC}"
gcloud scheduler jobs create http collect-analytics-daily \
  --location=$REGION \
  --schedule="0 23 * * *" \
  --uri="$COLLECT_ANALYTICS_URL" \
  --http-method=POST \
  --oidc-service-account-email="${PROJECT_ID}@appspot.gserviceaccount.com" \
  --time-zone="America/New_York" \
  --project=$PROJECT_ID \
  --attempt-deadline=540s || echo "Job may already exist"

echo -e "\n${GREEN}Cloud Scheduler jobs created successfully!${NC}"
echo -e "${YELLOW}Scheduled times (America/New_York):${NC}"
echo "- Video generation: 9:00 AM, 2:00 PM, 6:00 PM daily"
echo "- Analytics collection: 11:00 PM daily"
