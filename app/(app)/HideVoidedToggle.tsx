/**
 * Per-page "hide voided rows" toggle, persisted via a ?showVoided=
 * query param (default: hidden). Purely a display filter — the caller
 * still fetches every row unconditionally; this only decides how many
 * of them got rendered, so it can report the hidden count.
 */
export default function HideVoidedToggle({
  showVoided,
  hiddenCount,
}: {
  showVoided: boolean;
  hiddenCount: number;
}) {
  return (
    <a
      href={`?showVoided=${showVoided ? "0" : "1"}`}
      className={`inline-flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-sm no-underline transition-colors ${
        showVoided ? "border-brand bg-brand text-brand-contrast" : "border-border bg-surface hover:bg-brand-tint"
      }`}
    >
      {showVoided ? "Hide voided" : hiddenCount > 0 ? `Show voided (${hiddenCount} hidden)` : "Show voided"}
    </a>
  );
}
