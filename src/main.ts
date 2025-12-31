#!/usr/bin/env node

import { config } from 'dotenv';
config();

import { Logger } from './utils/logger';
import { Database } from './state/database';
import { fetchTrends } from './modules/trends/fetchTrends';
import { scoreTopics } from './modules/scoring/scoreTopics';
import { generateScript } from './modules/script/generateScript';
import { generateVoice } from './modules/voice/generateVoice';
import { generateVideo } from './modules/video/generateVideo';
import { generateThumbnail } from './modules/thumbnail/generateThumbnail';
import { generateMetadata } from './modules/seo/generateMetadata';
import { uploadVideo } from './modules/youtube/uploadVideo';
import { fetchAnalytics } from './modules/analytics/fetchAnalytics';
import { optimizeNextRun } from './modules/optimizer/optimizeNextRun';
import { VideoProject } from './types/index';

const logger = new Logger('Main');

class YouTubeAutomationPipeline {
  private db: Database;
  private currentProject: VideoProject | null = null;

  constructor() {
    this.db = new Database();
  }

  async initialize(): Promise<void> {
    try {
      await this.db.connect();
      logger.info('Pipeline initialized');
    } catch (error) {
      logger.error('Failed to initialize pipeline', error);
      throw error;
    }
  }

  async executePipeline(): Promise<void> {
    try {
      logger.info('Starting YouTube automation pipeline');

      // 1. Fetch trends
      const trends = await fetchTrends();
      if (!trends.length) {
        logger.warn('No trends found');
        return;
      }

      // 2. Score and select topic
      const scoredTopics = await scoreTopics(trends);
      const selectedTopic = scoredTopics[0];

      if (!selectedTopic) {
        logger.warn('No suitable topics found');
        return;
      }

      logger.info(`Selected topic: ${selectedTopic.query} (score: ${selectedTopic.score})`);

      // 3. Generate script
      const script = await generateScript(selectedTopic);

      // 4. Generate voiceover
      const voiceoverPath = await generateVoice(script);

      // 5. Generate video
      const videoPath = await generateVideo({
        script,
        voiceoverPath,
        topic: selectedTopic
      });

      // 6. Generate thumbnail
      const thumbnailPath = await generateThumbnail({
        topic: selectedTopic,
        script,
        videoPath
      });

      // 7. Generate metadata
      const metadata = await generateMetadata({
        topic: selectedTopic,
        script,
        videoPath
      });

      // 8. Upload to YouTube
      const videoId = await uploadVideo({
        videoPath,
        thumbnailPath,
        metadata
      });

      if (!videoId) {
        logger.error('Failed to upload video');
        return;
      }

      logger.info(`Video uploaded successfully: ${videoId}`);

      // 9. Store project data
      this.currentProject = {
        id: crypto.randomUUID(),
        videoId,
        topic: selectedTopic,
        script,
        metadata,
        createdAt: new Date(),
        status: 'uploaded'
      };

      await this.db.saveProject(this.currentProject);

      // 10. Schedule analytics collection (after 24 hours)
      setTimeout(async () => {
        await this.collectAnalytics(videoId);
      }, 24 * 60 * 60 * 1000);

      logger.info('Pipeline completed successfully');

    } catch (error) {
      logger.error('Pipeline execution failed', error);
      throw error;
    }
  }

  async collectAnalytics(videoId: string): Promise<void> {
    try {
      const analytics = await fetchAnalytics(videoId);
      await this.db.saveAnalytics(videoId, analytics);
      if (!analytics) {
        logger.error('Failed to fetch analytics');
        return;
      }
      // 11. Optimize next run
      await optimizeNextRun(analytics);

    } catch (error) {
      logger.error('Analytics collection failed', error);
    }
  }

  async shutdown(): Promise<void> {
    await this.db.disconnect();
    logger.info('Pipeline shutdown complete');
  }
}

// Main execution
async function main() {
  const pipeline = new YouTubeAutomationPipeline();

  try {
    await pipeline.initialize();
    await pipeline.executePipeline();
  } catch (error) {
    logger.error('Fatal pipeline error', error);
    process.exit(1);
  } finally {
    await pipeline.shutdown();
    process.exit(0);
  }
}

// Run if this is the main module
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}

export { YouTubeAutomationPipeline };
