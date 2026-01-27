"use client";

import { Button } from "@/components/ui/button";
import { Download } from "lucide-react";
import { toast } from "sonner";
import { useState } from "react";
import { format } from "date-fns";

interface DownloadLeaveReportProps {
  filters: {
    month?: number;
    year?: number;
    branchId?: string;
    status?: string;
    leaveType?: string;
  };
}

export function DownloadLeaveReport({ filters }: DownloadLeaveReportProps) {
  const [isDownloading, setIsDownloading] = useState(false);

  const handleDownload = async () => {
    try {
      setIsDownloading(true);

      const params = new URLSearchParams();
      
      if (filters.month) {
        params.append("month", filters.month.toString());
      }
      if (filters.year) {
        params.append("year", filters.year.toString());
      }
      if (filters.branchId && filters.branchId !== "ALL") {
        params.append("branchId", filters.branchId);
      }
      if (filters.status && filters.status !== "ALL") {
        params.append("status", filters.status);
      }
      if (filters.leaveType && filters.leaveType !== "ALL") {
        params.append("leaveType", filters.leaveType);
      }

      const response = await fetch(
        `/api/leave-requests/export?${params.toString()}`
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to generate leave report");
      }

      // Create blob from response
      const blob = await response.blob();

      // Create download link
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `leave-requests-report-${format(new Date(), "yyyy-MM-dd")}.xlsx`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      a.remove();

      toast.success("Leave report downloaded successfully");
    } catch (error) {
      console.error("Error downloading leave report:", error);
      toast.error(
        error instanceof Error
          ? error.message
          : "Failed to download leave report"
      );
    } finally {
      setIsDownloading(false);
    }
  };

  return (
    <Button
      onClick={handleDownload}
      disabled={isDownloading}
      className="gap-2"
      variant="outline"
    >
      <Download className="h-4 w-4" />
      {isDownloading ? "Downloading..." : "Download Report"}
    </Button>
  );
}
