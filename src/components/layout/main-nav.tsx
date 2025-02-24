"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { hasAccess } from "@/lib/access-control";

interface NavItem {
  title: string;
  href: string;
  feature: string;
}

const roleNavItems: Record<string, NavItem[]> = {
  HR: [
    { title: "Dashboard", href: "/dashboard", feature: "dashboard.view" },
    { title: "Users", href: "/users", feature: "users.view" },
    { title: "Manager Attendance", href: "/hr/attendance", feature: "attendance.mark" },
    { title: "Verify Attendance", href: "/hr/attendance-verification", feature: "attendance.verify" },
    { title: "Leave Requests", href: "/leave-requests", feature: "leave.view" },
  ],
  BRANCH_MANAGER: [
    { title: "Dashboard", href: "/dashboard", feature: "dashboard.view" },
    { title: "Attendance", href: "/attendance", feature: "attendance.mark" },
    { title: "Leave Requests", href: "/leave-requests", feature: "leave.view" },
  ],
  MANAGEMENT: [
    { title: "Dashboard", href: "/dashboard", feature: "dashboard.view" },
    { title: "Users", href: "/users", feature: "users.view" },
    { title: "Branches", href: "/branches", feature: "branch.view" },
    { title: "Reports", href: "/reports", feature: "attendance.report" },
  ],
  EMPLOYEE: [
    { title: "Dashboard", href: "/dashboard", feature: "dashboard.view" },
    { title: "Attendance", href: "/attendance", feature: "attendance.view" },
    { title: "Leave Requests", href: "/leave-requests", feature: "leave.request" },
  ],
};

interface MainNavProps {
  userRole: string;
}

export function MainNav({ userRole }: MainNavProps) {
  const pathname = usePathname();
  const navItems = roleNavItems[userRole] || [];

  return (
    <nav className="flex items-center space-x-4 lg:space-x-6">
      {navItems.map((item) => 
        hasAccess(userRole, item.feature) && (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              "text-sm font-medium transition-colors hover:text-primary",
              pathname === item.href
                ? "text-primary"
                : "text-muted-foreground"
            )}
          >
            {item.title}
          </Link>
        )
      )}
    </nav>
  );
} 