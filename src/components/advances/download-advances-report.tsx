"use client";

import { Button } from "@/components/ui/button";
import { Download } from "lucide-react";
import { toast } from "sonner";
import { useState } from "react";
import { format } from "date-fns";

interface DownloadAdvancesReportProps {
  isSettled: boolean;
  filters: {
    search: string;
    status: string;
    fromDate: string;
    toDate: string;
    branchId: string;
  };
}

export function DownloadAdvancesReport({
  isSettled,
  filters,
}: DownloadAdvancesReportProps) {
  const [isDownloading, setIsDownloading] = useState(false);

  const handleDownload = async () => {
    try {
      setIsDownloading(true);

      const params = new URLSearchParams({
        isSettled: isSettled.toString(),
        ...(filters.status !== "ALL" && { status: filters.status }),
        ...(filters.search && { search: filters.search }),
        ...(filters.fromDate && { fromDate: filters.fromDate }),
        ...(filters.toDate && { toDate: filters.toDate }),
        ...(filters.branchId !== "ALL" && { branchId: filters.branchId }),
      });

      const response = await fetch(`/api/advances/export?${params.toString()}`);

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to generate advances report");
      }

      // Create blob from response
      const blob = await response.blob();

      // Create download link
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `advances-report-${format(new Date(), "yyyy-MM-dd")}.xlsx`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      a.remove();

      toast.success("Advances report downloaded successfully");
    } catch (error) {
      console.error("Error downloading advances report:", error);
      toast.error(
        error instanceof Error
          ? error.message
          : "Failed to download advances report"
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
