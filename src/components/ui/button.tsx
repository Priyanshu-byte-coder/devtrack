import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center whitespace-nowrap rounded-xl text-sm font-semibold transition duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--background)] focus-visible:ring-[var(--accent)] disabled:pointer-events-none disabled:opacity-50 gap-2 active:scale-[0.98]",
  {
    variants: {
      variant: {
        default:
          "bg-[var(--accent)] text-[var(--accent-foreground)] shadow-xs hover:bg-[var(--accent)]/95 hover:shadow-sm hover:-translate-y-[0.5px] transition-all",
        destructive:
          "bg-[var(--destructive)] text-white shadow-xs hover:bg-[var(--destructive)]/90 hover:shadow-sm transition-all",
        outline:
          "border border-[var(--border)] bg-[var(--card)] text-[var(--foreground)] shadow-xs hover:border-[var(--accent)] hover:text-[var(--accent)] hover:bg-[var(--accent-soft)]/20 transition-all",
        secondary:
          "bg-[var(--control)] text-[var(--foreground)] border border-[var(--border)] shadow-xs hover:bg-[var(--control-hover)] hover:border-[var(--border)] transition-all",
        ghost: "hover:bg-[var(--accent-soft)] hover:text-[var(--accent)] transition-colors text-[var(--foreground)]",
        link: "text-[var(--accent)] underline-offset-4 hover:underline",
      },
      size: {
        default: "h-10 px-4 py-2",
        sm: "h-9 rounded-lg px-3",
        lg: "h-11 rounded-xl px-8",
        icon: "h-10 w-10",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    // Basic implementation without Radix Slot for simplicity, 
    // unless asChild is needed (which would require @radix-ui/react-slot)
    // We'll stick to a simple button for now.
    return (
      <button
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    );
  }
);
Button.displayName = "Button";

export { Button, buttonVariants };
