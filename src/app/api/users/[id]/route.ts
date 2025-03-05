import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { hash } from "bcrypt";
import { hasAccess } from "@/lib/access-control";
import {Prisma} from "@prisma/client";
import UserUpdateInput = Prisma.UserUpdateInput;

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    const { id } = await params;
    
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // @ts-expect-error - role is not defined in the session type
    const canManageUsers = hasAccess(session.user.role, "users.manage");
    const isOwnProfile = session.user.id === id;

    if (!canManageUsers && !isOwnProfile) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await request.json();
    const { 
      name, 
      email, 
      role, 
      branchId, 
      password,
      title,
      department,
      mobileNo,
      doj,
      dob,
      gender,
      panNo,
      aadharNo,
      salary,
      references 
    } = body;

    // Base update data
    const updateData: UserUpdateInput = {
      name,
      email,
      title,
      department,
      mobileNo,
      doj: doj ? new Date(doj) : null,
      dob: dob ? new Date(dob) : null,
      gender,
      panNo,
      aadharNo,
      salary: salary ? parseFloat(salary) : null,
      // Handle branchId - set to null if empty or undefined
      branch: branchId || null,
    };

    // Only update role if user has permission
    if (canManageUsers) {
      updateData.role = role;
    }

    // Only update password if provided
    if (password) {
      updateData.password = await hash(password, 10);
    }

    // Update user and references in a transaction
    const user = await prisma.$transaction(async (tx) => {
      // Update user
      const updatedUser = await tx.user.update({
        where: { id },
        data: updateData,
        include: {
          branch: {
            select: {
              id: true,
              name: true,
            },
          },
          references: true,
        },
      });

      // Update references if provided
      if (references) {
        // Delete existing references
        await tx.reference.deleteMany({
          where: { userId: id },
        });

        // Create new references
        if (references.length > 0) {
          await tx.reference.createMany({
            data: references.map((ref: { name: string; contactNo: string }) => ({
              name: ref.name,
              contactNo: ref.contactNo,
              userId: id,
            })),
          });
        }
      }

      return updatedUser;
    });

    return NextResponse.json(user);
  } catch (error) {
    console.error("Error updating user:", error);
    return NextResponse.json(
      { error: "Error updating user" },
      { status: 500 }
    );
  }
} 
