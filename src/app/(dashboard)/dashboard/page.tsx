"use client";

import { StatsCard } from "@/components/ui/StatsCard";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { useWallet } from "@/hooks/useWallet";
import { toast } from "sonner";

export default function DashboardPage() {
  const { isConnected } = useWallet();

  const sendHeartbeat = () => {
    if (!isConnected) {
      toast.error("Connect wallet first");
      return;
    }
    toast.success("Heartbeat sent on 0G Chain");
  };

  return (
    <div>
      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatsCard icon="❤️" value="2h ago" label="Last Heartbeat" />
        <StatsCard icon="⏰" value="6d 22h" label="Until Trigger" />
        <StatsCard icon="📝" value="4" label="Instructions" />
        <StatsCard icon="💾" value="190 MB" label="0G Storage" />
      </div>

      <Card>
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-lg font-semibold">On‑Chain Heartbeat</h3>
          <span className="text-xs text-accent cursor-pointer hover:underline">
            View on 0G Explorer
          </span>
        </div>
        <div className="mb-4">
          <div className="mb-1 flex justify-between text-sm text-gray-400">
            <span>Time remaining</span>
            <span>6 days 22 hours</span>
          </div>
          <div className="h-1 w-full overflow-hidden rounded-full bg-gray-700">
            <div className="h-full w-1/2 rounded-full bg-gradient-to-r from-primary to-accent" />
          </div>
        </div>
        <Button onClick={sendHeartbeat} className="w-full">
          Send Heartbeat (0.0001 ZG)
        </Button>
      </Card>

      <Card className="mt-6">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-lg font-semibold">Active Instructions</h3>
          <span className="cursor-pointer text-xs text-accent hover:underline">
            Add Instruction
          </span>
        </div>
        <div className="space-y-2">
          <div className="flex items-center gap-3 border-b border-borderColor pb-2">
            <span className="text-primary">🪙</span>
            <div>
              <div>Send 5000 USDC</div>
              <div className="text-xs text-gray-500">To: 0x71C...6d8F</div>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-primary">✉️</span>
            <div>
              <div>Notify Next of Kin</div>
              <div className="text-xs text-gray-500">jamie@example.com</div>
            </div>
          </div>
        </div>
      </Card>
    </div>
  );
}
