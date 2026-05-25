import NextAuth from 'next-auth';
import GoogleProvider from 'next-auth/providers/google';
import { User } from '@/models/User';
import { connectMongoDB } from '@/lib/mongodb';

const authSecret =
  process.env.AUTH_SECRET?.trim() || process.env.NEXTAUTH_SECRET?.trim();

const googleClientId = process.env.GOOGLE_CLIENT_ID?.trim();
const googleClientSecret = process.env.GOOGLE_CLIENT_SECRET?.trim();

export const { handlers, auth, signIn, signOut } = NextAuth({
  // On Vercel, host/URL is inferred from request headers (VERCEL=1). Local: set NEXTAUTH_URL or AUTH_TRUST_HOST=true.
  trustHost: true,
  secret: authSecret,
  providers: [
    GoogleProvider({
      clientId: googleClientId ?? '',
      clientSecret: googleClientSecret ?? '',
    }),
  ],
  callbacks: {
    async signIn({ user, account, profile }) {
      if (account?.provider !== 'google') return false;

      const email = user.email;
      if (!email) {
        console.error('[auth] signIn denied: Google account has no email');
        return false;
      }

      try {
        await connectMongoDB();
        const existingUser = await User.findOne({ email });
        if (!existingUser) {
          await User.create({
            email,
            name: user.name || 'Unknown',
            image: user.image || null,
            authProvider: 'google',
            authProviderId: profile?.sub || user.id || '',
          });
        }
        return true;
      } catch (err) {
        console.error(
          '[auth] signIn denied (check MONGODB_URI and Atlas network access):',
          err instanceof Error ? err.message : err
        );
        return false;
      }
    },

    async session({ session, token }) {
      if (session.user?.email) {
        await connectMongoDB();
        const dbUser = await User.findOne({ email: session.user.email }).select('_id');
        if (dbUser) {
          (session.user as any).id = dbUser._id.toString();
        }
      }
      return session;
    },

    async jwt({ token, account, profile }) {
      if (account?.provider === 'google') {
        token.providerId = profile?.sub || '';
      }
      return token;
    },
  },
  pages: {
    signIn: '/auth/signin',
  },
  session: {
    strategy: 'jwt',
  },
});