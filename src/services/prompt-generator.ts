import Anthropic from "@anthropic-ai/sdk";
import { config } from "../config/index.js";
import { Logger } from "../lib/logger.js";
import {
    PromptGenerationRequest,
    PromptGenerationResponse,
} from "../types/index.js";

const logger = new Logger("PromptGenerator");

export class PromptGeneratorService {
    private anthropic: Anthropic;

    constructor() {
        this.anthropic = new Anthropic({
            apiKey: config.anthropic.apiKey,
        });
    }

    /**
   * Generate a video prompt using Claude
   */
    async generatePrompt(request: PromptGenerationRequest): Promise<PromptGenerationResponse> {
        try {
            logger.info(`Generating prompt for niche: ${request.niche}`);

            const systemPrompt = this.buildSystemPrompt(request);
            const userPrompt = this.buildUserPrompt(request);

            const message = await this.anthropic.messages.create({
                model: "claude-sonnet-4-20250514",
                max_tokens: 1024,
                temperature: 0.9,
                system: systemPrompt,
                messages: [
                    {
                        role: "user",
                        content: userPrompt,
                    },
                ],
            });

            const firstContent = message.content[0];
            const responseText = firstContent.type === "text" ? firstContent.text : "";
            const response = this.parseResponse(responseText);
            logger.info("Prompt generated successfully");

            return response;
        } catch (error) {
            logger.error("Error generating prompt", error);
            throw error;
        }
    }

    /**
   * Generate multiple prompt variations
   */
    async generateMultiplePrompts(
        request: PromptGenerationRequest,
        count: number = 3
    ): Promise<PromptGenerationResponse[]> {
        try {
            const prompts: PromptGenerationResponse[] = [];

            for (let i = 0; i < count; i++) {
                const prompt = await this.generatePrompt(request);
                prompts.push(prompt);

                // Add generated prompt to previousPrompts to ensure diversity
                if (!request.previousPrompts) {
                    request.previousPrompts = [];
                }
                request.previousPrompts.push(prompt.prompt);
            }

            return prompts;
        } catch (error) {
            logger.error("Error generating multiple prompts", error);
            throw error;
        }
    }

    private buildSystemPrompt(request: PromptGenerationRequest): string {
        const styleGuidelines = {
            educational: "Focus on teaching, explaining concepts clearly, and providing value through knowledge.",
            motivational: "Inspire viewers with uplifting messages, success stories, and empowering content.",
            entertainment: "Create engaging, fun, and captivating content that keeps viewers hooked.",
            news: "Deliver timely, relevant information in a concise and informative manner.",
        };

        const style = request.style || "entertainment";

        return `You are an expert AI video content creator specializing in short-form vertical videos for social media platforms like YouTube Shorts, Instagram Reels, and TikTok.

Your task is to generate creative, engaging video prompts that will be used with AI video generation tools like Google Veo 3.

Content Style: ${styleGuidelines[style]}

Key Guidelines:
1. Videos are 8 seconds long - make every second count
2. Focus on visual storytelling that works WITHOUT sound (but can be enhanced with it)
3. Use clear, specific visual descriptions
4. Include camera movements and transitions
5. Ensure content is platform-appropriate and non-controversial
6. Make it shareable and engaging
7. Consider trending formats and viral patterns

Output Format:
Provide your response in the following JSON structure:
{
  "prompt": "Detailed video generation prompt with visual descriptions, camera angles, timing, and mood",
  "description": "Brief 1-2 sentence description of the video concept",
  "suggestedHashtags": ["hashtag1", "hashtag2", "hashtag3", "hashtag4", "hashtag5"],
  "estimatedEngagement": "low|medium|high"
}`;
    }

    private buildUserPrompt(request: PromptGenerationRequest): string {
        let prompt = `Generate a creative video prompt for the "${request.niche}" niche.\n\n`;

        if (request.trendingTopics && request.trendingTopics.length > 0) {
            prompt += "Trending Topics to Consider:\n";
            request.trendingTopics.forEach((topic, index) => {
                prompt += `${index + 1}. ${topic.topic} (score: ${topic.score})\n`;
                if (topic.relatedKeywords.length > 0) {
                    prompt += `   Related: ${topic.relatedKeywords.join(", ")}\n`;
                }
            });
            prompt += "\n";
        }

        if (request.previousPrompts && request.previousPrompts.length > 0) {
            prompt += "Previous prompts to avoid duplicating:\n";
            request.previousPrompts.forEach((prevPrompt, index) => {
                prompt += `${index + 1}. ${prevPrompt.substring(0, 100)}...\n`;
            });
            prompt += "\n";
        }

        prompt += "Create a unique, engaging video prompt that will perform well on social media. Be specific about visuals, timing, and mood. Make it different from any previous prompts.";

        return prompt;
    }

    private parseResponse(responseText: string): PromptGenerationResponse {
        try {
            // Try to parse JSON from response
            const jsonMatch = responseText.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
                const parsed = JSON.parse(jsonMatch[0]);
                return {
                    prompt: parsed.prompt,
                    description: parsed.description,
                    suggestedHashtags: parsed.suggestedHashtags || [],
                    estimatedEngagement: parsed.estimatedEngagement || "medium",
                };
            }

            // Fallback: use the entire response as prompt
            logger.warn("Could not parse JSON response, using raw text");
            return {
                prompt: responseText,
                description: "Generated video prompt",
                suggestedHashtags: [],
                estimatedEngagement: "medium",
            };
        } catch (error) {
            logger.error("Error parsing response", error);
            throw new Error("Failed to parse prompt generation response");
        }
    }
}
