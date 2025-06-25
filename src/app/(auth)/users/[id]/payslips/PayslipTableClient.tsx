"use client";

import { useRouter } from "next/navigation";

interface PayslipTableClientProps {
  salaries: Array<{
    id: string;
    month: number;
    year: number;
    netSalary: number;
    status: string;
    createdAt: string;
  }>;
}

export default function PayslipTableClient({ salaries }: PayslipTableClientProps) {
  const router = useRouter();

  const handleRowClick = (salaryId: string) => {
    router.push(`/salary/${salaryId}`);
  };

  const monthNames = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"
  ];

  return (
    <table className="min-w-full divide-y divide-gray-200">
      <thead>
        <tr>
          <th className="px-4 py-2 text-left">Month</th>
          <th className="px-4 py-2 text-left">Year</th>
          <th className="px-4 py-2 text-left">Status</th>
          <th className="px-4 py-2 text-left">Created At</th>
        </tr>
      </thead>
      <tbody>
        {salaries.length === 0 ? (
          <tr>
            <td colSpan={6} className="text-center py-4">No payslips found.</td>
          </tr>
        ) : (
          salaries.map((salary) => (
            <tr
              key={salary.id}
              className="border-b cursor-pointer hover:bg-gray-100"
              onClick={() => handleRowClick(salary.id)}
            >
              <td className="px-4 py-2">{monthNames[salary.month - 1]}</td>
              <td className="px-4 py-2">{salary.year}</td>
              <td className="px-4 py-2">{salary.status}</td>
              <td className="px-4 py-2">{new Date(salary.createdAt).toLocaleDateString()}</td>
            </tr>
          ))
        )}
      </tbody>
    </table>
  );
} 
