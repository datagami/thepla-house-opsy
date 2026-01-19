import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { hash } from "bcrypt";
import { hasAccess } from "@/lib/access-control";
import {Prisma} from "@prisma/client";
import { logTargetUserActivity, logUserActivity } from "@/lib/services/activity-log";
import { ActivityType } from "@prisma/client";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    const { id } = await params;

    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const sessionUserId = (session.user as { id?: string }).id;
    const isOwnProfile = sessionUserId === id;

    // @ts-expect-error - role is not defined in the session type
    const canViewUsers = hasAccess(session.user.role, "users.view");

    if (!canViewUsers && !isOwnProfile) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const user = await prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        hasWeeklyOff: true,
        weeklyOffType: true,
        weeklyOffDay: true,
      },
    });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    return NextResponse.json(user);
  } catch (error) {
    console.error("Error fetching user:", error);
    return NextResponse.json({ error: "Error fetching user" }, { status: 500 });
  }
}

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
    const sessionUserId = (session.user as { id?: string }).id;
    const isOwnProfile = sessionUserId === id;

    if (!canManageUsers && !isOwnProfile) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Get old user data for logging changes and to preserve bank details
    const oldUser = await prisma.user.findUnique({
      where: { id },
      select: {
        name: true,
        email: true,
        role: true,
        branchId: true,
        departmentId: true,
        status: true,
        bankAccountNo: true,
        bankIfscCode: true,
        doj: true,
        hasWeeklyOff: true,
        weeklyOffType: true,
        weeklyOffDay: true,
      },
    });

    if (!oldUser) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const body = await request.json();
    const { 
      name, 
      email, 
      role, 
      branchId, 
      password,
      title,
      departmentId,
      mobileNo,
      doj,
      dob,
      gender,
      panNo,
      aadharNo,
      salary,
      references,
      bankAccountNo,
      bankIfscCode,
      referredById,
      hasWeeklyOff,
      weeklyOffType,
      weeklyOffDay
    } = body;

    // Base update data
    const updateData: Prisma.UserUpdateInput = {
      name,
      email,
      title,
      ...(departmentId && { departmentId }),
      mobileNo,
      doj: doj ? new Date(doj) : null,
      dob: dob ? new Date(dob) : null,
      gender,
      panNo,
      aadharNo,
      salary: salary ? parseFloat(salary) : null,
      // Handle bank fields: preserve existing value if new value is empty and old value exists
      // This prevents accidentally clearing bank details when form sends empty string
      ...(bankAccountNo !== undefined && {
        bankAccountNo: bankAccountNo && bankAccountNo.trim() !== "" 
          ? bankAccountNo 
          : (oldUser.bankAccountNo && oldUser.bankAccountNo.trim() !== "" ? oldUser.bankAccountNo : null)
      }),
      ...(bankIfscCode !== undefined && {
        bankIfscCode: bankIfscCode && bankIfscCode.trim() !== "" 
          ? bankIfscCode 
          : (oldUser.bankIfscCode && oldUser.bankIfscCode.trim() !== "" ? oldUser.bankIfscCode : null)
      }),
      branchId: branchId || null,
      hasWeeklyOff: hasWeeklyOff !== undefined ? hasWeeklyOff : undefined,
      weeklyOffType: weeklyOffType !== undefined ? (weeklyOffType === "null" || weeklyOffType === "" ? null : weeklyOffType) : undefined,
      weeklyOffDay: weeklyOffDay !== undefined ? (weeklyOffDay === null || weeklyOffDay === "" ? null : parseInt(weeklyOffDay)) : undefined,
    };

    // Only update role if user has permission
    if (canManageUsers) {
      updateData.role = role;
    }

    // Only update password if provided
    if (password) {
      updateData.password = await hash(password, 12);
    }

    // Validate referral time restriction if referredById is provided
    if (referredById && referredById !== "null" && referredById !== "") {
      // Get the DOJ that will be used (either from update or existing)
      const dojToUse = doj ? new Date(doj) : oldUser?.doj;
      
      if (!dojToUse) {
        return NextResponse.json(
          { error: "Date of Joining must be set before adding a referral" },
          { status: 400 }
        );
      }

      // Check if more than 30 days have passed since DOJ
      const today = new Date();
      const dojDate = new Date(dojToUse);
      const daysSinceDoj = Math.floor((today.getTime() - dojDate.getTime()) / (1000 * 60 * 60 * 24));
      
      if (daysSinceDoj > 30) {
        return NextResponse.json(
          { error: "Referrals can only be added within one month of joining date" },
          { status: 400 }
        );
      }
    }

    // if branchId is null, remove the existing branch from database
    

    // Update user and references in a transaction
    const user = await prisma.$transaction(async (tx) => {
      // if (branchId === null) {
      //   await prisma.user.update({
      //     where: { id },
      //     data: { branchId: null },
      //   });
      // }
      
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
          department: {
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

      // Handle referral if referredById is provided
      if (referredById && referredById !== "null" && referredById !== "") {
        const referrer = await tx.user.findUnique({ where: { id: referredById } });
        if (referrer) {
          // Get the DOJ that will be used (either from update or existing)
          const dojToUse = updatedUser.doj || oldUser?.doj;
          
          if (!dojToUse) {
            throw new Error("Date of Joining must be set before adding a referral");
          }

          // Double-check time restriction with updated DOJ
          const today = new Date();
          const dojDate = new Date(dojToUse);
          const daysSinceDoj = Math.floor((today.getTime() - dojDate.getTime()) / (1000 * 60 * 60 * 24));
          
          if (daysSinceDoj > 30) {
            throw new Error("Referrals can only be added within one month of joining date");
          }

          const eligibleAt = new Date(dojDate);
          eligibleAt.setMonth(eligibleAt.getMonth() + 3);

          // Create or update referral
          await tx.referral.upsert({
            where: {
              referrerId_referredUserId: {
                referrerId: referredById,
                referredUserId: updatedUser.id,
              },
            },
            update: {
              eligibleAt,
            },
            create: {
              referrerId: referredById,
              referredUserId: updatedUser.id,
              eligibleAt,
            },
          });
        }
      }

      return updatedUser;
    });

    // If weekly off configuration changed, trigger salary recalculation for PENDING salaries
    const weeklyOffChanged = 
      (hasWeeklyOff !== undefined && hasWeeklyOff !== oldUser.hasWeeklyOff) ||
      (weeklyOffType !== undefined && weeklyOffType !== oldUser.weeklyOffType) ||
      (weeklyOffDay !== undefined && weeklyOffDay !== oldUser.weeklyOffDay);

    if (weeklyOffChanged) {
      // Recalculate all PENDING salaries for this user
      const pendingSalaries = await prisma.salary.findMany({
        where: {
          userId: id,
          status: 'PENDING',
        },
      });

      for (const salaryRecord of pendingSalaries) {
        try {
          const { calculateSalary } = await import('@/lib/services/salary-calculator');
          const salaryDetails = await calculateSalary(
            id,
            salaryRecord.month,
            salaryRecord.year
          );

          await prisma.salary.update({
            where: { id: salaryRecord.id },
            data: {
              presentDays: salaryDetails.presentDays,
              overtimeDays: salaryDetails.overtimeDays,
              halfDays: salaryDetails.halfDays,
              leavesEarned: salaryDetails.leavesEarned,
              leaveSalary: salaryDetails.leaveSalary,
              netSalary: salaryDetails.netSalary
            }
          });
        } catch (error) {
          console.error(`Error recalculating salary ${salaryRecord.id}:`, error);
          // Continue with other salaries even if one fails
        }
      }
    }

    // Log user update
    const changes: string[] = [];
    if (oldUser.name !== user.name) changes.push(`name: ${oldUser.name} → ${user.name}`);
    if (oldUser.email !== user.email) changes.push(`email: ${oldUser.email} → ${user.email}`);
    if (oldUser.role !== user.role) changes.push(`role: ${oldUser.role} → ${user.role}`);
    if (oldUser.branchId !== user.branchId) changes.push(`branchId: ${oldUser.branchId} → ${user.branchId}`);
    if (oldUser.departmentId !== user.departmentId) changes.push(`departmentId: ${oldUser.departmentId} → ${user.departmentId}`);
    if (oldUser.status !== user.status) changes.push(`status: ${oldUser.status} → ${user.status}`);
    if (password) changes.push("password changed");

    const logUserId = (session.user as { id?: string }).id;
    if (!logUserId) {
      return NextResponse.json(user);
    }
    const logActivityType = isOwnProfile ? ActivityType.USER_UPDATED : ActivityType.USER_UPDATED;
    
    if (isOwnProfile) {
      await logUserActivity(
        logActivityType,
        logUserId,
        `Updated own profile: ${changes.length > 0 ? changes.join(", ") : "no changes"}`,
        {
          userId: user.id,
          changes,
        },
        request
      );
    } else {
      await logTargetUserActivity(
        logActivityType,
        logUserId,
        user.id,
        `Updated user ${user.name}: ${changes.length > 0 ? changes.join(", ") : "no changes"}`,
        {
          userId: user.id,
          changes,
        },
        request
      );
    }

    // Log role change separately if it occurred
    if (oldUser.role !== user.role) {
      await logTargetUserActivity(
        ActivityType.USER_ROLE_CHANGED,
        logUserId,
        user.id,
        `Changed role from ${oldUser.role} to ${user.role}`,
        {
          userId: user.id,
          oldRole: oldUser.role,
          newRole: user.role,
        },
        request
      );
    }

    // Log branch assignment change separately if it occurred
    if (oldUser.branchId !== user.branchId) {
      await logTargetUserActivity(
        ActivityType.USER_BRANCH_ASSIGNED,
        logUserId,
        user.id,
        `Changed branch assignment from ${oldUser.branchId || "none"} to ${user.branchId || "none"}`,
        {
          userId: user.id,
          oldBranchId: oldUser.branchId,
          newBranchId: user.branchId,
        },
        request
      );
    }

    return NextResponse.json(user);
  } catch (error) {
    console.error("Error updating user:", error);
    return NextResponse.json(
      { error: "Error updating user" },
      { status: 500 }
    );
  }
} 
