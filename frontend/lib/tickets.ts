import { getRuntimeConfig } from "./config";

export type ExpensePage = {
  fields: Record<string, string>;
  // Absent on tickets processed before line-item extraction was added.
  lineItems?: Record<string, string>[];
};

export type ProcessedTicket = {
  userId: string;
  ticketId: string;
  status: "PROCESSED" | "FAILED";
  bucket: string;
  key: string;
  processedAt: string;
  vendorName?: string;
  total?: string;
  receiptDate?: string;
  pages?: ExpensePage[];
  error?: string;
};

export async function listTickets(idToken: string): Promise<ProcessedTicket[]> {
  const config = await getRuntimeConfig();

  const response = await fetch(`${config.apiBaseUrl}tickets`, {
    method: "GET",
    headers: { Authorization: `Bearer ${idToken}` },
  });

  if (!response.ok) {
    throw new Error("Could not load tickets");
  }

  const { tickets } = (await response.json()) as { tickets: ProcessedTicket[] };
  return tickets;
}

export async function requestUploadUrl(
  idToken: string,
  contentType: string
): Promise<{ uploadUrl: string; key: string }> {
  const config = await getRuntimeConfig();

  const response = await fetch(`${config.apiBaseUrl}tickets/presigned-url`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${idToken}`,
    },
    body: JSON.stringify({ contentType }),
  });

  if (!response.ok) {
    throw new Error("Could not get an upload URL");
  }

  return response.json();
}

export async function uploadTicket(uploadUrl: string, file: File): Promise<void> {
  const response = await fetch(uploadUrl, {
    method: "PUT",
    headers: { "Content-Type": file.type },
    body: file,
  });

  if (!response.ok) {
    throw new Error("Upload failed");
  }
}
