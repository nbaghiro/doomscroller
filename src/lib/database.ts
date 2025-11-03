import { Firestore, Timestamp } from "@google-cloud/firestore";
import { config } from "../config/index.js";
import {
    VideoMetadata,
    ContentNiche,
    AnalyticsData,
    WorkflowJob,
    TrendingTopic,
} from "../types/index.js";
import { Logger } from "./logger.js";

const logger = new Logger("DatabaseService");

export class DatabaseService {
    private db: Firestore;

    constructor() {
        this.db = new Firestore({
            projectId: config.gcp.projectId,
        });
    }

    // ===== Video Metadata Operations =====

    async saveVideoMetadata(video: VideoMetadata): Promise<void> {
        try {
            await this.db.collection("videos").doc(video.id).set({
                ...video,
                createdAt: Timestamp.fromDate(video.createdAt),
            });
            logger.info(`Video metadata saved: ${video.id}`);
        } catch (error) {
            logger.error("Error saving video metadata", error);
            throw error;
        }
    }

    async getVideoMetadata(videoId: string): Promise<VideoMetadata | null> {
        try {
            const doc = await this.db.collection("videos").doc(videoId).get();
            if (!doc.exists) return null;

            const data = doc.data();
            if (!data) return null;

            return {
                ...(data as Omit<VideoMetadata, "createdAt">),
                createdAt: data.createdAt.toDate(),
            };
        } catch (error) {
            logger.error("Error getting video metadata", error);
            throw error;
        }
    }

    async updateVideoStatus(videoId: string, status: VideoMetadata["status"]): Promise<void> {
        try {
            await this.db.collection("videos").doc(videoId).update({ status });
            logger.info(`Video status updated: ${videoId} -> ${status}`);
        } catch (error) {
            logger.error("Error updating video status", error);
            throw error;
        }
    }

    async getVideosByNiche(niche: string, limit: number = 50): Promise<VideoMetadata[]> {
        try {
            const snapshot = await this.db
                .collection("videos")
                .where("niche", "==", niche)
                .orderBy("createdAt", "desc")
                .limit(limit)
                .get();

            return snapshot.docs.map(doc => {
                const data = doc.data();
                return {
                    ...(data as Omit<VideoMetadata, "createdAt">),
                    createdAt: data.createdAt.toDate(),
                };
            });
        } catch (error) {
            logger.error("Error getting videos by niche", error);
            throw error;
        }
    }

    // ===== Content Niche Operations =====

    async saveContentNiche(niche: ContentNiche): Promise<void> {
        try {
            await this.db.collection("niches").doc(niche.id).set(niche);
            logger.info(`Content niche saved: ${niche.id}`);
        } catch (error) {
            logger.error("Error saving content niche", error);
            throw error;
        }
    }

    async getContentNiche(nicheId: string): Promise<ContentNiche | null> {
        try {
            const doc = await this.db.collection("niches").doc(nicheId).get();
            return doc.exists ? (doc.data() as ContentNiche) : null;
        } catch (error) {
            logger.error("Error getting content niche", error);
            throw error;
        }
    }

    async getAllContentNiches(): Promise<ContentNiche[]> {
        try {
            const snapshot = await this.db.collection("niches").get();
            return snapshot.docs.map(doc => doc.data() as ContentNiche);
        } catch (error) {
            logger.error("Error getting all content niches", error);
            throw error;
        }
    }

    // ===== Analytics Operations =====

    async saveAnalytics(analytics: AnalyticsData): Promise<void> {
        try {
            const id = `${analytics.videoId}_${analytics.platform}_${Date.now()}`;
            await this.db.collection("analytics").doc(id).set({
                ...analytics,
                fetchedAt: Timestamp.fromDate(analytics.fetchedAt),
            });
            logger.info(`Analytics saved for video: ${analytics.videoId}`);
        } catch (error) {
            logger.error("Error saving analytics", error);
            throw error;
        }
    }

    async getAnalytics(videoId: string): Promise<AnalyticsData[]> {
        try {
            const snapshot = await this.db
                .collection("analytics")
                .where("videoId", "==", videoId)
                .orderBy("fetchedAt", "desc")
                .get();

            return snapshot.docs.map(doc => {
                const data = doc.data();
                return {
                    ...(data as Omit<AnalyticsData, "fetchedAt">),
                    fetchedAt: data.fetchedAt.toDate(),
                };
            });
        } catch (error) {
            logger.error("Error getting analytics", error);
            throw error;
        }
    }

    // ===== Workflow Job Operations =====

    async createJob(job: Omit<WorkflowJob, "id" | "createdAt">): Promise<string> {
        try {
            const jobData: WorkflowJob = {
                ...job,
                id: this.db.collection("jobs").doc().id,
                createdAt: new Date(),
            };

            await this.db.collection("jobs").doc(jobData.id).set({
                ...jobData,
                createdAt: Timestamp.fromDate(jobData.createdAt),
                startedAt: jobData.startedAt ? Timestamp.fromDate(jobData.startedAt) : null,
                completedAt: jobData.completedAt ? Timestamp.fromDate(jobData.completedAt) : null,
            });

            logger.info(`Job created: ${jobData.id}`);
            return jobData.id;
        } catch (error) {
            logger.error("Error creating job", error);
            throw error;
        }
    }

    async updateJobStatus(
        jobId: string,
        status: WorkflowJob["status"],
        error?: string
    ): Promise<void> {
        try {
            const updates: Record<string, unknown> = { status };

            if (status === "running" && !updates.startedAt) {
                updates.startedAt = Timestamp.now();
            }

            if (status === "completed" || status === "failed") {
                updates.completedAt = Timestamp.now();
            }

            if (error) {
                updates.error = error;
            }

            await this.db.collection("jobs").doc(jobId).update(updates);
            logger.info(`Job status updated: ${jobId} -> ${status}`);
        } catch (error) {
            logger.error("Error updating job status", error);
            throw error;
        }
    }

    async getJob(jobId: string): Promise<WorkflowJob | null> {
        try {
            const doc = await this.db.collection("jobs").doc(jobId).get();
            if (!doc.exists) return null;

            const data = doc.data();
            if (!data) return null;

            return {
                ...(data as Omit<WorkflowJob, "createdAt" | "startedAt" | "completedAt">),
                createdAt: data.createdAt.toDate(),
                startedAt: data.startedAt?.toDate(),
                completedAt: data.completedAt?.toDate(),
            };
        } catch (error) {
            logger.error("Error getting job", error);
            throw error;
        }
    }

    // ===== Trending Topics Operations =====

    async saveTrendingTopics(topics: TrendingTopic[]): Promise<void> {
        try {
            const batch = this.db.batch();

            topics.forEach(topic => {
                const id = `${topic.source}_${topic.topic.replace(/\s+/g, "_")}_${Date.now()}`;
                const docRef = this.db.collection("trending").doc(id);
                batch.set(docRef, {
                    ...topic,
                    fetchedAt: Timestamp.fromDate(topic.fetchedAt),
                });
            });

            await batch.commit();
            logger.info(`Saved ${topics.length} trending topics`);
        } catch (error) {
            logger.error("Error saving trending topics", error);
            throw error;
        }
    }

    async getRecentTrendingTopics(limit: number = 20): Promise<TrendingTopic[]> {
        try {
            const snapshot = await this.db
                .collection("trending")
                .orderBy("fetchedAt", "desc")
                .limit(limit)
                .get();

            return snapshot.docs.map(doc => {
                const data = doc.data();
                return {
                    ...(data as Omit<TrendingTopic, "fetchedAt">),
                    fetchedAt: data.fetchedAt.toDate(),
                };
            });
        } catch (error) {
            logger.error("Error getting trending topics", error);
            throw error;
        }
    }
}
