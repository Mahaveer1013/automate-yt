import { exec } from 'child_process';
import { promises as fs } from 'fs';
import { promisify } from 'util';
import path from 'path';
import { Logger } from '../../utils/logger.js';
import { GeneratedScript } from '../script/generateScript.js';
import { ScoredTopic } from '../scoring/scoreTopics.js';

const execAsync = promisify(exec);
const logger = new Logger('VideoGenerator');

export interface VideoGenerationOptions {
  script: GeneratedScript;
  voiceoverPath: string;
  topic: ScoredTopic;
  resolution?: { width: number; height: number };
  framerate?: number;
}

export class VideoGenerator {
  private outputDir = process.env.OUTPUT_PATH || './output';
  private assetsDir = process.env.ASSETS_PATH || './src/assets';

  constructor() {
    fs.mkdir(this.outputDir, { recursive: true }).catch(() => {});
  }

  async generateVideo(options: VideoGenerationOptions): Promise<string> {
    logger.info('Generating video...');

    const {
      script,
      voiceoverPath,
      topic,
      resolution = { width: 1920, height: 1080 },
      framerate = 30
    } = options;

    const videoId = script.id;
    const outputPath = path.join(this.outputDir, `${videoId}_video.mp4`);

    try {
      // Step 1: Prepare assets
      const assets = await this.prepareAssets(script);

      // Step 2: Generate captions file
      const captionsPath = await this.generateCaptions(script, videoId);

      // Step 3: Create video with ffmpeg
      await this.renderWithFFmpeg({
        voiceoverPath,
        assets,
        captionsPath,
        outputPath,
        resolution,
        framerate,
        duration: script.estimatedDuration
      });

      // Step 4: Verify output
      const stats = await fs.stat(outputPath);
      if (stats.size === 0) {
        throw new Error('Generated video file is empty');
      }

      logger.info(`Video generated: ${outputPath} (${stats.size} bytes)`);
      return outputPath;

    } catch (error) {
      logger.error('Video generation failed', error);
      throw error;
    }
  }

  private async prepareAssets(script: GeneratedScript): Promise<string[]> {
    const assets: string[] = [];

    // In production, fetch relevant stock videos/images based on script
    // For this example, we'll create placeholder assets

    for (let i = 0; i < script.segments.length; i++) {
      const segment = script.segments[i];
      const assetPath = path.join(this.outputDir, `${script.id}_segment_${i}.png`);

      // Create a simple image with text overlay for each segment
      await this.createSegmentImage(segment, assetPath, i);
      assets.push(assetPath);
    }

    return assets;
  }

  private async createSegmentImage(segment: any, outputPath: string, index: number): Promise<void> {
    const text = segment.text.substring(0, 100).replace(/[^\w\s]/g, '');
    const bgColor = this.getSegmentColor(segment.type);

    // Create image with ImageMagick or a simple approach
    const command = `convert -size 1920x1080 xc:${bgColor} \
      -font Arial -pointsize 72 -fill white -gravity center \
      -annotate +0+0 "Segment ${index + 1}\\n${segment.type}\\n\\n${text}" \
      "${outputPath}"`;

    try {
      await execAsync(command);
    } catch (error) {
      // If ImageMagick isn't available, create a blank image
      await execAsync(`ffmpeg -f lavfi -i color=c=${bgColor}:s=1920x1080:d=1 -frames:v 1 "${outputPath}"`);
    }
  }

  private getSegmentColor(type: string): string {
    const colors: Record<string, string> = {
      hook: 'darkblue',
      context: 'darkgreen',
      explanation: 'darkred',
      summary: 'darkorange',
      cta: 'darkviolet'
    };
    return colors[type] || 'black';
  }

  private async generateCaptions(script: GeneratedScript, videoId: string): Promise<string> {
    const captionsPath = path.join(this.outputDir, `${videoId}_captions.srt`);
    let captionsContent = '';
    let captionIndex = 1;

    for (const segment of script.segments) {
      const startTime = this.formatTime(segment.startTime);
      const endTime = this.formatTime(segment.endTime);

      captionsContent += `${captionIndex}\n`;
      captionsContent += `${startTime} --> ${endTime}\n`;
      captionsContent += `${segment.text}\n\n`;

      captionIndex++;
    }

    await fs.writeFile(captionsPath, captionsContent);
    return captionsPath;
  }

  private formatTime(seconds: number): string {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);
    const ms = Math.floor((seconds % 1) * 1000);

    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')},${ms.toString().padStart(3, '0')}`;
  }

  private async renderWithFFmpeg(options: {
    voiceoverPath: string;
    assets: string[];
    captionsPath: string;
    outputPath: string;
    resolution: { width: number; height: number };
    framerate: number;
    duration: number;
  }): Promise<void> {
    const {
      voiceoverPath,
      assets,
      captionsPath,
      outputPath,
      resolution,
      framerate,
      duration
    } = options;

    // Calculate segment durations
    const segmentDurations = assets.map((_, i) => {
      // Simple distribution - in production, match script segment durations
      return 2; // 2 seconds per image
    });

    // Build ffmpeg command
    let filterComplex = '';
    let inputs = '';
    let filterCount = 0;

    // Add image inputs
    for (let i = 0; i < assets.length; i++) {
      inputs += `-loop 1 -t ${segmentDurations[i]} -i "${assets[i]}" `;
      filterComplex += `[${i}:v]setpts=PTS-STARTPTS[v${i}];`;
      filterCount++;
    }

    // Add audio input
    inputs += `-i "${voiceoverPath}" `;

    // Concatenate videos
    let concatInputs = '';
    for (let i = 0; i < assets.length; i++) {
      concatInputs += `[v${i}]`;
    }
    filterComplex += `${concatInputs}concat=n=${assets.length}:v=1:a=0[outv];`;

    // Add background music if available
    const musicPath = path.join(this.assetsDir, 'music', 'background.mp3');
    let audioFilter = '';

    try {
      await fs.access(musicPath);
      inputs += `-i "${musicPath}" `;

      // Mix voiceover with background music
      audioFilter = `;[${assets.length}:a]volume=0.3[music];[${assets.length + 1}:a]volume=0.1[bg];[music][bg]amix=inputs=2:duration=longest[aout]`;
      filterComplex += audioFilter;

    } catch {
      // No background music, use only voiceover
      filterComplex += `[${assets.length}:a]volume=1.0[aout]`;
    }

    // Add captions
    filterComplex += `;[outv]subtitles='${captionsPath.replace(/'/g, "'\\''")}':force_style='FontName=Arial,FontSize=24,PrimaryColour=&HFFFFFF&'[finalv]`;

    // Build final command
    const command = `ffmpeg ${inputs} \
      -filter_complex "${filterComplex}" \
      -map "[finalv]" -map "[aout]" \
      -c:v libx264 -preset medium -crf 23 \
      -c:a aac -b:a 192k \
      -r ${framerate} -s ${resolution.width}x${resolution.height} \
      -pix_fmt yuv420p \
      -shortest \
      -y "${outputPath}"`;

    logger.debug('FFmpeg command:', command);
    await execAsync(command, { timeout: 300000 }); // 5 minute timeout
  }
}

export async function generateVideo(options: VideoGenerationOptions): Promise<string> {
  const generator = new VideoGenerator();
  return generator.generateVideo(options);
}
