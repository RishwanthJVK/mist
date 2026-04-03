interface PerformanceBarsProps {
  userAccuracy: number; // 0-1
}

const PerformanceBars = ({ userAccuracy }: PerformanceBarsProps) => {
  const fakeAverage = 0.85;

  return (
    <div className="w-full max-w-2xl mx-auto space-y-3 px-4">
      {/* Average performance */}
      <div className="space-y-1">
        <div className="flex justify-between text-xs font-mono-experiment text-muted-foreground select-none">
          <span>Average Performance</span>
          <span>{Math.round(fakeAverage * 100)}%</span>
        </div>
        <div className="h-4 rounded-full bg-secondary overflow-hidden relative">
          <div
            className="h-full bg-perf-good rounded-full"
            style={{ width: `${fakeAverage * 100}%` }}
          />
          {/* Arrow marker */}
          <div
            className="absolute top-full mt-0.5 -translate-x-1/2"
            style={{ left: `${fakeAverage * 100}%` }}
          >
            <div className="w-0 h-0 border-l-4 border-r-4 border-b-4 border-l-transparent border-r-transparent border-b-perf-good" />
          </div>
        </div>
      </div>

      {/* Your performance */}
      <div className="space-y-1 mt-6">
        <div className="flex justify-between text-xs font-mono-experiment text-muted-foreground select-none">
          <span>Your Performance</span>
          <span>{Math.round(userAccuracy * 100)}%</span>
        </div>
        <div className="h-4 rounded-full bg-secondary overflow-hidden relative">
          <div
            className="h-full bg-perf-bad rounded-full transition-all duration-500"
            style={{ width: `${userAccuracy * 100}%` }}
          />
          <div
            className="absolute top-full mt-0.5 -translate-x-1/2 transition-all duration-500"
            style={{ left: `${userAccuracy * 100}%` }}
          >
            <div className="w-0 h-0 border-l-4 border-r-4 border-b-4 border-l-transparent border-r-transparent border-b-perf-bad" />
          </div>
        </div>
      </div>
    </div>
  );
};

export default PerformanceBars;
