export enum QuestionType {
  SINGLE_CHOICE = 'SINGLE_CHOICE',
  MULTI_CHOICE = 'MULTI_CHOICE',
  FILL_IN_BLANK = 'FILL_IN_BLANK',
  CODE = 'CODE',
  ESSAY = 'ESSAY', // Used for definitions, calculations, logic
  DIAGRAM = 'DIAGRAM'
}

export interface Question {
  id: string;
  type: QuestionType;
  text: string;
  options?: string[]; // For Single/Multi choice
  correctAnswer?: string | string[]; // For auto-grading simple types
  explanation: string;
  tags: string[]; // Knowledge points e.g., "Data Structures", "Pointers"
  hint?: string;
  codeSnippet?: string; // For code analysis questions
  source?: string; // e.g., "2023 408 Exam", "Custom"
  difficulty?: 'Easy' | 'Medium' | 'Hard';
}

export interface SyllabusModule {
  title: string;
  keyPoints: string[];
}

export interface Syllabus {
  id: string;
  courseName: string;
  description: string;
  semester?: string;
  modules: SyllabusModule[];
  addedAt: number;
}

export interface UserAnswer {
  questionId: string;
  answer: string | string[] | File; // File for Diagram questions
  isCorrect?: boolean; // For auto-graded
  aiFeedback?: string; // For AI-graded
  score?: number; // 0-100
}

export interface QuizSession {
  id: string;
  title: string;
  questions: Question[];
  answers: Record<string, UserAnswer>;
  isCompleted: boolean;
  score: number;
  startTime: number;
}

export interface UserStats {
  totalQuizzes: number;
  averageScore: number;
  topicStrength: Record<string, number>; // Topic -> 0-100 score
  recentActivity: { date: string; score: number }[];
  weakPoints: string[];
}

export type ViewState = 'DASHBOARD' | 'UPLOAD' | 'QUIZ' | 'RESULTS' | 'PLAN' | 'ADMIN';

export interface FileContext {
  name: string;
  type: string;
  data: string; // Base64
}

export const KNOWLEDGE_TREE = {
  '数据结构': ['链表', '树', '图', '查找', '排序', '栈与队列'],
  '计算机网络': ['TCP/IP', 'HTTP', '路由协议', '数据链路层', '网络安全'],
  '操作系统': ['进程管理', '内存管理', '文件系统', '死锁', 'I/O管理'],
  '计算机组成原理': ['指令系统', '流水线', '存储层次', '总线', 'CPU结构'],
  '数据库': ['SQL', '事务处理', '索引优化', '范式理论', '并发控制']
};