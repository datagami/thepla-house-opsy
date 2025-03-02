import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

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

    const { name, city, state, address } = await req.json();

    if (!name || !city || !state) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    const branch = await prisma.branch.create({
      data: {
        name,
        city,
        state,
        address,
      },
    });

    return NextResponse.json(branch, { status: 201 });
  } catch (error) {
    console.error("Error creating branch:", error);
    return NextResponse.json(
      { error: "Failed to create branch" },
      { status: 500 }
    );
  }
} 
