import type { ProcessedTicket } from "./tickets";

export type PeriodFilter =
  | { type: "all" }
  | { type: "days"; days: number }
  | { type: "year"; year: number }
  | { type: "custom"; from: string; to: string };

export type StatusFilter = "all" | "PROCESSED" | "FAILED";

const DAY_MS = 24 * 60 * 60 * 1000;

/** Filters by processing date (processedAt) — see lib/finance.ts for why. */
export function filterByPeriod(tickets: ProcessedTicket[], period: PeriodFilter): ProcessedTicket[] {
  if (period.type === "all") return tickets;

  let fromMs: number;
  let toMs: number;

  if (period.type === "days") {
    toMs = Date.now();
    fromMs = toMs - period.days * DAY_MS;
  } else if (period.type === "year") {
    fromMs = new Date(period.year, 0, 1).getTime();
    toMs = new Date(period.year + 1, 0, 1).getTime() - 1;
  } else {
    if (!period.from || !period.to) return tickets;
    fromMs = new Date(`${period.from}T00:00:00`).getTime();
    toMs = new Date(`${period.to}T23:59:59.999`).getTime();
  }

  return tickets.filter((ticket) => {
    const ms = Number(ticket.processedAt) * 1000;
    return ms >= fromMs && ms <= toMs;
  });
}

export function filterByStatus(tickets: ProcessedTicket[], status: StatusFilter): ProcessedTicket[] {
  if (status === "all") return tickets;
  return tickets.filter((ticket) => ticket.status === status);
}

export function filterByVendor(tickets: ProcessedTicket[], query: string): ProcessedTicket[] {
  const needle = query.trim().toLowerCase();
  if (!needle) return tickets;

  return tickets.filter((ticket) => {
    const vendor = ticket.vendorName ?? ticket.pages?.[0]?.fields?.VENDOR_NAME ?? "";
    return vendor.toLowerCase().includes(needle);
  });
}
