import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { AUTH_USER_EMAIL_HEADER, AUTH_USER_ID_HEADER } from "@/lib/auth-headers";

const PUBLIC_PATHS = new Set(["/login", "/register", "/reset-password"]);

export async function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  const pendingCookies: { name: string; value: string; options: CookieOptions }[] = [];
  const pendingHeaders: Record<string, string> = {};
  let user: { id: string; email: string | null } | null = null;

  if (url && key) {
    const supabase = createServerClient(url, key, {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: (cookiesToSet, headers) => {
          for (const { name, value } of cookiesToSet) {
            request.cookies.set(name, value);
          }
          pendingCookies.push(...cookiesToSet);
          Object.assign(pendingHeaders, headers);
        },
      },
    });

    const { data } = await supabase.auth.getUser();
    user = data.user ? { id: data.user.id, email: data.user.email ?? null } : null;
  }

  // Teruskan hasil verifikasi ke Server Components supaya mereka tidak perlu
  // memanggil Supabase Auth lagi. Nilai kiriman klien selalu dibuang lebih dulu.
  const forwardedHeaders = new Headers(request.headers);
  forwardedHeaders.delete(AUTH_USER_ID_HEADER);
  forwardedHeaders.delete(AUTH_USER_EMAIL_HEADER);
  if (user) {
    forwardedHeaders.set(AUTH_USER_ID_HEADER, user.id);
    forwardedHeaders.set(AUTH_USER_EMAIL_HEADER, user.email ?? "");
  }

  const build = (target?: URL) => {
    const response = target
      ? NextResponse.redirect(target)
      : NextResponse.next({ request: { headers: forwardedHeaders } });
    for (const { name, value, options } of pendingCookies) {
      response.cookies.set(name, value, options);
    }
    for (const [name, value] of Object.entries(pendingHeaders)) {
      response.headers.set(name, value);
    }
    return response;
  };

  if (pathname === "/auth/callback") return build();

  if (PUBLIC_PATHS.has(pathname)) {
    if (!user) return build();
    return build(new URL("/", request.url));
  }

  if (!user) {
    const loginUrl = new URL("/login", request.url);
    if (pathname !== "/") loginUrl.searchParams.set("next", `${pathname}${search}`);
    return build(loginUrl);
  }

  return build();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\..*).*)"],
};
