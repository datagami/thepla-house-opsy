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
  Building2,
  FileText,
  CalendarCheck,
  Plus,
  DollarSign,
  AlertTriangle,
  ChevronDown,
  ChevronRight,
  Briefcase,
  History,
  UserPlus,
  FileCheck,
} from "lucide-react";
import { useSession } from "next-auth/react";
import { useState } from "react";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";

interface NavSubItem {
  title: string;
  href: string;
  icon?: React.ReactNode;
  feature: string;
}

interface NavItem {
  title: string;
  href?: string;
  icon: React.ReactNode;
  feature: string;
  subItems?: NavSubItem[];
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
      title: "Job Offers", 
      href: "/job-offers",
      icon: <FileCheck className="h-5 w-5" />,
      feature: "users.manage" 
    },
    { 
      title: "Departments", 
      href: "/departments", 
      icon: <Briefcase className="h-5 w-5" />,
      feature: "users.manage" 
    },
    { 
      title: "Branch Attendance", 
      href: "/attendance", 
      icon: <Clock className="h-5 w-5" />,
      feature: "attendance.mark" 
    },
    { 
      title: "Manager Attendance", 
      href: "/hr/attendance", 
      icon: <ClipboardCheck className="h-5 w-5" />,
      feature: "attendance.verify" 
    },
    {
      title: "Branch Submissions",
      href: "/hr/branch-attendance",
      icon: <Building2 className="h-5 w-5" />,
      feature: "attendance.view_branch_submissions",
      subItems: [
        {
          title: "Attendance Verification",
          href: "/hr/attendance-verification",
          icon: <ClipboardCheck className="h-4 w-4" />,
          feature: "attendance.verify"
        },
      ]
    },
    { 
      title: "Leave Requests", 
      href: "/leave-requests", 
      icon: <CalendarCheck className="h-5 w-5" />,
      feature: "leave.view" 
    },
    { 
      title: "Reports", 
      href: "/reports", 
      icon: <FileText className="h-5 w-5" />,
      feature: "attendance.report" 
    },
    {
      title: "Salary & Finance",
      icon: <DollarSign className="h-5 w-5" />,
      feature: "salary.edit",
      subItems: [
        {
          title: "Salary",
          href: "/salary",
          icon: <DollarSign className="h-4 w-4" />,
          feature: "salary.edit"
        },
        {
          title: "My Payslips",
          href: "/users/<user_id>/payslips",
          icon: <FileText className="h-4 w-4" />,
          feature: "salary.view"
        },
        {
          title: "Attendance Conflicts",
          href: "/hr/attendance-conflicts",
          icon: <AlertTriangle className="h-4 w-4" />,
          feature: "attendance.resolve_conflicts"
        },
        {
          title: "Referrals",
          href: "/referrals",
          icon: <UserPlus className="h-4 w-4" />,
          feature: "salary.view"
        },
      ]
    },
    {
      title: "Notes",
      href: "/notes",
      icon: <FileText className="h-5 w-5" />,
      feature: "notes.view"
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
    {
      title: "My Payslips",
      href: "/users/<user_id>/payslips",
      icon: <FileText className="h-5 w-5" />,
      feature: "salary.view"
    },
    {
      title: "Notes",
      href: "/notes",
      icon: <FileText className="h-5 w-5" />,
      feature: "notes.view"
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
      title: "Job Offers", 
      href: "/job-offers",
      icon: <FileCheck className="h-5 w-5" />,
      feature: "users.manage" 
    },
    { 
      title: "Branches", 
      href: "/branches", 
      icon: <Building className="h-5 w-5" />,
      feature: "branch.view" 
    },
    { 
      title: "Departments", 
      href: "/departments", 
      icon: <Briefcase className="h-5 w-5" />,
      feature: "users.manage" 
    },
    { 
      title: "Branch Attendance", 
      href: "/attendance", 
      icon: <Clock className="h-5 w-5" />,
      feature: "attendance.mark" 
    },
    { 
      title: "Manager Attendance", 
      href: "/hr/attendance", 
      icon: <ClipboardCheck className="h-5 w-5" />,
      feature: "attendance.verify" 
    },
    {
      title: "Branch Submissions",
      href: "/hr/branch-attendance",
      icon: <Building2 className="h-5 w-5" />,
      feature: "attendance.view_branch_submissions",
      subItems: [
        {
          title: "Attendance Verification",
          href: "/hr/attendance-verification",
          icon: <ClipboardCheck className="h-4 w-4" />,
          feature: "attendance.verify"
        },
      ]
    },
    { 
      title: "Leave Requests", 
      href: "/leave-requests", 
      icon: <CalendarCheck className="h-5 w-5" />,
      feature: "leave.view" 
    },
    { 
      title: "Reports", 
      href: "/reports", 
      icon: <FileText className="h-5 w-5" />,
      feature: "attendance.report" 
    },
    {
      title: "Salary & Finance",
      icon: <DollarSign className="h-5 w-5" />,
      feature: "salary.edit",
      subItems: [
        {
          title: "Salary",
          href: "/salary",
          icon: <DollarSign className="h-4 w-4" />,
          feature: "salary.edit"
        },
        {
          title: "My Payslips",
          href: "/users/<user_id>/payslips",
          icon: <FileText className="h-4 w-4" />,
          feature: "salary.view"
        },
        {
          title: "Attendance Conflicts",
          href: "/hr/attendance-conflicts",
          icon: <AlertTriangle className="h-4 w-4" />,
          feature: "attendance.resolve_conflicts"
        },
        {
          title: "Referrals",
          href: "/referrals",
          icon: <UserPlus className="h-4 w-4" />,
          feature: "salary.view"
        },
      ]
    },
    {
      title: "Notes",
      href: "/notes",
      icon: <FileText className="h-5 w-5" />,
      feature: "notes.view"
    },
    {
      title: "Activity Logs",
      href: "/activity-logs",
      icon: <History className="h-5 w-5" />,
      feature: "activity-logs.view"
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
      title: "My Attendance",
      href: "/attendance/<user_id>",
      icon: <Clock className="h-5 w-5" />,
      feature: "attendance.view"
    },
    {
      title: "My Payslips",
      href: "/users/<user_id>/payslips",
      icon: <FileText className="h-5 w-5" />,
      feature: "salary.view"
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
    {
      title: "Notes",
      href: "/notes",
      icon: <FileText className="h-5 w-5" />,
      feature: "notes.view"
    },
  ],
};

interface MobileNavProps {
  userRole: string;
}

function NavItemComponent({ 
  item, 
  pathname, 
  userId 
}: { 
  item: NavItem; 
  pathname: string;
  userId?: string;
}) {
  const [isOpen, setIsOpen] = useState(() => {
    // Auto-expand if any submenu item is active
    if (item.subItems) {
      return item.subItems.some(subItem => {
        const href = subItem.href?.replace("<user_id>", userId || "");
        return href && pathname.startsWith(href);
      });
    }
    return false;
  });

  // Process href with user ID replacement
  const processHref = (href: string) => {
    if (userId && href.includes("<user_id>")) {
      return href.replace("<user_id>", userId);
    }
    return href;
  };

  // Check if item or any subitem is active
  const isActive = item.href 
    ? pathname === processHref(item.href) || pathname.startsWith(processHref(item.href) + "/")
    : false;

  const hasActiveSubItem = item.subItems?.some(subItem => {
    const href = subItem.href ? processHref(subItem.href) : "";
    return href && (pathname === href || pathname.startsWith(href + "/"));
  });

  const isItemActive = isActive || hasActiveSubItem;

  if (item.subItems && item.subItems.length > 0) {
    const parentHref = item.href ? processHref(item.href) : null;
    const isParentActive = parentHref && (pathname === parentHref || pathname.startsWith(parentHref + "/"));
    const shouldHighlight = isItemActive || isOpen || isParentActive;

    return (
      <Collapsible open={isOpen} onOpenChange={setIsOpen}>
        <div className="space-y-1">
          <div
            className={cn(
              "flex w-full items-center justify-between gap-3 rounded-lg px-3 py-2 text-sm transition-all",
              shouldHighlight
                ? "bg-accent text-primary"
                : "text-muted-foreground hover:text-primary"
            )}
          >
            {parentHref ? (
              <Link
                href={parentHref}
                className="flex items-center gap-3 flex-1"
                onClick={(e) => {
                  // Allow navigation but don't toggle the menu on link click
                  e.stopPropagation();
                }}
              >
                {item.icon}
                <span>{item.title}</span>
              </Link>
            ) : (
              <div className="flex items-center gap-3 flex-1">
                {item.icon}
                <span>{item.title}</span>
              </div>
            )}
            <CollapsibleTrigger asChild>
              <button
                className="flex items-center"
                onClick={(e) => {
                  e.stopPropagation();
                }}
              >
                {isOpen ? (
                  <ChevronDown className="h-4 w-4" />
                ) : (
                  <ChevronRight className="h-4 w-4" />
                )}
              </button>
            </CollapsibleTrigger>
          </div>
          <CollapsibleContent className="space-y-1 pl-4 pt-1">
            {item.subItems.map((subItem) => {
              const subHref = subItem.href ? processHref(subItem.href) : "#";
              const isSubActive = pathname === subHref || pathname.startsWith(subHref + "/");
              
              return (
                <Link
                  key={subItem.href || subItem.title}
                  href={subHref}
                  className={cn(
                    "flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-all hover:text-primary",
                    isSubActive
                      ? "bg-accent text-primary"
                      : "text-muted-foreground"
                  )}
                >
                  {subItem.icon || <div className="h-4 w-4" />}
                  <span>{subItem.title}</span>
                </Link>
              );
            })}
          </CollapsibleContent>
        </div>
      </Collapsible>
    );
  }

  // Regular nav item without submenu
  const href = item.href ? processHref(item.href) : "#";
  
  return (
    <Link
      href={href}
      className={cn(
        "flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-all hover:text-primary",
        isActive
          ? "bg-accent text-primary"
          : "text-muted-foreground"
      )}
    >
      {item.icon}
      {item.title}
    </Link>
  );
}

export function MobileNav({ userRole }: MobileNavProps) {
  const pathname = usePathname();
  const navItems = roleNavItems[userRole] || [];
  const { data: session } = useSession();

  const userId = session?.user?.id && typeof session.user.id === "string" 
    ? session.user.id 
    : undefined;

  return (
    <nav className="space-y-2">
      {navItems.map((item) => (
        <NavItemComponent
          key={item.title}
          item={item}
          pathname={pathname}
          userId={userId}
        />
      ))}
    </nav>
  );
} 