"use client";

import { Button } from "@/components/ui/Button";
import Link from "next/link";

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-bgDark text-white">
      <div className="mx-auto max-w-7xl px-6 py-12">
        <nav className="flex items-center justify-between border-b border-borderColor pb-8">
          <div className="flex items-center gap-2">
            <span className="text-2xl">⌛</span>
            <span className="bg-gradient-to-r from-white to-accent bg-clip-text text-2xl font-bold text-transparent">
              successor
            </span>
          </div>
          <div className="space-x-4">
            <Link href="/login">
              <Button variant="outline">Sign In</Button>
            </Link>
            <Link href="/signup">
              <Button>Get Started</Button>
            </Link>
          </div>
        </nav>

        <div className="grid items-center gap-12 py-20 md:grid-cols-2">
          <div>
            <h1 className="text-5xl font-bold leading-tight">
              Your will, executed{" "}
              <span className="text-accent">autonomously</span>
            </h1>
            <p className="mt-4 text-lg text-gray-400">
              When you stop responding, your Successor acts. On‑chain heartbeat.
              Verifiable. Trustless.
            </p>
            <div className="mt-8 flex gap-4">
              <Link href="/signup">
                <Button>Create your will →</Button>
              </Link>
              <Button variant="secondary">Watch demo</Button>
            </div>
          </div>
          <div className="rounded-2xl border border-borderColor bg-cardBg p-6 text-center">
            <div className="text-4xl">🕯️</div>
            <h3 className="mt-2 text-xl font-semibold">Powered by 0G Chain</h3>
            <p className="mt-2 text-sm text-gray-400">
              Permanent storage · Cryptographic attestations
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
