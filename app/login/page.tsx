import { signIn } from "@/auth";

export default function LoginPage() {
  return (
    <main className="login-page">
      <div className="login-glow-border">
        <div className="login-card">
          <h1>Sign in</h1>
          <form
            action={async (formData: FormData) => {
              "use server";
              await signIn("credentials", {
                email: formData.get("email"),
                password: formData.get("password"),
                redirectTo: "/",
              });
            }}
            style={{ display: "flex", flexDirection: "column", gap: 12 }}
          >
            <input name="email" type="email" placeholder="Email" required />
            <input name="password" type="password" placeholder="Password" required />
            <button type="submit">Sign in</button>
          </form>
        </div>
      </div>
    </main>
  );
}
