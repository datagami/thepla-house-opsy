import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const session = await auth();

    // @ts-expect-error - role is not in the User type
    const role = session.user.role;
    if (!session || role !== "MANAGEMENT") {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const documentTypes = await prisma.documentType.findMany({
      orderBy: {
        name: "asc",
      },
    });

    return NextResponse.json(documentTypes);
  } catch (error) {
    console.error("Error fetching document types:", error);
    return NextResponse.json(
      { error: "Failed to fetch document types" },
      { status: 500 }
    );
  }
}

export async function POST(req: Request) {
  try {
    const session = await auth();

    // @ts-expect-error - role is not in the User type
    const role = session.user.role;
    if (!session || role !== "MANAGEMENT") {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const { name, description, mandatory } = await req.json();

    if (!name) {
      return NextResponse.json(
        { error: "Document type name is required" },
        { status: 400 }
      );
    }

    // Check if document type already exists
    const existingType = await prisma.documentType.findUnique({
      where: { name },
    });

    if (existingType) {
      return NextResponse.json(
        { error: "Document type with this name already exists" },
        { status: 400 }
      );
    }

    const documentType = await prisma.documentType.create({
      data: {
        name,
        description: description || null,
        mandatory: mandatory || false,
      },
    });

    return NextResponse.json(documentType, { status: 201 });
  } catch (error) {
    console.error("Error creating document type:", error);
    return NextResponse.json(
      { error: "Failed to create document type" },
      { status: 500 }
    );
  }
} 