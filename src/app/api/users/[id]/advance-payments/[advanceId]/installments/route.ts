import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { z } from "zod";
import { auth } from "@/auth";

const installmentUpdateSchema = z.object({
  status: z.enum(["APPROVED", "REJECTED"]),
  installmentIds: z.array(z.string()),
});

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string; advanceId: string }> }
) {
  try {
    const session = await auth();
    const {id, advanceId} = await params;

    // @ts-expect-error expected
    if (!session?.user || !["HR", "MANAGEMENT"].includes(session.user.role)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const json = await req.json();
    const body = installmentUpdateSchema.parse(json);

    // Update installments status in a transaction
    await prisma.$transaction(async (tx) => {
      // Update installment statuses
      await tx.advancePaymentInstallment.updateMany({
        where: {
          id: {
            in: body.installmentIds
          },
          advanceId: advanceId,
          userId: id,
          status: "PENDING"
        },
        data: {
          status: body.status,
          // @ts-expect-error expected
          approvedById: session.user.id,
          approvedAt: new Date(),
        }
      });

      // If approved, update the advance payment remaining amount
      if (body.status === "APPROVED") {
        const installments = await tx.advancePaymentInstallment.findMany({
          where: {
            id: {
              in: body.installmentIds
            }
          },
          select: {
            amountPaid: true
          }
        });

        const totalApprovedAmount = installments.reduce(
          (sum, inst) => sum + inst.amountPaid, 
          0
        );

        await tx.advancePayment.update({
          where: {
            id: advanceId
          },
          data: {
            remainingAmount: {
              decrement: totalApprovedAmount
            }
          }
        });

        // Update user's total EMI deduction
        await tx.user.update({
          where: {
            id: id
          },
          data: {
            totalEmiDeduction: {
              increment: totalApprovedAmount
            }
          }
        });
      }
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error updating installments:", error);
    return NextResponse.json(
      { error: "Failed to update installments" },
      { status: 500 }
    );
  }
}

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string; advanceId: string }> }
) {
  try {
    const session = await auth();
    const {id, advanceId} = await params;
    
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const installments = await prisma.advancePaymentInstallment.findMany({
      where: {
        userId: id,
        advanceId: advanceId
      },
      include: {
        approvedBy: {
          select: {
            name: true
          }
        },
        salary: {
          select: {
            month: true,
            year: true
          }
        }
      }
    });

    return NextResponse.json(installments);
  } catch (error) {
    console.error("Error fetching installments:", error);
    return NextResponse.json(
      { error: "Failed to fetch installments" },
      { status: 500 }
    );
  }
} 
