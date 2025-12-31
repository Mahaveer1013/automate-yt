export interface MonetizationConfig {
  enabled: boolean;
  targetRPM: number;
  minimumRPM: number;
  adPlacements: {
    preRoll: boolean;
    midRoll: boolean;
    postRoll: boolean;
  };
  contentCategories: string[];
  restrictedTopics: string[];
  partnerCompliance: {
    noCopyrightInfringement: boolean;
    noReusedContent: boolean;
    familySafe: boolean;
    noHarmfulContent: boolean;
  };
}

export const monetizationConfig: MonetizationConfig = {
  enabled: parseFloat(process.env.MINIMUM_RPM_TARGET || '2.0') > 0,
  targetRPM: 5.0,
  minimumRPM: parseFloat(process.env.MINIMUM_RPM_TARGET || '2.0'),
  adPlacements: {
    preRoll: true,
    midRoll: true,
    postRoll: true
  },
  contentCategories: ['Education', 'Science & Technology', 'Howto & Style'],
  restrictedTopics: [
    'sensitive events',
    'harmful acts',
    'regulated goods',
    'misinformation'
  ],
  partnerCompliance: {
    noCopyrightInfringement: true,
    noReusedContent: false, // Our content is original
    familySafe: true,
    noHarmfulContent: true
  }
};
