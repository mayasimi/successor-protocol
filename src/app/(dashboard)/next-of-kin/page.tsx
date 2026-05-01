"use client";

import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";

export default function NextOfKinPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Next of Kin</h1>
          <p className="text-muted text-sm mt-1">
            Manage your designated beneficiaries
          </p>
        </div>
        <Button>+ Add Beneficiary</Button>
      </div>

      <Card>
        <div className="text-center py-10 space-y-3">
          <p className="text-white font-medium">No beneficiaries added</p>
          <p className="text-muted text-sm">
            Add a next of kin to receive your digital assets.
          </p>
          <Button variant="outline">Add Beneficiary</Button>
        </div>
      </Card>
    </div>
  );
}
