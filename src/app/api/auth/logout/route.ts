import { NextRequest, NextResponse } from "next/server";

function clearAuthCookies(res: NextResponse): void {
  // Clear access token
  res.cookies.set("token", "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 0,
    path: "/",
  });
  // Clear refresh token (path restricted)
  res.cookies.set("refresh_token", "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 0,
    path: "/api/auth/refresh",
  });
  // Also clear legacy cookie names if any
  res.cookies.set("refresh", "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 0,
    path: "/api/auth/refresh",
  });
}

export async function DELETE(_request: NextRequest) {
  const res = NextResponse.json({ ok: true }, { status: 200 });
  clearAuthCookies(res);
  return res;
}

// Allow POST as well for clients that use POST /api/auth/logout
export async function POST(request: NextRequest) {
  return DELETE(request);
}
