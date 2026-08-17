"use client";

import { useState } from "react";
import { LoginForm } from "@/components/LoginForm";
import { TicketUploader } from "@/components/TicketUploader";
import type { Session } from "@/lib/auth";

export default function Home() {
  const [session, setSession] = useState<Session | null>(null);

  if (!session) {
    return <LoginForm onLogin={setSession} />;
  }

  return <TicketUploader session={session} onLogout={() => setSession(null)} />;
}
