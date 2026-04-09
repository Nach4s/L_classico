// ===================================
// NextAuth API Route
// App Router: src/app/api/auth/[...nextauth]/route.ts
// ===================================

import NextAuth from "next-auth";
import { authOptions } from "@/lib/auth";

const handler = NextAuth(authOptions);

// Next.js App Router requires named exports for each HTTP method
export { handler as GET, handler as POST };
