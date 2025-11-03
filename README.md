# Doomscroller

Automated AI video generation and social media posting system for creating short-form content on YouTube Shorts, Instagram Reels, and TikTok.

## Features

- **AI Video Generation** - Google Veo 3 integration via Vertex AI or third-party providers (fal.ai, Replicate)
- **AI Content Creation** - Claude Sonnet 4.5 generates creative prompts based on trending topics
- **Multi-Platform Posting** - Automated posting to YouTube Shorts, Instagram Reels, and TikTok
- **Analytics Tracking** - Collects engagement metrics (views, likes, comments, shares)
- **Multi-Niche Support** - Manage multiple content channels with different topics
- **Trending Topics** - Integrates with Google Trends and Twitter for topical content
- **Cloud-Native** - Built on Google Cloud Platform with automatic scaling

## Tech Stack

- **Runtime** - Node.js/TypeScript
- **Cloud Platform** - Google Cloud Platform
  - Cloud Functions (2nd gen) - Serverless compute
  - Cloud Storage - Video file storage
  - Firestore - NoSQL database
  - Cloud Scheduler - Automated job scheduling
  - Cloud Logging - Centralized logging
- **AI Services**
  - Anthropic Claude - Prompt generation
  - Google Veo 3 - Video generation
- **APIs**
  - YouTube Data API v3
  - Instagram Graph API
  - TikTok Content Posting API

## Prerequisites

- **GCP Account** - With billing enabled
- **API Keys**
  - Anthropic API key
  - Video generation API key (fal.ai, Replicate, or Vertex AI)
  - Google Trends API key (optional)
  - Twitter Bearer Token (optional)
- **Social Media Accounts**
  - YouTube channel
  - Instagram Business account
  - TikTok account (requires API audit for public posting)

## Installation

```bash
# Clone repository
git clone <repo-url>
cd doomscroller

# Install dependencies
npm install

# Configure environment
cp .env.example .env
# Edit .env with your credentials

# Build project
npm run build
```

## Configuration

### Environment Variables

Create `.env` file with required credentials:

```env
# GCP Configuration
GCP_PROJECT_ID=your-project-id
GCP_REGION=us-central1
GCP_STORAGE_BUCKET=your-bucket-name

# AI Services
ANTHROPIC_API_KEY=sk-ant-...
VIDEO_PROVIDER=fal  # or 'replicate' or 'vertex'
FAL_API_KEY=your-fal-key  # if using fal.ai

# YouTube API
YOUTUBE_CLIENT_ID=your-client-id
YOUTUBE_CLIENT_SECRET=your-client-secret

# Instagram API
INSTAGRAM_APP_ID=your-app-id
INSTAGRAM_APP_SECRET=your-app-secret
INSTAGRAM_ACCESS_TOKEN=your-long-lived-token

# TikTok API
TIKTOK_CLIENT_KEY=your-client-key
TIKTOK_CLIENT_SECRET=your-client-secret
```

### GCP Setup

```bash
# Enable required APIs
gcloud services enable cloudfunctions.googleapis.com \
  cloudscheduler.googleapis.com \
  firestore.googleapis.com \
  storage.googleapis.com \
  logging.googleapis.com

# Create Cloud Storage bucket
gsutil mb -p $GCP_PROJECT_ID -l us-central1 gs://your-bucket-name

# Initialize Firestore
gcloud firestore databases create --region=us-central1
```

### Content Niches

Create content niches in Firestore `niches` collection:

```typescript
{
  id: "motivational",
  name: "Motivational Content",
  description: "Inspirational short videos",
  keywords: ["motivation", "success", "inspiration"],
  promptTemplate: "Create inspiring motivational content",
  targetAudience: "Young professionals",
  postingSchedule: {
    timesPerDay: 3,
    preferredTimes: ["09:00", "14:00", "18:00"],
    timezone: "America/New_York"
  },
  socialAccounts: {
    youtube: {
      channelId: "YOUR_CHANNEL_ID",
      refreshToken: "YOUR_REFRESH_TOKEN"
    },
    instagram: {
      accountId: "YOUR_ACCOUNT_ID",
      accessToken: "YOUR_ACCESS_TOKEN"
    },
    tiktok: {
      username: "YOUR_USERNAME",
      accessToken: "YOUR_ACCESS_TOKEN"  // Optional
    }
  }
}
```

Initialize sample niches:

```bash
tsx scripts/init-niches.ts
```

## Deployment

### Deploy Cloud Functions

```bash
export GCP_PROJECT_ID=your-project-id
export GCP_STORAGE_BUCKET=your-bucket-name

./deploy.sh
```

This deploys three functions:
- `generateVideos` - Main video generation workflow
- `collectAnalytics` - Analytics collection
- `health` - Health check endpoint

### Setup Automated Scheduling

```bash
./setup-scheduler.sh
```

Creates scheduled jobs:
- **Video Generation** - 3x daily (9 AM, 2 PM, 6 PM EST)
- **Analytics Collection** - 1x daily (11 PM EST)

## Usage

### Manual Trigger

```bash
# Get function URL
FUNCTION_URL=$(gcloud functions describe generateVideos \
  --gen2 --region=us-central1 --format='value(serviceConfig.uri)')

# Trigger video generation
curl -X POST $FUNCTION_URL
```

### View Logs

```bash
# Real-time logs
gcloud logging tail "resource.type=cloud_function"

# Recent logs
gcloud functions logs read generateVideos --gen2 --limit=50
```

### Monitor Data

Access Firestore collections:
- **videos** - Generated video metadata
- **analytics** - Engagement metrics
- **jobs** - Workflow job status
- **niches** - Content channel configuration
- **trending** - Trending topics cache

## Development

```bash
# Development mode
npm run dev

# Build project
npm run build

# Run linter
npm run lint

# Fix linting issues
npm run lint:fix
```

## Project Structure

```
doomscroller/
├── src/
│   ├── config/              # Configuration
│   ├── functions/           # Cloud Functions
│   │   ├── scheduled-video-generator.ts
│   │   └── analytics-collector.ts
│   ├── lib/                 # Core utilities
│   │   ├── database.ts      # Firestore operations
│   │   ├── storage.ts       # Cloud Storage operations
│   │   └── logger.ts        # Cloud Logging
│   ├── services/            # Business logic
│   │   ├── prompt-generator.ts
│   │   ├── video-generator.ts
│   │   ├── youtube-poster.ts
│   │   ├── instagram-poster.ts
│   │   ├── tiktok-poster.ts
│   │   ├── trending-topics.ts
│   │   └── workflow-orchestrator.ts
│   ├── types/               # TypeScript types
│   └── index.ts             # Entry point
├── scripts/
│   └── init-niches.ts       # Initialize sample niches
├── deploy.sh                # Deployment script
├── setup-scheduler.sh       # Scheduler setup
└── README.md
```

## Workflow

1. **Cloud Scheduler** triggers function (3x daily)
2. **Fetch trending topics** from Google Trends/Twitter
3. **Generate prompt** using Claude API
4. **Generate video** using Veo 3 API (8 seconds)
5. **Upload video** to Cloud Storage
6. **Post to platforms** (YouTube, Instagram, TikTok)
7. **Store metadata** in Firestore
8. **Collect analytics** (daily)

## Cost Estimates

Monthly costs for 10-15 videos/day:

| Service | Cost |
|---------|------|
| Video Generation (fal.ai) | $360 |
| Claude API | $15 |
| GCP Infrastructure | $20-30 |
| Trending APIs | $20-50 |
| **Total** | **~$415-455/month** |

*Using Vertex AI directly: ~$590-750/month*

## API Rate Limits

- **YouTube** - 10,000 units/day (6-7 videos with default quota)
- **Instagram** - No hard limit (rate-limited)
- **TikTok** - 15 posts/day per account (after audit)
- **Cloud Functions** - 2M invocations/month (free tier)

## Social Media Setup

### YouTube

1. Create OAuth 2.0 credentials in Google Cloud Console
2. Run OAuth flow to get refresh token
3. Store token in Firestore niche configuration

### Instagram

1. Create Facebook App with Instagram Graph API
2. Connect Instagram Business account
3. Generate long-lived access token (valid 60 days)
4. Store token in Firestore niche configuration

### TikTok

1. Create TikTok Developer account and app
2. **Important**: Apply for API audit for public posting
3. Unaudited apps limited to 5 test users and private posts
4. Store access token after OAuth flow

## Troubleshooting

### TikTok Posts Private Only
- Expected for unaudited apps
- Apply for audit at TikTok Developer Portal
- Use `privacyLevel: 'SELF_ONLY'` for testing

### YouTube Quota Exceeded
- Default: 10,000 units/day
- Each upload: ~1,600 units
- Request quota increase: [YouTube Quota Extension](https://support.google.com/youtube/contact/yt_api_form)

### Instagram Token Expired
- Long-lived tokens last 60 days
- Refresh before expiry using Instagram Graph API
- Implement token refresh in production

### Video Generation Timeout
- Increase Cloud Function timeout (max 60 minutes for 2nd gen)
- Check video provider API status
- Verify API keys are valid

## Security

- Store sensitive credentials in Secret Manager (not environment variables)
- Use service accounts with minimal required permissions
- Enable authentication on Cloud Functions in production
- Regularly rotate API keys and access tokens
- Review Firestore security rules

## License

ISC

## Support

For issues or questions, please open an issue on GitHub.
