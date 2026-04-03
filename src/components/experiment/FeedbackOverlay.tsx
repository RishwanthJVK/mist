import type { FeedbackType } from "@/lib/experiment-logic";

interface FeedbackOverlayProps {
  feedback: FeedbackType;
}

const FeedbackOverlay = ({ feedback }: FeedbackOverlayProps) => {
  if (!feedback) return null;

  const config = {
    correct: { text: "CORRECT", className: "text-correct" },
    incorrect: { text: "INCORRECT", className: "text-incorrect" },
    timeout: { text: "TIMEOUT", className: "text-timeout" },
  };

  const { text, className } = config[feedback];

  return (
    <div className="fixed inset-0 flex items-center justify-center z-50 bg-background/80 backdrop-blur-sm">
      <div className={`font-mono-experiment text-6xl md:text-8xl font-bold ${className} animate-scale-in select-none`}>
        {text}
      </div>
    </div>
  );
};

export default FeedbackOverlay;
