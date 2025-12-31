export interface RateLimits {
  youtube: {
    quota: number;
    requestsPerSecond: number;
    requestsPerDay: number;
  };
  googleTrends: {
    requestsPerMinute: number;
    cooldownMs: number;
  };
  videoGeneration: {
    maxConcurrent: number;
    timeoutMs: number;
  };
}

export const rateLimits: RateLimits = {
  youtube: {
    quota: 10000,
    requestsPerSecond: 1,
    requestsPerDay: parseInt(process.env.YOUTUBE_API_MAX_CALLS_PER_DAY || '10000')
  },
  googleTrends: {
    requestsPerMinute: 60,
    cooldownMs: parseInt(process.env.GOOGLE_TRENDS_RATE_LIMIT_MS || '1000')
  },
  videoGeneration: {
    maxConcurrent: 1,
    timeoutMs: 300000 // 5 minutes
  }
};

export interface ContentLimits {
  maxScriptLength: number;
  minScriptLength: number;
  maxKeywords: number;
  maxTags: number;
  maxHashtags: number;
}

export const contentLimits: ContentLimits = {
  maxScriptLength: 3000,
  minScriptLength: 500,
  maxKeywords: 10,
  maxTags: 30,
  maxHashtags: 5
};
