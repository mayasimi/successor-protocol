import { cn } from "@/lib/utils";

export function Card({
  className,
  children,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "rounded-xl border border-borderColor bg-cardBg p-5",
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
}
