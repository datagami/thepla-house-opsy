import {NextAuthConfig} from "next-auth";
import {prisma} from "@/prisma";
import Credentials from "next-auth/providers/credentials";
import {compare} from "bcryptjs";


export default {
  pages: {
    signIn: "/login",
  },
  providers: [
    Credentials({
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          return null;
        }

        const user = await prisma.user.findUnique({
          where: {
            // @ts-expect-error - email is not in the User type
            email: credentials.email,
          },
          select: {
            id: true,
            name: true,
            email: true,
            password: true,
            role: true,
            status: true,
            branchId: true,
            managedBranchId: true,
          },
        });

        if (!user || !user.password) {
          return null;
        }

        if (user.status !== "ACTIVE") {
          throw new Error("Account is not active");
        }

        const isPasswordValid = await compare(
          credentials.password as string,
          user.password
        );

        if (!isPasswordValid) {
          return null;
        }

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
          status: user.status,
          branchId: user.branchId,
          managedBranchId: user.managedBranchId,
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        // @ts-expect-error - role is not in the User type
        token.role = user.role;
        // @ts-expect-error - branchId is not in the User type
        token.branchId = user.branchId;
        // @ts-expect-error - managedBranchId is not in the
        token.managedBranchId = user.managedBranchId;
      }
      return token;
    },
    async session({ session, token }) {
      if (token && session.user) {
        session.user.id = token.sub as string;
        // @ts-expect-error - role is not in the User type
        session.user.role = token.role;
        // @ts-expect-error - branchId is not in the User type
        session.user.branchId = token.branchId as string | null;
        // @ts-expect-error - managedBranchId is not in the
        session.user.managedBranchId = token.managedBranchId as string | null;
      }
      return session;
    },
  },
}satisfies NextAuthConfig
