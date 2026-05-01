import { cn } from "@/lib/utils";
import { Card } from "./Card";

interface StatsCardProps {
  title: string;
  value: string;
  status?: "success" | "warning" | "error" | "neutral";
}

const statusColors = {
  success: "text-green-400",
  warning: "text-yellow-400",
  error: "text-red-400",
  neutral: "text-muted",
};

export function StatsCard({ title, value, status = "neutral" }: StatsCardProps) {
  return (
    <Card className="space-y-2">
      <p className="text-sm text-muted">{title}</p>
      <p className={cn("text-xl font-semibold", statusColors[status])}>
        {value}
      </p>
    </Card>
  );
}
