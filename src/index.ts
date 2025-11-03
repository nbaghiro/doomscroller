import { http, CloudEvent } from "@google-cloud/functions-framework";
import { scheduledVideoGenerator } from "./functions/scheduled-video-generator.js";
import { analyticsCollector } from "./functions/analytics-collector.js";

// Register Cloud Functions

// Scheduled function for video generation (triggered by Cloud Scheduler)
http("generateVideos", async (req, res) => {
    try {
    // Create a mock CloudEvent for HTTP trigger
        const cloudEvent: CloudEvent<unknown> = {
            specversion: "1.0",
            id: `http-${Date.now()}`,
            source: "http-trigger",
            type: "scheduled.event",
            datacontenttype: "application/json",
            data: req.body,
            time: new Date().toISOString(),
        };

        await scheduledVideoGenerator(cloudEvent);

        res.status(200).send({ success: true, message: "Video generation completed" });
    } catch (error) {
        console.error("Error in generateVideos:", error);
        const errorMessage = error instanceof Error ? error.message : "Unknown error";
        res.status(500).send({ success: false, error: errorMessage });
    }
});

// Scheduled function for analytics collection (triggered by Cloud Scheduler)
http("collectAnalytics", async (req, res) => {
    try {
        const cloudEvent: CloudEvent<unknown> = {
            specversion: "1.0",
            id: `http-${Date.now()}`,
            source: "http-trigger",
            type: "scheduled.event",
            datacontenttype: "application/json",
            data: req.body,
            time: new Date().toISOString(),
        };

        await analyticsCollector(cloudEvent);

        res.status(200).send({ success: true, message: "Analytics collection completed" });
    } catch (error) {
        console.error("Error in collectAnalytics:", error);
        const errorMessage = error instanceof Error ? error.message : "Unknown error";
        res.status(500).send({ success: false, error: errorMessage });
    }
});

// Health check endpoint
http("health", (req, res) => {
    res.status(200).send({ status: "healthy", timestamp: new Date().toISOString() });
});

export { scheduledVideoGenerator, analyticsCollector };
