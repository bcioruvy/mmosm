import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { changePassword } from "./actions";
import { KeyRound } from "lucide-react";

export default async function ChangePasswordPage({
  searchParams,
}: {
  searchParams: { error?: string; success?: string };
}) {
  const session = await auth();
  if (!session?.user) redirect("/login");

  return (
    <main className="max-w-md px-6 py-10">
      <h1 className="flex items-center gap-2 text-2xl font-bold">
        <KeyRound className="h-6 w-6 text-brand" />
        Change password
      </h1>
      {searchParams.error && <p className="mt-3 text-sm font-medium text-error">{searchParams.error}</p>}
      {searchParams.success && <p className="mt-3 text-sm font-medium text-success">Password updated.</p>}

      <div className="mt-6 rounded-xl border border-border bg-surface p-5 shadow-sm">
        <form action={changePassword} className="flex flex-col gap-3">
          <input name="currentPassword" type="password" placeholder="Current password" required />
          <input name="newPassword" type="password" placeholder="New password" minLength={8} required />
          <input name="confirmPassword" type="password" placeholder="Confirm new password" minLength={8} required />
          <button type="submit">Update password</button>
        </form>
      </div>
    </main>
  );
}
