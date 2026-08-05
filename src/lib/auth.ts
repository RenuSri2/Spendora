import { NextAuthOptions } from "next-auth"
import GoogleProvider from "next-auth/providers/google"
import CredentialsProvider from "next-auth/providers/credentials"
import { PrismaAdapter } from "@next-auth/prisma-adapter"
import { prisma } from "./prisma"

// Comma-separated allow-list, e.g. ALLOWED_EMAILS="you@gmail.com,friend@gmail.com"
// Empty/unset = nobody can sign in (fail closed, not open).
const ALLOWED_EMAILS = (process.env.ALLOWED_EMAILS || "")
  .split(",")
  .map((e) => e.trim().toLowerCase())
  .filter(Boolean)

function isAllowed(email?: string | null): boolean {
  if (!email) return false
  return ALLOWED_EMAILS.includes(email.toLowerCase())
}

export const authOptions: NextAuthOptions = {
  adapter: PrismaAdapter(prisma),
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    }),
    CredentialsProvider({
      id: "demo",
      name: "Demo Login",
      credentials: {
        email: { label: "Email", type: "email", placeholder: "demo@example.com" },
      },
      async authorize(credentials) {
        if (!credentials?.email) return null
        // Demo login is intentionally open to anyone — this is the public
        // "try it without signing in for real" path. Google stays restricted
        // to ALLOWED_EMAILS since it's tied to a real identity. Data written
        // via demo login lands in the same live database as everything
        // else — there's no separate sandbox, so this trades some abuse
        // surface (junk data, AI-quota usage) for a frictionless public demo.
        // Upsert a real user in DB so data persists
        const user = await prisma.user.upsert({
          where: { email: credentials.email },
          update: {},
          create: {
            email: credentials.email,
            name: credentials.email.split("@")[0],
          },
        })
        return { id: user.id, name: user.name, email: user.email, image: null }
      },
    }),
  ],
  callbacks: {
    signIn: async ({ user, account }) => {
      // Demo provider already checked inside authorize(); this covers Google.
      if (account?.provider === "google") {
        return isAllowed(user.email)
      }
      return true
    },
    session: async ({ session, token }) => {
      if (session?.user && token?.sub) {
        session.user.id = token.sub
      }
      return session
    },
    jwt: async ({ user, token }) => {
      if (user) {
        token.sub = user.id
      }
      return token
    },
  },
  pages: {
    signIn: "/auth/signin",
    error: "/auth/error",
  },
  session: {
    strategy: "jwt",
  },
}
