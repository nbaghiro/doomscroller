import axios from "axios";
import { config } from "../config/index.js";
import { Logger } from "../lib/logger.js";
import { VideoGenerationRequest, VideoGenerationResponse } from "../types/index.js";

const logger = new Logger("VideoGenerator");

export class VideoGeneratorService {
    /**
   * Generate a video using the configured provider
   */
    async generateVideo(request: VideoGenerationRequest): Promise<VideoGenerationResponse> {
        logger.info(`Generating video for niche: ${request.niche}`);

        switch (config.videoGeneration.provider) {
            case "vertex":
                return this.generateWithVertexAI(request);
            case "fal":
                return this.generateWithFal(request);
            case "replicate":
                return this.generateWithReplicate(request);
            default:
                throw new Error(`Unsupported video provider: ${config.videoGeneration.provider}`);
        }
    }

    /**
   * Generate video using Vertex AI (Google Veo 3)
   */
    private async generateWithVertexAI(
        request: VideoGenerationRequest
    ): Promise<VideoGenerationResponse> {
        try {
            logger.info("Generating video with Vertex AI");

            // Note: This is a simplified example. Vertex AI Veo 3 API is still being finalized.
            // You'll need to use the official Vertex AI SDK once it's fully available.

            const response = await axios.post(
                `https://${config.gcp.vertexAiLocation}-aiplatform.googleapis.com/v1/projects/${config.gcp.projectId}/locations/${config.gcp.vertexAiLocation}/publishers/google/models/veo-3:predict`,
                {
                    instances: [
                        {
                            prompt: request.prompt,
                            parameters: {
                                duration: request.duration || config.videoGeneration.defaultDuration,
                                resolution: request.resolution || config.videoGeneration.defaultResolution,
                                includeAudio: request.includeAudio ?? config.videoGeneration.includeAudio,
                            },
                        },
                    ],
                },
                {
                    headers: {
                        "Content-Type": "application/json",
                        // Authentication would be handled by Application Default Credentials
                    },
                }
            );

            const videoUrl = response.data.predictions[0].videoUrl;

            logger.info("Video generated successfully with Vertex AI");

            return {
                videoUrl,
                duration: request.duration || config.videoGeneration.defaultDuration,
                format: "mp4",
                size: 0, // Would be filled in after downloading
                generatedAt: new Date(),
            };
        } catch (error) {
            logger.error("Error generating video with Vertex AI", error);
            throw error;
        }
    }

    /**
   * Generate video using fal.ai (Veo 3 access)
   */
    private async generateWithFal(request: VideoGenerationRequest): Promise<VideoGenerationResponse> {
        try {
            logger.info("Generating video with fal.ai");

            // Step 1: Submit video generation request
            const submitResponse = await axios.post(
                "https://fal.run/fal-ai/google-veo-3",
                {
                    prompt: request.prompt,
                    video_length: request.duration || config.videoGeneration.defaultDuration,
                    resolution: request.resolution || config.videoGeneration.defaultResolution,
                    include_audio: request.includeAudio ?? config.videoGeneration.includeAudio,
                },
                {
                    headers: {
                        "Authorization": `Key ${config.videoGeneration.falApiKey}`,
                        "Content-Type": "application/json",
                    },
                }
            );

            const requestId = submitResponse.data.request_id;
            logger.info(`Video generation request submitted: ${requestId}`);

            // Step 2: Poll for completion
            let attempts = 0;
            const maxAttempts = 60; // 5 minutes with 5-second intervals
            let videoUrl: string | null = null;

            while (attempts < maxAttempts) {
                await this.sleep(5000); // Wait 5 seconds

                const statusResponse = await axios.get(
                    `https://fal.run/fal-ai/google-veo-3/requests/${requestId}`,
                    {
                        headers: {
                            "Authorization": `Key ${config.videoGeneration.falApiKey}`,
                        },
                    }
                );

                const status = statusResponse.data.status;

                if (status === "COMPLETED") {
                    videoUrl = statusResponse.data.video_url;
                    logger.info("Video generation completed");
                    break;
                } else if (status === "FAILED") {
                    throw new Error("Video generation failed");
                }

                attempts++;
                logger.debug(`Waiting for video generation... (attempt ${attempts}/${maxAttempts})`);
            }

            if (!videoUrl) {
                throw new Error("Video generation timed out");
            }

            return {
                videoUrl,
                duration: request.duration || config.videoGeneration.defaultDuration,
                format: "mp4",
                size: 0,
                generatedAt: new Date(),
            };
        } catch (error) {
            logger.error("Error generating video with fal.ai", error);
            throw error;
        }
    }

    /**
   * Generate video using Replicate (Veo 3 access)
   */
    private async generateWithReplicate(
        request: VideoGenerationRequest
    ): Promise<VideoGenerationResponse> {
        try {
            logger.info("Generating video with Replicate");

            // Step 1: Create prediction
            const createResponse = await axios.post(
                "https://api.replicate.com/v1/predictions",
                {
                    version: "veo-3-latest", // Replace with actual model version
                    input: {
                        prompt: request.prompt,
                        duration: request.duration || config.videoGeneration.defaultDuration,
                        resolution: request.resolution || config.videoGeneration.defaultResolution,
                        include_audio: request.includeAudio ?? config.videoGeneration.includeAudio,
                    },
                },
                {
                    headers: {
                        "Authorization": `Token ${config.videoGeneration.replicateApiKey}`,
                        "Content-Type": "application/json",
                    },
                }
            );

            const predictionId = createResponse.data.id;
            const pollUrl = createResponse.data.urls.get;

            logger.info(`Video prediction created: ${predictionId}`);

            // Step 2: Poll for completion
            let attempts = 0;
            const maxAttempts = 60;
            let videoUrl: string | null = null;

            while (attempts < maxAttempts) {
                await this.sleep(5000);

                const statusResponse = await axios.get(pollUrl, {
                    headers: {
                        "Authorization": `Token ${config.videoGeneration.replicateApiKey}`,
                    },
                });

                const status = statusResponse.data.status;

                if (status === "succeeded") {
                    videoUrl = statusResponse.data.output;
                    logger.info("Video generation succeeded");
                    break;
                } else if (status === "failed" || status === "canceled") {
                    throw new Error(`Video generation ${status}`);
                }

                attempts++;
                logger.debug(`Waiting for video generation... (attempt ${attempts}/${maxAttempts})`);
            }

            if (!videoUrl) {
                throw new Error("Video generation timed out");
            }

            return {
                videoUrl,
                duration: request.duration || config.videoGeneration.defaultDuration,
                format: "mp4",
                size: 0,
                generatedAt: new Date(),
            };
        } catch (error) {
            logger.error("Error generating video with Replicate", error);
            throw error;
        }
    }

    /**
   * Download video from URL
   */
    async downloadVideo(videoUrl: string): Promise<Buffer> {
        try {
            logger.info("Downloading video from URL");

            const response = await axios.get(videoUrl, {
                responseType: "arraybuffer",
                timeout: 300000, // 5 minutes
            });

            const buffer = Buffer.from(response.data);
            logger.info(`Video downloaded: ${buffer.length} bytes`);

            return buffer;
        } catch (error) {
            logger.error("Error downloading video", error);
            throw error;
        }
    }

    private sleep(ms: number): Promise<void> {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}
