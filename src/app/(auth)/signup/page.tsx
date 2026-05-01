"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { useLocalStorage } from "@/hooks/useLocalStorage";
import { toast } from "sonner";
import { z } from "zod";

// Validation schemas
const emailSchema = z.string().email("Invalid email address");
const nameSchema = z.string().min(1, "Name is required").max(100);
const walletSchema = z
  .string()
  .regex(/^0x[a-fA-F0-9]{40}$/, "Invalid wallet address");
const passwordSchema = z
  .string()
  .min(8, "Password must be at least 8 characters");

export default function SignupPage() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);

  const [form, setForm] = useState({
    ownerName: "",
    ownerEmail: "",
    kinName: "",
    kinEmail: "",
    graceDays: "7",
    wallet: "",
    password: "",
  });

  const [, setPending] = useLocalStorage("pending_registration", null);

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ) => {
    setForm({ ...form, [e.target.id]: e.target.value });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      nameSchema.parse(form.ownerName);
      emailSchema.parse(form.ownerEmail);
      nameSchema.parse(form.kinName);
      emailSchema.parse(form.kinEmail);
      walletSchema.parse(form.wallet);
      passwordSchema.parse(form.password);
    } catch (err) {
      if (err instanceof z.ZodError) {
        toast.error(err.errors[0].message);
      } else {
        toast.error("Invalid input");
      }
      setIsLoading(false);
      return;
    }

    const registrationId = `reg_${Date.now()}_${Math.random().toString(36).substring(2, 10)}`;
    const registrationData = {
      registrationId,
      ownerName: form.ownerName,
      ownerEmail: form.ownerEmail,
      kinName: form.kinName,
      kinEmail: form.kinEmail,
      graceDays: parseInt(form.graceDays),
      wallet: form.wallet,
      passwordHash: btoa(form.password), // Simple encoding (use proper hashing in backend)
      createdAt: new Date().toISOString(),
      kinConfirmed: false,
      kinDeclined: false,
      chain: "0G Chain",
    };

    setPending(registrationData);

    // Simulate sending email (in production, call an API)
    const confirmLink = `${window.location.origin}/confirm-kin/${registrationId}?email=${encodeURIComponent(form.kinEmail)}&owner=${encodeURIComponent(form.ownerName)}`;
    console.log(
      `📧 SIMULATED EMAIL TO ${form.kinEmail}:\nSubject: ${form.ownerName} named you as next of kin\nLink: ${confirmLink}`
    );

    toast.success(`Invitation sent to ${form.kinEmail}`);
    setTimeout(() => router.push("/login"), 2000);
    setIsLoading(false);
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-bgDark p-4">
      <div className="w-full max-w-md rounded-2xl border border-borderColor bg-cardBg p-6 md:p-8">
        <div className="mb-6 flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-r from-primary to-accent">
            <span className="text-white text-sm">⌛</span>
          </div>
          <span className="bg-gradient-to-r from-white to-accent bg-clip-text text-2xl font-bold text-transparent">
            successor
          </span>
        </div>

        <h2 className="text-2xl font-semibold">Create your plan</h2>
        <p className="mb-6 text-sm text-gray-400">
          Secure your digital legacy on 0G Chain
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label
              htmlFor="ownerName"
              className="mb-1 block text-xs uppercase tracking-wide text-gray-400"
            >
              Full name
            </label>
            <Input
              id="ownerName"
              type="text"
              placeholder="Alex Rivera"
              value={form.ownerName}
              onChange={handleChange}
              required
            />
          </div>

          <div>
            <label
              htmlFor="ownerEmail"
              className="mb-1 block text-xs uppercase tracking-wide text-gray-400"
            >
              Email
            </label>
            <Input
              id="ownerEmail"
              type="email"
              placeholder="alex@example.com"
              value={form.ownerEmail}
              onChange={handleChange}
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label
                htmlFor="kinName"
                className="mb-1 block text-xs uppercase tracking-wide text-gray-400"
              >
                Next of kin name
              </label>
              <Input
                id="kinName"
                type="text"
                placeholder="Jamie Rivera"
                value={form.kinName}
                onChange={handleChange}
                required
              />
            </div>
            <div>
              <label
                htmlFor="kinEmail"
                className="mb-1 block text-xs uppercase tracking-wide text-gray-400"
              >
                Next of kin email
              </label>
              <Input
                id="kinEmail"
                type="email"
                placeholder="jamie@example.com"
                value={form.kinEmail}
                onChange={handleChange}
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label
                htmlFor="graceDays"
                className="mb-1 block text-xs uppercase tracking-wide text-gray-400"
              >
                Grace period (days)
              </label>
              <select
                id="graceDays"
                value={form.graceDays}
                onChange={handleChange}
                className="w-full rounded-xl border border-borderColor bg-[#1A1A20] px-4 py-2.5 text-white focus:outline-none focus:ring-1 focus:ring-primary"
              >
                <option value="3">3 days</option>
                <option value="7">7 days</option>
                <option value="14">14 days</option>
              </select>
            </div>
            <div>
              <label
                htmlFor="wallet"
                className="mb-1 block text-xs uppercase tracking-wide text-gray-400"
              >
                Wallet address
              </label>
              <Input
                id="wallet"
                type="text"
                placeholder="0x..."
                value={form.wallet}
                onChange={handleChange}
                required
              />
            </div>
          </div>

          <div>
            <label
              htmlFor="password"
              className="mb-1 block text-xs uppercase tracking-wide text-gray-400"
            >
              Password
            </label>
            <Input
              id="password"
              type="password"
              placeholder="••••••••"
              value={form.password}
              onChange={handleChange}
              required
            />
          </div>

          <div className="mt-2 rounded-lg border-l-4 border-accent bg-primary/10 p-3 text-xs text-gray-300">
            ✉️ An invitation email will be sent to your next of kin. They must
            accept before your agent is active.
          </div>

          <Button type="submit" isLoading={isLoading} className="mt-2 w-full">
            ✈️ Send invitation &amp; register
          </Button>
        </form>
      </div>
    </div>
  );
}
