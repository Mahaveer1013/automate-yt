import { exec } from 'child_process';
import { promises as fs } from 'fs';
import { promisify } from 'util';
import path from 'path';
import { Logger } from '../../utils/logger.js';
import { GeneratedScript } from '../script/generateScript.js';
import { ScoredTopic } from '../scoring/scoreTopics.js';

const execAsync = promisify(exec);
const logger = new Logger('ThumbnailGenerator');

export interface ThumbnailOptions {
  topic: ScoredTopic;
  script: GeneratedScript;
  videoPath: string;
  style?: 'minimal' | 'bold' | 'contrast' | 'gradient';
}

export class ThumbnailGenerator {
  private outputDir = process.env.OUTPUT_PATH || './output';
  private assetsDir = process.env.ASSETS_PATH || './src/assets';
  private width = parseInt(process.env.THUMBNAIL_WIDTH || '1280');
  private height = parseInt(process.env.THUMBNAIL_HEIGHT || '720');

  constructor() {
    fs.mkdir(this.outputDir, { recursive: true }).catch(() => {});
  }

  async generateThumbnail(options: ThumbnailOptions): Promise<string> {
    logger.info('Generating thumbnail...');

    const { topic, script, videoPath, style = 'bold' } = options;
    const thumbnailPath = path.join(this.outputDir, `${script.id}_thumbnail.png`);

    try {
      // Extract a frame from video for background
      const framePath = await this.extractVideoFrame(videoPath);

      // Generate thumbnail with overlay
      await this.createThumbnailWithOverlay(framePath, thumbnailPath, topic, style);

      // Clean up temporary frame
      await fs.unlink(framePath).catch(() => {});

      // Verify thumbnail
      const stats = await fs.stat(thumbnailPath);
      if (stats.size === 0) {
        throw new Error('Generated thumbnail is empty');
      }

      logger.info(`Thumbnail generated: ${thumbnailPath}`);
      return thumbnailPath;

    } catch (error) {
      logger.error('Thumbnail generation failed', error);

      // Generate a simple thumbnail as fallback
      await this.generateFallbackThumbnail(thumbnailPath, topic);
      return thumbnailPath;
    }
  }

  private async extractVideoFrame(videoPath: string): Promise<string> {
    const framePath = path.join(this.outputDir, `frame_${Date.now()}.jpg`);

    // Extract frame at 10% into the video
    await execAsync(
      `ffmpeg -i "${videoPath}" -ss 00:00:02 -vframes 1 -q:v 2 "${framePath}"`
    );

    return framePath;
  }

  private async createThumbnailWithOverlay(
    backgroundPath: string,
    outputPath: string,
    topic: ScoredTopic,
    style: string
  ): Promise<void> {
    const title = this.createThumbnailTitle(topic.query);
    const colorScheme = this.getColorScheme(style);

    // Create thumbnail using ImageMagick
    const command = `convert "${backgroundPath}" \
      -resize ${this.width}x${this.height}^ -gravity center -extent ${this.width}x${this.height} \
      -fill "${colorScheme.overlay}" -colorize 30% \
      -fill white -font Arial -pointsize 60 -gravity north \
      -annotate +0+100 "🎬 ${title}" \
      -fill "${colorScheme.accent}" -font Arial-Bold -pointsize 90 -gravity center \
      -annotate +0+0 "${topic.query}" \
      -fill white -font Arial -pointsize 36 -gravity south \
      -annotate +0+100 "▶ WATCH NOW • COMPLETE GUIDE" \
      -fill "${colorScheme.accent}" -strokewidth 2 -draw "rectangle 100,$((${this.height}-150)) $((${this.width}-100)),$((${this.height}-120))" \
      "${outputPath}"`;

    try {
      await execAsync(command);
    } catch (error) {
      logger.warn('ImageMagick failed, using ffmpeg fallback');
      await this.createThumbnailWithFFmpeg(backgroundPath, outputPath, topic);
    }
  }

  private createThumbnailTitle(query: string): string {
    const prefixes = ['How to', 'Complete Guide to', 'Master', 'Learn', 'Discover'];
    const suffix = prefixes[Math.floor(Math.random() * prefixes.length)];

    if (query.length > 40) {
      return query.substring(0, 40) + '...';
    }

    return query;
  }

  private getColorScheme(style: string): { primary: string; accent: string; overlay: string } {
    const schemes: Record<string, { primary: string; accent: string; overlay: string }> = {
      minimal: { primary: '#000000', accent: '#333333', overlay: 'rgba(0,0,0,0.3)' },
      bold: { primary: '#FF0000', accent: '#FF5722', overlay: 'rgba(255,0,0,0.2)' },
      contrast: { primary: '#2196F3', accent: '#FFC107', overlay: 'rgba(33,150,243,0.2)' },
      gradient: { primary: '#9C27B0', accent: '#673AB7', overlay: 'rgba(156,39,176,0.2)' }
    };

    return schemes[style] || schemes.bold;
  }

  private async createThumbnailWithFFmpeg(
    backgroundPath: string,
    outputPath: string,
    topic: ScoredTopic
  ): Promise<void> {
    const text = topic.query;

    // Create a simple thumbnail with ffmpeg
    const command = `ffmpeg -i "${backgroundPath}" \
      -vf "drawtext=text='${text}':fontcolor=white:fontsize=60:box=1:boxcolor=black@0.5:boxborderw=5:x=(w-text_w)/2:y=(h-text_h)/2" \
      -frames:v 1 "${outputPath}"`;

    await execAsync(command);
  }

  private async generateFallbackThumbnail(outputPath: string, topic: ScoredTopic): Promise<void> {
    const color = this.getRandomColor();
    const text = topic.query.substring(0, 50);

    const command = `ffmpeg -f lavfi -i color=c=${color}:s=${this.width}x${this.height}:d=1 \
      -vf "drawtext=text='${text}':fontcolor=white:fontsize=48:box=1:boxcolor=black@0.5:boxborderw=10:x=(w-text_w)/2:y=(h-text_h)/2" \
      -frames:v 1 "${outputPath}"`;

    await execAsync(command);
  }

  private getRandomColor(): string {
    const colors = ['red', 'blue', 'green', 'purple', 'orange', 'teal'];
    return colors[Math.floor(Math.random() * colors.length)];
  }
}

export async function generateThumbnail(options: ThumbnailOptions): Promise<string> {
  const generator = new ThumbnailGenerator();
  return generator.generateThumbnail(options);
}
