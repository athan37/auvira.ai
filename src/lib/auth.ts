import NextAuth from 'next-auth';
import GoogleProvider from 'next-auth/providers/google';
import { User } from '@/models/User';
import { connectMongoDB } from '@/lib/mongodb';

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    }),
  ],
  callbacks: {
    async signIn({ user, account, profile }) {
      if (account?.provider !== 'google') return false;

      await connectMongoDB();

      const email = user.email;
      if (!email) return false;

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