import { memo } from "react";

interface RotaryDialProps {
  selectedDigit: number;
  disabled?: boolean;
}

const DIGITS = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9];
const RADIUS = 120;

const RotaryDial = memo(({ selectedDigit, disabled }: RotaryDialProps) => {
  const size = RADIUS * 2 + 80;
  const center = size / 2;

  return (
    <div className="flex flex-col items-center gap-4">
      <div
        className="relative"
        style={{ width: size, height: size }}
      >
        {/* Outer ring */}
        <div
          className="absolute inset-0 rounded-full border-2 border-dial-ring"
          style={{ width: size, height: size }}
        />

        {DIGITS.map((digit) => {
          const angle = (digit / 10) * 2 * Math.PI - Math.PI / 2;
          const x = center + RADIUS * Math.cos(angle);
          const y = center + RADIUS * Math.sin(angle);
          const isActive = digit === selectedDigit;

          return (
            <div
              key={digit}
              className={`absolute flex items-center justify-center w-12 h-12 rounded-full font-mono-experiment text-xl font-bold transition-all duration-150 select-none ${
                isActive
                  ? "bg-dial-active text-primary-foreground scale-125 shadow-lg shadow-primary/30"
                  : disabled
                  ? "bg-dial-bg text-muted-foreground/50"
                  : "bg-dial-bg text-foreground/80"
              }`}
              style={{
                left: x - 24,
                top: y - 24,
              }}
            >
              {digit}
            </div>
          );
        })}

        {/* Center display */}
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="w-16 h-16 rounded-full bg-secondary flex items-center justify-center font-mono-experiment text-2xl font-bold text-foreground border border-border">
            {selectedDigit}
          </div>
        </div>
      </div>

      {!disabled && (
        <div className="flex gap-6 text-sm text-muted-foreground font-mono-experiment select-none">
          <span>← → rotate</span>
          <span>↓/Enter submit</span>
        </div>
      )}
    </div>
  );
});

RotaryDial.displayName = "RotaryDial";
export default RotaryDial;
