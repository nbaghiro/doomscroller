#!/bin/bash

# Deployment script for Doomscroller to Google Cloud Platform
set -e

# Configuration
PROJECT_ID="${GCP_PROJECT_ID}"
REGION="${GCP_REGION:-us-central1}"
RUNTIME="nodejs22"
MEMORY="2GiB"
TIMEOUT="540s"  # 9 minutes (max for 2nd gen functions)

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${GREEN}================================${NC}"
echo -e "${GREEN}Doomscroller GCP Deployment${NC}"
echo -e "${GREEN}================================${NC}"

# Check if PROJECT_ID is set
if [ -z "$PROJECT_ID" ]; then
  echo -e "${RED}Error: GCP_PROJECT_ID environment variable not set${NC}"
  echo "Please set it using: export GCP_PROJECT_ID=your-project-id"
  exit 1
fi

echo -e "${YELLOW}Project ID: $PROJECT_ID${NC}"
echo -e "${YELLOW}Region: $REGION${NC}"

# Build the project
echo -e "\n${YELLOW}Building project...${NC}"
npm run build

# Deploy generateVideos function
echo -e "\n${YELLOW}Deploying generateVideos Cloud Function...${NC}"
gcloud functions deploy generateVideos \
  --gen2 \
  --runtime=$RUNTIME \
  --region=$REGION \
  --source=. \
  --entry-point=generateVideos \
  --trigger-http \
  --allow-unauthenticated \
  --memory=$MEMORY \
  --timeout=$TIMEOUT \
  --set-env-vars GCP_PROJECT_ID=$PROJECT_ID,GCP_REGION=$REGION \
  --project=$PROJECT_ID

# Deploy collectAnalytics function
echo -e "\n${YELLOW}Deploying collectAnalytics Cloud Function...${NC}"
gcloud functions deploy collectAnalytics \
  --gen2 \
  --runtime=$RUNTIME \
  --region=$REGION \
  --source=. \
  --entry-point=collectAnalytics \
  --trigger-http \
  --allow-unauthenticated \
  --memory=1GiB \
  --timeout=540s \
  --set-env-vars GCP_PROJECT_ID=$PROJECT_ID,GCP_REGION=$REGION \
  --project=$PROJECT_ID

# Deploy health check function
echo -e "\n${YELLOW}Deploying health Cloud Function...${NC}"
gcloud functions deploy health \
  --gen2 \
  --runtime=$RUNTIME \
  --region=$REGION \
  --source=. \
  --entry-point=health \
  --trigger-http \
  --allow-unauthenticated \
  --memory=256MiB \
  --timeout=10s \
  --project=$PROJECT_ID

echo -e "\n${GREEN}================================${NC}"
echo -e "${GREEN}Deployment completed successfully!${NC}"
echo -e "${GREEN}================================${NC}"

# Get function URLs
echo -e "\n${YELLOW}Function URLs:${NC}"
gcloud functions describe generateVideos --gen2 --region=$REGION --project=$PROJECT_ID --format='value(serviceConfig.uri)'
gcloud functions describe collectAnalytics --gen2 --region=$REGION --project=$PROJECT_ID --format='value(serviceConfig.uri)'
gcloud functions describe health --gen2 --region=$REGION --project=$PROJECT_ID --format='value(serviceConfig.uri)'

echo -e "\n${YELLOW}Next steps:${NC}"
echo "1. Set up Cloud Scheduler jobs to trigger functions periodically"
echo "2. Configure environment variables and secrets"
echo "3. Add content niches to Firestore"
echo "4. Set up OAuth credentials for social media platforms"
