import Link from "next/link";

export default function LandingPage() {
  return (
    <main className="min-h-screen bg-background flex flex-col items-center justify-center px-4">
      <div className="max-w-3xl text-center space-y-6">
        <h1 className="text-5xl font-bold text-white">
          Successor <span className="text-primary">Protocol</span>
        </h1>
        <p className="text-muted text-lg">
          Secure your digital legacy. Decentralized inheritance for the modern
          world.
        </p>
        <div className="flex gap-4 justify-center">
          <Link
            href="/signup"
            className="bg-primary text-white px-6 py-3 rounded-lg font-medium hover:opacity-90 transition"
          >
            Get Started
          </Link>
          <Link
            href="/login"
            className="border border-border text-white px-6 py-3 rounded-lg font-medium hover:bg-surface transition"
          >
            Sign In
          </Link>
        </div>
      </div>
    </main>
  );
}
