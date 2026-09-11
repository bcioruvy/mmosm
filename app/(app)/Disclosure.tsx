"use client";

import { useState } from "react";

/**
 * A small trigger button that reveals its children (a form) in place
 * when clicked, and hides them again on Cancel. A successful submit
 * triggers a full server round-trip (revalidatePath + redirect), so
 * the component remounts closed on its own — no state to reset here.
 */
export default function Disclosure({
  label,
  icon,
  children,
}: {
  label: string;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);

  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className="inline-flex items-center gap-1.5 text-xs">
        {icon}
        {label}
      </button>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {children}
      <button
        type="button"
        onClick={() => setOpen(false)}
        className="text-xs text-muted"
        style={{
          background: "none",
          border: "none",
          textDecoration: "underline",
          cursor: "pointer",
          color: "var(--color-text-muted)",
        }}
      >
        Cancel
      </button>
    </div>
  );
}
