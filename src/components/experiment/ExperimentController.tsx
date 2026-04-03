import { useCallback, useEffect, useReducer, useRef } from "react";
import {
  type ExperimentMode,
  type ExperimentState,
  type FeedbackType,
  generateTask,
  getTimeLimit,
  createInitialState,
} from "@/lib/experiment-logic";
import TaskDisplay from "./TaskDisplay";
import RotaryDial from "./RotaryDial";
import TimerBar from "./TimerBar";
import FeedbackOverlay from "./FeedbackOverlay";
import PerformanceBars from "./PerformanceBars";
import RestScreen from "./RestScreen";

type Action =
  | { type: "SET_MODE"; mode: ExperimentMode }
  | { type: "ROTATE"; direction: 1 | -1 }
  | { type: "SUBMIT" }
  | { type: "TIMEOUT" }
  | { type: "CLEAR_FEEDBACK" }
  | { type: "NEXT_TASK" };

function reducer(state: ExperimentState, action: Action): ExperimentState {
  switch (action.type) {
    case "SET_MODE":
      return createInitialState(action.mode);

    case "ROTATE": {
      const next = ((state.selectedDigit + action.direction) % 10 + 10) % 10;
      return { ...state, selectedDigit: next };
    }

    case "SUBMIT": {
      const responseTime = performance.now() - state.startTime;
      const isCorrect = state.selectedDigit === state.currentAnswer;
      const totalAnswered = state.totalAnswered + 1;
      const totalCorrect = state.totalCorrect + (isCorrect ? 1 : 0);
      const accuracy = totalCorrect / totalAnswered;
      return {
        ...state,
        responseTime,
        feedback: isCorrect ? "correct" : "incorrect",
        totalAnswered,
        totalCorrect,
        accuracy,
      };
    }

    case "TIMEOUT": {
      const totalAnswered = state.totalAnswered + 1;
      const accuracy = state.totalCorrect / totalAnswered;
      return {
        ...state,
        responseTime: state.timeLimit,
        feedback: "timeout",
        totalAnswered,
        accuracy,
      };
    }

    case "CLEAR_FEEDBACK":
      return { ...state, feedback: null };

    case "NEXT_TASK": {
      const task = generateTask(state.mode);
      return {
        ...state,
        currentTask: task.expression,
        currentAnswer: task.answer,
        selectedDigit: 0,
        timeLimit: getTimeLimit(state.mode, state.accuracy),
        startTime: performance.now(),
        responseTime: null,
        feedback: null,
      };
    }

    default:
      return state;
  }
}

const ExperimentController = () => {
  const [state, dispatch] = useReducer(reducer, "STRESS", createInitialState);
  const feedbackTimer = useRef<number>(0);
  const isShowingFeedback = state.feedback !== null;

  const handleTimeout = useCallback(() => {
    dispatch({ type: "TIMEOUT" });
  }, []);

  // Feedback → next task transition
  useEffect(() => {
    if (!isShowingFeedback) return;
    feedbackTimer.current = window.setTimeout(() => {
      dispatch({ type: "NEXT_TASK" });
    }, 800);
    return () => clearTimeout(feedbackTimer.current);
  }, [isShowingFeedback]);

  // Keyboard handler
  useEffect(() => {
    if (state.mode === "REST") return;

    const handleKey = (e: KeyboardEvent) => {
      if (isShowingFeedback) return;

      switch (e.key) {
        case "ArrowLeft":
          e.preventDefault();
          dispatch({ type: "ROTATE", direction: -1 });
          break;
        case "ArrowRight":
          e.preventDefault();
          dispatch({ type: "ROTATE", direction: 1 });
          break;
        case "ArrowDown":
        case "Enter":
          e.preventDefault();
          dispatch({ type: "SUBMIT" });
          break;
      }
    };

    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [state.mode, isShowingFeedback]);

  if (state.mode === "REST") {
    return (
      <>
        <RestScreen />
        <ModeSelector current={state.mode} onChange={(m) => dispatch({ type: "SET_MODE", mode: m })} />
      </>
    );
  }

  const isStress = state.mode === "STRESS";

  return (
    <div className="fixed inset-0 flex flex-col bg-background overflow-hidden select-none">
      {/* Performance bars - stress only */}
      {isStress && (
        <div className="pt-6 pb-2">
          <PerformanceBars userAccuracy={state.accuracy} />
        </div>
      )}

      {/* Timer - stress only */}
      {isStress && state.timeLimit > 0 && (
        <div className="px-8 py-3">
          <TimerBar
            startTime={state.startTime}
            timeLimit={state.timeLimit}
            onTimeout={handleTimeout}
            active={!isShowingFeedback}
          />
        </div>
      )}

      {/* Main content area */}
      <div className="flex-1 flex flex-col items-center justify-center gap-10">
        <TaskDisplay expression={state.currentTask} />
        <RotaryDial
          selectedDigit={state.selectedDigit}
          disabled={isShowingFeedback}
        />
      </div>

      {/* Stats bar */}
      <div className="pb-4 flex justify-center gap-8 text-xs font-mono-experiment text-muted-foreground">
        <span>Trial: {state.totalAnswered + 1}</span>
        <span>Accuracy: {state.totalAnswered > 0 ? Math.round(state.accuracy * 100) : 0}%</span>
      </div>

      {/* Feedback overlay */}
      <FeedbackOverlay feedback={state.feedback} />

      {/* Mode selector */}
      <ModeSelector current={state.mode} onChange={(m) => dispatch({ type: "SET_MODE", mode: m })} />
    </div>
  );
};

// Floating mode selector for demo
function ModeSelector({
  current,
  onChange,
}: {
  current: ExperimentMode;
  onChange: (m: ExperimentMode) => void;
}) {
  const modes: ExperimentMode[] = ["REST", "CONTROL", "STRESS"];
  return (
    <div className="fixed bottom-4 right-4 flex gap-1 bg-card border border-border rounded-lg p-1 z-50">
      {modes.map((m) => (
        <button
          key={m}
          onClick={() => onChange(m)}
          className={`px-3 py-1.5 rounded-md text-xs font-mono-experiment transition-colors ${
            current === m
              ? "bg-primary text-primary-foreground"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          {m}
        </button>
      ))}
    </div>
  );
}

export default ExperimentController;
