import { auth } from "@/auth";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

const updateUniformSchema = z.object({
  status: z.enum(["ISSUED", "RETURNED", "LOST", "DAMAGED"]),
  notes: z.string().optional(),
});

type UniformUpdateData = {
  status: "ISSUED" | "RETURNED" | "LOST" | "DAMAGED";
  notes?: string | null;
  returnedAt?: Date;
  returnedById?: string;
};

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string; uniformId: string }> }
) {
  try {
    const session = await auth();
    const { id, uniformId } = await params;

    if (id == undefined) {
      return NextResponse.json({ error: "Invalid Id" }, { status: 401 });
    }

    // @ts-expect-error role expected
    if (!session?.user || !["HR", "MANAGEMENT", "BRANCH_MANAGER"].includes(session.user.role)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // For BRANCH_MANAGER, check if they can access this user's uniforms
    // @ts-expect-error role expected
    if (session.user.role === "BRANCH_MANAGER") {
      // Get the target user's branch information
      const targetUser = await prisma.user.findUnique({
        where: { id: id as string },
        select: { branchId: true }
      });

      if (!targetUser) {
        return NextResponse.json({ error: "User not found" }, { status: 404 });
      }

      // Get the manager's branch information
      const manager = await prisma.user.findUnique({
        where: { id: session.user.id as string },
        select: { managedBranchId: true, branchId: true }
      });

      if (!manager) {
        return NextResponse.json({ error: "Manager not found" }, { status: 404 });
      }

      const managerBranchId = manager.managedBranchId ?? manager.branchId;
      
      // Check if manager can access this user (same branch or managed branch)
      if (!managerBranchId || managerBranchId !== targetUser.branchId) {
        return NextResponse.json({ error: "Forbidden - Cannot edit uniforms for users outside your branch" }, { status: 403 });
      }
    }

    const json = await req.json();
    const body = updateUniformSchema.parse(json);

    // Check if uniform exists and belongs to the user
    const uniform = await prisma.uniform.findUnique({
      where: {
        id: uniformId,
        userId: id as string,
      }
    });

    if (!uniform) {
      return NextResponse.json({ error: "Uniform not found" }, { status: 404 });
    }

    // Update uniform status - only pass the fields that should be updated
    const updateData: UniformUpdateData = {
      status: body.status,
      notes: body.notes,
    };

    // If status is RETURNED, set returnedAt and returnedById
    if (body.status === "RETURNED") {
      updateData.returnedAt = new Date();
      updateData.returnedById = session.user.id;
    }

    const updatedUniform = await prisma.uniform.update({
      where: {
        id: uniformId
      },
      data: updateData,
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
      }
    });

    // Map snake_case from prisma model to camelCase for client
    const mapped = {
      ...updatedUniform,
      uniformNumber: (updatedUniform as { uniform_number: string }).uniform_number,
    };
    // @ts-expect-error - expected
    delete mapped?.uniform_number;

    return NextResponse.json(mapped);
  } catch (error) {
    console.error("Error updating uniform:", error);
    return NextResponse.json(
      { error: "Failed to update uniform" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string; uniformId: string }> }
) {
  try {
    const session = await auth();
    const { id, uniformId } = await params;

    // Only HR and MANAGEMENT can delete uniforms - BRANCH_MANAGER access revoked
    // @ts-expect-error role expected
    if (!session?.user || !["HR", "MANAGEMENT"].includes(session.user.role)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Check if uniform exists and belongs to the user
    const uniform = await prisma.uniform.findUnique({
      where: {
        id: uniformId,
        userId: id,
      }
    });

    if (!uniform) {
      return NextResponse.json({ error: "Uniform not found" }, { status: 404 });
    }

    // Only allow deletion if status is ISSUED (not returned, lost, or damaged)
    if (uniform.status !== "ISSUED") {
      return NextResponse.json(
        { error: "Cannot delete uniform that has been returned, lost, or damaged" },
        { status: 400 }
      );
    }

    await prisma.uniform.delete({
      where: {
        id: uniformId
      }
    });

    return NextResponse.json({ message: "Uniform deleted successfully" });
  } catch (error) {
    console.error("Error deleting uniform:", error);
    return NextResponse.json(
      { error: "Failed to delete uniform" },
      { status: 500 }
    );
  }
} 
