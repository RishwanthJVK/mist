// Pure experiment logic — no UI, no React

export type ExperimentMode = "REST" | "TRAINING" | "CONTROL" | "STRESS";
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
  stressTotalAnswered: number; // Track only stress mode answers
  stressTotalCorrect: number;  // Track only stress mode correct answers
  consecutiveCorrect: number;
  consecutiveIncorrect: number;
  userAverageResponseTime: number | null;
  trainingResponseTimes: number[];
  difficultyLevel: number; // 1 to 5
}

interface ArithmeticTask {
  expression: string;
  answer: number;
}

export function generateTask(difficultyLevel: number): ArithmeticTask {
  // Brute force valid expressions that result in a single integer between 0 and 9
  while (true) {
    let opsCount = 1;
    let operators = ['+', '-'];
    
    if (difficultyLevel === 1) { opsCount = Math.random() < 0.5 ? 1 : 2; }
    else if (difficultyLevel === 2) { opsCount = 2; operators = ['+', '-', '*']; }
    else if (difficultyLevel === 3) { opsCount = 3; operators = ['+', '-', '*']; }
    else if (difficultyLevel >= 4) { opsCount = 3; operators = ['+', '-', '*', '/']; }
    
    const terms = Array.from({length: opsCount + 1}, () => {
       const max = difficultyLevel >= 3 ? 19 : 9; // allow 2-digit numbers
       return Math.floor(Math.random() * max) + 1;
    });
    
    const ops = Array.from({length: opsCount}, () => operators[Math.floor(Math.random() * operators.length)]);
    
    let evalStr = terms[0].toString();
    // To ensure no division by zero and cleaner division logic
    let hasDivision = false;
    for (let i = 0; i < opsCount; i++) {
        evalStr += ` ${ops[i]} ${terms[i+1]}`;
        if (ops[i] === '/') hasDivision = true;
    }
    
    try {
      // eslint-disable-next-line
      const ans = Function(`'use strict'; return (${evalStr})`)();
      
      // Strict criteria: Must be integer, must be between 0 and 9
      if (Number.isInteger(ans) && ans >= 0 && ans <= 9 && evalStr.length < 20) {
          // Additional checks for division rules (avoid things like 5/5 + 1 evaluating fine but having 5/5)
          const displayStr = evalStr.replace(/\*/g, '×').replace(/\//g, '÷');
          return { expression: displayStr, answer: ans };
      }
    } catch {
      // ignore eval errors
    }
  }
}

export function getInitialTimeLimit(mode: ExperimentMode, userAverage: number | null): number {
  if (mode === "CONTROL" || mode === "TRAINING" || mode === "REST") return 0; // no timer
  // Stress mode uses user baseline - 10%
  if (userAverage && userAverage > 0) {
    return userAverage * 0.9;
  }
  return 5000; // default 5s if no baseline
}

export function createInitialState(mode: ExperimentMode, prevAverage: number | null = null): ExperimentState {
  // Start on baseline difficulty, stress starts harder
  const startDifficulty = mode === "STRESS" ? 3 : 1; 
  const task = mode === "REST" ? { expression: "", answer: 0 } : generateTask(startDifficulty);
  
  return {
    mode,
    currentTask: task.expression,
    currentAnswer: task.answer,
    selectedDigit: 0,
    timeLimit: getInitialTimeLimit(mode, prevAverage),
    startTime: performance.now(),
    responseTime: null,
    feedback: null,
    accuracy: 0,
    totalAnswered: 0,
    totalCorrect: 0,
    stressTotalAnswered: 0,
    stressTotalCorrect: 0,
    consecutiveCorrect: 0,
    consecutiveIncorrect: 0,
    userAverageResponseTime: prevAverage,
    trainingResponseTimes: [],
    difficultyLevel: startDifficulty,
  };
}
