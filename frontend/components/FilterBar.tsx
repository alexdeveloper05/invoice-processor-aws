"use client";

import type { PeriodFilter, StatusFilter } from "@/lib/filters";

const PERIOD_PRESETS: { label: string; period: PeriodFilter }[] = [
  { label: "All time", period: { type: "all" } },
  { label: "Last 30 days", period: { type: "days", days: 30 } },
  { label: "Last 90 days", period: { type: "days", days: 90 } },
  { label: "This year", period: { type: "year", year: new Date().getFullYear() } },
];

function periodKey(period: PeriodFilter): string {
  switch (period.type) {
    case "all":
      return "all";
    case "days":
      return `days-${period.days}`;
    case "year":
      return `year-${period.year}`;
    case "custom":
      return "custom";
  }
}

export function FilterBar({
  period,
  onPeriodChange,
  status,
  onStatusChange,
  vendorQuery,
  onVendorQueryChange,
}: {
  period: PeriodFilter;
  onPeriodChange: (period: PeriodFilter) => void;
  status: StatusFilter;
  onStatusChange: (status: StatusFilter) => void;
  vendorQuery: string;
  onVendorQueryChange: (query: string) => void;
}) {
  const isCustom = period.type === "custom";

  return (
    <div className="flex flex-col gap-3 rounded-lg border border-zinc-200 bg-white p-3 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
      <div className="flex flex-wrap gap-2">
        {PERIOD_PRESETS.map((preset) => (
          <button
            key={periodKey(preset.period)}
            type="button"
            onClick={() => onPeriodChange(preset.period)}
            className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
              periodKey(period) === periodKey(preset.period)
                ? "bg-[#2a78d6] text-white dark:bg-[#3987e5]"
                : "bg-zinc-100 text-zinc-600 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700"
            }`}
          >
            {preset.label}
          </button>
        ))}
        <button
          type="button"
          onClick={() => onPeriodChange({ type: "custom", from: "", to: "" })}
          className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
            isCustom
              ? "bg-[#2a78d6] text-white dark:bg-[#3987e5]"
              : "bg-zinc-100 text-zinc-600 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700"
          }`}
        >
          Custom range
        </button>
      </div>

      {isCustom && (
        <div className="flex flex-wrap items-center gap-2 text-xs text-zinc-600 dark:text-zinc-300">
          <label className="flex items-center gap-1">
            From
            <input
              type="date"
              value={period.from}
              onChange={(event) => onPeriodChange({ ...period, from: event.target.value })}
              className="rounded-md border border-zinc-300 bg-white px-2 py-1 text-black dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-50"
            />
          </label>
          <label className="flex items-center gap-1">
            To
            <input
              type="date"
              value={period.to}
              onChange={(event) => onPeriodChange({ ...period, to: event.target.value })}
              className="rounded-md border border-zinc-300 bg-white px-2 py-1 text-black dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-50"
            />
          </label>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <select
          value={status}
          onChange={(event) => onStatusChange(event.target.value as StatusFilter)}
          className="rounded-md border border-zinc-300 bg-white px-2 py-1.5 text-xs text-black dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-50"
        >
          <option value="all">All statuses</option>
          <option value="PROCESSED">Processed</option>
          <option value="FAILED">Failed</option>
        </select>

        <input
          type="search"
          value={vendorQuery}
          onChange={(event) => onVendorQueryChange(event.target.value)}
          placeholder="Search by vendor…"
          className="min-w-0 flex-1 rounded-md border border-zinc-300 bg-white px-2 py-1.5 text-xs text-black placeholder:text-zinc-400 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-50"
        />
      </div>
    </div>
  );
}
