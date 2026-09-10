import sql from "@/lib/db";

export const SYSTEM_ROLES = ["accounts_receivable", "accounts_payable", "cash_or_bank"] as const;
export type SystemRole = (typeof SYSTEM_ROLES)[number];

export async function getAccountsReceivableAccount() {
  const [account] = await sql`
    SELECT id, code, name FROM accounts WHERE system_role = 'accounts_receivable' AND is_active = true
  `;
  if (!account) throw new Error("No account is tagged as Accounts Receivable. Set one in Chart of Accounts.");
  return account;
}

export async function getAccountsPayableAccount() {
  const [account] = await sql`
    SELECT id, code, name FROM accounts WHERE system_role = 'accounts_payable' AND is_active = true
  `;
  if (!account) throw new Error("No account is tagged as Accounts Payable. Set one in Chart of Accounts.");
  return account;
}

export async function getCashOrBankAccounts() {
  return sql`
    SELECT id, code, name FROM accounts WHERE system_role = 'cash_or_bank' AND is_active = true ORDER BY code
  `;
}

/** The contra-revenue account (code 4900) credit notes post against. */
export async function getSalesReturnsAccount() {
  const [account] = await sql`SELECT id, code, name FROM accounts WHERE code = '4900' AND is_active = true`;
  if (!account) {
    throw new Error("Sales Returns & Allowances account (4900) not found — run 008_credit_notes.sql.");
  }
  return account;
}
