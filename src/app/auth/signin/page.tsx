'use client';

import { signIn } from 'next-auth/react';
import { Card, CardBody } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { BrandLogo } from '@/components/marketing/BrandLogo';
import { BRAND } from '@/content/marketing';
import { TEXT } from '@/content/productTheme';

export default function SignInPage() {
  const error =
    typeof window !== 'undefined'
      ? new URLSearchParams(window.location.search).get('error')
      : null;

  return (
    <div className="min-h-screen flex items-center justify-center bg-brand-canvas px-4">
      <div className="max-w-md w-full">
        <div className="text-center mb-8">
          <div className="flex justify-center mb-4">
            <BrandLogo size="md" />
          </div>
          <h1 className={`text-3xl font-semibold tracking-[-0.03em] mb-2 ${TEXT.primary}`}>
            {BRAND.tagline}
          </h1>
          <p className={`text-[17px] leading-[1.47] ${TEXT.muted}`}>
            Sign in to create and manage your websites.
          </p>
        </div>

        <Card variant="glass" className="shadow-glass rounded-3xl">
          <CardBody className="p-8">
            {error && (
              <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-2xl text-red-700 text-sm">
                {error === 'AccessDenied'
                  ? 'Sign-in was denied after Google returned. Usually MONGODB_URI is missing, wrong, or Atlas is blocking Vercel (allow 0.0.0.0/0 in Network Access). Check Vercel function logs.'
                  : error === 'Configuration'
                    ? 'Server auth is misconfigured. Set AUTH_SECRET (or NEXTAUTH_SECRET), GOOGLE_CLIENT_ID, and GOOGLE_CLIENT_SECRET on Vercel, then redeploy.'
                    : error === 'OAuthCallback' || error === 'OAuthSignin'
                      ? 'Sign-in failed. Please try again.'
                      : `Sign-in error: ${error}`}
              </div>
            )}

            <Button
              onClick={() => signIn('google', { callbackUrl: '/dashboard' })}
              variant="primary"
              className="w-full gap-3 !no-underline"
              size="lg"
              type="button"
            >
              <svg className="w-5 h-5 shrink-0" viewBox="0 0 24 24" aria-hidden>
                <path
                  fill="#4285F4"
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                />
                <path
                  fill="#34A853"
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                />
                <path
                  fill="#FBBC05"
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                />
                <path
                  fill="#EA4335"
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                />
              </svg>
              Continue with Google
            </Button>

            <p className={`mt-6 text-center text-sm ${TEXT.tertiary}`}>
              By signing in you agree to use First Site for your business websites.
            </p>
          </CardBody>
        </Card>
      </div>
    </div>
  );
}
