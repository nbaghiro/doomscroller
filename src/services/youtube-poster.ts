import { google, youtube_v3 } from "googleapis";
import { OAuth2Client } from "google-auth-library";
import fs from "fs";
import { config } from "../config/index.js";
import { Logger } from "../lib/logger.js";

const logger = new Logger("YouTubePoster");

export class YouTubePosterService {
    private oauth2Client: OAuth2Client;
    private youtube: youtube_v3.Youtube;

    constructor() {
        this.oauth2Client = new google.auth.OAuth2(
            config.youtube.clientId,
            config.youtube.clientSecret,
            config.youtube.redirectUri
        );

        this.youtube = google.youtube({
            version: "v3",
            auth: this.oauth2Client,
        });
    }

    /**
   * Generate OAuth URL for user authorization
   */
    getAuthUrl(): string {
        const scopes = [
            "https://www.googleapis.com/auth/youtube.upload",
            "https://www.googleapis.com/auth/youtube",
        ];

        return this.oauth2Client.generateAuthUrl({
            access_type: "offline",
            scope: scopes,
            prompt: "consent",
        });
    }

    /**
   * Set credentials from refresh token
   */
    async setCredentials(refreshToken: string): Promise<void> {
        try {
            this.oauth2Client.setCredentials({
                refresh_token: refreshToken,
            });

            // Refresh the access token
            const { credentials } = await this.oauth2Client.refreshAccessToken();
            this.oauth2Client.setCredentials(credentials);

            logger.info("YouTube credentials set successfully");
        } catch (error) {
            logger.error("Error setting YouTube credentials", error);
            throw error;
        }
    }

    /**
   * Exchange authorization code for tokens
   */
    async getTokensFromCode(code: string): Promise<{ refreshToken: string; accessToken: string }> {
        try {
            const { tokens } = await this.oauth2Client.getToken(code);
            this.oauth2Client.setCredentials(tokens);

            if (!tokens.refresh_token) {
                throw new Error("No refresh token received");
            }

            logger.info("Tokens obtained successfully");

            return {
                refreshToken: tokens.refresh_token,
                accessToken: tokens.access_token!,
            };
        } catch (error) {
            logger.error("Error getting tokens from code", error);
            throw error;
        }
    }

    /**
   * Upload a video as a YouTube Short
   */
    async uploadShort(
        videoPath: string,
        title: string,
        description: string,
        hashtags: string[]
    ): Promise<{ videoId: string; url: string }> {
        try {
            logger.info(`Uploading Short: ${title}`);

            // Add #Shorts to description for YouTube to recognize it as a Short
            const fullDescription = `${description}\n\n${hashtags.map(tag => `#${tag}`).join(" ")}\n\n#Shorts`;

            const response = await this.youtube.videos.insert({
                part: ["snippet", "status"],
                requestBody: {
                    snippet: {
                        title: title.substring(0, 100), // YouTube title limit
                        description: fullDescription,
                        categoryId: "22", // People & Blogs category
                        tags: [...hashtags, "Shorts"],
                    },
                    status: {
                        privacyStatus: "public",
                        selfDeclaredMadeForKids: false,
                    },
                },
                media: {
                    body: fs.createReadStream(videoPath),
                },
            });

            const videoId = response.data.id!;
            const url = `https://www.youtube.com/shorts/${videoId}`;

            logger.info(`Short uploaded successfully: ${url}`);

            return { videoId, url };
        } catch (error) {
            logger.error("Error uploading Short", error);
            throw error;
        }
    }

    /**
   * Upload a Short from buffer
   */
    async uploadShortFromBuffer(
        videoBuffer: Buffer,
        title: string,
        description: string,
        hashtags: string[]
    ): Promise<{ videoId: string; url: string }> {
        try {
            // Create temporary file
            const tmpPath = `/tmp/video_${Date.now()}.mp4`;
            fs.writeFileSync(tmpPath, videoBuffer);

            const result = await this.uploadShort(tmpPath, title, description, hashtags);

            // Clean up temp file
            fs.unlinkSync(tmpPath);

            return result;
        } catch (error) {
            logger.error("Error uploading Short from buffer", error);
            throw error;
        }
    }

    /**
   * Get video analytics
   */
    async getVideoAnalytics(videoId: string): Promise<{
    views: number;
    likes: number;
    comments: number;
  }> {
        try {
            const response = await this.youtube.videos.list({
                part: ["statistics"],
                id: [videoId],
            });

            const stats = response.data.items?.[0]?.statistics;

            if (!stats) {
                throw new Error("Video not found or no statistics available");
            }

            return {
                views: parseInt(stats.viewCount || "0"),
                likes: parseInt(stats.likeCount || "0"),
                comments: parseInt(stats.commentCount || "0"),
            };
        } catch (error) {
            logger.error("Error getting video analytics", error);
            throw error;
        }
    }

    /**
   * Get channel info
   */
    async getChannelInfo(): Promise<{ id: string; title: string; subscriberCount: number }> {
        try {
            const response = await this.youtube.channels.list({
                part: ["snippet", "statistics"],
                mine: true,
            });

            const channel = response.data.items?.[0];

            if (!channel) {
                throw new Error("No channel found");
            }

            return {
                id: channel.id!,
                title: channel.snippet?.title || "Unknown",
                subscriberCount: parseInt(channel.statistics?.subscriberCount || "0"),
            };
        } catch (error) {
            logger.error("Error getting channel info", error);
            throw error;
        }
    }
}
