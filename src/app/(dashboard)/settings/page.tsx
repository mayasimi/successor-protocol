"use client";

import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { useState } from "react";

export default function SettingsPage() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    // TODO: save settings
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Settings</h1>
        <p className="text-muted text-sm mt-1">Manage your account preferences</p>
      </div>

      <Card>
        <form onSubmit={handleSave} className="space-y-4">
          <h2 className="text-white font-semibold">Profile</h2>
          <Input
            label="Full Name"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Jane Doe"
          />
          <Input
            label="Email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
          />
          <Button type="submit">Save Changes</Button>
        </form>
      </Card>
    </div>
  );
}
