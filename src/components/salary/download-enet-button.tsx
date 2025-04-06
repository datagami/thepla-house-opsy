"use client";

import { Button } from "@/components/ui/button";
import { Download } from "lucide-react";
import { toast } from "sonner";
import { useEffect, useState } from "react";

interface DownloadENETButtonProps {
  year?: number;
  month?: number;
}

export function DownloadENETButton({ year, month }: DownloadENETButtonProps) {
  const [hasProcessingSalaries, setHasProcessingSalaries] = useState(false);

  useEffect(() => {
    const checkProcessingSalaries = async () => {
      if (!year || !month) {
        setHasProcessingSalaries(false);
        return;
      }

      try {
        const response = await fetch(`/api/salary?year=${year}&month=${month}`);
        if (!response.ok) {
          throw new Error('Failed to fetch salary status');
        }
        const data = await response.json();
        const hasProcessing = data.some((salary: any) => salary.status === 'PROCESSING');
        console.log('Processing salaries found:', hasProcessing, data);
        setHasProcessingSalaries(hasProcessing);
      } catch (error) {
        console.error('Error checking processing salaries:', error);
        setHasProcessingSalaries(false);
      }
    };

    checkProcessingSalaries();
  }, [year, month]);

  const handleDownloadENET = async () => {
    if (!year || !month) {
      toast.error('Please select both year and month');
      return;
    }

    try {
      const response = await fetch('/api/salary/generate-enet', {
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
        throw new Error(error.error || 'Failed to generate ENET file');
      }

      // Create blob from response
      const blob = await response.blob();
      
      // Create download link
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `salary-enet-${month}-${year}.xlsx`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      a.remove();

      toast.success('ENET file downloaded successfully');
    } catch (error) {
      console.error('Error downloading ENET file:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to download ENET file');
    }
  };

  if (!year || !month) {
    return null;
  }

  return (
    <Button 
      onClick={handleDownloadENET}
      disabled={!hasProcessingSalaries}
      className="gap-2"
    >
      <Download className="h-4 w-4" />
      Download ENET
    </Button>
  );
} 