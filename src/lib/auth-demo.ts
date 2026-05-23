import { NextAuthOptions } from "next-auth"
import GoogleProvider from "next-auth/providers/google"
import CredentialsProvider from "next-auth/providers/credentials"

export const authOptions: NextAuthOptions = {
  providers: [
    // Demo provider for testing without real Google OAuth
    CredentialsProvider({
      id: "demo",
      name: "Demo Login",
      credentials: {
        email: { label: "Email", type: "email", placeholder: "demo@example.com" },
      },
      async authorize(credentials) {
        // This is for demo purposes only - never use in production!
        if (credentials?.email) {
          return {
            id: "demo-user-123",
            name: "Demo User",
            email: credentials.email,
            image: "https://via.placeholder.com/150?text=Demo",
          }
        }
        return null
      },
    }),
    // Real Google provider (will work when you add real credentials)
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID || "demo-client-id",
      clientSecret: process.env.GOOGLE_CLIENT_SECRET || "demo-secret",
    }),
  ],
  callbacks: {
    session: async ({ session, token }) => {
      if (session?.user) {
        session.user.id = token.sub || "demo-user-123"
      }
      return session
    },
    jwt: async ({ user, token }) => {
      if (user) {
        token.uid = user.id
      }
      return token
    },
  },
  pages: {
    signIn: "/auth/signin",
    error: "/auth/error",
  },
  session: {
    strategy: "jwt", // Using JWT for demo mode
  },
}
