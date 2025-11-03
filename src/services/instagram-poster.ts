import axios from "axios";
import { config } from "../config/index.js";
import { Logger } from "../lib/logger.js";

const logger = new Logger("InstagramPoster");

export class InstagramPosterService {
    private accessToken: string;
    private apiVersion: string = "v22.0";
    private baseUrl: string = "https://graph.facebook.com";

    constructor(accessToken?: string) {
        this.accessToken = accessToken || config.instagram.accessToken;
    }

    /**
   * Set or update access token
   */
    setAccessToken(token: string): void {
        this.accessToken = token;
    }

    /**
   * Post a Reel to Instagram
   * This is a two-step process:
   * 1. Create a media container
   * 2. Publish the container
   */
    async postReel(
        accountId: string,
        videoUrl: string,
        caption: string,
        coverUrl?: string
    ): Promise<{ mediaId: string; permalink: string }> {
        try {
            logger.info("Creating Instagram Reel");

            // Step 1: Create media container
            const containerId = await this.createMediaContainer(
                accountId,
                videoUrl,
                caption,
                coverUrl
            );

            // Step 2: Wait for processing (Instagram needs time to process the video)
            await this.waitForMediaProcessing(containerId);

            // Step 3: Publish the container
            const mediaId = await this.publishMediaContainer(accountId, containerId);

            // Step 4: Get permalink
            const permalink = await this.getMediaPermalink(mediaId);

            logger.info(`Reel posted successfully: ${permalink}`);

            return { mediaId, permalink };
        } catch (error) {
            logger.error("Error posting Reel", error);
            throw error;
        }
    }

    /**
   * Create a media container for the Reel
   */
    private async createMediaContainer(
        accountId: string,
        videoUrl: string,
        caption: string,
        coverUrl?: string
    ): Promise<string> {
        try {
            const url = `${this.baseUrl}/${this.apiVersion}/${accountId}/media`;

            const params: Record<string, string> = {
                media_type: "REELS",
                video_url: videoUrl,
                caption: caption.substring(0, 2200), // Instagram caption limit
                access_token: this.accessToken,
            };

            if (coverUrl) {
                params.cover_url = coverUrl;
            }

            const response = await axios.post(url, null, { params });

            const containerId = response.data.id;
            logger.info(`Media container created: ${containerId}`);

            return containerId;
        } catch (error) {
            const errorData = error instanceof Error && "response" in error ? (error as { response?: { data?: unknown } }).response?.data : error;
            logger.error("Error creating media container", errorData);
            throw error;
        }
    }

    /**
   * Wait for Instagram to finish processing the video
   */
    private async waitForMediaProcessing(containerId: string, maxAttempts: number = 20): Promise<void> {
        try {
            logger.info("Waiting for media processing...");

            for (let attempt = 0; attempt < maxAttempts; attempt++) {
                await this.sleep(5000); // Wait 5 seconds between checks

                const url = `${this.baseUrl}/${this.apiVersion}/${containerId}`;
                const response = await axios.get(url, {
                    params: {
                        fields: "status_code",
                        access_token: this.accessToken,
                    },
                });

                const statusCode = response.data.status_code;

                if (statusCode === "FINISHED") {
                    logger.info("Media processing completed");
                    return;
                } else if (statusCode === "ERROR") {
                    throw new Error("Media processing failed");
                }

                logger.debug(`Media processing status: ${statusCode} (attempt ${attempt + 1}/${maxAttempts})`);
            }

            throw new Error("Media processing timed out");
        } catch (error) {
            logger.error("Error waiting for media processing", error);
            throw error;
        }
    }

    /**
   * Publish the media container
   */
    private async publishMediaContainer(accountId: string, containerId: string): Promise<string> {
        try {
            const url = `${this.baseUrl}/${this.apiVersion}/${accountId}/media_publish`;

            const response = await axios.post(url, null, {
                params: {
                    creation_id: containerId,
                    access_token: this.accessToken,
                },
            });

            const mediaId = response.data.id;
            logger.info(`Media published: ${mediaId}`);

            return mediaId;
        } catch (error) {
            const errorData = error instanceof Error && "response" in error ? (error as { response?: { data?: unknown } }).response?.data : error;
            logger.error("Error publishing media", errorData);
            throw error;
        }
    }

    /**
   * Get permalink for published media
   */
    private async getMediaPermalink(mediaId: string): Promise<string> {
        try {
            const url = `${this.baseUrl}/${this.apiVersion}/${mediaId}`;

            const response = await axios.get(url, {
                params: {
                    fields: "permalink",
                    access_token: this.accessToken,
                },
            });

            return response.data.permalink;
        } catch (error) {
            logger.error("Error getting media permalink", error);
            throw error;
        }
    }

    /**
   * Get Reel analytics/insights
   */
    async getReelAnalytics(mediaId: string): Promise<{
    views: number;
    likes: number;
    comments: number;
    shares: number;
  }> {
        try {
            const url = `${this.baseUrl}/${this.apiVersion}/${mediaId}`;

            const response = await axios.get(url, {
                params: {
                    fields: "like_count,comments_count,media_product_type",
                    access_token: this.accessToken,
                },
            });

            // Get insights for plays (views)
            const insightsUrl = `${this.baseUrl}/${this.apiVersion}/${mediaId}/insights`;
            const insightsResponse = await axios.get(insightsUrl, {
                params: {
                    metric: "plays,shares",
                    access_token: this.accessToken,
                },
            });

            interface InsightItem {
                name: string;
                values: Array<{ value: number }>;
            }

            const plays = (insightsResponse.data.data as InsightItem[]).find((item) => item.name === "plays")?.values[0]?.value || 0;
            const shares = (insightsResponse.data.data as InsightItem[]).find((item) => item.name === "shares")?.values[0]?.value || 0;

            return {
                views: plays,
                likes: response.data.like_count || 0,
                comments: response.data.comments_count || 0,
                shares: shares,
            };
        } catch (error) {
            logger.error("Error getting Reel analytics", error);
            throw error;
        }
    }

    /**
   * Get account information
   */
    async getAccountInfo(accountId: string): Promise<{
    id: string;
    username: string;
    followersCount: number;
  }> {
        try {
            const url = `${this.baseUrl}/${this.apiVersion}/${accountId}`;

            const response = await axios.get(url, {
                params: {
                    fields: "id,username,followers_count",
                    access_token: this.accessToken,
                },
            });

            return {
                id: response.data.id,
                username: response.data.username,
                followersCount: response.data.followers_count || 0,
            };
        } catch (error) {
            logger.error("Error getting account info", error);
            throw error;
        }
    }

    /**
   * Exchange short-lived token for long-lived token
   */
    async getLongLivedToken(shortLivedToken: string): Promise<{ accessToken: string; expiresIn: number }> {
        try {
            const url = `${this.baseUrl}/${this.apiVersion}/oauth/access_token`;

            const response = await axios.get(url, {
                params: {
                    grant_type: "fb_exchange_token",
                    client_id: config.instagram.appId,
                    client_secret: config.instagram.appSecret,
                    fb_exchange_token: shortLivedToken,
                },
            });

            logger.info("Long-lived token obtained");

            return {
                accessToken: response.data.access_token,
                expiresIn: response.data.expires_in,
            };
        } catch (error) {
            logger.error("Error getting long-lived token", error);
            throw error;
        }
    }

    private sleep(ms: number): Promise<void> {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}
