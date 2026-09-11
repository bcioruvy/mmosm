"use client";

import { useState } from "react";
import { formatCurrency } from "@/lib/currency";

type Line = { accountId: string; debit: string; credit: string };
type Account = { id: number; code: string; name: string; type: string };

const EMPTY_LINE: Line = { accountId: "", debit: "", credit: "" };

export default function JournalLineEditor({ accounts }: { accounts: Account[] }) {
  const [lines, setLines] = useState<Line[]>([{ ...EMPTY_LINE }, { ...EMPTY_LINE }]);

  function updateAccount(i: number, accountId: string) {
    setLines((prev) => prev.map((l, idx) => (idx === i ? { ...l, accountId } : l)));
  }

  // Debit and credit are mutually exclusive on a line — typing into one clears the other,
  // so a line can't ambiguously carry both.
  function updateAmount(i: number, field: "debit" | "credit", value: string) {
    setLines((prev) =>
      prev.map((l, idx) => {
        if (idx !== i) return l;
        return field === "debit" ? { ...l, debit: value, credit: value ? "" : l.credit } : { ...l, credit: value, debit: value ? "" : l.debit };
      })
    );
  }

  function addLine() {
    setLines((prev) => [...prev, { ...EMPTY_LINE }]);
  }

  function removeLine(i: number) {
    setLines((prev) => prev.filter((_, idx) => idx !== i));
  }

  const totalDebit = lines.reduce((sum, l) => sum + (parseFloat(l.debit) || 0), 0);
  const totalCredit = lines.reduce((sum, l) => sum + (parseFloat(l.credit) || 0), 0);
  const hasAmounts = totalDebit > 0 || totalCredit > 0;
  const balanced = hasAmounts && Math.abs(totalDebit - totalCredit) < 0.005;

  return (
    <div>
      <input type="hidden" name="linesJson" value={JSON.stringify(lines)} />
      {lines.map((line, i) => (
        <div key={i} className="mb-2 flex flex-wrap items-center gap-2">
          <select value={line.accountId} onChange={(e) => updateAccount(i, e.target.value)} required className="min-w-[240px] flex-1">
            <option value="" disabled>
              Account…
            </option>
            {accounts.map((a) => (
              <option key={a.id} value={a.id}>
                {a.code} — {a.name} ({a.type})
              </option>
            ))}
          </select>
          <input
            type="number"
            step="0.01"
            min="0"
            placeholder="Debit"
            value={line.debit}
            onChange={(e) => updateAmount(i, "debit", e.target.value)}
            style={{ width: 110 }}
          />
          <input
            type="number"
            step="0.01"
            min="0"
            placeholder="Credit"
            value={line.credit}
            onChange={(e) => updateAmount(i, "credit", e.target.value)}
            style={{ width: 110 }}
          />
          <button type="button" onClick={() => removeLine(i)} disabled={lines.length === 2}>
            Remove
          </button>
        </div>
      ))}
      <button type="button" onClick={addLine}>
        + Add line
      </button>
      <p className={`mt-2 font-semibold ${balanced ? "text-success" : "text-error"}`}>
        Debits: {formatCurrency(totalDebit)} — Credits: {formatCurrency(totalCredit)}
        {hasAmounts ? (balanced ? " — Balanced" : " — Not balanced yet") : ""}
      </p>
    </div>
  );
}
