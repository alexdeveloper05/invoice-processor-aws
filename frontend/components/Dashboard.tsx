"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { getSession } from "@/lib/auth";
import { filterByPeriod, filterByStatus, filterByVendor } from "@/lib/filters";
import type { PeriodFilter, StatusFilter } from "@/lib/filters";
import { listTickets, type ProcessedTicket } from "@/lib/tickets";
import { UploadPanel } from "./UploadPanel";
import { TicketList } from "./TicketList";
import { FinancesPanel } from "./FinancesPanel";
import { FilterBar } from "./FilterBar";

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

  const [period, setPeriod] = useState<PeriodFilter>({ type: "all" });
  const [status, setStatus] = useState<StatusFilter>("all");
  const [vendorQuery, setVendorQuery] = useState("");

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

  const filteredTickets = useMemo(() => {
    if (!tickets) return null;
    return filterByVendor(filterByStatus(filterByPeriod(tickets, period), status), vendorQuery);
  }, [tickets, period, status, vendorQuery]);

  return (
    <div className="flex min-h-full flex-1 flex-col bg-zinc-50 font-sans dark:bg-black">
      <header className="sticky top-0 z-10 border-b border-zinc-200 bg-white/90 backdrop-blur dark:border-zinc-800 dark:bg-black/90">
        <div className="mx-auto flex w-full max-w-4xl flex-wrap items-center justify-between gap-4 px-6 py-4">
          <div className="flex items-center gap-2">
            <span className="h-2.5 w-2.5 rounded-full bg-[#2a78d6] dark:bg-[#3987e5]" />
            <span className="text-base font-semibold text-black dark:text-zinc-50">
              Invoice Processor
            </span>
          </div>

          <nav className="flex gap-1">
            {TABS.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => setTab(item.id)}
                className={`rounded-full px-3 py-1.5 text-sm font-medium transition-colors ${
                  tab === item.id
                    ? "bg-zinc-900 text-white dark:bg-zinc-50 dark:text-black"
                    : "text-zinc-500 hover:bg-zinc-100 hover:text-black dark:text-zinc-400 dark:hover:bg-zinc-900 dark:hover:text-zinc-50"
                }`}
              >
                {item.label}
              </button>
            ))}
          </nav>

          <button
            type="button"
            onClick={onLogout}
            className="text-sm text-zinc-500 hover:text-black dark:text-zinc-400 dark:hover:text-zinc-50"
          >
            Sign out
          </button>
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-4xl flex-1 flex-col gap-6 px-6 py-8">
        {tab === "upload" && (
          <>
            <div className="flex flex-col gap-1">
              <h1 className="text-xl font-semibold text-black dark:text-zinc-50">
                Upload your tickets
              </h1>
              <p className="text-sm text-zinc-600 dark:text-zinc-400">
                Upload photos or PDFs of your receipts and we&apos;ll extract the data
                automatically.
              </p>
            </div>
            <UploadPanel onUploaded={refreshTickets} onSessionExpired={onSessionExpired} />
          </>
        )}

        {tab !== "upload" && (
          <FilterBar
            period={period}
            onPeriodChange={setPeriod}
            status={status}
            onStatusChange={setStatus}
            vendorQuery={vendorQuery}
            onVendorQueryChange={setVendorQuery}
          />
        )}

        {tab === "tickets" && (
          <TicketList
            tickets={filteredTickets}
            loading={ticketsLoading}
            error={ticketsError}
            onRefresh={refreshTickets}
          />
        )}

        {tab === "finances" && <FinancesPanel tickets={filteredTickets ?? []} />}
      </main>
    </div>
  );
}
