import type { Contact } from "@/types/database";

/**
 * Export leads/contacts data to CSV file and trigger download
 */
export function exportLeadsToCSV(contacts: Contact[], filename = "leads.csv") {
  const headers = [
    "Name",
    "Phone",
    "Email",
    "Address",
    "Interest Level",
    "Lead Status",
    "Contact Status",
    "Source",
    "Created",
    "Notes",
  ];

  const rows = contacts.map((contact) => [
    contact.name || "Unknown",
    contact.phone,
    contact.email || "",
    contact.address || "",
    contact.interest_level || "Unknown",
    contact.lead_status || "",
    contact.status,
    contact.source,
    new Date(contact.created_at).toLocaleString(),
    contact.lead_notes || contact.notes || "",
  ]);

  // Escape CSV values (handle quotes and commas)
  const escapeCSV = (value: string): string => {
    if (value.includes(",") || value.includes('"') || value.includes("\n")) {
      return `"${value.replace(/"/g, '""')}"`;
    }
    return value;
  };

  const csvContent = [
    headers.map(escapeCSV).join(","),
    ...rows.map((row) => row.map(escapeCSV).join(",")),
  ].join("\n");

  // Create blob and trigger download
  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);

  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.style.display = "none";
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);

  URL.revokeObjectURL(url);
}
