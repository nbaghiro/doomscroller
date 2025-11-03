export interface VideoMetadata {
  id: string;
  niche: string;
  prompt: string;
  videoUrl: string;
  storagePath: string;
  duration: number;
  createdAt: Date;
  status: "generating" | "ready" | "posted" | "failed";
  platforms: PlatformPost[];
}

export interface PlatformPost {
  platform: "youtube" | "instagram" | "tiktok";
  postId?: string;
  postedAt?: Date;
  status: "pending" | "posted" | "failed";
  error?: string;
  views?: number;
  likes?: number;
  comments?: number;
}

export interface ContentNiche {
  id: string;
  name: string;
  description: string;
  keywords: string[];
  promptTemplate: string;
  targetAudience: string;
  postingSchedule: PostingSchedule;
  socialAccounts: SocialAccountConfig;
}

export interface PostingSchedule {
  timesPerDay: number;
  preferredTimes: string[]; // e.g., ["09:00", "14:00", "18:00"]
  timezone: string;
}

export interface SocialAccountConfig {
  youtube?: {
    channelId: string;
    refreshToken: string;
  };
  instagram?: {
    accountId: string;
    accessToken: string;
  };
  tiktok?: {
    username: string;
    accessToken?: string;
  };
}

export interface VideoGenerationRequest {
  prompt: string;
  duration?: number;
  resolution?: "720p" | "1080p" | "4k";
  includeAudio?: boolean;
  niche: string;
}

export interface VideoGenerationResponse {
  videoUrl: string;
  duration: number;
  format: string;
  size: number;
  generatedAt: Date;
}

export interface TrendingTopic {
  topic: string;
  score: number;
  source: "google-trends" | "twitter" | "manual";
  relatedKeywords: string[];
  fetchedAt: Date;
}

export interface PromptGenerationRequest {
  niche: string;
  trendingTopics?: TrendingTopic[];
  previousPrompts?: string[];
  style?: "educational" | "motivational" | "entertainment" | "news";
}

export interface PromptGenerationResponse {
  prompt: string;
  description: string;
  suggestedHashtags: string[];
  estimatedEngagement: "low" | "medium" | "high";
}

export interface AnalyticsData {
  videoId: string;
  platform: "youtube" | "instagram" | "tiktok";
  views: number;
  likes: number;
  comments: number;
  shares: number;
  watchTime?: number;
  engagementRate: number;
  fetchedAt: Date;
}

export interface WorkflowJob {
  id: string;
  type: "generate" | "post" | "analytics";
  status: "queued" | "running" | "completed" | "failed";
  niche: string;
  videoId?: string;
  createdAt: Date;
  startedAt?: Date;
  completedAt?: Date;
  error?: string;
  retryCount: number;
}
