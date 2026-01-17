/**
 * AI Center Index - Exports all AI Center services
 */

// Core Services
export { aiMemoryService, AIMemoryService } from './ai-memory.service';
export { aiTrainingCenterService, AITrainingCenterService } from './ai-training.service';
export { aiThreatDetectionService, AIThreatDetectionService } from './ai-threat-detection.service';
export { aiLearningPatternsService, AILearningPatternsService } from './ai-learning-patterns.service';
export { aiTaskService, AITaskService } from './ai-task.service';

// Re-export types
export type {
  MemoryType,
  MemoryEntry,
  MemorySearchOptions,
} from './ai-memory.service';

export type {
  TrainingType,
  DataType,
  TrainingCategory,
  TrainingExample,
  TrainingSessionConfig,
  TrainingMetrics,
} from './ai-training.service';

export type {
  ThreatType,
  ThreatSeverity,
  ThreatStatus,
  PatternType as ThreatPatternType,
  ThreatAnalysis,
  ThreatPattern,
  DefenseAction,
} from './ai-threat-detection.service';

export type {
  PatternCategory,
  LearningOutcome,
  Pattern,
  TriggerCondition,
  PatternVariable,
  SuccessMetrics,
  PatternMatch,
  LearningEvent,
} from './ai-learning-patterns.service';

export type {
  TaskType,
  TaskStatus,
  TaskPriority,
  AutonomyLevel,
  TaskInput,
  TaskResult,
  TaskSummary,
  TaskApprovalRequest,
} from './ai-task.service';
