import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function proxy(request: NextRequest) {
  const rawSession = request.cookies.get('jsession')?.value?.trim();
  const isValidSession = Boolean(rawSession && rawSession.length >= 10 && !rawSession.startsWith('offline-'));
  const { pathname } = request.nextUrl;

  // Protección para APIs locales
  if (pathname.startsWith('/api/local-')) {
    if (!isValidSession) {
      return NextResponse.json(
        { error: 'No autorizado: Se requiere una sesión activa' },
        { status: 401 }
      );
    }
    return NextResponse.next();
  }

  // Redirección inversa: Si ya tiene sesión activa y navega a /login
  if (pathname === '/login') {
    if (isValidSession) {
      const dashboardUrl = new URL('/dispositivos', request.url);
      return NextResponse.redirect(dashboardUrl);
    }
    return NextResponse.next();
  }

  // Rutas protegidas de la aplicación
  const isProtectedRoute = 
    pathname.startsWith('/dispositivos') ||
    pathname.startsWith('/simcards') ||
    pathname.startsWith('/informes') ||
    pathname.startsWith('/cuentas');

  if (isProtectedRoute && !isValidSession) {
    const loginUrl = new URL('/login', request.url);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    '/dispositivos/:path*',
    '/simcards/:path*',
    '/informes/:path*',
    '/cuentas/:path*',
    '/login',
    '/api/local-:path*',
  ],
};

