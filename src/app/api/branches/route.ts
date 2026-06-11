import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";

export async function POST(req: Request) {
  try {
    const session = await auth();

    // @ts-expect-error - role is not in the User type
    if (!session || session.user.role !== "MANAGEMENT") {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const { name, city, state, address, code } = await req.json();

    if (!name || !city || !state) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    const normalizedCode = code?.trim().toUpperCase().slice(0, 5) || null;

    const branch = await prisma.branch.create({
      data: {
        name,
        city,
        state,
        address,
        code: normalizedCode,
      },
    });

    return NextResponse.json(branch, { status: 201 });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      const fields = (error.meta?.target as string[]) ?? [];
      if (fields.includes("code")) {
        return NextResponse.json(
          { error: "That outlet code is already in use" },
          { status: 409 }
        );
      }
      if (fields.includes("name")) {
        return NextResponse.json(
          { error: "Branch name already exists" },
          { status: 409 }
        );
      }
    }
    console.error("Error creating branch:", error);
    return NextResponse.json(
      { error: "Failed to create branch" },
      { status: 500 }
    );
  }
}

export async function GET() {
  try {
    const users = await prisma.user.findMany({
      select: {
        branch: true,
      },
      distinct: ['branchId'],
    })

    const branches = users.map(user => user.branch).filter(Boolean)
    return NextResponse.json(branches)
  } catch (error) {
    console.error('Error fetching branches:', error)
    return NextResponse.json(
      { error: 'Failed to fetch branches' },
      { status: 500 }
    )
  }
} 
