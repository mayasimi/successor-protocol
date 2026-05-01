import { cn } from "@/lib/utils";
import { HTMLAttributes } from "react";

interface CardProps extends HTMLAttributes<HTMLDivElement> {}

export function Card({ children, className, ...props }: CardProps) {
  return (
    <div
      className={cn(
        "bg-surface border border-border rounded-2xl p-6",
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
}
