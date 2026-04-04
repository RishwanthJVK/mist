import { useCallback, useEffect, useReducer, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  type ExperimentMode,
  type ExperimentState,
  generateTask,
  createInitialState,
} from "@/lib/experiment-logic";
import TaskDisplay from "./TaskDisplay";
import RotaryDial from "./RotaryDial";
import TimerBar from "./TimerBar";
import FeedbackOverlay from "./FeedbackOverlay";
import PerformanceBars from "./PerformanceBars";
import RestScreen from "./RestScreen";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { LogOut } from "lucide-react";

type Action =
  | { type: "SET_MODE"; mode: ExperimentMode }
  | { type: "ROTATE"; direction: 1 | -1 }
  | { type: "SUBMIT" }
  | { type: "TIMEOUT" }
  | { type: "CLEAR_FEEDBACK" }
  | { type: "NEXT_TASK" };


function reducer(state: ExperimentState, action: Action): ExperimentState {
  switch (action.type) {
    case "SET_MODE": {
      if (state.mode === action.mode) return state; // ignore if same
      let newAverage = state.userAverageResponseTime;
      if (state.mode === "TRAINING" && state.trainingResponseTimes.length > 0) {
        newAverage = state.trainingResponseTimes.reduce((a, b) => a + b, 0) / state.trainingResponseTimes.length;
      }
      return createInitialState(action.mode, newAverage);
    }

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

      let consecutiveCorrect = isCorrect ? state.consecutiveCorrect + 1 : 0;
      let consecutiveIncorrect = isCorrect ? 0 : state.consecutiveIncorrect + 1;

      let trainingResponseTimes = [...state.trainingResponseTimes];
      if (state.mode === "TRAINING") {
        trainingResponseTimes.push(responseTime);
      }

      // Track stress-specific answers
      let stressTotalAnswered = state.stressTotalAnswered;
      let stressTotalCorrect = state.stressTotalCorrect;
      if (state.mode === "STRESS") {
        stressTotalAnswered += 1;
        stressTotalCorrect += isCorrect ? 1 : 0;
      }

      return {
        ...state,
        responseTime,
        feedback: isCorrect ? "correct" : "incorrect",
        totalAnswered,
        totalCorrect,
        stressTotalAnswered,
        stressTotalCorrect,
        accuracy,
        consecutiveCorrect,
        consecutiveIncorrect,
        trainingResponseTimes,
      };
    }

    case "TIMEOUT": {
      const totalAnswered = state.totalAnswered + 1;
      const accuracy = state.totalCorrect / totalAnswered;

      // Track stress-specific answers for timeout
      let stressTotalAnswered = state.stressTotalAnswered;
      if (state.mode === "STRESS") {
        stressTotalAnswered += 1;
      }

      return {
        ...state,
        responseTime: state.timeLimit,
        feedback: "timeout",
        totalAnswered,
        accuracy,
        stressTotalAnswered,
        consecutiveCorrect: 0,
        consecutiveIncorrect: state.consecutiveIncorrect + 1,
      };
    }

    case "CLEAR_FEEDBACK":
      return { ...state, feedback: null };

    case "NEXT_TASK": {
      let { timeLimit, consecutiveCorrect, consecutiveIncorrect, difficultyLevel, mode, totalAnswered, accuracy } = state;

      if (mode === "STRESS") {
        if (consecutiveCorrect >= 3) {
          timeLimit *= 0.9;
          consecutiveCorrect = 0;
          if (difficultyLevel < 5 && Math.random() > 0.5) difficultyLevel++;
        }
        if (consecutiveIncorrect >= 3) {
          timeLimit *= 1.1;
          consecutiveIncorrect = 0;
          if (difficultyLevel > 1 && Math.random() > 0.5) difficultyLevel--;
        }

        // Forced failure watchdog
        if (totalAnswered >= 5 && accuracy > 0.45) {
          timeLimit *= 0.8;
          if (difficultyLevel < 5) difficultyLevel++;
        }

        timeLimit = Math.max(1000, timeLimit); // Minimum 1s limit
      } else if (mode === "CONTROL") {
         difficultyLevel = 3;
      }

      const task = generateTask(difficultyLevel);
      return {
        ...state,
        currentTask: task.expression,
        currentAnswer: task.answer,
        selectedDigit: 0,
        timeLimit,
        difficultyLevel,
        consecutiveCorrect,
        consecutiveIncorrect,
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
  const [participantId, setParticipantId] = useState<string | null>(null);
  const [state, dispatch] = useReducer(reducer, "REST", (m) => createInitialState(m as ExperimentMode));
  const feedbackTimer = useRef<number>(0);
  const isShowingFeedback = state.feedback !== null;
  const navigate = useNavigate();

  const handleTimeout = useCallback(() => {
    dispatch({ type: "TIMEOUT" });
  }, []);

  const handleLogout = async () => {
    if (window.confirm("Are you sure you want to exit the session?")) {
      await supabase.auth.signOut();
      navigate('/');
    }
  }

  // Sync auth on mount
  useEffect(() => {
    const checkSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        setParticipantId(session.user.id);
      }
    };
    checkSession();
  }, [navigate]);

  // Realtime Subscription & Live State Fetch
  useEffect(() => {
    if (!participantId) return;

    // Fetch initial state
    supabase
      .from('participant_state')
      .select('current_mode')
      .eq('participant_id', participantId)
      .single()
      .then(({ data }) => {
        if (data?.current_mode) {
          dispatch({ type: "SET_MODE", mode: data.current_mode as ExperimentMode });
        }
      });

    // Subscribe to admin remote control changes
    const channel = supabase
      .channel(`sync-participant-${participantId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'participant_state',
        },
        (payload) => {
          console.log("Realtime payload received in Experiment:", payload);
          if (payload.new && payload.new.participant_id === participantId) {
            const newMode = payload.new.current_mode as ExperimentMode;
            console.log(`Realtime mode change detected: ${newMode}`);
            if (newMode) dispatch({ type: "SET_MODE", mode: newMode });
          }
        }
      )
      .subscribe((status, err) => {
        console.log(`Realtime sync status: ${status}`, err);
      });

    return () => {
      console.log("Cleaning up realtime channel");
      supabase.removeChannel(channel);
    };
  }, [participantId]);

  // Log Trials & Publish Realtime Stats to participant_state
  useEffect(() => {
    if (state.feedback !== null && participantId && state.mode !== "REST") {
      
      const logSessionData = async () => {
        // 1. Log the trial
        const { error: trialError } = await supabase.from('trials').insert({
          participant_id: participantId,
          condition_type: state.mode,
          difficulty_level: state.difficultyLevel,
          problem: state.currentTask,
          user_answer: state.selectedDigit,
          is_correct: state.feedback === "correct",
          response_time_ms: state.responseTime,
          current_limit_ms: state.timeLimit
        });
        if (trialError) console.error("Trial Log:", trialError);

        // 2. Publish updated real-time stats to the admin via participant_state
        const { error: stateError } = await supabase.from('participant_state').update({
          accuracy: state.accuracy,
          latest_response_time: state.responseTime,
          updated_at: new Date().toISOString()
        }).eq('participant_id', participantId);
        if (stateError) console.error("State Log:", stateError);
      };

      logSessionData();
    }
  }, [state.totalAnswered, state.feedback, participantId, state.mode]);

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

  if (!participantId) {
    return <div className="flex h-screen items-center justify-center">Loading Session...</div>;
  }

  const logoutButton = (
    <Button 
      variant="outline" 
      size="sm" 
      onClick={handleLogout} 
      className="absolute top-4 right-4 items-center gap-2 border-slate-500 text-white font-bold hover:bg-slate-800/50 hover:border-slate-400 transition-all z-50 shadow-sm"
    >
      <LogOut className="w-4 h-4" />
      Exit
    </Button>
  );

  if (state.mode === "REST") {
    return (
      <div className="fixed inset-0 bg-[#0B0F1A]">
        {logoutButton}
        <RestScreen />
      </div>
    );
  }


  const isStress = state.mode === "STRESS";
  
  // Calculate stress-specific accuracy for the performance bar
  const stressAccuracy = state.stressTotalAnswered > 0 
    ? state.stressTotalCorrect / state.stressTotalAnswered 
    : 0;

  return (
    <div className="fixed inset-0 flex flex-col bg-[#0B0F1A] overflow-hidden select-none font-sans">
      <div className="absolute inset-0 bg-grid-slate-800 [mask-image:linear-gradient(0deg,white,rgba(255,255,255,0.1))] pointer-events-none" />
      
      {logoutButton}
      {/* Performance bars - stress only */}
      {isStress && (
        <div className="pt-6 pb-2 relative z-10">
          <PerformanceBars userAccuracy={stressAccuracy} />
        </div>
      )}

      {/* Timer - stress only */}
      {isStress && state.timeLimit > 0 && (
        <div className="px-8 py-3 relative z-10">
          <TimerBar
            startTime={state.startTime}
            timeLimit={state.timeLimit}
            onTimeout={handleTimeout}
            active={!isShowingFeedback}
          />
        </div>
      )}

      {/* Main content area */}
      <div className="flex-1 flex flex-col items-center justify-center gap-10 relative z-10">
        <TaskDisplay expression={state.currentTask} />
        <RotaryDial
          selectedDigit={state.selectedDigit}
          disabled={isShowingFeedback}
        />
      </div>

      {/* Stats bar */}
      <div className="pb-4 flex flex-col items-center gap-2 text-xs font-mono-experiment text-slate-400 font-bold relative z-10">
        <span className="opacity-60 uppercase tracking-widest">Mode: {state.mode}</span>
      </div>

      <FeedbackOverlay feedback={state.feedback} />
    </div>
  );
};

function WaitMessage() {
  return (
    <div className="fixed bottom-8 w-full text-center text-slate-300 text-sm animate-pulse font-mono-experiment font-bold">
      Waiting for Investigator...
    </div>
  );
}

export default ExperimentController;
