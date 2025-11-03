import dotenv from "dotenv";

dotenv.config();

export const config = {
    gcp: {
        projectId: process.env.GCP_PROJECT_ID || "",
        region: process.env.GCP_REGION || "us-central1",
        storageBucket: process.env.GCP_STORAGE_BUCKET || "",
        vertexAiLocation: process.env.VERTEX_AI_LOCATION || "us-central1",
    },

    anthropic: {
        apiKey: process.env.ANTHROPIC_API_KEY || "",
    },

    videoGeneration: {
        provider: (process.env.VIDEO_PROVIDER || "fal") as "vertex" | "fal" | "replicate",
        falApiKey: process.env.FAL_API_KEY || "",
        replicateApiKey: process.env.REPLICATE_API_KEY || "",
        defaultDuration: 8, // seconds
        defaultResolution: "1080p" as const,
        includeAudio: true,
    },

    youtube: {
        clientId: process.env.YOUTUBE_CLIENT_ID || "",
        clientSecret: process.env.YOUTUBE_CLIENT_SECRET || "",
        redirectUri: process.env.YOUTUBE_REDIRECT_URI || "http://localhost:3000/oauth2callback",
    },

    instagram: {
        appId: process.env.INSTAGRAM_APP_ID || "",
        appSecret: process.env.INSTAGRAM_APP_SECRET || "",
        accessToken: process.env.INSTAGRAM_ACCESS_TOKEN || "",
    },

    tiktok: {
        clientKey: process.env.TIKTOK_CLIENT_KEY || "",
        clientSecret: process.env.TIKTOK_CLIENT_SECRET || "",
    },

    trending: {
        twitterBearerToken: process.env.TWITTER_BEARER_TOKEN || "",
        googleTrendsApiKey: process.env.GOOGLE_TRENDS_API_KEY || "",
    },

    monitoring: {
        slackWebhookUrl: process.env.SLACK_WEBHOOK_URL || "",
        alertEmail: process.env.ALERT_EMAIL || "",
    },

    scheduling: {
        defaultTimesPerDay: 3,
        maxRetries: 3,
        retryDelayMs: 5000,
    },
};

// Validation helper
export function validateConfig(): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (!config.gcp.projectId) errors.push("GCP_PROJECT_ID is required");
    if (!config.gcp.storageBucket) errors.push("GCP_STORAGE_BUCKET is required");
    if (!config.anthropic.apiKey) errors.push("ANTHROPIC_API_KEY is required");

    if (config.videoGeneration.provider === "fal" && !config.videoGeneration.falApiKey) {
        errors.push("FAL_API_KEY is required when using fal provider");
    }

    if (config.videoGeneration.provider === "replicate" && !config.videoGeneration.replicateApiKey) {
        errors.push("REPLICATE_API_KEY is required when using replicate provider");
    }

    return {
        valid: errors.length === 0,
        errors,
    };
}
