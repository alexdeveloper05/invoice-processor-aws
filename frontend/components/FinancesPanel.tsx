"use client";

import { useMemo } from "react";
import { formatCurrency, summarizeFinances } from "@/lib/finance";
import type { ProcessedTicket } from "@/lib/tickets";

function StatTile({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="flex flex-col gap-1 rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
      <span className="text-xs text-zinc-500 dark:text-zinc-400">{label}</span>
      <span className="text-xl font-semibold text-black dark:text-zinc-50">{value}</span>
      {hint && <span className="text-xs text-zinc-500 dark:text-zinc-400">{hint}</span>}
    </div>
  );
}

export function FinancesPanel({ tickets }: { tickets: ProcessedTicket[] }) {
  const summary = useMemo(() => summarizeFinances(tickets), [tickets]);
  const maxMonthTotal = Math.max(1, ...summary.months.map((m) => m.total));

  if (tickets.length === 0) {
    return (
      <p className="text-sm text-zinc-500 dark:text-zinc-400">
        No tickets yet — finances show up here once you&apos;ve uploaded and processed some.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      {summary.mixedCurrencies && (
        <p className="text-xs text-zinc-500 dark:text-zinc-400">
          Tickets use more than one currency symbol — totals below add raw amounts together
          regardless of currency.
        </p>
      )}

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatTile
          label="Total spend"
          value={formatCurrency(summary.totalSpend, summary.currencySymbol)}
        />
        <StatTile label="Tickets processed" value={String(summary.processedCount)} />
        <StatTile
          label="Average ticket"
          value={formatCurrency(summary.averageTicket, summary.currencySymbol)}
        />
        <StatTile
          label="Failed to process"
          value={String(summary.failedCount)}
          hint={summary.failedCount > 0 ? "Check the Tickets tab" : undefined}
        />
      </div>

      <div className="flex flex-col gap-3">
        <h3 className="text-sm font-semibold text-black dark:text-zinc-50">Monthly spend</h3>
        {summary.months.length === 0 ? (
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            No processed totals yet to break down by month.
          </p>
        ) : (
          <div className="flex flex-col gap-2">
            {summary.months.map((month) => (
              <div key={month.monthKey} className="flex items-center gap-3">
                <span className="w-28 shrink-0 text-xs text-zinc-500 dark:text-zinc-400">
                  {month.label}
                </span>
                <div className="h-2 flex-1 rounded-full bg-zinc-100 dark:bg-zinc-800">
                  <div
                    className="h-2 rounded-full bg-[#2a78d6] dark:bg-[#3987e5]"
                    style={{ width: `${(month.total / maxMonthTotal) * 100}%` }}
                  />
                </div>
                <span className="w-20 shrink-0 text-right text-xs font-medium text-black dark:text-zinc-50">
                  {formatCurrency(month.total, summary.currencySymbol)}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="flex flex-col gap-3">
        <h3 className="text-sm font-semibold text-black dark:text-zinc-50">Top vendors</h3>
        {summary.topVendors.length === 0 ? (
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            No vendor names extracted yet.
          </p>
        ) : (
          <ul className="flex flex-col gap-2">
            {summary.topVendors.map((vendor) => (
              <li
                key={vendor.vendor}
                className="flex items-center justify-between gap-3 rounded-lg border border-zinc-200 bg-white p-3 dark:border-zinc-800 dark:bg-zinc-900"
              >
                <span className="truncate text-sm text-black dark:text-zinc-50">{vendor.vendor}</span>
                <span className="shrink-0 text-sm font-medium text-black dark:text-zinc-50">
                  {formatCurrency(vendor.total, summary.currencySymbol)}
                  <span className="ml-1 text-xs font-normal text-zinc-500 dark:text-zinc-400">
                    ({vendor.count})
                  </span>
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
