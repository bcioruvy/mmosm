export const PERMISSIONS = {
  MANAGE_ACCOUNTS: "manage_accounts",
  MANAGE_USERS: "manage_users",
  MANAGE_CUSTOMERS: "manage_customers",
  MANAGE_VENDORS: "manage_vendors",
  MANAGE_TRANSACTIONS: "manage_transactions",
  VIEW_REPORTS: "view_reports",
  VIEW_AUDIT_LOG: "view_audit_log",
} as const;

export type Permission = (typeof PERMISSIONS)[keyof typeof PERMISSIONS];
