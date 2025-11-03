import axios from "axios";
import { config } from "../config/index.js";
import { Logger } from "../lib/logger.js";
import { TrendingTopic } from "../types/index.js";

const logger = new Logger("TrendingTopics");

export class TrendingTopicsService {
    /**
   * Fetch trending topics from multiple sources
   */
    async fetchTrendingTopics(limit: number = 10): Promise<TrendingTopic[]> {
        try {
            logger.info("Fetching trending topics");

            const topics: TrendingTopic[] = [];

            // Fetch from Google Trends
            const googleTopics = await this.fetchGoogleTrends(limit);
            topics.push(...googleTopics);

            // Fetch from Twitter if configured
            if (config.trending.twitterBearerToken) {
                const twitterTopics = await this.fetchTwitterTrends(limit);
                topics.push(...twitterTopics);
            }

            // Sort by score and limit
            topics.sort((a, b) => b.score - a.score);

            logger.info(`Fetched ${topics.length} trending topics`);

            return topics.slice(0, limit);
        } catch (error) {
            logger.error("Error fetching trending topics", error);
            throw error;
        }
    }

    /**
   * Fetch trending topics from Google Trends
   * Using google-trends-api or SerpApi
   */
    private async fetchGoogleTrends(limit: number): Promise<TrendingTopic[]> {
        try {
            logger.info("Fetching Google Trends");

            // Option 1: Using SerpApi (requires API key)
            if (config.trending.googleTrendsApiKey) {
                const response = await axios.get("https://serpapi.com/search.json", {
                    params: {
                        engine: "google_trends_trending_now",
                        api_key: config.trending.googleTrendsApiKey,
                        geo: "US",
                    },
                });

                interface TrendItem {
                    query: string;
                    related_queries?: Array<{ query: string }>;
                }

                const trends = (response.data.trending_searches as TrendItem[]) || [];

                return trends.slice(0, limit).map((trend, index: number) => ({
                    topic: trend.query,
                    score: 100 - index * 5, // Higher score for higher-ranked trends
                    source: "google-trends" as const,
                    relatedKeywords: trend.related_queries?.map((q) => q.query) || [],
                    fetchedAt: new Date(),
                }));
            }

            // Option 2: Using google-trends-api (free, but requires CORS proxy for browser)
            // For now, return empty array if no API key
            logger.warn("Google Trends API key not configured, skipping");
            return [];
        } catch (error) {
            logger.error("Error fetching Google Trends", error);
            return [];
        }
    }

    /**
   * Fetch trending topics from Twitter/X
   */
    private async fetchTwitterTrends(limit: number): Promise<TrendingTopic[]> {
        try {
            logger.info("Fetching Twitter trends");

            // Twitter API v2 endpoint for trending topics
            // Note: This requires Twitter API Essential access or higher
            const response = await axios.get(
                "https://api.twitter.com/1.1/trends/place.json",
                {
                    params: {
                        id: 1, // 1 = worldwide, 23424977 = United States
                    },
                    headers: {
                        "Authorization": `Bearer ${config.trending.twitterBearerToken}`,
                    },
                }
            );

            interface TwitterTrend {
                name: string;
                tweet_volume: number | null;
            }

            const trends = (response.data[0]?.trends as TwitterTrend[]) || [];

            return trends.slice(0, limit).map((trend, index: number) => ({
                topic: trend.name.replace(/^#/, ""), // Remove # prefix
                score: trend.tweet_volume || 50 - index * 2,
                source: "twitter" as const,
                relatedKeywords: [],
                fetchedAt: new Date(),
            }));
        } catch (error) {
            const errorData = error instanceof Error && "response" in error ? (error as { response?: { data?: unknown } }).response?.data : error;
            logger.error("Error fetching Twitter trends", errorData);
            return [];
        }
    }

    /**
   * Analyze trending topics for a specific niche
   * Filters topics that are relevant to the niche
   */
    async getTrendingForNiche(
        niche: string,
        nicheKeywords: string[]
    ): Promise<TrendingTopic[]> {
        try {
            const allTopics = await this.fetchTrendingTopics(30);

            // Filter topics that match niche keywords
            const relevantTopics = allTopics.filter(topic => {
                const topicLower = topic.topic.toLowerCase();
                return nicheKeywords.some(keyword =>
                    topicLower.includes(keyword.toLowerCase())
                );
            });

            logger.info(`Found ${relevantTopics.length} relevant topics for niche: ${niche}`);

            return relevantTopics.slice(0, 10);
        } catch (error) {
            logger.error("Error getting trending topics for niche", error);
            return [];
        }
    }

    /**
   * Get top hashtags from trending topics
   */
    getHashtagsFromTopics(topics: TrendingTopic[]): string[] {
        const hashtags = new Set<string>();

        topics.forEach(topic => {
            // Convert topic to hashtag
            const hashtag = topic.topic
                .replace(/[^a-zA-Z0-9\s]/g, "")
                .replace(/\s+/g, "")
                .substring(0, 30); // Hashtag length limit

            if (hashtag.length > 0) {
                hashtags.add(hashtag);
            }

            // Add related keywords as hashtags
            topic.relatedKeywords.forEach(keyword => {
                const kwHashtag = keyword
                    .replace(/[^a-zA-Z0-9\s]/g, "")
                    .replace(/\s+/g, "")
                    .substring(0, 30);

                if (kwHashtag.length > 0) {
                    hashtags.add(kwHashtag);
                }
            });
        });

        return Array.from(hashtags).slice(0, 15);
    }

    /**
   * Mock trending topics for testing
   */
    async getMockTrendingTopics(niche: string): Promise<TrendingTopic[]> {
        const mockTopics: Record<string, TrendingTopic[]> = {
            motivational: [
                {
                    topic: "Morning Routine",
                    score: 85,
                    source: "manual",
                    relatedKeywords: ["productivity", "success", "habits"],
                    fetchedAt: new Date(),
                },
                {
                    topic: "Success Mindset",
                    score: 75,
                    source: "manual",
                    relatedKeywords: ["growth", "achievement", "goals"],
                    fetchedAt: new Date(),
                },
            ],
            educational: [
                {
                    topic: "AI Technology",
                    score: 90,
                    source: "manual",
                    relatedKeywords: ["machine learning", "innovation", "future"],
                    fetchedAt: new Date(),
                },
                {
                    topic: "Space Exploration",
                    score: 80,
                    source: "manual",
                    relatedKeywords: ["NASA", "Mars", "astronomy"],
                    fetchedAt: new Date(),
                },
            ],
            entertainment: [
                {
                    topic: "Viral Challenge",
                    score: 95,
                    source: "manual",
                    relatedKeywords: ["trending", "fun", "comedy"],
                    fetchedAt: new Date(),
                },
            ],
        };

        return mockTopics[niche] || mockTopics.entertainment;
    }
}
