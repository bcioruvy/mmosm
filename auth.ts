import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import sql from "@/lib/db";
import { authConfig } from "@/auth.config";

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  providers: [
    Credentials({
      credentials: { email: {}, password: {} },
      authorize: async (credentials) => {
        const email = credentials?.email as string;
        const password = credentials?.password as string;
        if (!email || !password) return null;

        const rows = await sql`
          SELECT u.id, u.name, u.email, u.password_hash, u.is_active, r.name AS role
          FROM users u
          JOIN roles r ON r.id = u.role_id
          WHERE u.email = ${email}
        `;
        const user = rows[0];
        if (!user || !user.is_active) return null;

        const valid = await bcrypt.compare(password, user.password_hash);
        if (!valid) return null;

        return { id: String(user.id), name: user.name, email: user.email, role: user.role };
      },
    }),
  ],
});