"use client";

import { useEffect, useState } from "react";
import { LoginForm } from "@/components/LoginForm";
import { TicketUploader } from "@/components/TicketUploader";
import { getSession, logout, type Session } from "@/lib/auth";

export default function Home() {
  const [session, setSession] = useState<Session | null | undefined>(undefined);

  useEffect(() => {
    getSession().then(setSession);
  }, []);

  if (session === undefined) {
    return <div className="flex flex-1 bg-zinc-50 dark:bg-black" />;
  }

  if (!session) {
    return <LoginForm onLogin={setSession} />;
  }

  return (
    <TicketUploader
      onSessionExpired={() => setSession(null)}
      onLogout={() => {
        logout();
        setSession(null);
      }}
    />
  );
}
