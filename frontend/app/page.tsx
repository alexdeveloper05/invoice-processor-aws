"use client";

import { useCallback, useRef, useState } from "react";

const ACCEPTED_TYPES = ["image/jpeg", "image/png", "image/webp", "application/pdf"];
const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024;

type Ticket = {
  id: string;
  file: File;
  previewUrl: string | null;
};

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function uploadLabel(count: number, status: "idle" | "uploading"): string {
  if (status === "uploading") return "Uploading…";
  if (count === 0) return "Upload tickets";
  return `Upload ${count} ticket${count === 1 ? "" : "s"}`;
}

export default function Home() {
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<"idle" | "uploading">("idle");
  const inputRef = useRef<HTMLInputElement>(null);

  const addFiles = useCallback((fileList: FileList | null) => {
    if (!fileList) return;

    const accepted: Ticket[] = [];
    let rejected = false;

    for (const file of Array.from(fileList)) {
      if (!ACCEPTED_TYPES.includes(file.type) || file.size > MAX_FILE_SIZE_BYTES) {
        rejected = true;
        continue;
      }
      accepted.push({
        id: `${file.name}-${file.lastModified}-${file.size}`,
        file,
        previewUrl: file.type.startsWith("image/") ? URL.createObjectURL(file) : null,
      });
    }

    setError(
      rejected ? "Some files were skipped — only JPG, PNG, WEBP or PDF up to 10MB are allowed." : null
    );
    setTickets((prev) => {
      const existingIds = new Set(prev.map((t) => t.id));
      return [...prev, ...accepted.filter((t) => !existingIds.has(t.id))];
    });
  }, []);

  const removeTicket = (id: string) => {
    setTickets((prev) => {
      const target = prev.find((t) => t.id === id);
      if (target?.previewUrl) URL.revokeObjectURL(target.previewUrl);
      return prev.filter((t) => t.id !== id);
    });
  };

  const handleDrop = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    addFiles(event.dataTransfer.files);
  };

  const handleUpload = async () => {
    setStatus("uploading");
    await new Promise((resolve) => setTimeout(resolve, 500));
    setStatus("idle");
    setError("Uploading isn't wired up yet — this is just the local preview.");
  };

  return (
    <div className="flex flex-1 flex-col items-center bg-zinc-50 font-sans dark:bg-black">
      <main className="flex w-full max-w-2xl flex-1 flex-col gap-6 px-6 py-16">
        <div className="flex flex-col gap-2">
          <h1 className="text-2xl font-semibold text-black dark:text-zinc-50">
            Upload your tickets
          </h1>
          <p className="text-zinc-600 dark:text-zinc-400">
            Upload photos or PDFs of your receipts and we&apos;ll extract the data automatically.
          </p>
        </div>

        <div
          onDragOver={(event) => event.preventDefault()}
          onDrop={handleDrop}
          onClick={() => inputRef.current?.click()}
          className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-zinc-300 bg-white px-6 py-12 text-center transition-colors hover:border-zinc-400 dark:border-zinc-700 dark:bg-zinc-900 dark:hover:border-zinc-600"
        >
          <p className="font-medium text-black dark:text-zinc-50">
            Drag & drop tickets here, or click to browse
          </p>
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            JPG, PNG, WEBP or PDF — up to 10MB each
          </p>
          <input
            ref={inputRef}
            type="file"
            multiple
            accept={ACCEPTED_TYPES.join(",")}
            onChange={(event) => addFiles(event.target.files)}
            className="hidden"
          />
        </div>

        {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}

        {tickets.length > 0 && (
          <ul className="flex flex-col gap-3">
            {tickets.map((ticket) => (
              <li
                key={ticket.id}
                className="flex items-center gap-3 rounded-lg border border-zinc-200 bg-white p-3 dark:border-zinc-800 dark:bg-zinc-900"
              >
                {ticket.previewUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={ticket.previewUrl}
                    alt={ticket.file.name}
                    className="h-12 w-12 rounded object-cover"
                  />
                ) : (
                  <div className="flex h-12 w-12 items-center justify-center rounded bg-zinc-100 text-xs font-medium text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400">
                    PDF
                  </div>
                )}
                <div className="flex flex-1 flex-col overflow-hidden">
                  <span className="truncate text-sm font-medium text-black dark:text-zinc-50">
                    {ticket.file.name}
                  </span>
                  <span className="text-xs text-zinc-500 dark:text-zinc-400">
                    {formatFileSize(ticket.file.size)}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => removeTicket(ticket.id)}
                  className="text-sm text-zinc-500 hover:text-red-600 dark:text-zinc-400 dark:hover:text-red-400"
                  aria-label={`Remove ${ticket.file.name}`}
                >
                  Remove
                </button>
              </li>
            ))}
          </ul>
        )}

        <button
          type="button"
          disabled={tickets.length === 0 || status === "uploading"}
          onClick={handleUpload}
          className="rounded-full bg-foreground px-5 py-3 text-sm font-medium text-background transition-colors disabled:cursor-not-allowed disabled:opacity-40 hover:enabled:bg-[#383838] dark:hover:enabled:bg-[#ccc]"
        >
          {uploadLabel(tickets.length, status)}
        </button>
      </main>
    </div>
  );
}
