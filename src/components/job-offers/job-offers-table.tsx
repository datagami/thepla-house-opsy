'use client';

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { JobOfferActions } from './job-offer-actions';
import { format } from 'date-fns';

interface JobOffer {
  id: string;
  name: string;
  designation: string;
  totalSalary: number;
  status: 'PENDING' | 'ACCEPTED' | 'REJECTED' | 'EXPIRED';
  offerDate: Date;
  joiningDate: Date | null;
  acceptedAt: Date | null;
  department: {
    id: string;
    name: string;
  } | null;
  user: {
    id: string;
    name: string | null;
    email: string | null;
    mobileNo: string | null;
  };
}

interface Department {
  id: string;
  name: string;
}

interface JobOffersTableProps {
  jobOffers: JobOffer[];
  departments: Department[];
}

const statusColors = {
  PENDING: 'bg-yellow-100 text-yellow-800',
  ACCEPTED: 'bg-green-100 text-green-800',
  REJECTED: 'bg-red-100 text-red-800',
  EXPIRED: 'bg-gray-100 text-gray-800',
} as const;

export function JobOffersTable({
  jobOffers,
  departments,
}: JobOffersTableProps) {
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0,
    }).format(amount);
  };

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Name</TableHead>
          <TableHead>Designation</TableHead>
          <TableHead>Department</TableHead>
          <TableHead>Total Salary</TableHead>
          <TableHead>Offer Date</TableHead>
          <TableHead>Joining Date</TableHead>
          <TableHead>Status</TableHead>
          <TableHead className="text-right">Actions</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {jobOffers.length === 0 ? (
          <TableRow>
            <TableCell colSpan={8} className="text-center text-muted-foreground">
              No job offers found
            </TableCell>
          </TableRow>
        ) : (
          jobOffers.map((offer) => (
            <TableRow key={offer.id}>
              <TableCell className="font-medium">{offer.name}</TableCell>
              <TableCell>{offer.designation}</TableCell>
              <TableCell>
                {offer.department?.name || (
                  <span className="text-muted-foreground">-</span>
                )}
              </TableCell>
              <TableCell>{formatCurrency(offer.totalSalary)}</TableCell>
              <TableCell>
                {format(new Date(offer.offerDate), 'dd MMM yyyy')}
              </TableCell>
              <TableCell>
                {offer.joiningDate
                  ? format(new Date(offer.joiningDate), 'dd MMM yyyy')
                  : '-'}
              </TableCell>
              <TableCell>
                <Badge
                  variant="secondary"
                  className={statusColors[offer.status]}
                >
                  {offer.status}
                </Badge>
              </TableCell>
              <TableCell className="text-right">
                <JobOfferActions
                  jobOffer={offer}
                  departments={departments}
                />
              </TableCell>
            </TableRow>
          ))
        )}
      </TableBody>
    </Table>
  );
}
