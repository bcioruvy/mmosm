"use client";

import { useState } from "react";
import { Pencil } from "lucide-react";

/**
 * Click-to-edit text field: shows the current value (or a muted empty
 * placeholder) with a pencil icon; clicking it swaps in an inline form
 * that posts to the caller's own server action. No new server logic —
 * this only changes how an existing update action is triggered.
 */
export default function InlineEditField({
  action,
  hiddenFields,
  fieldName,
  value,
  placeholder,
}: {
  action: (formData: FormData) => void | Promise<void>;
  hiddenFields: Record<string, string | number>;
  fieldName: string;
  value: string | null;
  placeholder: string;
}) {
  const [editing, setEditing] = useState(false);

  if (!editing) {
    return (
      <button
        type="button"
        onClick={() => setEditing(true)}
        className="inline-flex items-center gap-1.5 text-left text-sm"
        style={{ background: "none", border: "none", padding: 0, cursor: "pointer" }}
      >
        <span className={value ? "" : "text-muted"}>{value || `No ${placeholder.toLowerCase()}`}</span>
        <Pencil className="h-3 w-3 text-muted" />
      </button>
    );
  }

  return (
    <form action={action} className="flex flex-wrap items-center gap-1.5">
      {Object.entries(hiddenFields).map(([name, val]) => (
        <input key={name} type="hidden" name={name} value={val} />
      ))}
      <input name={fieldName} defaultValue={value ?? ""} placeholder={placeholder} autoFocus style={{ width: 200 }} />
      <button type="submit" className="text-xs">
        Save
      </button>
      <button
        type="button"
        onClick={() => setEditing(false)}
        className="text-xs"
        style={{ background: "none", border: "none", textDecoration: "underline", cursor: "pointer" }}
      >
        Cancel
      </button>
    </form>
  );
}
