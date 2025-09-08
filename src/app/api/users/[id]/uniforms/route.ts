import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { z } from "zod";
import { auth } from "@/auth";

const uniformSchema = z.object({
  uniformNumber: z.string().min(1),
  size: z.string().optional(),
  notes: z.string().optional(),
  issuedAt: z.string().optional(),
});

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    const { id } = await params;

    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const json = await req.json();
    const body = uniformSchema.parse(json);

    // Check if user exists
    const user = await prisma.user.findUnique({
      where: { id: id },
      select: { id: true, name: true, branchId: true }
    });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Authorization: HR/MANAGEMENT always allowed; BRANCH_MANAGER allowed if same/managed branch
    // @ts-expect-error expected
    const role = (session.user).role as string;
    if (
      role !== "HR" &&
      role !== "MANAGEMENT" &&
      !(role === "BRANCH_MANAGER" && (
        // @ts-expect-error expected
        (session.user).managedBranchId === user.branchId ||
        // @ts-expect-error expected
        (session.user).branchId === user.branchId
      ))
    ) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Create uniform record - fixed to Shirt with internal uniform number
    const uniform = await prisma.uniform.create({
      data: {
        userId: id,
        itemName: "Shirt",
        itemType: "Shirt",
        size: body.size,
        // color and quantity removed per requirements
        // internal uniform number -> prisma model uses snake_case
        uniform_number: body.uniformNumber,
        notes: body.notes,
        issuedAt: body.issuedAt ? new Date(body.issuedAt) : new Date(),
        issuedById: session.user.id,
        status: "ISSUED",
      },
    });

    // Map to camelCase for client consistency
    const { uniform_number: createdUniformNumber, ...restCreated } = uniform;
    const mapped = {
      ...restCreated,
      uniformNumber: createdUniformNumber,
    };

    return NextResponse.json(mapped);
  } catch (error) {
    console.error("Error creating uniform:", error);
    return NextResponse.json(
      { error: "Failed to create uniform record" },
      { status: 500 }
    );
  }
}

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    const { id } = await params;

    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const uniforms = await (prisma).uniform.findMany({
      where: {
        userId: id
      },
      include: {
        issuedBy: {
          select: {
            name: true,
          }
        },
        returnedBy: {
          select: {
            name: true,
          }
        }
      },
      orderBy: {
        issuedAt: 'desc'
      }
    });

    // Map snake_case from prisma model to camelCase for client
    const mapped = uniforms.map((u) => {
      const { uniform_number, ...rest } = u;
      return { ...rest, uniformNumber: uniform_number };
    });

    return NextResponse.json(mapped);
  } catch (error) {
    console.error("Error fetching uniforms:", error);
    return NextResponse.json(
      { error: "Failed to fetch uniforms" },
      { status: 500 }
    );
  }
} 
