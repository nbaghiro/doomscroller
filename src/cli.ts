#!/usr/bin/env node

import { Command } from "commander";
import { config } from "./config/index.js";
import { Logger } from "./lib/logger.js";
import { DatabaseService } from "./lib/database.js";
import { StorageService } from "./lib/storage.js";
import { PromptGeneratorService } from "./services/prompt-generator.js";
import { VideoGeneratorService } from "./services/video-generator.js";
import { YouTubePosterService } from "./services/youtube-poster.js";
import { InstagramPosterService } from "./services/instagram-poster.js";
import { TikTokPosterService } from "./services/tiktok-poster.js";
import { TrendingTopicsService } from "./services/trending-topics.js";
import { WorkflowOrchestratorService } from "./services/workflow-orchestrator.js";
import { ContentNiche } from "./types/index.js";

const logger = new Logger("CLI");
const program = new Command();

program
    .name("doomscroller")
    .description("CLI tool for testing Doomscroller video generation services")
    .version("1.0.0");

// Generate Prompt Command
program
    .command("generate-prompt")
    .description("Test prompt generation for a niche")
    .argument("[niche]", "Niche name", "motivational")
    .option("-t, --trending", "Include trending topics")
    .action(async (niche: string, options: { trending?: boolean }) => {
        try {
            logger.info(`Generating prompt for niche: ${niche}`);

            const promptGenerator = new PromptGeneratorService();
            const trendingService = new TrendingTopicsService();

            let trendingTopics;
            if (options.trending) {
                logger.info("Fetching trending topics...");
                trendingTopics = await trendingService.getMockTrendingTopics(niche);
                console.log("\n📈 Trending Topics:");
                trendingTopics.forEach((topic) => {
                    console.log(`  - ${topic.topic} (score: ${topic.score})`);
                });
            }

            const result = await promptGenerator.generatePrompt({
                niche,
                trendingTopics,
                style: "entertainment",
            });

            console.log("\n✅ Prompt Generated:");
            console.log("\n📝 Prompt:");
            console.log(result.prompt);
            console.log("\n📋 Description:");
            console.log(result.description);
            console.log("\n🏷️  Hashtags:");
            console.log(result.suggestedHashtags.join(", "));
            console.log("\n📊 Estimated Engagement:");
            console.log(result.estimatedEngagement);
        } catch (error) {
            logger.error("Failed to generate prompt", error);
            process.exit(1);
        }
    });

// Generate Video Command
program
    .command("generate-video")
    .description("Test video generation")
    .argument("<prompt>", "Video generation prompt")
    .option("-n, --niche <niche>", "Niche ID", "test")
    .action(async (prompt: string, options: { niche: string }) => {
        try {
            logger.info("Generating video...");

            const videoGenerator = new VideoGeneratorService();

            const result = await videoGenerator.generateVideo({
                prompt,
                niche: options.niche,
            });

            console.log("\n✅ Video Generated:");
            console.log(`\n🎬 Video URL: ${result.videoUrl}`);
            console.log(`⏱️  Duration: ${result.duration}s`);
            console.log(`🆔 Request ID: ${result.requestId}`);

            if (result.thumbnailUrl) {
                console.log(`🖼️  Thumbnail: ${result.thumbnailUrl}`);
            }

            console.log("\n💡 Tip: Use the video URL to test posting to social media");
        } catch (error) {
            logger.error("Failed to generate video", error);
            process.exit(1);
        }
    });

// Test YouTube Posting
program
    .command("post-youtube")
    .description("Test YouTube Shorts posting")
    .argument("<videoId>", "Video ID from Firestore")
    .option("-t, --title <title>", "Video title")
    .option("-d, --description <description>", "Video description")
    .action(async (videoId: string, options: { title?: string; description?: string }) => {
        try {
            logger.info("Testing YouTube posting...");

            const db = new DatabaseService();
            const video = await db.getVideoMetadata(videoId);

            if (!video) {
                console.error("❌ Video not found in database");
                process.exit(1);
            }

            // For testing, we need a niche with YouTube credentials
            const niches = await db.getContentNiches();
            const nicheWithYT = niches.find((n) => n.socialAccounts.youtube);

            if (!nicheWithYT || !nicheWithYT.socialAccounts.youtube) {
                console.error("❌ No niche found with YouTube credentials");
                console.log("💡 Add YouTube credentials to a niche in Firestore");
                process.exit(1);
            }

            const youtube = new YouTubePosterService();
            await youtube.setCredentials(nicheWithYT.socialAccounts.youtube.refreshToken);

            const storage = new StorageService();
            const videoBuffer = await storage.downloadVideo(video.storagePath);

            const title = options.title || video.prompt.substring(0, 60);
            const description = options.description || video.prompt;

            const result = await youtube.uploadShortFromBuffer(videoBuffer, title, description, []);

            console.log("\n✅ Posted to YouTube:");
            console.log(`\n🎬 Video ID: ${result.videoId}`);
            console.log(`🔗 URL: ${result.url}`);
        } catch (error) {
            logger.error("Failed to post to YouTube", error);
            process.exit(1);
        }
    });

// Test Instagram Posting
program
    .command("post-instagram")
    .description("Test Instagram Reels posting")
    .argument("<videoId>", "Video ID from Firestore")
    .option("-c, --caption <caption>", "Post caption")
    .action(async (videoId: string, options: { caption?: string }) => {
        try {
            logger.info("Testing Instagram posting...");

            const db = new DatabaseService();
            const video = await db.getVideoMetadata(videoId);

            if (!video) {
                console.error("❌ Video not found in database");
                process.exit(1);
            }

            const niches = await db.getContentNiches();
            const nicheWithIG = niches.find((n) => n.socialAccounts.instagram);

            if (!nicheWithIG || !nicheWithIG.socialAccounts.instagram) {
                console.error("❌ No niche found with Instagram credentials");
                console.log("💡 Add Instagram credentials to a niche in Firestore");
                process.exit(1);
            }

            const instagram = new InstagramPosterService(
                nicheWithIG.socialAccounts.instagram.accessToken
            );

            const caption = options.caption || video.prompt.substring(0, 100);

            const result = await instagram.postReel(
                nicheWithIG.socialAccounts.instagram.accountId,
                video.videoUrl,
                caption
            );

            console.log("\n✅ Posted to Instagram:");
            console.log(`\n📸 Media ID: ${result.mediaId}`);
            console.log(`🔗 Permalink: ${result.permalink}`);
        } catch (error) {
            logger.error("Failed to post to Instagram", error);
            process.exit(1);
        }
    });

// Test TikTok Posting
program
    .command("post-tiktok")
    .description("Test TikTok posting")
    .argument("<videoId>", "Video ID from Firestore")
    .option("-c, --caption <caption>", "Post caption")
    .option("-p, --privacy <level>", "Privacy level", "PUBLIC_TO_EVERYONE")
    .action(
        async (
            videoId: string,
            options: { caption?: string; privacy: string }
        ) => {
            try {
                logger.info("Testing TikTok posting...");

                const db = new DatabaseService();
                const video = await db.getVideoMetadata(videoId);

                if (!video) {
                    console.error("❌ Video not found in database");
                    process.exit(1);
                }

                const niches = await db.getContentNiches();
                const nicheWithTT = niches.find(
                    (n) => n.socialAccounts.tiktok?.accessToken
                );

                if (!nicheWithTT || !nicheWithTT.socialAccounts.tiktok?.accessToken) {
                    console.error("❌ No niche found with TikTok credentials");
                    console.log("💡 Add TikTok access token to a niche in Firestore");
                    process.exit(1);
                }

                const tiktok = new TikTokPosterService(
                    nicheWithTT.socialAccounts.tiktok.accessToken
                );

                const storage = new StorageService();
                const videoBuffer = await storage.downloadVideo(video.storagePath);

                const caption = options.caption || video.prompt.substring(0, 100);

                const result = await tiktok.postVideo(videoBuffer, caption, {
                    privacyLevel: options.privacy as "PUBLIC_TO_EVERYONE" | "SELF_ONLY" | "MUTUAL_FOLLOW_FRIENDS" | "FOLLOWER_OF_CREATOR",
                    disableComment: false,
                    disableDuet: false,
                    disableStitch: false,
                });

                console.log("\n✅ Posted to TikTok:");
                console.log(`\n🎵 Publish ID: ${result.publishId}`);
                console.log(`📊 Status: ${result.status}`);
            } catch (error) {
                logger.error("Failed to post to TikTok", error);
                process.exit(1);
            }
        }
    );

// Test Trending Topics
program
    .command("trending")
    .description("Test trending topics fetching")
    .argument("[niche]", "Niche name", "motivational")
    .option("-k, --keywords <keywords>", "Comma-separated keywords")
    .action(async (niche: string, options: { keywords?: string }) => {
        try {
            logger.info("Fetching trending topics...");

            const trendingService = new TrendingTopicsService();

            const keywords = options.keywords
                ? options.keywords.split(",").map((k) => k.trim())
                : ["trending", "viral", "popular"];

            const topics = await trendingService.getTrendingForNiche(niche, keywords);

            console.log(`\n📈 Trending Topics for "${niche}":`);
            if (topics.length === 0) {
                console.log("  No trending topics found");
                console.log(
                    "\n💡 Configure Google Trends or Twitter API keys in .env"
                );
            } else {
                topics.forEach((topic, index) => {
                    console.log(`\n${index + 1}. ${topic.topic}`);
                    console.log(`   Score: ${topic.score}`);
                    console.log(`   Source: ${topic.source}`);
                    if (topic.relatedKeywords.length > 0) {
                        console.log(`   Related: ${topic.relatedKeywords.join(", ")}`);
                    }
                });
            }

            // Show hashtags
            if (topics.length > 0) {
                const hashtags = trendingService.getHashtagsFromTopics(topics);
                console.log("\n🏷️  Suggested Hashtags:");
                console.log(hashtags.map((h) => `#${h}`).join(" "));
            }
        } catch (error) {
            logger.error("Failed to fetch trending topics", error);
            process.exit(1);
        }
    });

// Full Workflow Test
program
    .command("full-workflow")
    .description("Test complete video generation and posting workflow")
    .argument("[nicheId]", "Niche ID from Firestore")
    .action(async (nicheId?: string) => {
        try {
            logger.info("Testing full workflow...");

            const db = new DatabaseService();
            const workflow = new WorkflowOrchestratorService();

            let niche: ContentNiche | null = null;

            if (nicheId) {
                niche = await db.getContentNiche(nicheId);
            } else {
                // Get first available niche
                const niches = await db.getContentNiches();
                if (niches.length > 0) {
                    niche = niches[0];
                }
            }

            if (!niche) {
                console.error("❌ No niche found");
                console.log("💡 Run: tsx scripts/init-niches.ts");
                process.exit(1);
            }

            console.log(`\n🎯 Testing workflow for niche: ${niche.name}`);
            console.log("⏳ This may take several minutes...\n");

            const videoId = await workflow.generateAndPostVideo(niche);

            console.log("\n✅ Workflow completed successfully!");
            console.log(`\n🎬 Video ID: ${videoId}`);

            // Fetch and display video details
            const video = await db.getVideoMetadata(videoId);
            if (video) {
                console.log(`🔗 Video URL: ${video.videoUrl}`);
                console.log(`📊 Status: ${video.status}`);
                console.log(`📱 Posted to ${video.platforms.length} platform(s):`);
                video.platforms.forEach((p) => {
                    console.log(`   - ${p.platform}: ${p.postId}`);
                });
            }
        } catch (error) {
            logger.error("Workflow failed", error);
            process.exit(1);
        }
    });

// List Niches
program
    .command("list-niches")
    .description("List all configured content niches")
    .action(async () => {
        try {
            const db = new DatabaseService();
            const niches = await db.getContentNiches();

            if (niches.length === 0) {
                console.log("❌ No niches found");
                console.log("💡 Run: tsx scripts/init-niches.ts");
                process.exit(1);
            }

            console.log(`\n📚 Content Niches (${niches.length}):\n`);
            niches.forEach((niche) => {
                console.log(`🎯 ${niche.name} (${niche.id})`);
                console.log(`   Description: ${niche.description}`);
                console.log(`   Keywords: ${niche.keywords.join(", ")}`);
                console.log(`   Platforms: ${Object.keys(niche.socialAccounts).join(", ")}`);
                console.log("");
            });
        } catch (error) {
            logger.error("Failed to list niches", error);
            process.exit(1);
        }
    });

// List Videos
program
    .command("list-videos")
    .description("List recent videos")
    .option("-n, --niche <nicheId>", "Filter by niche ID")
    .option("-l, --limit <number>", "Number of videos to show", "10")
    .action(async (options: { niche?: string; limit: string }) => {
        try {
            const db = new DatabaseService();
            const limit = parseInt(options.limit, 10);

            let videos;
            if (options.niche) {
                videos = await db.getVideosByNiche(options.niche, limit);
                console.log(`\n🎬 Recent Videos for niche "${options.niche}" (${videos.length}):\n`);
            } else {
                videos = await db.getRecentVideos(limit);
                console.log(`\n🎬 Recent Videos (${videos.length}):\n`);
            }

            if (videos.length === 0) {
                console.log("No videos found");
                process.exit(0);
            }

            videos.forEach((video) => {
                console.log(`📹 ${video.id}`);
                console.log(`   Niche: ${video.niche}`);
                console.log(`   Status: ${video.status}`);
                console.log(`   Created: ${video.createdAt.toISOString()}`);
                console.log(`   Platforms: ${video.platforms.length}`);
                console.log(`   URL: ${video.videoUrl}`);
                console.log("");
            });
        } catch (error) {
            logger.error("Failed to list videos", error);
            process.exit(1);
        }
    });

// Config Check
program
    .command("check-config")
    .description("Validate configuration and check API connectivity")
    .action(async () => {
        try {
            console.log("🔍 Checking configuration...\n");

            // Check GCP Config
            console.log("☁️  GCP Configuration:");
            console.log(`   Project ID: ${config.gcp.projectId || "❌ Missing"}`);
            console.log(`   Region: ${config.gcp.region}`);
            console.log(`   Bucket: ${config.gcp.storageBucket || "❌ Missing"}`);

            // Check AI Services
            console.log("\n🤖 AI Services:");
            console.log(`   Anthropic API: ${config.anthropic.apiKey ? "✅ Configured" : "❌ Missing"}`);
            console.log(`   Video Provider: ${config.videoGeneration.provider}`);

            if (config.videoGeneration.provider === "fal") {
                console.log(`   Fal.ai API: ${config.videoGeneration.falApiKey ? "✅ Configured" : "❌ Missing"}`);
            } else if (config.videoGeneration.provider === "replicate") {
                console.log(`   Replicate API: ${config.videoGeneration.replicateApiKey ? "✅ Configured" : "❌ Missing"}`);
            }

            // Check Social Media
            console.log("\n📱 Social Media:");
            console.log(`   YouTube: ${config.youtube.clientId ? "✅ Configured" : "❌ Missing"}`);
            console.log(`   Instagram: ${config.instagram.accessToken ? "✅ Configured" : "❌ Missing"}`);
            console.log(`   TikTok: ${config.tiktok.clientKey ? "✅ Configured" : "❌ Missing"}`);

            // Check Optional Services
            console.log("\n🔧 Optional Services:");
            console.log(`   Google Trends: ${config.trending.googleTrendsApiKey ? "✅ Configured" : "⚠️  Not configured"}`);
            console.log(`   Twitter: ${config.trending.twitterBearerToken ? "✅ Configured" : "⚠️  Not configured"}`);

            console.log("\n✅ Configuration check complete");
        } catch (error) {
            logger.error("Configuration check failed", error);
            process.exit(1);
        }
    });

program.parse();
