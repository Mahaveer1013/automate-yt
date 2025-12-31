export interface ChannelConfig {
  id: string;
  name: string;
  niche: string[];
  targetRegions: string[];
  language: string;
  uploadSchedule: {
    enabled: boolean;
    times: string[]; // ["10:00", "18:00"]
    days: number[]; // [1, 3, 5] for Mon, Wed, Fri
  };
  contentRules: {
    minDuration: number; // seconds
    maxDuration: number;
    maxVideosPerWeek: number;
    allowMonetization: boolean;
  };
}

export const defaultChannelConfig: ChannelConfig = {
  id: process.env.YOUTUBE_CHANNEL_ID || '',
  name: 'Automated Content Channel',
  niche: ['education', 'technology', 'explainer'],
  targetRegions: ['US', 'GB', 'CA', 'AU'],
  language: 'en-US',
  uploadSchedule: {
    enabled: true,
    times: ['10:00', '18:00'],
    days: [1, 3, 5]
  },
  contentRules: {
    minDuration: 180, // 3 minutes
    maxDuration: 900, // 15 minutes
    maxVideosPerWeek: 3,
    allowMonetization: true
  }
};
