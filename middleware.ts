import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({ request });

  const pathname = request.nextUrl.pathname;

  const publicRoutes = [
    "/login",
    "/register",
    "/tenant/register",
    "/api/tenant/register",
  ];

  const isPublicRoute =
    publicRoutes.includes(pathname) ||
    pathname.startsWith("/tenant/register/") ||
    pathname.startsWith("/api/tenant/register/");

  if (isPublicRoute) {
    return response;
  }

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );

          response = NextResponse.next({ request });

          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  const role = profile?.role;

  const isTenant =
    role === "tenant_company" || role === "tenant_staff";

  const isAdmin =
    role === "admin" || role === "tenant_admin";

  if (isTenant && pathname.startsWith("/home")) {
    const url = request.nextUrl.clone();
    url.pathname = "/tenant/home";
    return NextResponse.redirect(url);
  }

  if (isTenant && pathname.startsWith("/admin")) {
    const url = request.nextUrl.clone();
    url.pathname = "/tenant/home";
    return NextResponse.redirect(url);
  }

  if (isTenant && pathname === "/staff") {
    const url = request.nextUrl.clone();
    url.pathname = "/tenant/staff";
    return NextResponse.redirect(url);
  }

  if (isAdmin && pathname.startsWith("/tenant/home")) {
    const url = request.nextUrl.clone();
    url.pathname = "/home";
    return NextResponse.redirect(url);
  }

  if (pathname === "/login" || pathname === "/register") {
    const url = request.nextUrl.clone();
    url.pathname = isTenant ? "/tenant/home" : "/home";
    return NextResponse.redirect(url);
  }

  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};