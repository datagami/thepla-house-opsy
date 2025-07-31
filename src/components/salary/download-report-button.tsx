"use client";

import { Button } from "@/components/ui/button";
import { Download } from "lucide-react";
import { toast } from "sonner";
import { useEffect, useState } from "react";
import { Salary } from "@/models/models";

interface DownloadReportButtonProps {
  year?: number;
  month?: number;
}

export function DownloadReportButton({ year, month }: DownloadReportButtonProps) {
  const [hasSalaries, setHasSalaries] = useState(false);

  useEffect(() => {
    const checkSalaries = async () => {
      if (!year || !month) {
        setHasSalaries(false);
        return;
      }

      try {
        const response = await fetch(`/api/salary?year=${year}&month=${month}`);
        if (!response.ok) {
          throw new Error('Failed to fetch salary status');
        }
        const data = await response.json();
        const hasAnySalaries = data.length > 0;
        console.log('Salaries found:', hasAnySalaries, data.length);
        setHasSalaries(hasAnySalaries);
      } catch (error) {
        console.error('Error checking salaries:', error);
        setHasSalaries(false);
      }
    };

    checkSalaries();
  }, [year, month]);

  const handleDownloadReport = async () => {
    if (!year || !month) {
      toast.error('Please select both year and month');
      return;
    }

    try {
      const response = await fetch('/api/salary/generate-report', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          year,
          month
        })
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to generate salary report');
      }

      // Create blob from response
      const blob = await response.blob();
      
      // Create download link
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `salary-report-${month}-${year}.xlsx`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      a.remove();

      toast.success('Salary report downloaded successfully');
    } catch (error) {
      console.error('Error downloading salary report:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to download salary report');
    }
  };

  if (!year || !month) return null;

  return (
    <Button 
      onClick={handleDownloadReport}
      disabled={!hasSalaries}
      className="gap-2"
      variant="outline"
    >
      <Download className="h-4 w-4" />
      Download Salary Report
    </Button>
  );
} 