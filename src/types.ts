export type Pattern = 'TCS' | 'Eduquity';

export interface Opt {
  text: string;
  img?: string;
}

export interface Question {
  id: string;
  text: string;
  img?: string;
  options: Opt[];
  ans: number;
  exp?: string;
}

export interface Section {
  name: string;
  questions: Question[];
}

export interface Test {
  id: string;
  title: string;
  pattern: Pattern;
  /** total duration in minutes (TCS) */
  duration: number;
  /** per-section duration in minutes (Eduquity) */
  sectionDuration: number;
  pos: number;
  neg: number;
  sections: Section[];
  createdAt: number;
}

export type Status = 'not_visited' | 'not_answered' | 'answered' | 'review' | 'ans_review';

export interface QState {
  status: Status;
  sel: number | null;
  time: number;
}

export type QMap = Record<string, QState>;

export interface Progress {
  qs: QMap;
  timers: number[];
  cur: number;
  ts: number;
}

export interface SectionStat {
  name: string;
  score: number;
  max: number;
  correct: number;
  wrong: number;
  skipped: number;
  time: number;
  total: number;
}

export interface Attempt {
  id: string;
  testId: string;
  title: string;
  pattern: Pattern;
  date: number;
  score: number;
  maxScore: number;
  correct: number;
  wrong: number;
  skipped: number;
  accuracy: number;
  timeTaken: number;
  qs: QMap;
  test: Test;
  sectionStats: SectionStat[];
}

export type View = 'dashboard' | 'instructions' | 'exam' | 'result' | 'history-report' | 'admin';
