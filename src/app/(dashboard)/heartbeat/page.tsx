"use client";

import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";

export default function HeartbeatPage() {
  const handleCheckIn = () => {
    // TODO: trigger heartbeat check-in
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Heartbeat</h1>
        <p className="text-muted text-sm mt-1">
          Manage your liveness check-in settings
        </p>
      </div>

      <Card>
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-white font-medium">Current Status</p>
              <p className="text-sm text-green-400">Active</p>
            </div>
            <Button onClick={handleCheckIn}>Check In Now</Button>
          </div>
          <hr className="border-border" />
          <div className="space-y-2">
            <p className="text-sm text-muted">Last check-in</p>
            <p className="text-white">Today at 09:41 AM</p>
          </div>
          <div className="space-y-2">
            <p className="text-sm text-muted">Check-in interval</p>
            <p className="text-white">Every 30 days</p>
          </div>
          <div className="space-y-2">
            <p className="text-sm text-muted">Grace period</p>
            <p className="text-white">7 days</p>
          </div>
        </div>
      </Card>
    </div>
  );
}
