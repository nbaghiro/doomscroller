import { CloudEvent } from "@google-cloud/functions-framework";
import { DatabaseService } from "../lib/database.js";
import { WorkflowOrchestratorService } from "../services/workflow-orchestrator.js";
import { Logger } from "../lib/logger.js";
import { validateConfig } from "../config/index.js";

const logger = new Logger("ScheduledVideoGenerator");

/**
 * Cloud Function triggered by Cloud Scheduler
 * Generates and posts videos for all configured niches
 */
export async function scheduledVideoGenerator(cloudEvent: CloudEvent<unknown>): Promise<void> {
    try {
        logger.info("Scheduled video generator triggered");
        logger.info(`Event ID: ${cloudEvent.id}, Event Type: ${cloudEvent.type}`);

        // Validate configuration
        const configValidation = validateConfig();
        if (!configValidation.valid) {
            throw new Error(`Invalid configuration: ${configValidation.errors.join(", ")}`);
        }

        const db = new DatabaseService();
        const orchestrator = new WorkflowOrchestratorService();

        // Get all content niches
        const niches = await db.getAllContentNiches();

        if (niches.length === 0) {
            logger.warn("No content niches configured");
            return;
        }

        logger.info(`Found ${niches.length} content niches`);

        // Generate videos for each niche
        // Run them sequentially to avoid hitting API rate limits
        for (const niche of niches) {
            try {
                logger.info(`Processing niche: ${niche.name}`);

                const videoId = await orchestrator.generateAndPostVideo(niche);

                logger.info(`Successfully generated and posted video: ${videoId} for niche: ${niche.name}`);
            } catch (error) {
                logger.error(`Error processing niche: ${niche.name}`, error);
                // Continue with other niches even if one fails
            }

            // Add delay between niches to avoid rate limiting
            await sleep(10000); // 10 seconds
        }

        logger.info("Scheduled video generator completed successfully");
    } catch (error) {
        logger.error("Error in scheduled video generator", error);
        throw error;
    }
}

function sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
}
