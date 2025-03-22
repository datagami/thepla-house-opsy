import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { z } from "zod";
import {auth} from "@/auth";

const advancePaymentSchema = z.object({
  amount: z.number().positive(),
  emiAmount: z.number().positive(),
  reason: z.string().min(1),
});

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();

    const {id} = await params;

    // @ts-expect-error role expected
    if (!session?.user || !["HR", "MANAGEMENT"].includes(session.user.role)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const json = await req.json();
    const body = advancePaymentSchema.parse(json);

    // Get user's current advance balance
    const user = await prisma.user.findUnique({
      where: { id: id },
      select: { totalAdvanceBalance: true }
    });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Create advance payment with transaction
    const advancePayment = await prisma.$transaction(async (tx) => {
      // Create the advance payment
      const advance = await tx.advancePayment.create({
        data: {
          userId: id,
          amount: body.amount,
          emiAmount: body.emiAmount,
          remainingAmount: body.amount,
          reason: body.reason,
          // @ts-expect-error - expected
          approvedById: session.user.id,
          approvedAt: new Date(),
          status: "APPROVED",
        },
      });

      // Update user's total advance balance
      await tx.user.update({
        where: { id: id },
        data: {
          totalAdvanceBalance: {
            increment: body.amount
          }
        }
      });

      return advance;
    });

    return NextResponse.json(advancePayment);
  } catch (error) {
    console.error("Error creating advance payment:", error);
    return NextResponse.json(
      { error: "Failed to create advance payment" },
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
    const {id} = await params;

    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const advancePayments = await prisma.advancePayment.findMany({
      where: {
        userId: id
      },
      include: {
        approvedBy: {
          select: {
            name: true,
          }
        }
      },
      orderBy: {
        createdAt: 'desc'
      }
    });

    return NextResponse.json(advancePayments);
  } catch (error) {
    console.error("Error fetching advance payments:", error);
    return NextResponse.json(
      { error: "Failed to fetch advance payments" },
      { status: 500 }
    );
  }
} 
