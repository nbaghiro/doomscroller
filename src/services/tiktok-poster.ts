import axios from "axios";
import { config } from "../config/index.js";
import { Logger } from "../lib/logger.js";

const logger = new Logger("TikTokPoster");

/**
 * TikTok Content Posting API Service
 *
 * IMPORTANT: This service requires your TikTok app to be audited before it can post publicly.
 * Unaudited apps are limited to:
 * - Maximum 5 users can post in 24 hours
 * - All content restricted to private viewing (SELF_ONLY)
 *
 * See TikTok API audit process: https://developers.tiktok.com/doc/content-posting-api-get-started/
 */
export class TikTokPosterService {
    private accessToken: string;
    private baseUrl: string = "https://open.tiktokapis.com";

    constructor(accessToken?: string) {
        this.accessToken = accessToken || "";
    }

    /**
   * Set or update access token
   */
    setAccessToken(token: string): void {
        this.accessToken = token;
    }

    /**
   * Post a video to TikTok
   *
   * @param videoBuffer - Video file as Buffer
   * @param title - Video title/caption
   * @param privacyLevel - 'SELF_ONLY', 'MUTUAL_FOLLOW_FRIENDS', 'FOLLOWER_OF_CREATOR', 'PUBLIC_TO_EVERYONE'
   * @param disableComment - Whether to disable comments
   * @param disableDuet - Whether to disable duets
   * @param disableStitch - Whether to disable stitches
   * @param videoCoverTimestamp - Timestamp in seconds for video cover (1-3 seconds recommended)
   */
    async postVideo(
        videoBuffer: Buffer,
        title: string,
        options: {
      privacyLevel?: "SELF_ONLY" | "MUTUAL_FOLLOW_FRIENDS" | "FOLLOWER_OF_CREATOR" | "PUBLIC_TO_EVERYONE";
      disableComment?: boolean;
      disableDuet?: boolean;
      disableStitch?: boolean;
      videoCoverTimestamp?: number;
      brandContentToggle?: boolean;
      brandOrganicToggle?: boolean;
    } = {}
    ): Promise<{ publishId: string; status: string }> {
        try {
            logger.info("Posting video to TikTok");

            // Default privacy to PUBLIC_TO_EVERYONE (requires audited app)
            // Use SELF_ONLY for testing with unaudited app
            const privacyLevel = options.privacyLevel || "PUBLIC_TO_EVERYONE";

            // Step 1: Initialize video upload
            const uploadInfo = await this.initializeUpload(videoBuffer.length);

            // Step 2: Upload video chunks
            await this.uploadVideo(uploadInfo.uploadUrl, videoBuffer);

            // Step 3: Create post
            const publishId = await this.createPost({
                uploadId: uploadInfo.uploadId,
                title,
                privacyLevel,
                disableComment: options.disableComment ?? false,
                disableDuet: options.disableDuet ?? false,
                disableStitch: options.disableStitch ?? false,
                videoCoverTimestamp: options.videoCoverTimestamp ?? 1.0,
                brandContentToggle: options.brandContentToggle ?? false,
                brandOrganicToggle: options.brandOrganicToggle ?? false,
            });

            logger.info(`Video posted successfully. Publish ID: ${publishId}`);

            return { publishId, status: "processing" };
        } catch (error) {
            const errorData = error instanceof Error && "response" in error ? (error as { response?: { data?: unknown } }).response?.data : error;
            logger.error("Error posting video to TikTok", errorData);
            throw error;
        }
    }

    /**
   * Initialize video upload and get upload URL
   */
    private async initializeUpload(fileSize: number): Promise<{ uploadUrl: string; uploadId: string }> {
        try {
            const url = `${this.baseUrl}/v2/post/publish/inbox/video/init/`;

            const response = await axios.post(
                url,
                {
                    source_info: {
                        source: "FILE_UPLOAD",
                        video_size: fileSize,
                        chunk_size: fileSize, // Single chunk upload
                        total_chunk_count: 1,
                    },
                },
                {
                    headers: {
                        "Authorization": `Bearer ${this.accessToken}`,
                        "Content-Type": "application/json",
                    },
                }
            );

            const data = response.data.data;

            logger.info("Video upload initialized");

            return {
                uploadUrl: data.upload_url,
                uploadId: data.publish_id,
            };
        } catch (error) {
            const errorData = error instanceof Error && "response" in error ? (error as { response?: { data?: unknown } }).response?.data : error;
            logger.error("Error initializing upload", errorData);
            throw error;
        }
    }

    /**
   * Upload video file to TikTok
   */
    private async uploadVideo(uploadUrl: string, videoBuffer: Buffer): Promise<void> {
        try {
            logger.info("Uploading video to TikTok");

            await axios.put(uploadUrl, videoBuffer, {
                headers: {
                    "Content-Type": "video/mp4",
                    "Content-Length": videoBuffer.length,
                },
            });

            logger.info("Video uploaded successfully");
        } catch (error) {
            logger.error("Error uploading video", error);
            throw error;
        }
    }

    /**
   * Create the post after video is uploaded
   */
    private async createPost(params: {
    uploadId: string;
    title: string;
    privacyLevel: string;
    disableComment: boolean;
    disableDuet: boolean;
    disableStitch: boolean;
    videoCoverTimestamp: number;
    brandContentToggle: boolean;
    brandOrganicToggle: boolean;
  }): Promise<string> {
        try {
            const url = `${this.baseUrl}/v2/post/publish/video/init/`;

            const response = await axios.post(
                url,
                {
                    post_info: {
                        title: params.title.substring(0, 2200), // TikTok caption limit
                        privacy_level: params.privacyLevel,
                        disable_comment: params.disableComment,
                        disable_duet: params.disableDuet,
                        disable_stitch: params.disableStitch,
                        video_cover_timestamp_ms: Math.floor(params.videoCoverTimestamp * 1000),
                    },
                    source_info: {
                        source: "FILE_UPLOAD",
                        publish_id: params.uploadId,
                    },
                },
                {
                    headers: {
                        "Authorization": `Bearer ${this.accessToken}`,
                        "Content-Type": "application/json",
                    },
                }
            );

            const publishId = response.data.data.publish_id;
            logger.info(`Post created with publish ID: ${publishId}`);

            return publishId;
        } catch (error) {
            const errorData = error instanceof Error && "response" in error ? (error as { response?: { data?: unknown } }).response?.data : error;
            logger.error("Error creating post", errorData);
            throw error;
        }
    }

    /**
   * Check video publish status
   */
    async checkPublishStatus(publishId: string): Promise<{
    status: "PUBLISH_COMPLETE" | "PROCESSING_UPLOAD" | "FAILED";
    failReason?: string;
  }> {
        try {
            const url = `${this.baseUrl}/v2/post/publish/status/fetch/`;

            const response = await axios.post(
                url,
                {
                    publish_id: publishId,
                },
                {
                    headers: {
                        "Authorization": `Bearer ${this.accessToken}`,
                        "Content-Type": "application/json",
                    },
                }
            );

            const data = response.data.data;

            return {
                status: data.status,
                failReason: data.fail_reason,
            };
        } catch (error) {
            logger.error("Error checking publish status", error);
            throw error;
        }
    }

    /**
   * Get video analytics
   * Note: Analytics API may require additional permissions
   */
    async getVideoAnalytics(_videoId: string): Promise<{
    views: number;
    likes: number;
    comments: number;
    shares: number;
  }> {
        try {
            // Note: This is a placeholder. TikTok's analytics API structure may differ
            // and requires specific scopes. Check TikTok API documentation for details.

            logger.warn("TikTok analytics API implementation pending - check current API docs");

            // Placeholder return
            return {
                views: 0,
                likes: 0,
                comments: 0,
                shares: 0,
            };
        } catch (error) {
            logger.error("Error getting video analytics", error);
            throw error;
        }
    }

    /**
   * Get user info
   */
    async getUserInfo(): Promise<{
    openId: string;
    displayName: string;
    avatarUrl: string;
  }> {
        try {
            const url = `${this.baseUrl}/v2/user/info/`;

            const response = await axios.get(url, {
                headers: {
                    "Authorization": `Bearer ${this.accessToken}`,
                },
                params: {
                    fields: "open_id,display_name,avatar_url",
                },
            });

            const data = response.data.data.user;

            return {
                openId: data.open_id,
                displayName: data.display_name,
                avatarUrl: data.avatar_url,
            };
        } catch (error) {
            logger.error("Error getting user info", error);
            throw error;
        }
    }

    /**
   * Get OAuth authorization URL
   */
    static getAuthUrl(redirectUri: string, state?: string): string {
        const clientKey = config.tiktok.clientKey;
        const scope = "user.info.basic,video.upload,video.publish";

        const params = new URLSearchParams({
            client_key: clientKey,
            scope: scope,
            response_type: "code",
            redirect_uri: redirectUri,
            state: state || Math.random().toString(36).substring(7),
        });

        return `https://www.tiktok.com/v2/auth/authorize/?${params.toString()}`;
    }

    /**
   * Exchange authorization code for access token
   */
    static async getAccessToken(code: string, redirectUri: string): Promise<{
    accessToken: string;
    expiresIn: number;
    refreshToken: string;
    openId: string;
  }> {
        try {
            const url = "https://open.tiktokapis.com/v2/oauth/token/";

            const response = await axios.post(
                url,
                {
                    client_key: config.tiktok.clientKey,
                    client_secret: config.tiktok.clientSecret,
                    code: code,
                    grant_type: "authorization_code",
                    redirect_uri: redirectUri,
                },
                {
                    headers: {
                        "Content-Type": "application/x-www-form-urlencoded",
                    },
                }
            );

            const data = response.data.data;

            logger.info("Access token obtained");

            return {
                accessToken: data.access_token,
                expiresIn: data.expires_in,
                refreshToken: data.refresh_token,
                openId: data.open_id,
            };
        } catch (error) {
            const errorData = error instanceof Error && "response" in error ? (error as { response?: { data?: unknown } }).response?.data : error;
            logger.error("Error getting access token", errorData);
            throw error;
        }
    }
}
