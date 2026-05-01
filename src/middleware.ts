import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// Auth is handled client-side via Zustand + localStorage.
// Middleware only handles non-auth concerns (e.g. redirecting root).
export function middleware(request: NextRequest) {
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|public).*)"],
};
