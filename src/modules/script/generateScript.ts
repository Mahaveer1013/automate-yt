import { Logger } from '../../utils/logger.js';
import { ScoredTopic } from '../scoring/scoreTopics.js';
import { contentLimits } from '../../config/limits.config.js';
import { defaultChannelConfig } from '../../config/channel.config.js';

export interface ScriptSegment {
  type: 'hook' | 'context' | 'explanation' | 'summary' | 'cta';
  startTime: number;
  endTime: number;
  duration: number;
  text: string;
  visualHint: string;
}

export interface GeneratedScript {
  id: string;
  topic: string;
  title: string;
  segments: ScriptSegment[];
  totalWords: number;
  estimatedDuration: number;
  targetKeywords: string[];
  timestamp: Date;
}

const logger = new Logger('ScriptGenerator');

export class ScriptGenerator {
  private readonly WORDS_PER_MINUTE = 150;
  private readonly SEGMENT_DURATIONS = {
    hook: { min: 5, max: 7 },
    context: { min: 7, max: 30 },
    explanation: { min: 60, max: 600 },
    summary: { min: 10, max: 20 },
    cta: { min: 5, max: 10 }
  };

  private generateHook(topic: string): string {
    const hooks = [
      `Have you ever wondered ${topic.toLowerCase()}?`,
      `What if I told you there's a better way to ${topic.toLowerCase()}?`,
      `In this video, I'm revealing the truth about ${topic.toLowerCase()}.`,
      `Stop wasting time! Here's how to ${topic.toLowerCase()} effectively.`,
      `The secret to ${topic.toLowerCase()} that nobody tells you about.`
    ];

    return hooks[Math.floor(Math.random() * hooks.length)];
  }

  private generateContext(topic: string): string {
    return `Before we dive in, let's understand why ${topic.toLowerCase()} matters.
    Many people struggle with this, but with the right approach, you can master it.
    I've spent years researching this topic, and today I'll share what really works.`;
  }

  private generateExplanation(topic: string): string[] {
    // In production, integrate with an LLM API like OpenAI
    // For this example, we'll generate structured content
    const paragraphs = [
      `First, let's break down the fundamentals of ${topic.toLowerCase()}.
      Understanding the basics is crucial for success.`,

      `Next, I'll show you the step-by-step process that actually works.
      Many tutorials skip these important details, but they're essential.`,

      `Here's a practical example to illustrate the concept.
      You can apply this immediately to see results.`,

      `Common mistakes to avoid when dealing with ${topic.toLowerCase()}.
      These pitfalls can save you hours of frustration.`
    ];

    return paragraphs;
  }

  private generateSummary(topic: string): string {
    return `To recap, mastering ${topic.toLowerCase()} requires understanding the basics,
    following a proven process, avoiding common mistakes, and applying what you learn.
    Remember, consistency is key.`;
  }

  private generateCTA(): string {
    const ctas = [
      `If you found this helpful, please like and subscribe for more content like this.
      Your support helps me create more valuable videos.`,

      `What topic should I cover next? Let me know in the comments below.
      Don't forget to hit the notification bell so you don't miss future videos.`,

      `Check out the description for additional resources and links.
      If you have questions, ask them in the comments and I'll do my best to help.`
    ];

    return ctas[Math.floor(Math.random() * ctas.length)];
  }

  private calculateSegmentDuration(wordCount: number): number {
    // Assuming 150 words per minute = 2.5 words per second
    return Math.ceil(wordCount / 2.5);
  }

  async generateScript(topic: ScoredTopic): Promise<GeneratedScript> {
    logger.info(`Generating script for: ${topic.query}`);

    const hook = this.generateHook(topic.query);
    const context = this.generateContext(topic.query);
    const explanation = this.generateExplanation(topic.query);
    const summary = this.generateSummary(topic.query);
    const cta = this.generateCTA();

    const segments: ScriptSegment[] = [];
    let currentTime = 0;

    // Hook segment
    const hookDuration = this.calculateSegmentDuration(hook.split(' ').length);
    segments.push({
      type: 'hook',
      startTime: currentTime,
      endTime: currentTime + hookDuration,
      duration: hookDuration,
      text: hook,
      visualHint: 'attention_grabber'
    });
    currentTime += hookDuration;

    // Context segment
    const contextDuration = this.calculateSegmentDuration(context.split(' ').length);
    segments.push({
      type: 'context',
      startTime: currentTime,
      endTime: currentTime + contextDuration,
      duration: contextDuration,
      text: context,
      visualHint: 'explanation_visual'
    });
    currentTime += contextDuration;

    // Explanation segments
    for (const [index, paragraph] of explanation.entries()) {
      const explanationDuration = this.calculateSegmentDuration(paragraph.split(' ').length);
      segments.push({
        type: 'explanation',
        startTime: currentTime,
        endTime: currentTime + explanationDuration,
        duration: explanationDuration,
        text: paragraph,
        visualHint: `step_${index + 1}`
      });
      currentTime += explanationDuration;
    }

    // Summary segment
    const summaryDuration = this.calculateSegmentDuration(summary.split(' ').length);
    segments.push({
      type: 'summary',
      startTime: currentTime,
      endTime: currentTime + summaryDuration,
      duration: summaryDuration,
      text: summary,
      visualHint: 'recap_visual'
    });
    currentTime += summaryDuration;

    // CTA segment
    const ctaDuration = this.calculateSegmentDuration(cta.split(' ').length);
    segments.push({
      type: 'cta',
      startTime: currentTime,
      endTime: currentTime + ctaDuration,
      duration: ctaDuration,
      text: cta,
      visualHint: 'end_screen'
    });
    currentTime += ctaDuration;

    const totalWords = segments.reduce((sum, seg) => sum + seg.text.split(' ').length, 0);

    const script: GeneratedScript = {
      id: crypto.randomUUID(),
      topic: topic.query,
      title: `${topic.query} - Complete Guide & Tutorial`,
      segments,
      totalWords,
      estimatedDuration: currentTime,
      targetKeywords: this.extractKeywords(topic.query),
      timestamp: new Date()
    };

    // Validate script length
    if (totalWords > contentLimits.maxScriptLength) {
      logger.warn(`Script exceeds maximum length: ${totalWords} words`);
      // In production, implement truncation logic
    }

    logger.info(`Script generated: ${totalWords} words, ${currentTime}s duration`);

    return script;
  }

  private extractKeywords(query: string): string[] {
    const words = query.toLowerCase().split(' ');
    const stopWords = ['the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by'];

    return words
      .filter(word => word.length > 3 && !stopWords.includes(word))
      .slice(0, contentLimits.maxKeywords);
  }
}

export async function generateScript(topic: ScoredTopic): Promise<GeneratedScript> {
  const generator = new ScriptGenerator();
  return generator.generateScript(topic);
}
