import { auth } from "@/auth";
import sql from "@/lib/db";
import { redirect } from "next/navigation";
import { PERMISSIONS } from "@/lib/permissions";
import { todayISO, daysAgoISO } from "@/lib/reports/dates";
import { History } from "lucide-react";

const RESULT_LIMIT = 200;

export default async function AuditLogPage({
  searchParams,
}: {
  searchParams: { start?: string; end?: string; entityType?: string; actorId?: string };
}) {
  const session = await auth();
  const permissions = session?.user?.permissions ?? [];
  if (!session?.user || !permissions.includes(PERMISSIONS.VIEW_AUDIT_LOG)) {
    redirect("/");
  }

  const start = searchParams.start || daysAgoISO(30);
  const end = searchParams.end || todayISO();
  const entityType = searchParams.entityType || "";
  const actorId = searchParams.actorId || "";

  const [entityTypes, actors] = await Promise.all([
    sql`SELECT DISTINCT entity_type FROM audit_log ORDER BY entity_type`,
    sql`SELECT id, name FROM users ORDER BY name`,
  ]);

  const entries = await sql`
    SELECT a.id, a.action, a.entity_type, a.entity_id, a.details, a.created_at, u.name AS actor_name
    FROM audit_log a
    LEFT JOIN users u ON u.id = a.actor_id
    WHERE a.created_at >= ${start}::date
      AND a.created_at < (${end}::date + interval '1 day')
      ${entityType ? sql`AND a.entity_type = ${entityType}` : sql``}
      ${actorId ? sql`AND a.actor_id = ${actorId}` : sql``}
    ORDER BY a.created_at DESC
    LIMIT ${RESULT_LIMIT}
  `;

  return (
    <main className="max-w-screen-2xl px-6 py-10">
      <h1 className="flex items-center gap-2 text-2xl font-bold">
        <History className="h-6 w-6 text-brand" />
        Audit Trail
      </h1>

      <form
        method="get"
        className="mt-6 flex flex-wrap items-center gap-3 rounded-xl border border-border bg-surface p-4 shadow-sm"
      >
        <label className="flex items-center gap-2 text-sm text-muted">
          From <input type="date" name="start" defaultValue={start} />
        </label>
        <label className="flex items-center gap-2 text-sm text-muted">
          To <input type="date" name="end" defaultValue={end} />
        </label>
        <select name="entityType" defaultValue={entityType}>
          <option value="">All entity types</option>
          {entityTypes.map((t: any) => (
            <option key={t.entity_type} value={t.entity_type}>
              {t.entity_type}
            </option>
          ))}
        </select>
        <select name="actorId" defaultValue={actorId}>
          <option value="">All users</option>
          {actors.map((u: any) => (
            <option key={u.id} value={u.id}>
              {u.name}
            </option>
          ))}
        </select>
        <button type="submit">Filter</button>
      </form>

      {entries.length === RESULT_LIMIT && (
        <p className="mt-3 text-sm text-muted">
          Showing the latest {RESULT_LIMIT} matching entries — narrow the date range or filters to see more
          precisely.
        </p>
      )}

      <div className="mt-6 overflow-x-auto rounded-xl border border-border bg-surface p-5 shadow-sm">
        <table className="w-full min-w-[800px] border-collapse">
          <thead>
            <tr className="border-b text-left">
              <th>Timestamp</th>
              <th>Actor</th>
              <th>Action</th>
              <th>Entity</th>
              <th>Details</th>
            </tr>
          </thead>
          <tbody>
            {entries.map((e: any) => (
              <tr key={e.id} className="border-b">
                <td>{new Date(e.created_at).toLocaleString()}</td>
                <td>{e.actor_name ?? "—"}</td>
                <td>{e.action}</td>
                <td>
                  {e.entity_type === "invoice" ? (
                    <a href={`/invoices/${e.entity_id}`}>invoice #{e.entity_id}</a>
                  ) : (
                    `${e.entity_type} #${e.entity_id}`
                  )}
                </td>
                <td className="font-mono text-xs">{JSON.stringify(e.details)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </main>
  );
}
