"use client";

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { DollarSign, TrendingUp, Users, Wallet } from "lucide-react";
import { formatCurrency } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";

interface AdvancesStatsProps {
  stats: {
    totalAmount: number;
    totalOutstanding: number;
    totalEmiDeductions: number;
    employeesCount: number;
  };
  isLoading: boolean;
}

export function AdvancesStats({ stats, isLoading }: AdvancesStatsProps) {
  const statsCards = [
    {
      title: "Total Advances",
      value: formatCurrency(stats.totalAmount),
      icon: Wallet,
      description: "Sum of all advance amounts",
      color: "text-blue-600",
      bgColor: "bg-blue-100",
    },
    {
      title: "Outstanding Balance",
      value: formatCurrency(stats.totalOutstanding),
      icon: TrendingUp,
      description: "Total remaining to be paid",
      color: "text-orange-600",
      bgColor: "bg-orange-100",
    },
    {
      title: "Total EMI",
      value: formatCurrency(stats.totalEmiDeductions),
      icon: DollarSign,
      description: "Monthly EMI deductions",
      color: "text-green-600",
      bgColor: "bg-green-100",
    },
    {
      title: "Employees",
      value: stats.employeesCount.toString(),
      icon: Users,
      description: "With active advances",
      color: "text-purple-600",
      bgColor: "bg-purple-100",
    },
  ];

  if (isLoading) {
    return (
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {[1, 2, 3, 4].map((i) => (
          <Card key={i}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <Skeleton className="h-4 w-[100px]" />
              <Skeleton className="h-4 w-4 rounded" />
            </CardHeader>
            <CardContent>
              <Skeleton className="h-8 w-[120px] mb-1" />
              <Skeleton className="h-3 w-[150px]" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      {statsCards.map((stat, index) => {
        const Icon = stat.icon;
        return (
          <Card key={index}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                {stat.title}
              </CardTitle>
              <div className={`p-2 rounded-lg ${stat.bgColor}`}>
                <Icon className={`h-4 w-4 ${stat.color}`} />
              </div>
            </CardHeader>
            <CardContent>
              <div className={`text-2xl font-bold ${stat.color}`}>
                {stat.value}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                {stat.description}
              </p>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
