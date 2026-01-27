"use client";

import { useState, useEffect } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AdvancesStats } from "./advances-stats";
import { AdvancesFilters } from "./advances-filters";
import { AdvancesTable } from "./advances-table";
import { DownloadAdvancesReport } from "./download-advances-report";
import { toast } from "sonner";
import { Skeleton } from "@/components/ui/skeleton";

interface AdvancesManagementProps {
  userRole: string;
  userId: string;
}

export interface AdvanceData {
  userId: string;
  userName: string;
  userNumId: number;
  userBranch: string;
  totalAdvanceAmount: number;
  totalRemainingAmount: number;
  totalEmiAmount: number;
  advancesCount: number;
  lastPaymentDate: Date | null;
  advances: any[];
}

export interface AdvancesStats {
  totalAmount: number;
  totalOutstanding: number;
  totalEmiDeductions: number;
  employeesCount: number;
}

export function AdvancesManagement({
  userRole,
  userId,
}: AdvancesManagementProps) {
  const [activeTab, setActiveTab] = useState<"unsettled" | "settled">(
    "unsettled"
  );
  const [advances, setAdvances] = useState<AdvanceData[]>([]);
  const [stats, setStats] = useState<AdvancesStats>({
    totalAmount: 0,
    totalOutstanding: 0,
    totalEmiDeductions: 0,
    employeesCount: 0,
  });
  const [isLoading, setIsLoading] = useState(true);
  const [filters, setFilters] = useState({
    search: "",
    status: "ALL",
    fromDate: "",
    toDate: "",
    branchId: "ALL",
  });

  const isHROrManagement = ["HR", "MANAGEMENT"].includes(userRole);

  const fetchAdvances = async () => {
    try {
      setIsLoading(true);
      const params = new URLSearchParams({
        isSettled: (activeTab === "settled").toString(),
        ...(filters.status !== "ALL" && { status: filters.status }),
        ...(filters.search && { search: filters.search }),
        ...(filters.fromDate && { fromDate: filters.fromDate }),
        ...(filters.toDate && { toDate: filters.toDate }),
        ...(filters.branchId !== "ALL" && { branchId: filters.branchId }),
      });

      const response = await fetch(`/api/advances?${params.toString()}`);
      if (!response.ok) {
        throw new Error("Failed to fetch advances");
      }

      const data = await response.json();
      setAdvances(data.advances);
      setStats(data.stats);
    } catch (error) {
      console.error("Error fetching advances:", error);
      toast.error("Failed to load advances data");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchAdvances();
  }, [activeTab, filters]);

  const handleFilterChange = (newFilters: typeof filters) => {
    setFilters(newFilters);
  };

  const handleTabChange = (value: string) => {
    setActiveTab(value as "unsettled" | "settled");
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">
            {isHROrManagement ? "Advances" : "My Advances"}
          </h1>
          <p className="text-muted-foreground">
            {isHROrManagement
              ? "View and manage employee salary advances"
              : "View your salary advances and payment history"}
          </p>
        </div>
        <DownloadAdvancesReport
          isSettled={activeTab === "settled"}
          filters={filters}
        />
      </div>

      {/* Stats Cards */}
      <AdvancesStats stats={stats} isLoading={isLoading} />

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={handleTabChange}>
        <TabsList>
          <TabsTrigger value="unsettled">Unsettled Advances</TabsTrigger>
          <TabsTrigger value="settled">Settled Advances</TabsTrigger>
        </TabsList>

        <TabsContent value="unsettled" className="space-y-4">
          {/* Filters */}
          <AdvancesFilters
            filters={filters}
            onFilterChange={handleFilterChange}
            isHROrManagement={isHROrManagement}
          />

          {/* Table */}
          {isLoading ? (
            <div className="space-y-3">
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-12 w-full" />
            </div>
          ) : (
            <AdvancesTable advances={advances} />
          )}
        </TabsContent>

        <TabsContent value="settled" className="space-y-4">
          {/* Filters */}
          <AdvancesFilters
            filters={filters}
            onFilterChange={handleFilterChange}
            isHROrManagement={isHROrManagement}
          />

          {/* Table */}
          {isLoading ? (
            <div className="space-y-3">
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-12 w-full" />
            </div>
          ) : (
            <AdvancesTable advances={advances} />
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
