import type { NextAuthConfig } from "next-auth";

export const authConfig = {
  trustHost: true,
  secret: process.env.AUTH_SECRET || "crab-secret-fallback-minimum-32-chars-key-2026",
  pages: {
    signIn: "/login",
  },
  session: {
    strategy: "jwt",
  },
  callbacks: {
    authorized({ auth, request: { nextUrl } }) {
      const isLoggedIn = !!auth?.user;
      const pathname = nextUrl.pathname;

      if (
        pathname.startsWith("/api/auth") ||
        pathname === "/manifest.webmanifest" ||
        pathname.startsWith("/icons/")
      ) {
        return true;
      }

      if (pathname === "/login") {
        if (isLoggedIn) {
          return Response.redirect(new URL("/", nextUrl));
        }
        return true;
      }

      if (pathname.startsWith("/api/") && !isLoggedIn) {
        return Response.json({ error: "Unauthorized" }, { status: 401 });
      }

      return isLoggedIn;
    },
    jwt({ token, user }) {
      if (user?.id) {
        token.id = user.id;
      }
      return token;
    },
    session({ session, token }) {
      if (session.user && token.id) {
        session.user.id = String(token.id);
      }
      return session;
    },
  },
  providers: [],
} satisfies NextAuthConfig;

