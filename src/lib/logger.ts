import { Logging } from "@google-cloud/logging";
import { config } from "../config/index.js";

export class Logger {
    private logging: Logging;
    private logName: string;
    private serviceName: string;

    constructor(serviceName: string) {
        this.serviceName = serviceName;
        this.logging = new Logging({
            projectId: config.gcp.projectId,
        });
        this.logName = "doomscroller";
    }

    private async writeLog(severity: string, message: string, metadata?: Record<string, unknown>): Promise<void> {
        try {
            const log = this.logging.log(this.logName);

            const entry = log.entry(
                {
                    resource: {
                        type: "cloud_function",
                        labels: {
                            function_name: this.serviceName,
                            region: config.gcp.region,
                        },
                    },
                    severity,
                },
                {
                    message,
                    service: this.serviceName,
                    timestamp: new Date().toISOString(),
                    ...metadata,
                }
            );

            await log.write(entry);
        } catch (error) {
            // Fallback to console if Cloud Logging fails
            console.error("Failed to write to Cloud Logging:", error);
            console.log(`[${severity}] ${this.serviceName}: ${message}`, metadata);
        }
    }

    info(message: string, metadata?: Record<string, unknown>): void {
        console.log(`[INFO] ${this.serviceName}: ${message}`, metadata || "");
        this.writeLog("INFO", message, metadata).catch(console.error);
    }

    warn(message: string, metadata?: Record<string, unknown>): void {
        console.warn(`[WARN] ${this.serviceName}: ${message}`, metadata || "");
        this.writeLog("WARNING", message, metadata).catch(console.error);
    }

    error(message: string, error?: unknown, metadata?: Record<string, unknown>): void {
        console.error(`[ERROR] ${this.serviceName}: ${message}`, error, metadata || "");
        const errorObj = error instanceof Error ? { message: error.message, stack: error.stack } : { message: String(error) };
        this.writeLog("ERROR", message, {
            ...errorObj,
            ...metadata,
        }).catch(console.error);
    }

    debug(message: string, metadata?: Record<string, unknown>): void {
        if (process.env.NODE_ENV !== "production") {
            console.debug(`[DEBUG] ${this.serviceName}: ${message}`, metadata || "");
        }
    }
}
