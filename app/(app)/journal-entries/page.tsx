import { auth } from "@/auth";
import sql from "@/lib/db";
import { redirect } from "next/navigation";
import { PERMISSIONS } from "@/lib/permissions";
import { formatCurrency } from "@/lib/currency";
import {
  createManualJournalEntry,
  voidManualJournalEntry,
  updateJournalEntryDescription,
  correctManualJournalEntryDate,
} from "./actions";
import JournalLineEditor from "./JournalLineEditor";
import Disclosure from "../Disclosure";
import HideVoidedToggle from "../HideVoidedToggle";
import { NotebookPen, Ban, Plus, CalendarClock } from "lucide-react";

export default async function JournalEntriesPage({
  searchParams,
}: {
  searchParams: { error?: string; success?: string; showVoided?: string };
}) {
  const session = await auth();
  const permissions = session?.user?.permissions ?? [];
  if (!session?.user || !permissions.includes(PERMISSIONS.MANAGE_JOURNAL_ENTRIES)) {
    redirect("/");
  }
  const canVoid = permissions.includes(PERMISSIONS.VOID_TRANSACTIONS);

  const [entriesRaw, accounts] = await Promise.all([
    sql`
      SELECT id, entry_date, description, created_at, voided_at
      FROM journal_entries
      WHERE source_type = 'manual'
      ORDER BY entry_date DESC, id DESC
    `,
    sql`SELECT id, code, name, type FROM accounts WHERE is_active = true ORDER BY code`,
  ]);

  const entries = await Promise.all(
    entriesRaw.map(async (e: any) => ({
      ...e,
      lines: await sql`
        SELECT jl.debit, jl.credit, a.code, a.name
        FROM journal_lines jl
        JOIN accounts a ON a.id = jl.account_id
        WHERE jl.entry_id = ${e.id}
        ORDER BY jl.id
      `,
    }))
  );

  const showVoided = searchParams.showVoided === "1";
  const visibleEntries = showVoided ? entries : entries.filter((e: any) => !e.voided_at);
  const hiddenCount = entries.length - visibleEntries.length;

  return (
    <main className="max-w-screen-2xl px-6 py-10">
      <h1 className="flex items-center gap-2 text-2xl font-bold">
        <NotebookPen className="h-6 w-6 text-brand" />
        Manual Journal Entries
      </h1>
      <p className="mt-2 max-w-2xl text-sm text-muted">
        For postings none of the other flows cover — owner contributions and draws, corrections, and
        anything else that needs a direct debit/credit. Owner_admin only, since this bypasses the
        account-type checks and automatic AR/AP handling the structured flows normally provide.
      </p>
      {searchParams.error && <p className="mt-3 text-sm font-medium text-error">{searchParams.error}</p>}
      {searchParams.success && <p className="mt-3 text-sm font-medium text-success">Done.</p>}

      <div className="mt-3">
        <HideVoidedToggle showVoided={showVoided} hiddenCount={hiddenCount} />
      </div>

      <div className="mt-6 space-y-4">
        {visibleEntries.map((e: any) => (
          <div key={e.id} className="rounded-xl border border-border bg-surface p-5 shadow-sm" style={{ opacity: e.voided_at ? 0.5 : 1 }}>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-semibold">{new Date(e.entry_date).toLocaleDateString()}</span>
                {e.voided_at ? (
                  <span className="ml-2">{e.description}</span>
                ) : (
                  <form action={updateJournalEntryDescription} className="ml-2 flex items-center gap-1.5">
                    <input type="hidden" name="entryId" value={e.id} />
                    <input
                      name="description"
                      defaultValue={e.description}
                      required
                      style={{ width: 240 }}
                    />
                    <button type="submit" className="text-xs">
                      Save
                    </button>
                  </form>
                )}
                {e.voided_at && (
                  <span className="ml-2 rounded-full bg-brand-tint px-2.5 py-0.5 text-sm font-medium text-error">Voided</span>
                )}
              </div>
              {!e.voided_at && canVoid && (
                <div className="flex flex-wrap items-center gap-3">
                  <Disclosure label="Correct date" icon={<CalendarClock className="h-3.5 w-3.5" />}>
                    <form action={correctManualJournalEntryDate} className="flex flex-wrap items-center gap-1.5">
                      <input type="hidden" name="entryId" value={e.id} />
                      <input name="newDate" type="date" required style={{ width: 150 }} />
                      <input name="reason" placeholder="Reason (optional)" style={{ width: 150 }} />
                      <button type="submit" className="text-xs">
                        Confirm
                      </button>
                    </form>
                  </Disclosure>
                  <Disclosure label="Void" icon={<Ban className="h-3.5 w-3.5" />}>
                    <form action={voidManualJournalEntry} className="flex flex-wrap items-center gap-1.5">
                      <input type="hidden" name="entryId" value={e.id} />
                      <input name="reason" placeholder="Reason (optional)" style={{ width: 150 }} />
                      <button type="submit" className="text-xs">
                        Confirm
                      </button>
                    </form>
                  </Disclosure>
                </div>
              )}
            </div>
            <table className="mt-3 w-full border-collapse">
              <thead>
                <tr className="border-b text-left">
                  <th>Account</th>
                  <th className="text-right">Debit</th>
                  <th className="text-right">Credit</th>
                </tr>
              </thead>
              <tbody>
                {e.lines.map((l: any, i: number) => (
                  <tr key={i} className="border-b">
                    <td>
                      {l.code} — {l.name}
                    </td>
                    <td className="text-right">{Number(l.debit) ? formatCurrency(Number(l.debit)) : ""}</td>
                    <td className="text-right">{Number(l.credit) ? formatCurrency(Number(l.credit)) : ""}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ))}
        {entries.length === 0 && (
          <div className="rounded-xl border border-border bg-surface p-5 text-sm text-muted shadow-sm">
            No manual journal entries yet.
          </div>
        )}
      </div>

      <div className="mt-6 rounded-xl border border-border bg-surface p-5 shadow-sm">
        <h2 className="mb-3 flex items-center gap-2 text-base font-semibold">
          <Plus className="h-4 w-4 text-brand" />
          New journal entry
        </h2>
        <form action={createManualJournalEntry} className="flex flex-col gap-3" style={{ maxWidth: 800 }}>
          <div className="flex flex-wrap items-center gap-3">
            <label className="flex items-center gap-2 text-sm text-muted">
              Date <input name="entryDate" type="date" required />
            </label>
            <input name="description" placeholder="Description" required style={{ flex: 1, minWidth: 240 }} />
          </div>

          <JournalLineEditor accounts={accounts as any} />

          <button type="submit" className="self-start">
            Save journal entry
          </button>
        </form>
      </div>
    </main>
  );
}
