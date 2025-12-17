import { Metadata } from 'next';
import { auth } from '@/auth';
import { redirect } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import { JobOffersTable } from '@/components/job-offers/job-offers-table';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Plus } from 'lucide-react';

export const metadata: Metadata = {
  title: 'Job Offers - HRMS',
  description: 'Manage job offers',
};

export default async function JobOffersPage() {
  const session = await auth();

  if (!session) {
    redirect('/login');
  }

  // @ts-expect-error - role is not in the User type
  const role = session.user.role;
  const canManageJobOffers = ['HR', 'MANAGEMENT'].includes(role);

  if (!canManageJobOffers) {
    redirect('/dashboard');
  }

  const jobOffers = await prisma.jobOffer.findMany({
    include: {
      user: {
        select: {
          id: true,
          name: true,
          email: true,
          mobileNo: true,
        },
      },
      department: {
        select: {
          id: true,
          name: true,
        },
      },
    },
    orderBy: {
      offerDate: 'desc',
    },
  });

  const departments = await prisma.department.findMany({
    where: { isActive: true },
    select: {
      id: true,
      name: true,
    },
    orderBy: {
      name: 'asc',
    },
  });

  return (
    <div className="flex-1 space-y-4 p-8 pt-6">
      <div className="flex items-center justify-between">
        <h2 className="text-3xl font-bold tracking-tight">Job Offers</h2>
        <Link href="/job-offers/new">
          <Button>
            <Plus className="mr-2 h-4 w-4" />
            New Job Offer
          </Button>
        </Link>
      </div>

      <div className="rounded-md border">
        <JobOffersTable jobOffers={jobOffers} departments={departments} />
      </div>
    </div>
  );
}
