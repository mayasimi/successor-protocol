import { StatsCard } from "@/components/ui/StatsCard";

export default function DashboardPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Dashboard</h1>
        <p className="text-muted text-sm mt-1">
          Overview of your successor protocol
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        <StatsCard title="Heartbeat Status" value="Active" status="success" />
        <StatsCard title="Next of Kin" value="2 Added" status="neutral" />
        <StatsCard title="Will Documents" value="1 Draft" status="warning" />
        <StatsCard title="Attestations" value="0 Pending" status="neutral" />
        <StatsCard title="Last Check-in" value="Today" status="success" />
        <StatsCard title="Wallet Connected" value="Yes" status="success" />
      </div>
    </div>
  );
}
