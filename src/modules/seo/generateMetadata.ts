import { Logger } from '../../utils/logger.js';
import { GeneratedScript } from '../script/generateScript.js';
import { ScoredTopic } from '../scoring/scoreTopics.js';
import { contentLimits } from '../../config/limits.config.js';
import { defaultChannelConfig } from '../../config/channel.config.js';

export interface VideoMetadata {
  title: string;
  description: string;
  tags: string[];
  categoryId: string;
  privacyStatus: 'public' | 'private' | 'unlisted';
  publishAt?: string;
  embeddable: boolean;
  license: 'youtube' | 'creativeCommon';
  publicStatsViewable: boolean;
  notForKids: boolean;
  hashtags: string[];
  defaultLanguage: string;
  defaultAudioLanguage: string;
}

const logger = new Logger('MetadataGenerator');

export class MetadataGenerator {
  private readonly YOUTUBE_CATEGORIES: Record<string, string> = {
    education: '27',
    technology: '28',
    howto: '26',
    science: '28'
  };

  private readonly COMMON_TAGS = [
    'tutorial', 'howto', 'guide', 'learn', 'education',
    'tips', 'tricks', 'beginners', 'advanced', 'explained'
  ];

  generateMetadata(options: {
    topic: ScoredTopic;
    script: GeneratedScript;
    videoPath: string;
  }): VideoMetadata {
    logger.info('Generating SEO metadata...');

    const { topic, script } = options;

    // Generate title
    const title = this.generateTitle(topic, script);

    // Generate description
    const description = this.generateDescription(topic, script);

    // Generate tags
    const tags = this.generateTags(topic, script);

    // Generate hashtags
    const hashtags = this.generateHashtags(topic);

    // Determine category
    const categoryId = this.determineCategory(topic);

    // Determine publish schedule
    const publishAt = this.calculatePublishTime();

    const metadata: VideoMetadata = {
      title,
      description,
      tags: tags.slice(0, contentLimits.maxTags),
      categoryId,
      privacyStatus: 'private', // Start as private, schedule for publishing
      publishAt,
      embeddable: true,
      license: 'youtube',
      publicStatsViewable: true,
      notForKids: true,
      hashtags: hashtags.slice(0, contentLimits.maxHashtags),
      defaultLanguage: defaultChannelConfig.language,
      defaultAudioLanguage: defaultChannelConfig.language.split('-')[0]
    };

    logger.info(`Metadata generated: "${title}"`);

    return metadata;
  }

  private generateTitle(topic: ScoredTopic, script: GeneratedScript): string {
    const titleTemplates = [
      `${topic.query} - Complete Guide ${new Date().getFullYear()}`,
      `How to ${topic.query} (Step-by-Step Tutorial)`,
      `Master ${topic.query} in 10 Minutes`,
      `${topic.query}: The Ultimate Guide`,
      `Learn ${topic.query} Fast (Beginner to Advanced)`
    ];

    const selectedTemplate = titleTemplates[Math.floor(Math.random() * titleTemplates.length)];

    // Ensure title length is optimal (60-70 characters for SEO)
    let title = selectedTemplate;
    if (title.length > 70) {
      title = title.substring(0, 67) + '...';
    }

    return title;
  }

  private generateDescription(topic: ScoredTopic, script: GeneratedScript): string {
    const descriptionParts: string[] = [];

    // Main description
    descriptionParts.push(
      `📚 Learn how to ${topic.query.toLowerCase()} with this complete tutorial!`
    );

    // Timestamps if video has clear segments
    if (script.segments.length > 3) {
      descriptionParts.push('\n⏰ TIMESTAMPS:');
      script.segments.forEach((segment, index) => {
        const timestamp = this.formatTimestamp(segment.startTime);
        descriptionParts.push(`${timestamp} - ${segment.type.toUpperCase()}`);
      });
    }

    // Key points
    descriptionParts.push('\n🔑 WHAT YOU\'LL LEARN:');
    script.segments
      .filter(s => s.type === 'explanation')
      .slice(0, 5)
      .forEach((segment, index) => {
        const keyPoint = segment.text.split('.')[0];
        if (keyPoint && keyPoint.length < 100) {
          descriptionParts.push(`• ${keyPoint}`);
        }
      });

    // Resources section
    descriptionParts.push('\n📦 RESOURCES & LINKS:');
    descriptionParts.push('• Subscribe for more content like this!');
    descriptionParts.push('• Like this video if you found it helpful');
    descriptionParts.push('• Comment below with questions or suggestions');

    // SEO keywords
    descriptionParts.push('\n🔍 RELATED SEARCHES:');
    const keywords = this.extractKeywords(topic.query);
    keywords.forEach(keyword => {
      descriptionParts.push(`#${keyword.replace(/\s+/g, '')}`);
    });

    // Legal disclaimer
    descriptionParts.push('\n⚠️ DISCLAIMER:');
    descriptionParts.push('This content is original and created for educational purposes.');
    descriptionParts.push('We do not use copyrighted material without permission.');
    descriptionParts.push('All automated content complies with YouTube policies.');

    // Channel info
    descriptionParts.push(`\n🎯 Channel: ${defaultChannelConfig.name}`);
    descriptionParts.push('Automated educational content system.');

    return descriptionParts.join('\n');
  }

  private formatTimestamp(seconds: number): string {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);

    if (hours > 0) {
      return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    } else {
      return `${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
  }

  private generateTags(topic: ScoredTopic, script: GeneratedScript): string[] {
    const tags = new Set<string>();

    // Add topic-based tags
    const topicWords = topic.query.toLowerCase().split(' ');
    topicWords.forEach(word => {
      if (word.length > 3 && !this.isStopWord(word)) {
        tags.add(word);
        tags.add(`${word} tutorial`);
        tags.add(`${word} guide`);
      }
    });

    // Add script-based tags
    script.targetKeywords.forEach(keyword => {
      tags.add(keyword);
      tags.add(`learn ${keyword}`);
      tags.add(`${keyword} for beginners`);
    });

    // Add common tags
    this.COMMON_TAGS.forEach(tag => tags.add(tag));

    // Add niche tags
    defaultChannelConfig.niche.forEach(niche => {
      tags.add(niche);
      tags.add(`${niche} education`);
    });

    // Add year tag
    tags.add(new Date().getFullYear().toString());

    return Array.from(tags);
  }

  private generateHashtags(topic: ScoredTopic): string[] {
    const hashtags = new Set<string>();

    // Main topic hashtag
    const mainHashtag = topic.query
      .toLowerCase()
      .replace(/[^\w\s]/g, '')
      .replace(/\s+/g, '');

    hashtags.add(mainHashtag);

    // Niche hashtags
    defaultChannelConfig.niche.forEach(niche => {
      hashtags.add(niche);
      hashtags.add(`learn${niche}`);
      hashtags.add(`${niche}tutorial`);
    });

    // Educational hashtags
    hashtags.add('education');
    hashtags.add('tutorial');
    hashtags.add('howto');
    hashtags.add('learning');

    return Array.from(hashtags);
  }

  private determineCategory(topic: ScoredTopic): string {
    for (const [niche, categoryId] of Object.entries(this.YOUTUBE_CATEGORIES)) {
      if (topic.query.toLowerCase().includes(niche) ||
          topic.category.toLowerCase().includes(niche)) {
        return categoryId;
      }
    }

    return '27'; // Default to Education
  }

  private calculatePublishTime(): string {
    if (!defaultChannelConfig.uploadSchedule.enabled) {
      return new Date(Date.now() + 3600000).toISOString(); // 1 hour from now
    }

    const now = new Date();
    const days = defaultChannelConfig.uploadSchedule.days;
    const times = defaultChannelConfig.uploadSchedule.times;

    // Find next scheduled time
    for (let i = 0; i < 7; i++) {
      const futureDate = new Date(now);
      futureDate.setDate(now.getDate() + i);

      if (days.includes(futureDate.getDay())) {
        for (const time of times) {
          const [hours, minutes] = time.split(':').map(Number);
          const publishDate = new Date(futureDate);
          publishDate.setHours(hours, minutes, 0, 0);

          if (publishDate > now) {
            return publishDate.toISOString();
          }
        }
      }
    }

    // Default to tomorrow at first scheduled time
    const tomorrow = new Date(now);
    tomorrow.setDate(now.getDate() + 1);
    const [hours, minutes] = times[0].split(':').map(Number);
    tomorrow.setHours(hours, minutes, 0, 0);

    return tomorrow.toISOString();
  }

  private extractKeywords(query: string): string[] {
    const words = query.toLowerCase().split(' ');
    const stopWords = ['the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for'];

    return words
      .filter(word => word.length > 3 && !stopWords.includes(word))
      .slice(0, 10);
  }

  private isStopWord(word: string): boolean {
    const stopWords = [
      'the', 'a', 'an', 'and', 'or', 'but', 'if', 'because',
      'as', 'what', 'which', 'this', 'that', 'these', 'those',
      'then', 'just', 'so', 'than', 'such', 'both', 'through',
      'about', 'for', 'is', 'of', 'while', 'during', 'to', 'from'
    ];

    return stopWords.includes(word.toLowerCase());
  }
}

export async function generateMetadata(options: {
  topic: ScoredTopic;
  script: GeneratedScript;
  videoPath: string;
}): Promise<VideoMetadata> {
  const generator = new MetadataGenerator();
  return generator.generateMetadata(options);
}
