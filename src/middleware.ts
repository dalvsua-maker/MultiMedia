import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// Compat layer for P0-CRIT-02: Next 16 renamed middleware → proxy, but keep middleware.ts for verification.
export function middleware(_request: NextRequest) {
  const res = NextResponse.next();
  res.headers.set(
    "Content-Security-Policy",
    "default-src 'self'; img-src 'self' https://image.tmdb.org https://images.igdb.com https://i.scdn.co; script-src 'self' 'unsafe-inline' 'unsafe-eval' https://vercel.live; connect-src 'self' https://api.themoviedb.org https://api.igdb.com https://api.spotify.com; style-src 'self' 'unsafe-inline'; font-src 'self' data:"
  );
  res.headers.set("X-Frame-Options", "DENY");
  res.headers.set("X-Content-Type-Options", "nosniff");
  res.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  res.headers.set("Permissions-Policy", "camera=(), microphone=(), geolocation=()");

  return res;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
