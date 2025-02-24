import { Metadata } from "next";
import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { UserTable } from "@/components/users/user-table";
import { UserTableFilters } from "@/components/users/user-table-filters";

export const metadata: Metadata = {
  title: "User Management - HRMS",
  description: "Manage users in the HRMS system",
};

interface PageProps {
  searchParams: {
    page?: string;
    search?: string;
    status?: string;
    role?: string;
  };
}

export default async function UsersPage({ searchParams }: PageProps) {
  const session = await auth();

  if (!session || !["MANAGEMENT", "HR"].includes(session.user.role)) {
    redirect("/dashboard");
  }

  const page = Number(searchParams.page) || 1;
  const perPage = 10;

  // Create filter conditions
  const where = {
    AND: [
      searchParams.search
        ? {
            OR: [
              { name: { contains: searchParams.search, mode: "insensitive" } },
              { email: { contains: searchParams.search, mode: "insensitive" } },
            ],
          }
        : {},
      searchParams.status && searchParams.status !== "all"
        ? { status: searchParams.status }
        : {},
      searchParams.role && searchParams.role !== "all"
        ? { role: searchParams.role }
        : {},
    ],
  };

  // Get total count for pagination
  const totalUsers = await prisma.user.count({ where });
  const totalPages = Math.ceil(totalUsers / perPage);

  // Get users with pagination
  const users = await prisma.user.findMany({
    where,
    include: {
      branch: true,
      approvedBy: {
        select: {
          name: true,
        },
      },
    },
    orderBy: {
      createdAt: "desc",
    },
    skip: (page - 1) * perPage,
    take: perPage,
  });

  return (
    <div className="flex-1 space-y-4">
      <div className="flex items-center justify-between space-y-2">
        <h2 className="text-3xl font-bold tracking-tight">User Management</h2>
      </div>
      <div className="space-y-4">
        <UserTableFilters />
        <UserTable users={users} currentPage={page} totalPages={totalPages} />
      </div>
    </div>
  );
} 