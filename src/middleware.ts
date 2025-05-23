import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"
import NextAuth from "next-auth";
import authConfig from "@/auth.config";

const {auth} = NextAuth(authConfig);

export default auth(
  async function middleware(req: NextRequest) {

    // @ts-expect-error - Property 'auth' does not exist on type 'NextRequest'
    const session = req.auth
    const pathname = req.nextUrl.pathname

    // Public routes - allow access
    if (
      pathname === "/login" ||
      pathname === "/register" ||
      pathname.startsWith("/_next") ||
      pathname.startsWith("/api")
    ) {
      return NextResponse.next()
    }

    // Protected routes - require authentication
    if (!session?.user) {
      return NextResponse.redirect(new URL("/login", req.url))
    }

    // Routes that don't require branch selection for MANAGEMENT users1
    const managementExemptRoutes = [
      "/select-branch",
      "/users",
      "/branches",
      "/settings",
    ]

    // Allow MANAGEMENT users1 to access certain routes without branch selection
    if (
      session.user.role === "MANAGEMENT" && 
      managementExemptRoutes.some(route => pathname.startsWith(route))
    ) {
      return NextResponse.next()
    }

    // Require branch selection for MANAGEMENT users1 on other routes
    if (
      session.user.role === "MANAGEMENT" && 
      !session.user.branchId && 
      pathname !== "/select-branch"
    ) {
      return NextResponse.redirect(new URL("/select-branch", req.url))
    }

    // Allow access to all other authenticated routes
    return NextResponse.next()
  },
)

export const config = {
  matcher: ["/((?!.+\\.[\\w]+$|_next).*)", "/", "/(api|trpc)(.*)"],
}
