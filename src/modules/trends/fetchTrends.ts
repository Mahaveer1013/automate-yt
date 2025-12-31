import axios from 'axios';
import { Logger } from '../../utils/logger.js';
import { retryWithBackoff } from '../../utils/retry.js';
import { defaultChannelConfig } from '../../config/channel.config.js';
import { rateLimits } from '../../config/limits.config.js';

export interface TrendData {
  query: string;
  searchVolume: number;
  competition: number;
  trendScore: number;
  region: string;
  category: string;
  timestamp: Date;
  estimatedRPM: number;
}

const logger = new Logger('TrendsFetcher');

export class TrendsFetcher {
  private lastRequestTime = 0;

  private async ensureRateLimit(): Promise<void> {
    const now = Date.now();
    const timeSinceLastRequest = now - this.lastRequestTime;

    if (timeSinceLastRequest < rateLimits.googleTrends.cooldownMs) {
      await new Promise(resolve =>
        setTimeout(resolve, rateLimits.googleTrends.cooldownMs - timeSinceLastRequest)
      );
    }

    this.lastRequestTime = Date.now();
  }

  async fetchYouTubeSuggestions(query: string): Promise<string[]> {
    await this.ensureRateLimit();

    return retryWithBackoff(async () => {
      const response = await axios.get(
        `http://suggestqueries.google.com/complete/search`,
        {
          params: {
            client: 'youtube',
            q: query,
            hl: defaultChannelConfig.language,
            ds: 'yt'
          },
          headers: {
            'User-Agent': 'Mozilla/5.0 (compatible; YouTubeAutomation/1.0)'
          }
        }
      );

      if (response.data && Array.isArray(response.data[1])) {
        return response.data[1].slice(0, 10);
      }

      return [];
    }, 3);
  }

  async fetchGoogleTrends(region: string): Promise<TrendData[]> {
    await this.ensureRateLimit();

    return retryWithBackoff(async () => {
      // This is a simplified example. In production, use official Google Trends API
      // or a reliable third-party service with proper licensing
      const trendingTopics = [
        {
          query: 'AI tools for productivity',
          searchVolume: 85000,
          competition: 0.7,
          trendScore: 0.85,
          estimatedRPM: 4.5
        },
        {
          query: 'how to learn programming fast',
          searchVolume: 120000,
          competition: 0.9,
          trendScore: 0.75,
          estimatedRPM: 3.8
        },
        {
          query: 'sustainable technology innovations',
          searchVolume: 45000,
          competition: 0.5,
          trendScore: 0.9,
          estimatedRPM: 5.2
        }
      ];

      return trendingTopics.map(topic => ({
        ...topic,
        region,
        category: 'Technology',
        timestamp: new Date()
      }));
    }, 3);
  }

  async fetchTrends(): Promise<TrendData[]> {
    logger.info('Fetching trends...');

    const allTrends: TrendData[] = [];

    for (const region of defaultChannelConfig.targetRegions) {
      try {
        const regionalTrends = await this.fetchGoogleTrends(region);

        // Filter by niche
        const filteredTrends = regionalTrends.filter(trend =>
          defaultChannelConfig.niche.some(niche =>
            trend.query.toLowerCase().includes(niche.toLowerCase()) ||
            trend.category.toLowerCase().includes(niche.toLowerCase())
          )
        );

        allTrends.push(...filteredTrends);

        // Get related suggestions for each trend
        for (const trend of filteredTrends.slice(0, 3)) {
          const suggestions = await this.fetchYouTubeSuggestions(trend.query);

          for (const suggestion of suggestions) {
            allTrends.push({
              query: suggestion,
              searchVolume: trend.searchVolume * 0.7, // Estimate
              competition: trend.competition * 1.1,
              trendScore: trend.trendScore * 0.8,
              region,
              category: trend.category,
              timestamp: new Date(),
              estimatedRPM: trend.estimatedRPM * 0.9
            });
          }
        }

      } catch (error) {
        logger.error(`Failed to fetch trends for region ${region}`, error);
      }
    }

    logger.info(`Found ${allTrends.length} potential trends`);
    return allTrends;
  }
}

export async function fetchTrends(): Promise<TrendData[]> {
  const fetcher = new TrendsFetcher();
  return fetcher.fetchTrends();
}
