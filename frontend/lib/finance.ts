import type { ProcessedTicket } from "./tickets";

/**
 * Best-effort parse of a Textract-extracted amount string ("412,03 €", "$1,234.56", ...)
 * into a number. Textract gives us raw OCR text, not a normalized value, so this is a
 * heuristic: whichever of "," or "." appears last is treated as the decimal separator.
 */
export function parseAmount(raw?: string): number | null {
  if (!raw) return null;

  const cleaned = raw.replace(/[^0-9.,-]/g, "");
  if (!cleaned) return null;

  const lastComma = cleaned.lastIndexOf(",");
  const lastDot = cleaned.lastIndexOf(".");
  let normalized = cleaned;

  if (lastComma > -1 && lastDot > -1) {
    normalized =
      lastComma > lastDot
        ? cleaned.replace(/\./g, "").replace(",", ".")
        : cleaned.replace(/,/g, "");
  } else if (lastComma > -1) {
    const decimals = cleaned.length - lastComma - 1;
    normalized = decimals === 2 ? cleaned.replace(",", ".") : cleaned.replace(/,/g, "");
  }

  const value = Number.parseFloat(normalized);
  return Number.isFinite(value) ? value : null;
}

export function extractCurrencySymbol(raw?: string): string | null {
  if (!raw) return null;
  const match = raw.match(/[€$£¥]/);
  return match ? match[0] : null;
}

export function formatCurrency(amount: number, symbol: string | null): string {
  const rounded = amount.toFixed(2);
  return symbol ? `${symbol}${rounded}` : rounded;
}

function ticketAmount(ticket: ProcessedTicket): number | null {
  return parseAmount(ticket.total ?? ticket.pages?.[0]?.fields.TOTAL);
}

function ticketVendor(ticket: ProcessedTicket): string | undefined {
  return ticket.vendorName ?? ticket.pages?.[0]?.fields.VENDOR_NAME;
}

export type MonthlySummary = {
  monthKey: string;
  label: string;
  total: number;
  count: number;
};

/**
 * Grouped by processing month (processedAt), not the OCR'd receipt date — Textract's
 * INVOICE_RECEIPT_DATE is free-text with no reliable, unambiguous format (DD/MM vs
 * MM/DD, etc.), while processedAt is a timestamp we control.
 */
export function summarizeByMonth(tickets: ProcessedTicket[]): MonthlySummary[] {
  const buckets = new Map<string, { total: number; count: number }>();

  for (const ticket of tickets) {
    if (ticket.status !== "PROCESSED") continue;
    const amount = ticketAmount(ticket);
    if (amount === null) continue;

    const date = new Date(Number(ticket.processedAt) * 1000);
    const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;

    const bucket = buckets.get(monthKey) ?? { total: 0, count: 0 };
    bucket.total += amount;
    bucket.count += 1;
    buckets.set(monthKey, bucket);
  }

  return Array.from(buckets.entries())
    .map(([monthKey, { total, count }]) => ({
      monthKey,
      label: new Date(`${monthKey}-01T00:00:00`).toLocaleDateString(undefined, {
        month: "long",
        year: "numeric",
      }),
      total,
      count,
    }))
    .sort((a, b) => (a.monthKey < b.monthKey ? 1 : -1));
}

export type VendorSummary = {
  vendor: string;
  total: number;
  count: number;
};

export type FinanceSummary = {
  totalSpend: number;
  ticketCount: number;
  processedCount: number;
  failedCount: number;
  averageTicket: number;
  currencySymbol: string | null;
  mixedCurrencies: boolean;
  topVendors: VendorSummary[];
  months: MonthlySummary[];
};

export function summarizeFinances(tickets: ProcessedTicket[]): FinanceSummary {
  const processed = tickets.filter((t) => t.status === "PROCESSED");

  let totalSpend = 0;
  let amountCount = 0;
  const currencyCounts = new Map<string, number>();
  const vendorTotals = new Map<string, { total: number; count: number }>();

  for (const ticket of processed) {
    const rawTotal = ticket.total ?? ticket.pages?.[0]?.fields.TOTAL;
    const amount = parseAmount(rawTotal);
    if (amount !== null) {
      totalSpend += amount;
      amountCount += 1;
    }

    const symbol = extractCurrencySymbol(rawTotal);
    if (symbol) currencyCounts.set(symbol, (currencyCounts.get(symbol) ?? 0) + 1);

    const vendor = ticketVendor(ticket);
    if (vendor && amount !== null) {
      const entry = vendorTotals.get(vendor) ?? { total: 0, count: 0 };
      entry.total += amount;
      entry.count += 1;
      vendorTotals.set(vendor, entry);
    }
  }

  const currencySymbol = [...currencyCounts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;

  const topVendors = [...vendorTotals.entries()]
    .map(([vendor, { total, count }]) => ({ vendor, total, count }))
    .sort((a, b) => b.total - a.total)
    .slice(0, 5);

  return {
    totalSpend,
    ticketCount: tickets.length,
    processedCount: processed.length,
    failedCount: tickets.length - processed.length,
    averageTicket: amountCount > 0 ? totalSpend / amountCount : 0,
    currencySymbol,
    mixedCurrencies: currencyCounts.size > 1,
    topVendors,
    months: summarizeByMonth(tickets),
  };
}
