import { Storage } from "@google-cloud/storage";
import { config } from "../config/index.js";
import { Logger } from "./logger.js";

const logger = new Logger("StorageService");

export class StorageService {
    private storage: Storage;
    private bucketName: string;

    constructor() {
        this.storage = new Storage({
            projectId: config.gcp.projectId,
        });
        this.bucketName = config.gcp.storageBucket;
    }

    /**
   * Upload a video file to Cloud Storage
   */
    async uploadVideo(
        videoBuffer: Buffer,
        videoId: string,
        niche: string
    ): Promise<{ publicUrl: string; storagePath: string }> {
        try {
            const fileName = `videos/${niche}/${videoId}.mp4`;
            const bucket = this.storage.bucket(this.bucketName);
            const file = bucket.file(fileName);

            await file.save(videoBuffer, {
                metadata: {
                    contentType: "video/mp4",
                    metadata: {
                        videoId,
                        niche,
                        uploadedAt: new Date().toISOString(),
                    },
                },
            });

            // Make file publicly accessible (optional - depends on your security requirements)
            await file.makePublic();

            const publicUrl = `https://storage.googleapis.com/${this.bucketName}/${fileName}`;

            logger.info(`Video uploaded successfully: ${fileName}`);

            return {
                publicUrl,
                storagePath: fileName,
            };
        } catch (error) {
            logger.error("Error uploading video to storage", error);
            throw error;
        }
    }

    /**
   * Download a video from Cloud Storage
   */
    async downloadVideo(storagePath: string): Promise<Buffer> {
        try {
            const bucket = this.storage.bucket(this.bucketName);
            const file = bucket.file(storagePath);

            const [buffer] = await file.download();
            logger.info(`Video downloaded successfully: ${storagePath}`);

            return buffer;
        } catch (error) {
            logger.error("Error downloading video from storage", error);
            throw error;
        }
    }

    /**
   * Delete a video from Cloud Storage
   */
    async deleteVideo(storagePath: string): Promise<void> {
        try {
            const bucket = this.storage.bucket(this.bucketName);
            const file = bucket.file(storagePath);

            await file.delete();
            logger.info(`Video deleted successfully: ${storagePath}`);
        } catch (error) {
            logger.error("Error deleting video from storage", error);
            throw error;
        }
    }

    /**
   * Get signed URL for temporary access to video
   */
    async getSignedUrl(storagePath: string, expiresInMinutes: number = 60): Promise<string> {
        try {
            const bucket = this.storage.bucket(this.bucketName);
            const file = bucket.file(storagePath);

            const [url] = await file.getSignedUrl({
                version: "v4",
                action: "read",
                expires: Date.now() + expiresInMinutes * 60 * 1000,
            });

            return url;
        } catch (error) {
            logger.error("Error generating signed URL", error);
            throw error;
        }
    }

    /**
   * List all videos in a niche
   */
    async listVideos(niche?: string): Promise<string[]> {
        try {
            const bucket = this.storage.bucket(this.bucketName);
            const prefix = niche ? `videos/${niche}/` : "videos/";

            const [files] = await bucket.getFiles({ prefix });
            const videoFiles = files.map(file => file.name);

            logger.info(`Found ${videoFiles.length} videos`);
            return videoFiles;
        } catch (error) {
            logger.error("Error listing videos", error);
            throw error;
        }
    }
}
