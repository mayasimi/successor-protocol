"use client";

import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";

export default function MyWillPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">My Will</h1>
          <p className="text-muted text-sm mt-1">
            Manage your digital asset distribution
          </p>
        </div>
        <Button>+ Add Asset</Button>
      </div>

      <Card>
        <div className="text-center py-10 space-y-3">
          <p className="text-white font-medium">No assets added yet</p>
          <p className="text-muted text-sm">
            Start by adding your first digital asset to distribute.
          </p>
          <Button variant="outline">Add Your First Asset</Button>
        </div>
      </Card>
    </div>
  );
}
