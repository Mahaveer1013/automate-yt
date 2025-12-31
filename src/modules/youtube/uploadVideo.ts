import { google } from 'googleapis';
import { createReadStream } from 'node:fs';
import * as fs from 'node:fs/promises';
import { Logger } from '../../utils/logger.js';
import { retryWithBackoff } from '../../utils/retry.js';
import { VideoMetadata } from '../seo/generateMetadata.js';

const logger = new Logger('YouTubeUploader');

export interface UploadOptions {
  videoPath: string;
  thumbnailPath: string;
  metadata: VideoMetadata;
}

export class YouTubeUploader {
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

      this.youtube = google.youtube({
        version: 'v3',
        auth
      });

      this.initialized = true;
      logger.info('YouTube API initialized');
    } catch (error) {
      logger.error('Failed to initialize YouTube API', error);
      throw error;
    }
  }

  async uploadVideo(options: UploadOptions): Promise<string | null> {
    await this.initialize();

    const { videoPath, thumbnailPath, metadata } = options;

    logger.info(`Uploading video: ${metadata.title}`);

    try {
      // Step 1: Upload video
      const videoId = await this.uploadVideoFile(videoPath, metadata);

      if (!videoId) {
        throw new Error('Video upload failed');
      }

      // Step 2: Set thumbnail
      await this.setThumbnail(videoId, thumbnailPath);

      // Step 3: Update video metadata if needed
      await this.updateVideoMetadata(videoId, metadata);

      logger.info(`Video uploaded successfully: ${videoId}`);

      return videoId;

    } catch (error) {
      logger.error('Video upload failed', error);
      return null;
    }
  }

  private async uploadVideoFile(
    videoPath: string,
    metadata: VideoMetadata
  ): Promise<string | null> {
    return retryWithBackoff(async () => {
      const fileSize = (await fs.stat(videoPath)).size;

      const res = await this.youtube.videos.insert({
        part: ['snippet', 'status'],
        requestBody: {
          snippet: {
            title: metadata.title,
            description: metadata.description,
            tags: metadata.tags,
            categoryId: metadata.categoryId,
            defaultLanguage: metadata.defaultLanguage,
            defaultAudioLanguage: metadata.defaultAudioLanguage
          },
          status: {
            privacyStatus: metadata.privacyStatus,
            publishAt: metadata.publishAt,
            embeddable: metadata.embeddable,
            license: metadata.license,
            publicStatsViewable: metadata.publicStatsViewable,
            selfDeclaredMadeForKids: !metadata.notForKids
          }
        },
        media: {
          body: createReadStream(videoPath),
          mimeType: 'video/mp4'
        }
      });

      return res.data.id ?? null;
    }, 3);
  }


  private async setThumbnail(
    videoId: string,
    thumbnailPath: string
  ): Promise<void> {
    return retryWithBackoff(async () => {
      await this.youtube.thumbnails.set({
        videoId,
        media: {
          body: createReadStream(thumbnailPath),
          mimeType: 'image/png'
        }
      });

      logger.info(`Thumbnail set for video ${videoId}`);
    }, 3);
  }


  private async updateVideoMetadata(videoId: string, metadata: VideoMetadata): Promise<void> {
    return retryWithBackoff(async () => {
      await this.youtube.videos.update({
        part: 'snippet',
        requestBody: {
          id: videoId,
          snippet: {
            title: metadata.title,
            description: metadata.description + this.addHashtagsToDescription(metadata.hashtags),
            tags: metadata.tags,
            categoryId: metadata.categoryId
          }
        }
      });
    }, 3);
  }

  private addHashtagsToDescription(hashtags: string[]): string {
    if (hashtags.length === 0) return '';

    const hashtagString = hashtags.map(tag => `#${tag}`).join(' ');
    return `\n\n${hashtagString}`;
  }

  async checkQuota(): Promise<{ used: number; total: number }> {
    await this.initialize();

    try {
      // Note: YouTube API doesn't provide quota usage via API
      // This is a placeholder for manual quota tracking
      return {
        used: 0,
        total: parseInt(process.env.YOUTUBE_API_MAX_CALLS_PER_DAY || '10000')
      };
    } catch (error) {
      logger.error('Failed to check quota', error);
      return { used: 0, total: 10000 };
    }
  }
}

export async function uploadVideo(options: UploadOptions): Promise<string | null> {
  const uploader = new YouTubeUploader();
  return uploader.uploadVideo(options);
}
