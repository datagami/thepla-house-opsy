import { Metadata } from 'next';
import { auth } from '@/auth';
import { redirect } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import { JobOfferForm } from '@/components/job-offers/job-offer-form';

export const metadata: Metadata = {
  title: 'New Job Offer - HRMS',
  description: 'Create a new job offer',
};

export default async function NewJobOfferPage() {
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
        <h2 className="text-3xl font-bold tracking-tight">New Job Offer</h2>
      </div>

      <JobOfferForm departments={departments} />
    </div>
  );
}
