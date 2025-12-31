import { Logger } from '../../utils/logger.js';
import { VideoAnalytics } from '../analytics/fetchAnalytics.js';
import { Database } from '../../state/database.js';

const logger = new Logger('PipelineOptimizer');

export interface OptimizationResult {
  actions: string[];
  changes: Record<string, any>;
  nextRunImprovements: string[];
}

export class PipelineOptimizer {
  private db: Database;

  // Thresholds from environment or defaults
  private readonly MIN_CTR_TARGET = parseFloat(process.env.MINIMUM_CTR_TARGET || '0.04');
  private readonly MIN_RETENTION_TARGET = parseFloat(process.env.MINIMUM_RETENTION_TARGET || '0.6');
  private readonly MIN_RPM_TARGET = parseFloat(process.env.MINIMUM_RPM_TARGET || '2.0');

  constructor() {
    this.db = new Database();
  }

  async optimizeNextRun(analytics: VideoAnalytics): Promise<OptimizationResult> {
    logger.info('Analyzing performance data for optimization...');

    const result: OptimizationResult = {
      actions: [],
      changes: {},
      nextRunImprovements: []
    };

    // Analyze CTR
    const ctr = analytics.impressionsClickThroughRate / 100;
    if (ctr < this.MIN_CTR_TARGET) {
      result.actions.push('CHANGE_THUMBNAIL_STRATEGY');
      result.changes.thumbnailStrategy = 'high_contrast_with_text';
      result.nextRunImprovements.push(
        'Increase thumbnail contrast',
        'Add more compelling text',
        'Use brighter colors',
        'Test human faces in thumbnails'
      );
    }

    // Analyze retention (average view percentage)
    const retention = analytics.averageViewPercentage / 100;
    if (retention < this.MIN_RETENTION_TARGET) {
      result.actions.push('SHORTEN_HOOK');
      result.actions.push('IMPROVE_CONTENT_STRUCTURE');

      result.changes.hookDuration = '5-7 seconds';
      result.changes.contentStructure = 'shorter_segments';

      result.nextRunImprovements.push(
        'Make hook more engaging in first 5 seconds',
        'Break content into smaller, digestible segments',
        'Add more visual variety',
        'Improve pacing'
      );
    }

    // Analyze RPM/CPM
    const rpm = analytics.cpm / 1000; // Convert CPM to RPM
    if (rpm < this.MIN_RPM_TARGET) {
      result.actions.push('ADJUST_TOPIC_SELECTION');
      result.changes.topicSelectionCriteria = 'higher_RPM_topics';
      result.nextRunImprovements.push(
        'Focus on higher-value niches',
        'Target topics with commercial intent',
        'Research competitor RPM performance'
      );
    }

    // Analyze engagement
    const engagementRate = (analytics.likes + analytics.comments + analytics.shares) / analytics.views;
    if (engagementRate < 0.02) { // 2% engagement rate target
      result.actions.push('IMPROVE_CTA');
      result.changes.ctaStrategy = 'clearer_calls_to_action';
      result.nextRunImprovements.push(
        'Add clearer like/subscribe prompts',
        'Ask specific questions in comments',
        'Create stronger end screens'
      );
    }

    // Store optimization results
    await this.db.saveOptimizationResult(analytics.videoId, result);

    // Update scoring weights based on performance
    await this.updateScoringWeights(analytics, result);

    logger.info(`Optimization complete: ${result.actions.length} actions recommended`);

    return result;
  }

  private async updateScoringWeights(analytics: VideoAnalytics, result: OptimizationResult): Promise<void> {
    const weights = await this.db.getScoringWeights();

    // Adjust weights based on performance
    if (result.actions.includes('CHANGE_THUMBNAIL_STRATEGY')) {
      // Thumbnail quality is important
      await this.db.updateScoringWeight('thumbnailQuality', weights.thumbnailQuality + 0.1);
    }

    if (result.actions.includes('ADJUST_TOPIC_SELECTION')) {
      // RPM is more important than we thought
      await this.db.updateScoringWeight('estimatedRPM', weights.estimatedRPM + 0.15);
      await this.db.updateScoringWeight('searchVolume', weights.searchVolume - 0.05);
    }

    if (analytics.averageViewDuration > 180) { // Good retention (>3 min)
      // Content length is working
      await this.db.updateScoringWeight('contentDepth', weights.contentDepth + 0.1);
    }
  }

  generateRecommendationReport(analytics: VideoAnalytics, result: OptimizationResult): string {
    const report = [
      '📊 PERFORMANCE OPTIMIZATION REPORT',
      `Video: ${analytics.videoId}`,
      `Date: ${new Date().toISOString()}`,
      '',
      '📈 PERFORMANCE METRICS:',
      `• CTR: ${(analytics.impressionsClickThroughRate || 0).toFixed(2)}%`,
      `• Average View %: ${(analytics.averageViewPercentage || 0).toFixed(1)}%`,
      `• RPM: $${((analytics.cpm || 0) / 1000).toFixed(2)}`,
      `• Engagement Rate: ${(((analytics.likes + analytics.comments + analytics.shares) / analytics.views) * 100 || 0).toFixed(2)}%`,
      '',
      '🎯 RECOMMENDED ACTIONS:'
    ];

    if (result.actions.length > 0) {
      result.actions.forEach((action, index) => {
        report.push(`${index + 1}. ${this.formatAction(action)}`);
      });
    } else {
      report.push('✅ All metrics meet targets. Continue current strategy.');
    }

    if (result.nextRunImprovements.length > 0) {
      report.push('', '💡 NEXT RUN IMPROVEMENTS:');
      result.nextRunImprovements.forEach((improvement, index) => {
        report.push(`• ${improvement}`);
      });
    }

    return report.join('\n');
  }

  private formatAction(action: string): string {
    const actionMap: Record<string, string> = {
      'CHANGE_THUMBNAIL_STRATEGY': 'Update thumbnail design strategy',
      'SHORTEN_HOOK': 'Reduce video hook duration',
      'IMPROVE_CONTENT_STRUCTURE': 'Restructure content for better retention',
      'ADJUST_TOPIC_SELECTION': 'Modify topic selection criteria',
      'IMPROVE_CTA': 'Enhance calls to action'
    };

    return actionMap[action] || action;
  }
}

export async function optimizeNextRun(analytics: VideoAnalytics): Promise<OptimizationResult> {
  const optimizer = new PipelineOptimizer();
  return optimizer.optimizeNextRun(analytics);
}
