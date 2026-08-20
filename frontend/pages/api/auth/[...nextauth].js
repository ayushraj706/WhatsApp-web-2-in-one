import NextAuth from "next-auth";
import GoogleProvider from "next-auth/providers/google";
import GitHubProvider from "next-auth/providers/github";

/**
 * SaaS auth model: Google + GitHub OAuth ONLY. No credentials provider,
 * no password field anywhere. After NextAuth verifies the OAuth profile,
 * we hand it to our backend (/api/auth/oauth-login) to mint our own JWT
 * that's used for REST + Socket.io auth.
 */
export default NextAuth({
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    }),
    GitHubProvider({
      clientId: process.env.GITHUB_ID,
      clientSecret: process.env.GITHUB_SECRET,
    }),
  ],
  callbacks: {
    async jwt({ token, account, profile }) {
      if (account && profile) {
        const res = await fetch(`${process.env.BACKEND_URL}/api/auth/oauth-login`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            email: profile.email,
            name: profile.name,
            avatarUrl: profile.picture || profile.avatar_url,
            provider: account.provider,
            oauthId: account.providerAccountId,
          }),
        });
        const data = await res.json();
        token.backendToken = data.token; // our own signed JWT, used for API/socket calls
      }
      return token;
    },
    async session({ session, token }) {
      session.backendToken = token.backendToken;
      return session;
    },
  },
  session: { strategy: "jwt" },
});
