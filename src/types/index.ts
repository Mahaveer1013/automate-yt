export interface VideoProject {
  id: string;
  videoId: string;
  topic: any;
  script: any;
  metadata: any;
  createdAt: Date;
  status: 'pending' | 'processing' | 'uploaded' | 'published' | 'failed';
}

export interface PipelineState {
  currentStep: number;
  totalSteps: number;
  status: 'idle' | 'running' | 'paused' | 'completed' | 'failed';
  currentProject: VideoProject | null;
  lastError: string | null;
  startTime: Date | null;
  endTime: Date | null;
}

export interface SystemMetrics {
  cpuUsage: number;
  memoryUsage: number;
  diskUsage: number;
  activeProcesses: number;
  uptime: number;
}

export interface ComplianceCheck {
  copyrightClear: boolean;
  policyCompliant: boolean;
  monetizationEligible: boolean;
  checks: {
    originalContent: boolean;
    noReusedContent: boolean;
    familySafe: boolean;
    noMisinformation: boolean;
    noHarmfulContent: boolean;
  };
  timestamp: Date;
}
