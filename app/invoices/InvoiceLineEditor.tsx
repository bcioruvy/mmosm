"use client";

import { useState } from "react";

type Line = { description: string; quantity: string; unitPrice: string; discountPercent: string };

const EMPTY_LINE: Line = { description: "", quantity: "1", unitPrice: "", discountPercent: "0" };

export default function InvoiceLineEditor() {
  const [lines, setLines] = useState<Line[]>([{ ...EMPTY_LINE }]);

  function updateLine(i: number, field: keyof Line, value: string) {
    setLines((prev) => prev.map((l, idx) => (idx === i ? { ...l, [field]: value } : l)));
  }

  function addLine() {
    setLines((prev) => [...prev, { ...EMPTY_LINE }]);
  }

  function removeLine(i: number) {
    setLines((prev) => prev.filter((_, idx) => idx !== i));
  }

  const total = lines.reduce((sum, l) => {
    const qty = parseFloat(l.quantity) || 0;
    const price = parseFloat(l.unitPrice) || 0;
    const discount = parseFloat(l.discountPercent) || 0;
    return sum + qty * price * (1 - discount / 100);
  }, 0);

  return (
    <div>
      <input type="hidden" name="linesJson" value={JSON.stringify(lines)} />
      {lines.map((line, i) => (
        <div key={i} style={{ display: "flex", gap: 8, marginBottom: 8, alignItems: "center" }}>
          <input
            placeholder="Description"
            value={line.description}
            onChange={(e) => updateLine(i, "description", e.target.value)}
            required
            style={{ flex: 2 }}
          />
          <input
            type="number"
            step="0.01"
            min="0.01"
            placeholder="Qty"
            value={line.quantity}
            onChange={(e) => updateLine(i, "quantity", e.target.value)}
            style={{ width: 70 }}
          />
          <input
            type="number"
            step="0.01"
            min="0"
            placeholder="Unit price"
            value={line.unitPrice}
            onChange={(e) => updateLine(i, "unitPrice", e.target.value)}
            style={{ width: 90 }}
          />
          <input
            type="number"
            step="0.01"
            min="0"
            max="100"
            placeholder="Disc %"
            value={line.discountPercent}
            onChange={(e) => updateLine(i, "discountPercent", e.target.value)}
            style={{ width: 70 }}
          />
          <button type="button" onClick={() => removeLine(i)} disabled={lines.length === 1}>
            Remove
          </button>
        </div>
      ))}
      <button type="button" onClick={addLine}>
        + Add line
      </button>
      <p>
        <strong>Total: ${total.toFixed(2)}</strong>
      </p>
    </div>
  );
}
