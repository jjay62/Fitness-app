import type { NextRequest } from 'next/server';

export function getPublicOrigin(req: NextRequest): string {
  const fromEnv = process.env.GOOGLE_OAUTH_REDIRECT_ORIGIN?.trim().replace(/\/$/, '');
  if (fromEnv) return fromEnv;

  const host = req.headers.get('x-forwarded-host')?.split(',')[0]?.trim();
  const proto = req.headers.get('x-forwarded-proto')?.split(',')[0]?.trim();
  if (host) {
    const scheme = proto === 'http' || proto === 'https' ? proto : 'https';
    return `${scheme}://${host}`;
  }

  return req.nextUrl.origin;
}

export function getGoogleFitRedirectUri(req: NextRequest): string {
  return `${getPublicOrigin(req)}/api/auth/google-fit/callback`;
}
