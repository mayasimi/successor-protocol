import { forwardRef, ButtonHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "outline";
  isLoading?: boolean;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      className,
      variant = "primary",
      isLoading,
      children,
      disabled,
      ...props
    },
    ref
  ) => {
    const base =
      "px-4 py-2 rounded-full font-semibold transition-all disabled:opacity-50 inline-flex items-center justify-center gap-2";
    const variants = {
      primary:
        "bg-gradient-to-r from-primary to-primary/80 text-white hover:opacity-90",
      secondary:
        "bg-cardBg border border-borderColor text-white hover:bg-borderColor",
      outline: "border border-primary text-primary hover:bg-primary/10",
    };
    return (
      <button
        ref={ref}
        className={cn(base, variants[variant], className)}
        disabled={disabled || isLoading}
        {...props}
      >
        {isLoading && <span className="animate-spin">⏳</span>}
        {children}
      </button>
    );
  }
);
Button.displayName = "Button";
