// ===================================
// NextAuth Configuration
// ===================================

import { type NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { db } from "@/lib/db";

export const authOptions: NextAuthOptions = {
  // Use JWT strategy (no DB sessions — stateless, works well with App Router)
  session: {
    strategy: "jwt",
    maxAge: 30 * 24 * 60 * 60, // 30 days
  },

  pages: {
    signIn: "/auth/login",
    error: "/auth/login", // Redirect auth errors back to login
  },

  providers: [
    CredentialsProvider({
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },

      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          throw new Error("Email и пароль обязательны");
        }

        // 1. Find user in DB
        const user = await db.user.findUnique({
          where: { email: credentials.email.toLowerCase().trim() },
        });

        if (!user) {
          throw new Error("Неверный email или пароль");
        }

        // 2. Verify password hash
        const isPasswordValid = await bcrypt.compare(
          credentials.password,
          user.passwordHash
        );

        if (!isPasswordValid) {
          throw new Error("Неверный email или пароль");
        }

        // 3. Return user object (will be encoded into JWT)
        return {
          id: user.id,
          email: user.email,
          role: user.role,
          managerName: user.managerName,
        };
      },
    }),
  ],

  callbacks: {
    // Runs when JWT is created/updated
    async jwt({ token, user }) {
      if (user) {
        // First sign-in: persist custom fields into the token
        token.id = user.id;
        token.role = user.role;
        token.managerName = user.managerName;
      }
      return token;
    },

    // Runs on every session read — exposes token data to the client
    async session({ session, token }) {
      if (token && session.user) {
        session.user.id = token.id as string;
        session.user.role = token.role as string;
        session.user.managerName = token.managerName as string | undefined;
      }
      return session;
    },
  },
};

// ===================================
// TypeScript: Extend NextAuth types
// ===================================
// So session.user.id, .role, .managerName are strongly typed

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      email: string;
      role: string;
      managerName?: string;
    };
  }

  interface User {
    id: string;
    email: string;
    role: string;
    managerName?: string | null;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id: string;
    role: string;
    managerName?: string | null;
  }
}
