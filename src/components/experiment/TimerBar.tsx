import { useEffect, useRef, useState } from "react";

interface TimerBarProps {
  startTime: number;
  timeLimit: number;
  onTimeout: () => void;
  active: boolean;
}

const TimerBar = ({ startTime, timeLimit, onTimeout, active }: TimerBarProps) => {
  const [progress, setProgress] = useState(1);
  const rafRef = useRef<number>(0);
  const timedOut = useRef(false);

  useEffect(() => {
    if (!active || timeLimit <= 0) return;
    timedOut.current = false;

    const tick = () => {
      const elapsed = performance.now() - startTime;
      const remaining = Math.max(0, 1 - elapsed / timeLimit);
      setProgress(remaining);

      if (remaining <= 0 && !timedOut.current) {
        timedOut.current = true;
        onTimeout();
        return;
      }

      if (remaining > 0) {
        rafRef.current = requestAnimationFrame(tick);
      }
    };

    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, [startTime, timeLimit, active, onTimeout]);

  const isDanger = progress < 0.25;

  return (
    <div className="w-full max-w-xl mx-auto">
      <div className="h-3 rounded-full bg-secondary overflow-hidden">
        <div
          className={`h-full rounded-full transition-colors duration-300 ${
            isDanger ? "bg-timer-danger" : "bg-timer-bar"
          }`}
          style={{
            width: `${progress * 100}%`,
            transition: "none",
          }}
        />
      </div>
      <div className="mt-1 text-xs text-muted-foreground font-mono-experiment text-center select-none">
        {Math.max(0, Math.ceil(progress * timeLimit / 1000))}s
      </div>
    </div>
  );
};

export default TimerBar;
