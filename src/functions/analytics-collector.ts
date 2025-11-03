import { CloudEvent } from "@google-cloud/functions-framework";
import { DatabaseService } from "../lib/database.js";
import { YouTubePosterService } from "../services/youtube-poster.js";
import { InstagramPosterService } from "../services/instagram-poster.js";
import { TikTokPosterService } from "../services/tiktok-poster.js";
import { Logger } from "../lib/logger.js";
import { AnalyticsData, VideoMetadata, ContentNiche } from "../types/index.js";

const logger = new Logger("AnalyticsCollector");

/**
 * Cloud Function triggered by Cloud Scheduler
 * Collects analytics for all posted videos
 */
export async function analyticsCollector(_cloudEvent: CloudEvent<unknown>): Promise<void> {
    try {
        logger.info("Analytics collector triggered");

        const db = new DatabaseService();

        // Get all niches
        const niches = await db.getAllContentNiches();

        if (niches.length === 0) {
            logger.warn("No content niches configured");
            return;
        }

        // Collect analytics for each niche
        for (const niche of niches) {
            try {
                // Get recent videos for this niche (last 7 days)
                const videos = await db.getVideosByNiche(niche.id, 100);

                const recentVideos = videos.filter(video => {
                    const daysSinceCreated = (Date.now() - video.createdAt.getTime()) / (1000 * 60 * 60 * 24);
                    return daysSinceCreated <= 7 && video.status === "posted";
                });

                logger.info(`Collecting analytics for ${recentVideos.length} videos in niche: ${niche.name}`);

                for (const video of recentVideos) {
                    await collectVideoAnalytics(video, niche, db);
                }
            } catch (error) {
                logger.error(`Error collecting analytics for niche: ${niche.name}`, error);
            }
        }

        logger.info("Analytics collection completed");
    } catch (error) {
        logger.error("Error in analytics collector", error);
        throw error;
    }
}

async function collectVideoAnalytics(
    video: VideoMetadata,
    niche: ContentNiche,
    db: DatabaseService
): Promise<void> {
    for (const platformPost of video.platforms) {
        try {
            if (platformPost.status !== "posted" || !platformPost.postId) {
                continue;
            }

            let analytics: Partial<AnalyticsData> = {
                videoId: video.id,
                platform: platformPost.platform,
                fetchedAt: new Date(),
            };

            // Collect platform-specific analytics
            switch (platformPost.platform) {
                case "youtube":
                    if (niche.socialAccounts.youtube) {
                        const youtube = new YouTubePosterService();
                        await youtube.setCredentials(niche.socialAccounts.youtube.refreshToken);

                        const stats = await youtube.getVideoAnalytics(platformPost.postId);

                        analytics = {
                            ...analytics,
                            views: stats.views,
                            likes: stats.likes,
                            comments: stats.comments,
                            shares: 0,
                            engagementRate: calculateEngagementRate(stats.views, stats.likes, stats.comments),
                        };
                    }
                    break;

                case "instagram":
                    if (niche.socialAccounts.instagram) {
                        const instagram = new InstagramPosterService(niche.socialAccounts.instagram.accessToken);

                        const stats = await instagram.getReelAnalytics(platformPost.postId);

                        analytics = {
                            ...analytics,
                            views: stats.views,
                            likes: stats.likes,
                            comments: stats.comments,
                            shares: stats.shares,
                            engagementRate: calculateEngagementRate(stats.views, stats.likes, stats.comments, stats.shares),
                        };
                    }
                    break;

                case "tiktok":
                    if (niche.socialAccounts.tiktok?.accessToken) {
                        const tiktok = new TikTokPosterService(niche.socialAccounts.tiktok.accessToken);

                        const stats = await tiktok.getVideoAnalytics(platformPost.postId);

                        analytics = {
                            ...analytics,
                            views: stats.views,
                            likes: stats.likes,
                            comments: stats.comments,
                            shares: stats.shares,
                            engagementRate: calculateEngagementRate(stats.views, stats.likes, stats.comments, stats.shares),
                        };
                    }
                    break;
            }

            // Save analytics to database
            if (analytics.views !== undefined) {
                await db.saveAnalytics(analytics as AnalyticsData);
                logger.info(`Analytics saved for video ${video.id} on ${platformPost.platform}`);

                // Update platform post with latest stats
                platformPost.views = analytics.views;
                platformPost.likes = analytics.likes;
                platformPost.comments = analytics.comments;
            }
        } catch (error) {
            logger.error(`Error collecting analytics for ${platformPost.platform}`, error);
        }
    }

    // Save updated video metadata
    await db.saveVideoMetadata(video);
}

function calculateEngagementRate(
    views: number,
    likes: number,
    comments: number,
    shares: number = 0
): number {
    if (views === 0) return 0;

    const totalEngagements = likes + comments + shares;
    return (totalEngagements / views) * 100;
}
