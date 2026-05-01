"use client";

import { useParams } from "next/navigation";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";

export default function ConfirmKinPage() {
  const params = useParams();
  const ref = params?.ref as string;

  const handleAccept = () => {
    // TODO: accept next-of-kin invitation
  };

  const handleDecline = () => {
    // TODO: decline next-of-kin invitation
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4">
      <Card className="max-w-md w-full">
        <div className="space-y-6 text-center">
          <div className="space-y-2">
            <h1 className="text-2xl font-bold text-white">
              You&apos;ve been named
            </h1>
            <p className="text-muted text-sm">
              Someone has designated you as their next of kin on Successor
              Protocol.
            </p>
            <p className="text-xs text-muted">Reference: {ref}</p>
          </div>

          <div className="flex gap-3 justify-center">
            <Button onClick={handleAccept}>Accept</Button>
            <Button variant="outline" onClick={handleDecline}>
              Decline
            </Button>
          </div>
        </div>
      </Card>
    </div>
  );
}
