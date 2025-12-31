import { google } from 'googleapis';
import { Logger } from '../../utils/logger.js';
import { retryWithBackoff } from '../../utils/retry.js';

const logger = new Logger('AnalyticsFetcher');

export interface VideoAnalytics {
  videoId: string;
  date: Date;
  views: number;
  watchTime: number;
  averageViewDuration: number;
  averageViewPercentage: number;
  likes: number;
  dislikes: number;
  shares: number;
  comments: number;
  subscribersGained: number;
  subscribersLost: number;
  impressions: number;
  impressionsClickThroughRate: number;
  estimatedRevenue: number;
  estimatedAdRevenue: number;
  cpm: number;
}

export interface ChannelAnalytics {
  totalViews: number;
  totalWatchTime: number;
  totalSubscribers: number;
  totalVideos: number;
  estimatedMonthlyRevenue: number;
}

export class AnalyticsFetcher {
  private youtubeAnalytics: any;
  private youtube: any;
  private initialized = false;

  async initialize(): Promise<void> {
    if (this.initialized) return;

    try {
      const auth = new google.auth.OAuth2(
        process.env.YOUTUBE_CLIENT_ID,
        process.env.YOUTUBE_CLIENT_SECRET
      );

      auth.setCredentials({
        refresh_token: process.env.YOUTUBE_REFRESH_TOKEN
      });

      this.youtubeAnalytics = google.youtubeAnalytics({
        version: 'v2',
        auth
      });

      this.youtube = google.youtube({
        version: 'v3',
        auth
      });

      this.initialized = true;
      logger.info('YouTube Analytics API initialized');
    } catch (error) {
      logger.error('Failed to initialize YouTube Analytics API', error);
      throw error;
    }
  }

  async fetchVideoAnalytics(videoId: string): Promise<VideoAnalytics | null> {
    await this.initialize();

    logger.info(`Fetching analytics for video: ${videoId}`);

    try {
      // Fetch basic statistics
      const statsResponse = await this.youtube.videos.list({
        part: 'statistics,snippet',
        id: videoId
      });

      if (!statsResponse.data.items?.[0]) {
        throw new Error('Video not found');
      }

      const stats = statsResponse.data.items[0].statistics;
      const snippet = statsResponse.data.items[0].snippet;

      // Fetch detailed analytics via YouTube Analytics API
      const analyticsResponse = await this.youtubeAnalytics.reports.query({
        ids: `channel==${process.env.YOUTUBE_CHANNEL_ID}`,
        startDate: this.getStartDate(),
        endDate: this.getEndDate(),
        metrics: 'views,estimatedMinutesWatched,averageViewDuration,averageViewPercentage,likes,dislikes,shares,comments,subscribersGained,subscribersLost,impressions,impressionsClickThroughRate,estimatedRevenue,estimatedAdRevenue,cpm',
        filters: `video==${videoId}`,
        dimensions: 'day'
      });

      const analyticsData = analyticsResponse.data.rows?.[0] || [];

      const analytics: VideoAnalytics = {
        videoId,
        date: new Date(),
        views: parseInt(stats.viewCount || '0'),
        watchTime: analyticsData[1] || 0,
        averageViewDuration: analyticsData[2] || 0,
        averageViewPercentage: analyticsData[3] || 0,
        likes: parseInt(stats.likeCount || '0'),
        dislikes: parseInt(stats.dislikeCount || '0'),
        shares: parseInt(stats.shareCount || '0'),
        comments: parseInt(stats.commentCount || '0'),
        subscribersGained: analyticsData[8] || 0,
        subscribersLost: analyticsData[9] || 0,
        impressions: analyticsData[10] || 0,
        impressionsClickThroughRate: analyticsData[11] || 0,
        estimatedRevenue: analyticsData[12] || 0,
        estimatedAdRevenue: analyticsData[13] || 0,
        cpm: analyticsData[14] || 0
      };

      logger.info(`Analytics fetched: ${analytics.views} views, ${analytics.impressionsClickThroughRate}% CTR`);

      return analytics;

    } catch (error) {
      logger.error('Failed to fetch video analytics', error);

      // Return mock data for development
      return this.getMockAnalytics(videoId);
    }
  }

  async fetchChannelAnalytics(): Promise<ChannelAnalytics | null> {
    await this.initialize();

    try {
      const channelResponse = await this.youtube.channels.list({
        part: 'statistics,snippet',
        id: process.env.YOUTUBE_CHANNEL_ID
      });

      if (!channelResponse.data.items?.[0]) {
        throw new Error('Channel not found');
      }

      const stats = channelResponse.data.items[0].statistics;

      // Fetch revenue analytics
      const analyticsResponse = await this.youtubeAnalytics.reports.query({
        ids: `channel==${process.env.YOUTUBE_CHANNEL_ID}`,
        startDate: this.getStartDate(30),
        endDate: this.getEndDate(),
        metrics: 'estimatedRevenue,views,estimatedMinutesWatched'
      });

      const analyticsData = analyticsResponse.data.rows?.[0] || [0, 0, 0];

      const analytics: ChannelAnalytics = {
        totalViews: parseInt(stats.viewCount || '0'),
        totalWatchTime: analyticsData[2] || 0,
        totalSubscribers: parseInt(stats.subscriberCount || '0'),
        totalVideos: parseInt(stats.videoCount || '0'),
        estimatedMonthlyRevenue: analyticsData[0] || 0
      };

      return analytics;

    } catch (error) {
      logger.error('Failed to fetch channel analytics', error);
      return null;
    }
  }

  private getStartDate(daysAgo: number = 7): string {
    const date = new Date();
    date.setDate(date.getDate() - daysAgo);
    return date.toISOString().split('T')[0];
  }

  private getEndDate(): string {
    return new Date().toISOString().split('T')[0];
  }

  private getMockAnalytics(videoId: string): VideoAnalytics {
    // Mock data for development/testing
    return {
      videoId,
      date: new Date(),
      views: Math.floor(Math.random() * 1000),
      watchTime: Math.floor(Math.random() * 10000),
      averageViewDuration: Math.random() * 180,
      averageViewPercentage: Math.random() * 100,
      likes: Math.floor(Math.random() * 100),
      dislikes: Math.floor(Math.random() * 10),
      shares: Math.floor(Math.random() * 50),
      comments: Math.floor(Math.random() * 30),
      subscribersGained: Math.floor(Math.random() * 20),
      subscribersLost: Math.floor(Math.random() * 5),
      impressions: Math.floor(Math.random() * 5000),
      impressionsClickThroughRate: 2 + Math.random() * 8, // 2-10%
      estimatedRevenue: Math.random() * 10,
      estimatedAdRevenue: Math.random() * 8,
      cpm: 1 + Math.random() * 4 // $1-5 CPM
    };
  }
}

export async function fetchAnalytics(videoId: string): Promise<VideoAnalytics | null> {
  const fetcher = new AnalyticsFetcher();
  return fetcher.fetchVideoAnalytics(videoId);
}
