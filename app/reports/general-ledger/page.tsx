import { auth } from "@/auth";
import sql from "@/lib/db";
import { redirect } from "next/navigation";
import { PERMISSIONS } from "@/lib/permissions";
import { formatCurrency } from "@/lib/currency";
import { journalLinesThroughDate, journalLinesInRange } from "@/lib/reports/journalFilters";
import { todayISO, startOfYearISO } from "@/lib/reports/dates";
import { dayBefore, balanceLabel } from "@/lib/reports/balance";

export default async function GeneralLedgerPage({
  searchParams,
}: {
  searchParams: { start?: string; end?: string; account?: string };
}) {
  const session = await auth();
  const permissions = session?.user?.permissions ?? [];
  if (!session?.user || !permissions.includes(PERMISSIONS.VIEW_REPORTS)) {
    redirect("/");
  }

  const start = searchParams.start || startOfYearISO();
  const end = searchParams.end || todayISO();
  const accountId = searchParams.account || "";
  const dayBeforeStart = dayBefore(start);

  const accounts = await sql`SELECT id, code, name FROM accounts ORDER BY code`;

  if (accountId) {
    const [account] = await sql`SELECT id, code, name, type FROM accounts WHERE id = ${accountId}`;
    if (!account) redirect("/reports/general-ledger");

    const [{ opening }] = await sql`
      SELECT COALESCE(SUM(debit), 0) - COALESCE(SUM(credit), 0) AS opening
      FROM (${journalLinesThroughDate(dayBeforeStart)}) x
      WHERE account_id = ${accountId}
    `;

    const lines = await sql`
      SELECT jl.id, je.entry_date, je.description, je.source_type, jl.debit, jl.credit
      FROM journal_lines jl
      JOIN journal_entries je ON je.id = jl.entry_id
      WHERE jl.account_id = ${accountId} AND je.voided_at IS NULL AND je.entry_date BETWEEN ${start} AND ${end}
      ORDER BY je.entry_date, jl.id
    `;

    let running = Number(opening);
    const rows = lines.map((l: any) => {
      running += Number(l.debit) - Number(l.credit);
      return { ...l, runningBalance: running };
    });

    return (
      <main style={{ maxWidth: 900, margin: "40px auto", padding: 24 }}>
        <p>
          <a href="/reports">&larr; Reports</a>
        </p>
        <h1>
          General Ledger — {account.code} {account.name}
        </h1>
        <form
          method="get"
          style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 16, flexWrap: "wrap" }}
        >
          <label>
            From <input type="date" name="start" defaultValue={start} />
          </label>
          <label>
            To <input type="date" name="end" defaultValue={end} />
          </label>
          <select name="account" defaultValue={accountId}>
            <option value="">All accounts</option>
            {accounts.map((a: any) => (
              <option key={a.id} value={a.id}>
                {a.code} — {a.name}
              </option>
            ))}
          </select>
          <button type="submit">Update</button>
        </form>

        <p>Opening balance: {balanceLabel(Number(opening))}</p>

        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ textAlign: "left", borderBottom: "1px solid #ccc" }}>
              <th>Date</th>
              <th>Description</th>
              <th>Source</th>
              <th style={{ textAlign: "right" }}>Debit</th>
              <th style={{ textAlign: "right" }}>Credit</th>
              <th style={{ textAlign: "right" }}>Balance</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((l: any) => (
              <tr key={l.id} style={{ borderBottom: "1px solid #eee" }}>
                <td>{new Date(l.entry_date).toLocaleDateString()}</td>
                <td>{l.description}</td>
                <td>{l.source_type}</td>
                <td style={{ textAlign: "right" }}>{Number(l.debit) ? formatCurrency(Number(l.debit)) : ""}</td>
                <td style={{ textAlign: "right" }}>{Number(l.credit) ? formatCurrency(Number(l.credit)) : ""}</td>
                <td style={{ textAlign: "right" }}>{balanceLabel(l.runningBalance)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p style={{ fontWeight: "bold", marginTop: 8 }}>Closing balance: {balanceLabel(running)}</p>
      </main>
    );
  }

  const summary = await sql`
    SELECT a.id, a.code, a.name, a.type,
      COALESCE(o.opening, 0) AS opening,
      COALESCE(p.period_debit, 0) AS period_debit,
      COALESCE(p.period_credit, 0) AS period_credit
    FROM accounts a
    LEFT JOIN (
      SELECT account_id, SUM(debit) - SUM(credit) AS opening
      FROM (${journalLinesThroughDate(dayBeforeStart)}) x
      GROUP BY account_id
    ) o ON o.account_id = a.id
    LEFT JOIN (
      SELECT account_id, SUM(debit) AS period_debit, SUM(credit) AS period_credit
      FROM (${journalLinesInRange(start, end)}) y
      GROUP BY account_id
    ) p ON p.account_id = a.id
    ORDER BY a.code
  `;

  return (
    <main style={{ maxWidth: 900, margin: "40px auto", padding: 24 }}>
      <p>
        <a href="/reports">&larr; Reports</a>
      </p>
      <h1>General Ledger</h1>
      <form method="get" style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 16, flexWrap: "wrap" }}>
        <label>
          From <input type="date" name="start" defaultValue={start} />
        </label>
        <label>
          To <input type="date" name="end" defaultValue={end} />
        </label>
        <select name="account" defaultValue="">
          <option value="">All accounts</option>
          {accounts.map((a: any) => (
            <option key={a.id} value={a.id}>
              {a.code} — {a.name}
            </option>
          ))}
        </select>
        <button type="submit">Update</button>
      </form>
      <p>Select an account above to see its full transaction history with a running balance.</p>

      <table style={{ width: "100%", borderCollapse: "collapse" }}>
        <thead>
          <tr style={{ textAlign: "left", borderBottom: "1px solid #ccc" }}>
            <th>Code</th>
            <th>Name</th>
            <th style={{ textAlign: "right" }}>Opening</th>
            <th style={{ textAlign: "right" }}>Debit</th>
            <th style={{ textAlign: "right" }}>Credit</th>
            <th style={{ textAlign: "right" }}>Closing</th>
          </tr>
        </thead>
        <tbody>
          {summary.map((a: any) => {
            const opening = Number(a.opening);
            const closing = opening + Number(a.period_debit) - Number(a.period_credit);
            return (
              <tr key={a.id} style={{ borderBottom: "1px solid #eee" }}>
                <td>
                  <a href={`/reports/general-ledger?start=${start}&end=${end}&account=${a.id}`}>{a.code}</a>
                </td>
                <td>{a.name}</td>
                <td style={{ textAlign: "right" }}>{balanceLabel(opening)}</td>
                <td style={{ textAlign: "right" }}>
                  {Number(a.period_debit) ? formatCurrency(Number(a.period_debit)) : ""}
                </td>
                <td style={{ textAlign: "right" }}>
                  {Number(a.period_credit) ? formatCurrency(Number(a.period_credit)) : ""}
                </td>
                <td style={{ textAlign: "right" }}>{balanceLabel(closing)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </main>
  );
}
