"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { useLocalStorage } from "@/hooks/useLocalStorage";
import {
  emailSchema,
  nameSchema,
  walletAddressSchema,
  passwordSchema,
} from "@/lib/validators";
import { toast } from "sonner";

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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      nameSchema.parse(form.ownerName);
      emailSchema.parse(form.ownerEmail);
      nameSchema.parse(form.kinName);
      emailSchema.parse(form.kinEmail);
      walletAddressSchema.parse(form.wallet);
      passwordSchema.parse(form.password);
    } catch {
      toast.error("Invalid input format");
      return;
    }

    setIsLoading(true);
    const registrationId = `reg_${Date.now()}_${Math.random().toString(36).substring(2)}`;
    const registrationData = {
      registrationId,
      ...form,
      createdAt: new Date().toISOString(),
      kinConfirmed: false,
      chain: "0G Chain",
    };
    setPending(registrationData);

    console.log(
      `📧 Invitation sent to ${form.kinEmail} with link: ${window.location.origin}/confirm-kin/${registrationId}?email=${encodeURIComponent(form.kinEmail)}&owner=${encodeURIComponent(form.ownerName)}`
    );
    toast.success(`Invitation sent to ${form.kinEmail}`);
    router.push("/login");
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-bgDark p-4">
      <div className="w-full max-w-md rounded-2xl border border-borderColor bg-cardBg p-8">
        <div className="mb-6 flex items-center gap-2">
          <span className="text-2xl">⌛</span>
          <span className="bg-gradient-to-r from-white to-accent bg-clip-text text-xl font-bold text-transparent">
            successor
          </span>
        </div>
        <h2 className="text-2xl font-semibold">Create your plan</h2>
        <p className="mb-6 text-sm text-gray-400">
          Secure your digital legacy on 0G Chain
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <Input
            placeholder="Your full name"
            value={form.ownerName}
            onChange={(e) => setForm({ ...form, ownerName: e.target.value })}
            required
          />
          <Input
            type="email"
            placeholder="Your email"
            value={form.ownerEmail}
            onChange={(e) => setForm({ ...form, ownerEmail: e.target.value })}
            required
          />
          <div className="grid grid-cols-2 gap-3">
            <Input
              placeholder="Next of kin name"
              value={form.kinName}
              onChange={(e) => setForm({ ...form, kinName: e.target.value })}
              required
            />
            <Input
              type="email"
              placeholder="Kin email"
              value={form.kinEmail}
              onChange={(e) => setForm({ ...form, kinEmail: e.target.value })}
              required
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <select
              value={form.graceDays}
              onChange={(e) => setForm({ ...form, graceDays: e.target.value })}
              className="rounded-xl border border-borderColor bg-[#1A1A20] px-4 py-3 text-white focus:border-primary focus:outline-none"
            >
              <option value="3">3 days</option>
              <option value="7">7 days</option>
              <option value="14">14 days</option>
            </select>
            <Input
              placeholder="Wallet address (0x...)"
              value={form.wallet}
              onChange={(e) => setForm({ ...form, wallet: e.target.value })}
              required
            />
          </div>
          <Input
            type="password"
            placeholder="Password"
            value={form.password}
            onChange={(e) => setForm({ ...form, password: e.target.value })}
            required
          />
          <Button type="submit" isLoading={isLoading} className="w-full">
            Send invitation &amp; register
          </Button>
        </form>
      </div>
    </div>
  );
}
