"use client";

import { Button } from "@/components/ui/button";
import { Download } from "lucide-react";
import { toast } from "sonner";
import { useState } from "react";
import { format } from "date-fns";

interface DownloadReferralsReportProps {
  filters: {
    status?: string;
    fromDate?: string;
    toDate?: string;
    branchId?: string;
  };
}

export function DownloadReferralsReport({
  filters,
}: DownloadReferralsReportProps) {
  const [isDownloading, setIsDownloading] = useState(false);

  const handleDownload = async () => {
    try {
      setIsDownloading(true);

      const params = new URLSearchParams();

      if (filters.status && filters.status !== "ALL") {
        params.append("status", filters.status);
      }
      if (filters.fromDate) {
        params.append("fromDate", filters.fromDate);
      }
      if (filters.toDate) {
        params.append("toDate", filters.toDate);
      }
      if (filters.branchId && filters.branchId !== "ALL") {
        params.append("branchId", filters.branchId);
      }

      const response = await fetch(
        `/api/referrals/export?${params.toString()}`
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to generate referrals report");
      }

      // Create blob from response
      const blob = await response.blob();

      // Create download link
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `referrals-report-${format(new Date(), "yyyy-MM-dd")}.xlsx`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      a.remove();

      toast.success("Referrals report downloaded successfully");
    } catch (error) {
      console.error("Error downloading referrals report:", error);
      toast.error(
        error instanceof Error
          ? error.message
          : "Failed to download referrals report"
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
