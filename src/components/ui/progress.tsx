import * as React from "react";
import { cn } from "@/lib/utils";

export interface ProgressProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Current progress value (0–100). */
  value?: number;
  /** Custom fill color. Defaults to `var(--accent)`. */
  color?: string;
}

const Progress = React.forwardRef<HTMLDivElement, ProgressProps>(
  ({ className, value = 0, color, style, ...props }, ref) => {
    const clampedValue = Math.max(0, Math.min(100, value));
    const fillColor = color ?? "var(--accent)";

    return (
      <div
        ref={ref}
        role="progressbar"
        aria-valuenow={clampedValue}
        aria-valuemin={0}
        aria-valuemax={100}
        className={cn(
          "relative h-2 w-full overflow-hidden rounded-full bg-[var(--card-muted)]",
          className
        )}
        style={style}
        {...props}
      >
        <div
          className="h-full rounded-full transition-all duration-500 ease-in-out"
          style={{
            width: `${clampedValue}%`,
            backgroundColor: fillColor,
          }}
        />
      </div>
    );
  }
);
Progress.displayName = "Progress";

export { Progress };
