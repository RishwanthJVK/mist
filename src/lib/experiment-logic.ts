// Pure experiment logic — no UI, no React

export type ExperimentMode = "REST" | "CONTROL" | "STRESS";
export type FeedbackType = "correct" | "incorrect" | "timeout" | null;

export interface ExperimentState {
  mode: ExperimentMode;
  currentTask: string;
  currentAnswer: number;
  selectedDigit: number;
  timeLimit: number; // ms
  startTime: number;
  responseTime: number | null;
  feedback: FeedbackType;
  accuracy: number;
  totalAnswered: number;
  totalCorrect: number;
}

interface ArithmeticTask {
  expression: string;
  answer: number;
}

export function generateTask(mode: ExperimentMode): ArithmeticTask {
  // STRESS = harder, CONTROL = easier
  if (mode === "STRESS") {
    return generateHardTask();
  }
  return generateEasyTask();
}

function generateEasyTask(): ArithmeticTask {
  const a = randomInt(2, 9);
  const b = randomInt(2, 9);
  const sum = a + b;
  // Keep answer single digit
  const answer = sum % 10;
  return {
    expression: `(${a} + ${b}) mod 10`,
    answer,
  };
}

function generateHardTask(): ArithmeticTask {
  const a = randomInt(3, 12);
  const b = randomInt(3, 12);
  const c = randomInt(1, 20);
  const raw = a * b - c;
  const answer = ((raw % 10) + 10) % 10; // ensure positive single digit
  return {
    expression: `(${a} × ${b} − ${c}) mod 10`,
    answer,
  };
}

function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

export function getTimeLimit(mode: ExperimentMode, accuracy: number): number {
  if (mode === "CONTROL") return 0; // no timer
  // Adaptive: if doing well, reduce time. Base 5s, min 2s
  const base = 5000;
  const adjusted = base - accuracy * 2000; // 0% → 5s, 100% → 3s
  return Math.max(2000, Math.min(base, adjusted));
}

export function createInitialState(mode: ExperimentMode): ExperimentState {
  const task = generateTask(mode);
  return {
    mode,
    currentTask: task.expression,
    currentAnswer: task.answer,
    selectedDigit: 0,
    timeLimit: getTimeLimit(mode, 0),
    startTime: performance.now(),
    responseTime: null,
    feedback: null,
    accuracy: 0,
    totalAnswered: 0,
    totalCorrect: 0,
  };
}
