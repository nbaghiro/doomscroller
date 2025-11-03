import { v4 as uuidv4 } from "uuid";
import { DatabaseService } from "../lib/database.js";
import { StorageService } from "../lib/storage.js";
import { Logger } from "../lib/logger.js";
import { PromptGeneratorService } from "./prompt-generator.js";
import { VideoGeneratorService } from "./video-generator.js";
import { YouTubePosterService } from "./youtube-poster.js";
import { InstagramPosterService } from "./instagram-poster.js";
import { TikTokPosterService } from "./tiktok-poster.js";
import { TrendingTopicsService } from "./trending-topics.js";
import { ContentNiche, VideoMetadata } from "../types/index.js";

const logger = new Logger("WorkflowOrchestrator");

export class WorkflowOrchestratorService {
    private db: DatabaseService;
    private storage: StorageService;
    private promptGenerator: PromptGeneratorService;
    private videoGenerator: VideoGeneratorService;
    private trendingTopics: TrendingTopicsService;

    constructor() {
        this.db = new DatabaseService();
        this.storage = new StorageService();
        this.promptGenerator = new PromptGeneratorService();
        this.videoGenerator = new VideoGeneratorService();
        this.trendingTopics = new TrendingTopicsService();
    }

    /**
   * Main workflow: Generate and post a video for a niche
   */
    async generateAndPostVideo(niche: ContentNiche): Promise<string> {
        let jobId: string | null = null;

        try {
            // Create workflow job
            jobId = await this.db.createJob({
                type: "generate",
                status: "queued",
                niche: niche.id,
                retryCount: 0,
            });

            await this.db.updateJobStatus(jobId, "running");
            logger.info(`Starting workflow for niche: ${niche.name} (Job: ${jobId})`);

            // Step 1: Fetch trending topics
            logger.info("Step 1: Fetching trending topics");
            const trendingTopics = await this.trendingTopics.getTrendingForNiche(
                niche.name,
                niche.keywords
            );

            // Save trending topics to database
            if (trendingTopics.length > 0) {
                await this.db.saveTrendingTopics(trendingTopics);
            }

            // Step 2: Generate prompt
            logger.info("Step 2: Generating video prompt");
            const recentVideos = await this.db.getVideosByNiche(niche.id, 10);
            const previousPrompts = recentVideos.map(v => v.prompt);

            const promptResponse = await this.promptGenerator.generatePrompt({
                niche: niche.name,
                trendingTopics: trendingTopics.length > 0 ? trendingTopics : undefined,
                previousPrompts,
                style: this.getStyleFromNiche(niche),
            });

            logger.info(`Generated prompt: ${promptResponse.prompt.substring(0, 100)}...`);

            // Step 3: Generate video
            logger.info("Step 3: Generating video");
            const videoId = uuidv4();

            const videoResponse = await this.videoGenerator.generateVideo({
                prompt: promptResponse.prompt,
                niche: niche.id,
            });

            // Step 4: Download and store video
            logger.info("Step 4: Downloading and storing video");
            const videoBuffer = await this.videoGenerator.downloadVideo(videoResponse.videoUrl);

            const { publicUrl, storagePath } = await this.storage.uploadVideo(
                videoBuffer,
                videoId,
                niche.id
            );

            // Step 5: Save video metadata
            logger.info("Step 5: Saving video metadata");
            const videoMetadata: VideoMetadata = {
                id: videoId,
                niche: niche.id,
                prompt: promptResponse.prompt,
                videoUrl: publicUrl,
                storagePath,
                duration: videoResponse.duration,
                createdAt: new Date(),
                status: "ready",
                platforms: [],
            };

            await this.db.saveVideoMetadata(videoMetadata);

            // Step 6: Post to social media platforms
            logger.info("Step 6: Posting to social media");
            await this.postToAllPlatforms(videoId, videoBuffer, promptResponse.description, promptResponse.suggestedHashtags, niche);

            // Step 7: Update job status
            await this.db.updateJobStatus(jobId, "completed");
            await this.db.updateVideoStatus(videoId, "posted");

            logger.info(`Workflow completed successfully for video: ${videoId}`);

            return videoId;
        } catch (error) {
            logger.error("Error in workflow", error);

            if (jobId) {
                const errorMessage = error instanceof Error ? error.message : String(error);
                await this.db.updateJobStatus(jobId, "failed", errorMessage);
            }

            throw error;
        }
    }

    /**
   * Post video to all configured platforms
   */
    private async postToAllPlatforms(
        videoId: string,
        videoBuffer: Buffer,
        description: string,
        hashtags: string[],
        niche: ContentNiche
    ): Promise<void> {
        const platforms = [];

        // YouTube
        if (niche.socialAccounts.youtube) {
            platforms.push(
                this.postToYouTube(videoId, videoBuffer, description, hashtags, niche.socialAccounts.youtube)
            );
        }

        // Instagram
        if (niche.socialAccounts.instagram) {
            platforms.push(
                this.postToInstagram(videoId, description, hashtags, niche)
            );
        }

        // TikTok
        if (niche.socialAccounts.tiktok?.accessToken) {
            platforms.push(
                this.postToTikTok(videoId, videoBuffer, description, hashtags, niche.socialAccounts.tiktok.accessToken)
            );
        }

        // Post to all platforms in parallel
        await Promise.allSettled(platforms);
    }

    /**
   * Post to YouTube
   */
    private async postToYouTube(
        videoId: string,
        videoBuffer: Buffer,
        description: string,
        hashtags: string[],
        youtubeAccount: { channelId: string; refreshToken: string }
    ): Promise<void> {
        try {
            logger.info("Posting to YouTube");

            const youtube = new YouTubePosterService();
            await youtube.setCredentials(youtubeAccount.refreshToken);

            const title = this.generateTitle(description);
            const result = await youtube.uploadShortFromBuffer(videoBuffer, title, description, hashtags);

            // Update video metadata
            const video = await this.db.getVideoMetadata(videoId);
            if (video) {
                video.platforms.push({
                    platform: "youtube",
                    postId: result.videoId,
                    postedAt: new Date(),
                    status: "posted",
                });
                await this.db.saveVideoMetadata(video);
            }

            logger.info(`Posted to YouTube: ${result.url}`);
        } catch (error) {
            logger.error("Error posting to YouTube", error);
            // Don't throw - allow other platforms to continue
        }
    }

    /**
   * Post to Instagram
   */
    private async postToInstagram(
        videoId: string,
        description: string,
        hashtags: string[],
        niche: ContentNiche
    ): Promise<void> {
        try {
            logger.info("Posting to Instagram");

            const video = await this.db.getVideoMetadata(videoId);
            if (!video) throw new Error("Video not found");

            const instagram = new InstagramPosterService(niche.socialAccounts.instagram!.accessToken);

            const caption = `${description}\n\n${hashtags.map(tag => `#${tag}`).join(" ")}`;
            const result = await instagram.postReel(
        niche.socialAccounts.instagram!.accountId,
        video.videoUrl,
        caption
            );

            // Update video metadata
            video.platforms.push({
                platform: "instagram",
                postId: result.mediaId,
                postedAt: new Date(),
                status: "posted",
            });
            await this.db.saveVideoMetadata(video);

            logger.info(`Posted to Instagram: ${result.permalink}`);
        } catch (error) {
            logger.error("Error posting to Instagram", error);
        }
    }

    /**
   * Post to TikTok
   */
    private async postToTikTok(
        videoId: string,
        videoBuffer: Buffer,
        description: string,
        hashtags: string[],
        accessToken: string
    ): Promise<void> {
        try {
            logger.info("Posting to TikTok");

            const tiktok = new TikTokPosterService(accessToken);

            const caption = `${description} ${hashtags.map(tag => `#${tag}`).join(" ")}`;
            const result = await tiktok.postVideo(videoBuffer, caption, {
                privacyLevel: "PUBLIC_TO_EVERYONE", // Requires audited app
                disableComment: false,
                disableDuet: false,
                disableStitch: false,
            });

            // Update video metadata
            const video = await this.db.getVideoMetadata(videoId);
            if (video) {
                video.platforms.push({
                    platform: "tiktok",
                    postId: result.publishId,
                    postedAt: new Date(),
                    status: "posted",
                });
                await this.db.saveVideoMetadata(video);
            }

            logger.info(`Posted to TikTok: ${result.publishId}`);
        } catch (error) {
            logger.error("Error posting to TikTok", error);
        }
    }

    /**
   * Generate a concise title from description
   */
    private generateTitle(description: string): string {
    // Take first sentence or first 60 characters
        const firstSentence = description.split(/[.!?]/)[0];
        return firstSentence.substring(0, 60).trim();
    }

    /**
   * Determine content style from niche
   */
    private getStyleFromNiche(niche: ContentNiche): "educational" | "motivational" | "entertainment" | "news" {
        const nicheNameLower = niche.name.toLowerCase();

        if (nicheNameLower.includes("education") || nicheNameLower.includes("learn") || nicheNameLower.includes("tutorial")) {
            return "educational";
        }

        if (nicheNameLower.includes("motivation") || nicheNameLower.includes("inspire") || nicheNameLower.includes("success")) {
            return "motivational";
        }

        if (nicheNameLower.includes("news") || nicheNameLower.includes("current") || nicheNameLower.includes("trending")) {
            return "news";
        }

        return "entertainment";
    }

    /**
   * Retry failed job
   */
    async retryFailedJob(jobId: string): Promise<void> {
        try {
            const job = await this.db.getJob(jobId);

            if (!job || job.status !== "failed") {
                throw new Error("Job not found or not in failed status");
            }

            const niche = await this.db.getContentNiche(job.niche);

            if (!niche) {
                throw new Error("Niche not found");
            }

            logger.info(`Retrying job: ${jobId}`);
            await this.generateAndPostVideo(niche);
        } catch (error) {
            logger.error("Error retrying job", error);
            throw error;
        }
    }
}
