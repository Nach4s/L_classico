import { withAuth } from "next-auth/middleware";
import { NextResponse } from "next/server";

export default withAuth(
  function middleware(req) {
    const { pathname } = req.nextUrl;
    const token = req.nextauth.token;

    // /admin — ADMIN role only
    if (pathname.startsWith("/admin") && token?.role !== "ADMIN") {
      // Authenticated but not admin → 403 page (or redirect to home)
      const url = req.nextUrl.clone();
      url.pathname = "/";
      url.searchParams.set("error", "access_denied");
      return NextResponse.redirect(url);
    }

    return NextResponse.next();
  },
  {
    callbacks: {
      // Return true = allow, false = redirect to login page
      authorized({ token }) {
        // Token exists = user is authenticated
        return !!token;
      },
    },
    pages: {
      signIn: "/auth/login",
    },
  }
);

export const config = {
  // Protect these routes — middleware runs on all of them
  matcher: [
    "/admin/:path*",
    "/fantasy/:path*",
  ],
};
