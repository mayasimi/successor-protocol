interface StatsCardProps {
  icon: string;
  value: string;
  label: string;
}

export function StatsCard({ icon, value, label }: StatsCardProps) {
  return (
    <div className="rounded-xl border border-borderColor bg-cardBg p-4 transition hover:border-primary">
      <div className="mb-2 flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
        <span className="text-xl">{icon}</span>
      </div>
      <div className="text-2xl font-bold">{value}</div>
      <div className="text-xs text-gray-500">{label}</div>
    </div>
  );
}
