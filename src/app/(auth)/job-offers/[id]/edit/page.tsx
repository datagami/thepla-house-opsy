import { Metadata } from 'next';
import { auth } from '@/auth';
import { redirect } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import { JobOfferForm } from '@/components/job-offers/job-offer-form';

export const metadata: Metadata = {
  title: 'Edit Job Offer - HRMS',
  description: 'Edit job offer',
};

export default async function EditJobOfferPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
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

  const { id } = await params;

  const jobOffer = await prisma.jobOffer.findUnique({
    where: { id },
    include: {
      user: {
        select: {
          id: true,
          title: true,
          role: true,
        },
      },
      department: {
        select: {
          id: true,
          name: true,
        },
      },
    },
  });

  if (!jobOffer) {
    redirect('/job-offers');
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
        <h2 className="text-3xl font-bold tracking-tight">Edit Job Offer</h2>
      </div>

      <JobOfferForm departments={departments} jobOffer={jobOffer} />
    </div>
  );
}
