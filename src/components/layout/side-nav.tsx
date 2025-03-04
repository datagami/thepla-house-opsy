"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { 
  LayoutDashboard, 
  Users, 
  Clock, 
  ClipboardCheck,
  Building,
  FileText,
  CalendarCheck,
  Plus
} from "lucide-react";

interface NavItem {
  title: string;
  href: string;
  icon: React.ReactNode;
  feature: string;
}

const roleNavItems: Record<string, NavItem[]> = {
  HR: [
    { 
      title: "Dashboard", 
      href: "/dashboard", 
      icon: <LayoutDashboard className="h-5 w-5" />,
      feature: "dashboard.view" 
    },
    { 
      title: "Users", 
      href: "/users",
      icon: <Users className="h-5 w-5" />,
      feature: "users.view" 
    },
    { 
      title: "Manager Attendance", 
      href: "/hr/attendance", 
      icon: <Clock className="h-5 w-5" />,
      feature: "attendance.mark" 
    },
    { 
      title: "Verify Attendance", 
      href: "/hr/attendance-verification", 
      icon: <ClipboardCheck className="h-5 w-5" />,
      feature: "attendance.verify" 
    },
    { 
      title: "Leave Requests", 
      href: "/leave-requests", 
      icon: <CalendarCheck className="h-5 w-5" />,
      feature: "leave.view" 
    },
  ],
  BRANCH_MANAGER: [
    { 
      title: "Dashboard", 
      href: "/dashboard", 
      icon: <LayoutDashboard className="h-5 w-5" />,
      feature: "dashboard.view" 
    },
    { 
      title: "Employees",
      href: "/employees", 
      icon: <Users className="h-5 w-5" />,
      feature: "employees.view" 
    },
    { 
      title: "Attendance", 
      href: "/attendance", 
      icon: <Clock className="h-5 w-5" />,
      feature: "attendance.mark" 
    },
    { 
      title: "Leave Requests", 
      href: "/leave-requests", 
      icon: <CalendarCheck className="h-5 w-5" />,
      feature: "leave.view" 
    },
    { 
      title: "New Leave Request", 
      href: "/leave-requests/new", 
      icon: <Plus className="h-5 w-5" />,
      feature: "leave.request" 
    },
  ],
  MANAGEMENT: [
    { 
      title: "Dashboard", 
      href: "/dashboard", 
      icon: <LayoutDashboard className="h-5 w-5" />,
      feature: "dashboard.view" 
    },
    { 
      title: "Users", 
      href: "/users",
      icon: <Users className="h-5 w-5" />,
      feature: "users.view" 
    },
    { 
      title: "Branches", 
      href: "/branches", 
      icon: <Building className="h-5 w-5" />,
      feature: "branch.view" 
    },
    { 
      title: "Reports", 
      href: "/reports", 
      icon: <FileText className="h-5 w-5" />,
      feature: "attendance.report" 
    },
  ],
  EMPLOYEE: [
    { 
      title: "Dashboard", 
      href: "/dashboard", 
      icon: <LayoutDashboard className="h-5 w-5" />,
      feature: "dashboard.view" 
    },
    { 
      title: "Attendance", 
      href: "/attendance", 
      icon: <Clock className="h-5 w-5" />,
      feature: "attendance.view" 
    },
    { 
      title: "Leave Requests", 
      href: "/leave-requests", 
      icon: <CalendarCheck className="h-5 w-5" />,
      feature: "leave.view" 
    },
    { 
      title: "New Leave Request", 
      href: "/leave-requests/new", 
      icon: <Plus className="h-5 w-5" />,
      feature: "leave.request" 
    },
  ],
};

interface SideNavProps {
  userRole: string;
}

export function SideNav({ userRole }: SideNavProps) {
  const pathname = usePathname();
  const navItems = roleNavItems[userRole] || [];

  return (
    <nav className="space-y-2">
      {navItems.map((item) => (
        <Link
          key={item.href}
          href={item.href}
          className={cn(
            "flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-all hover:text-primary",
            pathname === item.href 
              ? "bg-accent text-primary" 
              : "text-muted-foreground"
          )}
        >
          {item.icon}
          {item.title}
        </Link>
      ))}
    </nav>
  );
} 
