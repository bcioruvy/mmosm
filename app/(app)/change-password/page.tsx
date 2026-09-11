import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { changePassword } from "./actions";

export default async function ChangePasswordPage({
  searchParams,
}: {
  searchParams: { error?: string; success?: string };
}) {
  const session = await auth();
  if (!session?.user) redirect("/login");

  return (
    <main style={{ maxWidth: 360, margin: "80px 0", padding: 24 }}>
      <p>
        <a href="/">&larr; Home</a>
      </p>
      <h1>Change password</h1>
      {searchParams.error && <p style={{ color: "#b00020" }}>{searchParams.error}</p>}
      {searchParams.success && <p style={{ color: "#1b7a3d" }}>Password updated.</p>}
      <form action={changePassword} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <input name="currentPassword" type="password" placeholder="Current password" required />
        <input name="newPassword" type="password" placeholder="New password" minLength={8} required />
        <input name="confirmPassword" type="password" placeholder="Confirm new password" minLength={8} required />
        <button type="submit">Update password</button>
      </form>
    </main>
  );
}
