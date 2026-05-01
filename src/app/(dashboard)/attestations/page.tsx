"use client";

import { Card } from "@/components/ui/Card";

export default function AttestationsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Attestations</h1>
        <p className="text-muted text-sm mt-1">
          On-chain attestations for your will
        </p>
      </div>

      <Card>
        <div className="text-center py-10 space-y-3">
          <p className="text-white font-medium">No attestations yet</p>
          <p className="text-muted text-sm">
            Attestations will appear here once your will is submitted on-chain.
          </p>
        </div>
      </Card>
    </div>
  );
}
