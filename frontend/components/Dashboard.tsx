"use client";

import { useCallback, useEffect, useState } from "react";
import { getSession } from "@/lib/auth";
import { listTickets, type ProcessedTicket } from "@/lib/tickets";
import { UploadPanel } from "./UploadPanel";
import { TicketList } from "./TicketList";
import { FinancesPanel } from "./FinancesPanel";

type Tab = "upload" | "tickets" | "finances";

const TABS: { id: Tab; label: string }[] = [
  { id: "upload", label: "Upload" },
  { id: "tickets", label: "Tickets" },
  { id: "finances", label: "Finances" },
];

export function Dashboard({
  onLogout,
  onSessionExpired,
}: {
  onLogout: () => void;
  onSessionExpired: () => void;
}) {
  const [tab, setTab] = useState<Tab>("upload");
  const [tickets, setTickets] = useState<ProcessedTicket[] | null>(null);
  const [ticketsError, setTicketsError] = useState<string | null>(null);
  const [ticketsLoading, setTicketsLoading] = useState(false);

  const refreshTickets = useCallback(async () => {
    setTicketsLoading(true);
    setTicketsError(null);
    try {
      const session = await getSession();
      if (!session) {
        onSessionExpired();
        return;
      }
      setTickets(await listTickets(session.idToken));
    } catch {
      setTicketsError("Could not load your tickets.");
    } finally {
      setTicketsLoading(false);
    }
  }, [onSessionExpired]);

  useEffect(() => {
    // Fetch-on-mount for the shared ticket list every tab reads from.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    refreshTickets();
  }, [refreshTickets]);

  return (
    <div className="flex flex-1 flex-col items-center bg-zinc-50 font-sans dark:bg-black">
      <main className="flex w-full max-w-2xl flex-1 flex-col gap-6 px-6 py-16">
        <div className="flex items-start justify-between gap-4">
          <div className="flex flex-col gap-2">
            <h1 className="text-2xl font-semibold text-black dark:text-zinc-50">
              Invoice Processor
            </h1>
            <p className="text-zinc-600 dark:text-zinc-400">
              Upload photos or PDFs of your receipts and we&apos;ll extract the data automatically.
            </p>
          </div>
          <button
            type="button"
            onClick={onLogout}
            className="shrink-0 text-sm text-zinc-500 hover:text-black dark:text-zinc-400 dark:hover:text-zinc-50"
          >
            Sign out
          </button>
        </div>

        <div className="flex gap-1 border-b border-zinc-200 dark:border-zinc-800">
          {TABS.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setTab(item.id)}
              className={`-mb-px border-b-2 px-3 py-2 text-sm font-medium transition-colors ${
                tab === item.id
                  ? "border-black text-black dark:border-zinc-50 dark:text-zinc-50"
                  : "border-transparent text-zinc-500 hover:text-black dark:text-zinc-400 dark:hover:text-zinc-50"
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>

        {tab === "upload" && (
          <UploadPanel onUploaded={refreshTickets} onSessionExpired={onSessionExpired} />
        )}

        {tab === "tickets" && (
          <TicketList
            tickets={tickets}
            loading={ticketsLoading}
            error={ticketsError}
            onRefresh={refreshTickets}
          />
        )}

        {tab === "finances" && <FinancesPanel tickets={tickets ?? []} />}
      </main>
    </div>
  );
}
