import {
  convexAuthNextjsMiddleware,
  createRouteMatcher,
  nextjsMiddlewareRedirect,
} from "@convex-dev/auth/nextjs/server";
import { NextResponse } from "next/server";

const isSignInPage = createRouteMatcher(["/signin"]);
const isProtectedRoute = createRouteMatcher([
  "/chat(.*)",
  "/notes(.*)",
  "/automations(.*)",
]);

export default convexAuthNextjsMiddleware(
  async (request, { convexAuth }) => {
    const legacyNoteMatch = request.nextUrl.pathname.match(
      /^\/notes\/([^/]+)$/
    );
    if (legacyNoteMatch) {
      const url = request.nextUrl.clone();
      url.pathname = "/notes";
      url.searchParams.set("note", legacyNoteMatch[1]);
      return NextResponse.redirect(url);
    }

    if (isSignInPage(request) && (await convexAuth.isAuthenticated())) {
      return nextjsMiddlewareRedirect(request, "/chat");
    }
    if (isProtectedRoute(request) && !(await convexAuth.isAuthenticated())) {
      return nextjsMiddlewareRedirect(request, "/signin");
    }
  },
  {
    cookieConfig: { maxAge: 60 * 60 * 24 * 30 }, // 30 days
  }
);

export const config = {
  // The following matcher runs middleware on all routes
  // except static assets.
  matcher: ["/((?!.*\\..*|_next).*)", "/", "/(api|trpc)(.*)"],
};
