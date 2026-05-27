export type UserRole = 'reader' | 'parent' | 'teacher';

// User Profile Types
export interface UserProfile {
  id: string;
  email?: string;
  name?: string;
  role?: UserRole;
  challenges: ReadingChallenge[];
  preferences: UserPreferences;
  createdAt: Date;
  updatedAt: Date;
}

export type ReadingChallenge = 'dyslexia' | 'adhd' | 'none';

export interface UserPreferences {
  fontSize: number; // 8-72pt
  fontFamily: string;
  lineSpacing: number; // 1.0-3.0x
  theme: 'light' | 'dark' | 'sepia' | 'high-contrast';
  ttsEnabled: boolean;
  ttsSpeed: number; // 100-300 wpm
  eyeTrackingEnabled: boolean;
  arOverlaysEnabled: boolean;
  brightnessAutoAdjust: boolean;
}

// Eye Tracking Types
export interface GazePoint {
  x: number;
  y: number;
  timestamp: number;
}

export interface Fixation {
  x: number;
  y: number;
  duration: number; // milliseconds
  startTime: number;
  endTime: number;
}

export interface Saccade {
  startX: number;
  startY: number;
  endX: number;
  endY: number;
  duration: number;
  velocity: number; // degrees per second
  timestamp: number;
}

export interface Regression extends Saccade {
  isRegression: true;
}

export interface EyeMetrics {
  fixations: Fixation[];
  saccades: Saccade[];
  regressions: Regression[];
  engagement: number; // 0-100%
  timeOnPage: number; // milliseconds
  dwellTime: number; // milliseconds without scrolling
  blinkCount?: number;
}

export interface CalibrationPoint {
  x: number;
  y: number;
  gazeX?: number;
  gazeY?: number;
  timestamp?: number;
}

export type CalibrationMethod = 'explicit' | 'smooth-pursuit' | 'implicit';

export interface CalibrationResult {
  method: CalibrationMethod;
  points: CalibrationPoint[];
  accuracy: number; // 0-1
  completed: boolean;
}

export interface EyeAlgoConfig {
  iDT: {
    dispersionThreshold: number; // degrees, default 1°
    durationThreshold: number; // milliseconds, default 100ms
  };
  iVT: {
    velocityThreshold: number; // degrees/second, default 30°/s
  };
  regression: {
    leftwardThreshold: number; // percentage, default 10%
  };
}

// Reading Metrics
export interface ReadingMetrics {
  documentId: string;
  pageNumber: number;
  eyeMetrics: EyeMetrics;
  readingSpeed: number; // words per minute
  comprehensionScore?: number; // 0-100
  timeSpent: number; // milliseconds
  timestamp: Date;
}

// Document Types
export type DocumentFormat = 'pdf' | 'epub' | 'docx' | 'txt' | 'rtf' | 'image' | 'xlsx' | 'pptx';

export interface Document {
  id: string;
  title: string;
  format: DocumentFormat;
  filePath: string;
  thumbnailPath?: string;
  pageCount?: number;
  uploadDate: Date;
  lastRead?: Date;
  progress?: number; // 0-100
  annotations?: Annotation[];
}

export interface Annotation {
  id: string;
  type: 'highlight' | 'underline' | 'strikethrough' | 'note' | 'drawing';
  page: number;
  x: number;
  y: number;
  width?: number;
  height?: number;
  color?: string;
  text?: string;
  timestamp: Date;
}

// Gamification Types
export interface GamificationState {
  points: number;
  level: number;
  badges: Badge[];
  streaks: {
    current: number;
    longest: number;
    lastDate: string; // ISO date string
  };
  challenges: Challenge[];
}

export interface Badge {
  id: string;
  name: string;
  description: string;
  icon: string;
  unlockedAt: Date;
}

export interface Challenge {
  id: string;
  name: string;
  description: string;
  target: number;
  progress: number;
  reward: number; // points
  completed: boolean;
}

// AI & Comprehension Types
export interface ComprehensionMetric {
  score: number; // 0-100
  confidence: number; // 0-1
  factors: {
    regressions: number;
    fixations: number;
    readingSpeed: number;
    engagement: number;
  };
  timestamp: Date;
}

export interface QuizQuestion {
  id: string;
  question: string;
  options: string[];
  correctAnswer: number;
  explanation?: string;
}

export interface Quiz {
  id: string;
  documentId: string;
  pageNumber: number;
  questions: QuizQuestion[];
  score?: number;
  completedAt?: Date;
}

// Hardware Integration Types
export type HardwareType = 
  | 'webgazer' 
  | 'pupil-labs' 
  | 'tobii' 
  | 'eyelink' 
  | 'smi' 
  | 'gazepoint' 
  | 'gazesense'
  | 'none';

export interface HardwareConfig {
  type: HardwareType;
  connected: boolean;
  address?: string;
  port?: number;
  calibrationData?: CalibrationResult;
}

// AR Overlay Types
export interface AROverlay {
  id: string;
  type: 'definition' | 'model' | 'filter' | 'animation';
  position: { x: number; y: number; z?: number };
  content: string | object;
  visible: boolean;
}

// Brightness Modulation Types
export interface BrightnessSettings {
  autoAdjust: boolean;
  baseBrightness: number; // 0-1
  ambientLight: number; // lux
  timeOfDay: 'morning' | 'afternoon' | 'evening' | 'night';
  eyeSensitivity: number; // 0-1, predicted from eye metrics
}

// Analytics Types
export interface AnalyticsData {
  readingSpeed: { date: string; speed: number }[];
  engagement: { date: string; engagement: number }[];
  comprehension: { date: string; score: number }[];
  heatmap: { x: number; y: number; intensity: number }[];
}

// UX Personalization Types
export interface UXPreferences {
  animationSpeed: 'slow' | 'normal' | 'fast';
  hapticFeedback: boolean;
  voiceCommands: boolean;
  gestureControls: boolean;
  theme: 'auto' | 'light' | 'dark';
}

