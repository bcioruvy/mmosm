"use server";

import sql from "@/lib/db";
import { requirePermission } from "@/lib/authz";
import { logAudit } from "@/lib/audit";
import { postJournalEntry } from "@/lib/journal";
import { getAccountsReceivableAccount } from "@/lib/controlAccounts";
import { PERMISSIONS } from "@/lib/permissions";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

type RawLine = { description: string; quantity: string; unitPrice: string; discountPercent: string };

export async function createInvoice(formData: FormData) {
  const session = await requirePermission(PERMISSIONS.MANAGE_TRANSACTIONS);

  const customerId = String(formData.get("customerId") ?? "");
  const invoiceDate = String(formData.get("invoiceDate") ?? "");
  const dueDate = String(formData.get("dueDate") ?? "");
  const revenueAccountId = String(formData.get("revenueAccountId") ?? "");
  const notes = String(formData.get("notes") ?? "").trim();
  const linesJson = String(formData.get("linesJson") ?? "[]");

  let rawLines: RawLine[] = [];
  try {
    rawLines = JSON.parse(linesJson);
  } catch {
    redirect(`/invoices?error=${encodeURIComponent("Invalid line items.")}`);
  }

  const lines = rawLines
    .map((l) => ({
      description: (l.description ?? "").trim(),
      quantity: Number(l.quantity),
      unitPrice: Number(l.unitPrice),
      discountPercent: Number(l.discountPercent) || 0,
    }))
    .filter((l) => l.description && Number.isFinite(l.quantity) && l.quantity > 0 && Number.isFinite(l.unitPrice) && l.unitPrice >= 0);

  if (!customerId || !invoiceDate || !dueDate || !revenueAccountId || lines.length === 0) {
    redirect(
      `/invoices?error=${encodeURIComponent("Customer, dates, revenue account, and at least one valid line item are required.")}`
    );
  }

  const [customer] = await sql`SELECT id FROM customers WHERE id = ${customerId} AND is_active = true`;
  if (!customer) redirect(`/invoices?error=${encodeURIComponent("Customer not found.")}`);

  const [revenueAccount] = await sql`
    SELECT id FROM accounts WHERE id = ${revenueAccountId} AND type = 'revenue' AND is_active = true
  `;
  if (!revenueAccount) redirect(`/invoices?error=${encodeURIComponent("Choose a valid revenue account.")}`);

  let invoiceId: number;
  try {
    invoiceId = await sql.begin(async (tx) => {
      const [invoice] = await tx`
        INSERT INTO invoices (invoice_number, customer_id, invoice_date, due_date, revenue_account_id, notes, status, created_by)
        VALUES (
          'INV-' || lpad(nextval('invoice_number_seq')::text, 5, '0'),
          ${customerId}, ${invoiceDate}, ${dueDate}, ${revenueAccountId}, ${notes || null}, 'draft', ${session.user.id}
        )
        RETURNING id
      `;

      for (const line of lines) {
        const lineTotal = Math.round(line.quantity * line.unitPrice * (1 - line.discountPercent / 100) * 100) / 100;
        await tx`
          INSERT INTO invoice_lines (invoice_id, description, quantity, unit_price, discount_percent, line_total)
          VALUES (${invoice.id}, ${line.description}, ${line.quantity}, ${line.unitPrice}, ${line.discountPercent}, ${lineTotal})
        `;
      }

      return invoice.id as number;
    });
  } catch (err: any) {
    redirect(`/invoices?error=${encodeURIComponent("Could not create invoice.")}`);
  }

  await logAudit({
    actorId: session.user.id,
    action: "create",
    entityType: "invoice",
    entityId: invoiceId,
    details: { customerId, lineCount: lines.length },
  });

  revalidatePath("/invoices");
  redirect(`/invoices/${invoiceId}`);
}

export async function sendInvoice(formData: FormData) {
  const session = await requirePermission(PERMISSIONS.MANAGE_TRANSACTIONS);
  const invoiceId = String(formData.get("id") ?? "");

  const [invoice] = await sql`
    SELECT i.id, i.invoice_number, i.status, i.invoice_date, i.revenue_account_id, c.name AS customer_name
    FROM invoices i JOIN customers c ON c.id = i.customer_id
    WHERE i.id = ${invoiceId}
  `;
  if (!invoice) redirect(`/invoices?error=${encodeURIComponent("Invoice not found.")}`);
  if (invoice.status !== "draft") {
    redirect(`/invoices/${invoiceId}?error=${encodeURIComponent("Only draft invoices can be sent.")}`);
  }

  const [{ total }] = await sql`
    SELECT COALESCE(SUM(line_total), 0) AS total FROM invoice_lines WHERE invoice_id = ${invoiceId}
  `;
  if (Number(total) <= 0) {
    redirect(`/invoices/${invoiceId}?error=${encodeURIComponent("Invoice has no line items.")}`);
  }

  let error: string | null = null;
  try {
    const ar = await getAccountsReceivableAccount();
    await postJournalEntry({
      entryDate: invoice.invoice_date,
      description: `Invoice ${invoice.invoice_number} — ${invoice.customer_name}`,
      sourceType: "invoice",
      createdBy: session.user.id,
      lines: [
        { accountId: ar.id, debit: Number(total) },
        { accountId: invoice.revenue_account_id, credit: Number(total) },
      ],
      linkSource: async (tx, journalEntryId) => {
        await tx`UPDATE invoices SET status = 'sent', journal_entry_id = ${journalEntryId} WHERE id = ${invoiceId}`;
        return invoiceId;
      },
    });
    await logAudit({
      actorId: session.user.id,
      action: "send",
      entityType: "invoice",
      entityId: invoiceId,
      details: { total: Number(total) },
    });
  } catch (err: any) {
    error = err?.message || "Could not send invoice.";
  }

  if (error) redirect(`/invoices/${invoiceId}?error=${encodeURIComponent(error)}`);
  revalidatePath(`/invoices/${invoiceId}`);
  revalidatePath("/invoices");
  redirect(`/invoices/${invoiceId}?success=1`);
}

export async function deleteInvoiceDraft(formData: FormData) {
  const session = await requirePermission(PERMISSIONS.MANAGE_TRANSACTIONS);
  const invoiceId = String(formData.get("id") ?? "");

  const [invoice] = await sql`SELECT status, invoice_number FROM invoices WHERE id = ${invoiceId}`;
  if (!invoice) redirect(`/invoices?error=${encodeURIComponent("Invoice not found.")}`);
  if (invoice.status !== "draft") {
    redirect(`/invoices?error=${encodeURIComponent("Only draft invoices can be deleted.")}`);
  }

  await sql.begin(async (tx) => {
    await tx`DELETE FROM invoice_lines WHERE invoice_id = ${invoiceId}`;
    await tx`DELETE FROM invoices WHERE id = ${invoiceId}`;
  });

  await logAudit({
    actorId: session.user.id,
    action: "delete_draft",
    entityType: "invoice",
    entityId: invoiceId,
    details: { invoiceNumber: invoice.invoice_number },
  });

  revalidatePath("/invoices");
  redirect("/invoices?success=1");
}
