"use client";

import type { ProcessedTicket } from "@/lib/tickets";

function formatDate(processedAt: string): string {
  const ms = Number(processedAt) * 1000;
  if (!Number.isFinite(ms)) return "Unknown date";
  return new Date(ms).toLocaleString();
}

function summarize(ticket: ProcessedTicket): string {
  const page = ticket.pages?.[0]?.fields;
  const parts = [
    ticket.vendorName ?? page?.VENDOR_NAME,
    ticket.total ?? page?.TOTAL,
    ticket.receiptDate ?? page?.INVOICE_RECEIPT_DATE,
  ].filter(Boolean);
  return parts.length > 0 ? parts.join(" · ") : "No details extracted";
}

function lineItemLabel(item: Record<string, string>): string {
  const description = item.ITEM ?? item.PRODUCT_CODE ?? "Item";
  const quantity = item.QUANTITY ? `x${item.QUANTITY}` : null;
  const price = item.PRICE ?? item.UNIT_PRICE;
  return [description, quantity, price].filter(Boolean).join(" · ");
}

export function TicketList({
  tickets,
  loading,
  error,
  onRefresh,
}: {
  tickets: ProcessedTicket[] | null;
  loading: boolean;
  error: string | null;
  onRefresh: () => void;
}) {
  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-black dark:text-zinc-50">Your tickets</h2>
        <button
          type="button"
          onClick={onRefresh}
          disabled={loading}
          className="text-sm text-zinc-500 hover:text-black disabled:opacity-40 dark:text-zinc-400 dark:hover:text-zinc-50"
        >
          {loading ? "Refreshing…" : "Refresh"}
        </button>
      </div>

      {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}

      {tickets === null && loading && (
        <p className="text-sm text-zinc-500 dark:text-zinc-400">Loading…</p>
      )}

      {tickets?.length === 0 && (
        <p className="text-sm text-zinc-500 dark:text-zinc-400">
          No tickets yet — upload one above to see it here once it&apos;s processed.
        </p>
      )}

      {tickets && tickets.length > 0 && (
        <ul className="flex flex-col gap-3">
          {tickets.map((ticket) => (
            <li
              key={ticket.ticketId}
              className="flex flex-col gap-1 rounded-lg border border-zinc-200 bg-white p-3 dark:border-zinc-800 dark:bg-zinc-900"
            >
              <div className="flex items-center justify-between gap-3">
                <span className="truncate text-sm font-medium text-black dark:text-zinc-50">
                  {ticket.status === "PROCESSED" ? summarize(ticket) : "Processing failed"}
                </span>
                <span
                  className={`shrink-0 text-xs font-medium ${
                    ticket.status === "PROCESSED"
                      ? "text-green-600 dark:text-green-400"
                      : "text-red-600 dark:text-red-400"
                  }`}
                >
                  {ticket.status}
                </span>
              </div>
              <span className="text-xs text-zinc-500 dark:text-zinc-400">
                {formatDate(ticket.processedAt)}
              </span>
              {ticket.status === "FAILED" && ticket.error && (
                <span className="text-xs text-red-600 dark:text-red-400">{ticket.error}</span>
              )}
              {ticket.status === "PROCESSED" &&
                ticket.pages?.some((page) => (page.lineItems?.length ?? 0) > 0) && (
                  <details className="text-xs text-zinc-600 dark:text-zinc-400">
                    <summary className="cursor-pointer select-none">What was bought</summary>
                    <ul className="mt-1 flex flex-col gap-0.5 pl-3">
                      {ticket.pages.flatMap((page, pageIndex) =>
                        (page.lineItems ?? []).map((item, itemIndex) => (
                          <li key={`${pageIndex}-${itemIndex}`}>{lineItemLabel(item)}</li>
                        ))
                      )}
                    </ul>
                  </details>
                )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
