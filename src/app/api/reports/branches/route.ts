import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";

export async function GET() {
  try {
    const session = await auth();
    // @ts-expect-error - role is not in the User type
    if (!session?.user || !["HR", "MANAGEMENT"].includes(session.user.role)) {
      return new NextResponse("Unauthorized", { status: 401 });
    }

    // For HR and MANAGEMENT, return all branches
    const branches = await prisma.branch.findMany({
      select: { name: true },
      orderBy: { name: "asc" },
    });

    return NextResponse.json(branches.map((b) => b.name));
  } catch (error) {
    console.error("Error fetching branches:", error);
    return NextResponse.json(
      { error: "Failed to fetch branches" },
      { status: 500 }
    );
  }
}

