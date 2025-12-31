import { Logger } from '../../utils/logger.js';
import { TrendData } from '../trends/fetchTrends.js';
import { monetizationConfig } from '../../config/monetization.config.js';

export interface ScoredTopic extends TrendData {
  score: number;
  viability: 'high' | 'medium' | 'low';
  monetizationPotential: number;
}

const logger = new Logger('TopicScorer');

export class TopicScorer {
  private readonly MIN_SEARCH_VOLUME = 1000;
  private readonly MAX_COMPETITION = 0.95;

  private calculateBaseScore(topic: TrendData): number {
    // Normalize values
    const normalizedVolume = Math.min(topic.searchVolume / 100000, 1);
    const normalizedRPM = topic.estimatedRPM / 10;
    const competitionFactor = 1 - topic.competition;

    // Weighted score formula
    return (normalizedVolume * 0.4 + normalizedRPM * 0.4 + competitionFactor * 0.2) * 100;
  }

  private assessViability(score: number): 'high' | 'medium' | 'low' {
    if (score >= 70) return 'high';
    if (score >= 40) return 'medium';
    return 'low';
  }

  private filterByMonetization(topic: TrendData): boolean {
    if (!monetizationConfig.enabled) return true;

    // Check RPM meets minimum
    if (topic.estimatedRPM < monetizationConfig.minimumRPM) {
      return false;
    }

    // Check against restricted topics
    const lowerQuery = topic.query.toLowerCase();
    for (const restricted of monetizationConfig.restrictedTopics) {
      if (lowerQuery.includes(restricted.toLowerCase())) {
        return false;
      }
    }

    return true;
  }

  private filterByContentRules(topic: TrendData): boolean {
    // Basic content filtering
    const lowerQuery = topic.query.toLowerCase();

    const blacklist = [
      'hack', 'crack', 'illegal', 'free download',
      'premium free', 'cheat', 'porn', 'adult'
    ];

    for (const term of blacklist) {
      if (lowerQuery.includes(term)) {
        return false;
      }
    }

    return true;
  }

  scoreTopics(topics: TrendData[]): ScoredTopic[] {
    logger.info(`Scoring ${topics.length} topics...`);

    const scoredTopics: ScoredTopic[] = [];

    for (const topic of topics) {
      // Apply filters
      if (!this.filterByContentRules(topic)) continue;
      if (!this.filterByMonetization(topic)) continue;
      if (topic.searchVolume < this.MIN_SEARCH_VOLUME) continue;
      if (topic.competition > this.MAX_COMPETITION) continue;

      const score = this.calculateBaseScore(topic);
      const viability = this.assessViability(score);

      scoredTopics.push({
        ...topic,
        score,
        viability,
        monetizationPotential: topic.estimatedRPM
      });
    }

    // Sort by score descending
    scoredTopics.sort((a, b) => b.score - a.score);

    logger.info(`Scored ${scoredTopics.length} viable topics`);

    return scoredTopics;
  }
}

export async function scoreTopics(topics: TrendData[]): Promise<ScoredTopic[]> {
  const scorer = new TopicScorer();
  return scorer.scoreTopics(topics);
}
