import { exec } from 'child_process';
import { promises as fs } from 'fs';
import { promisify } from 'util';
import path from 'path';
import { Logger } from '../../utils/logger.js';
import { GeneratedScript } from '../script/generateScript.js';

const execAsync = promisify(exec);
const logger = new Logger('VoiceGenerator');

export class VoiceGenerator {
  private outputDir = process.env.OUTPUT_PATH || './output';
  private assetsDir = process.env.ASSETS_PATH || './src/assets';

  constructor() {
    // Ensure output directory exists
    fs.mkdir(this.outputDir, { recursive: true }).catch(() => {});
  }

  async generateVoice(script: GeneratedScript): Promise<string> {
    logger.info('Generating voiceover...');

    const outputPath = path.join(this.outputDir, `${script.id}_voice.mp3`);

    try {
      // In production, integrate with a TTS service like:
      // 1. Google Cloud Text-to-Speech
      // 2. Amazon Polly
      // 3. ElevenLabs

      // For this example, we'll use system TTS or a mock
      await this.generateWithFFmpegTTS(script, outputPath);

      // Verify file was created
      const stats = await fs.stat(outputPath);
      if (stats.size === 0) {
        throw new Error('Generated voice file is empty');
      }

      logger.info(`Voiceover generated: ${outputPath} (${stats.size} bytes)`);
      return outputPath;

    } catch (error) {
      logger.error('Voice generation failed', error);

      // Fallback: create a silent audio file with the correct duration
      await this.createFallbackAudio(script.estimatedDuration, outputPath);

      logger.warn(`Using fallback audio for ${script.estimatedDuration}s`);
      return outputPath;
    }
  }

  private async generateWithFFmpegTTS(script: GeneratedScript, outputPath: string): Promise<void> {
    const fullText = script.segments.map(s => s.text).join(' ');

    // On macOS, we can use the built-in 'say' command
    // On Linux, install espeak or another TTS engine
    // This is a cross-platform example using a simple approach

    const platform = process.platform;

    if (platform === 'darwin') {
      // macOS
      await execAsync(`say -v Samantha -o ${outputPath} "${fullText.replace(/"/g, '\\"')}"`);
    } else if (platform === 'linux') {
      // Linux with espeak
      const tempFile = path.join(this.outputDir, `${script.id}_temp.wav`);
      await execAsync(`espeak -v en-us -w ${tempFile} "${fullText.replace(/"/g, '\\"')}"`);
      await execAsync(`ffmpeg -i ${tempFile} -codec:a libmp3lame -qscale:a 2 ${outputPath}`);
      await fs.unlink(tempFile).catch(() => {});
    } else {
      // Windows or other - use PowerShell TTS
      // Create a PowerShell script for TTS
      const psScript = path.join(this.outputDir, `${script.id}_tts.ps1`);
      const psContent = `Add-Type -AssemblyName System.Speech\n$speak = New-Object System.Speech.Synthesis.SpeechSynthesizer\n$speak.SetOutputToWaveFile("${outputPath.replace('.mp3', '.wav')}")\n$speak.Speak("${fullText.replace(/"/g, '\\"')}")\n$speak.Dispose()`;

      await fs.writeFile(psScript, psContent);
      await execAsync(`powershell -ExecutionPolicy Bypass -File "${psScript}"`);
      await fs.unlink(psScript).catch(() => {});

      // Convert WAV to MP3
      if (await this.fileExists(outputPath.replace('.mp3', '.wav'))) {
        await execAsync(`ffmpeg -i "${outputPath.replace('.mp3', '.wav')}" -codec:a libmp3lame -qscale:a 2 "${outputPath}"`);
        await fs.unlink(outputPath.replace('.mp3', '.wav')).catch(() => {});
      }
    }
  }

  private async createFallbackAudio(duration: number, outputPath: string): Promise<void> {
    // Create silent audio with ffmpeg
    await execAsync(
      `ffmpeg -f lavfi -i anullsrc=r=44100:cl=stereo -t ${duration} -c:a libmp3lame -qscale:a 2 "${outputPath}"`
    );
  }

  private async fileExists(filePath: string): Promise<boolean> {
    try {
      await fs.access(filePath);
      return true;
    } catch {
      return false;
    }
  }
}

export async function generateVoice(script: GeneratedScript): Promise<string> {
  const generator = new VoiceGenerator();
  return generator.generateVoice(script);
}
