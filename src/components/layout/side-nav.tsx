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
  Calendar,
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
  Wallet,
  AlertCircle,
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
  badge?: {
    count?: number;
    variant?: "default" | "warning" | "error";
  };
}

interface NavItem {
  title: string;
  href?: string;
  icon: React.ReactNode;
  feature: string;
  subItems?: NavSubItem[];
  badge?: {
    count?: number;
    variant?: "default" | "warning" | "error";
  };
  isSeparator?: boolean;
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
      title: "People Management",
      icon: <Users className="h-5 w-5" />,
      feature: "users.view",
      subItems: [
        {
          title: "Users",
          href: "/users",
          icon: <Users className="h-4 w-4" />,
          feature: "users.view"
        },
        {
          title: "Job Offers",
          href: "/job-offers",
          icon: <FileCheck className="h-4 w-4" />,
          feature: "users.manage"
        },
        {
          title: "Departments",
          href: "/departments",
          icon: <Briefcase className="h-4 w-4" />,
          feature: "users.manage"
        },
      ]
    },
    {
      title: "Attendance & Time",
      icon: <Clock className="h-5 w-5" />,
      feature: "attendance.mark",
      subItems: [
        {
          title: "Branch Attendance",
          href: "/attendance",
          icon: <Clock className="h-4 w-4" />,
          feature: "attendance.mark"
        },
        {
          title: "Manager Attendance",
          href: "/hr/attendance",
          icon: <ClipboardCheck className="h-4 w-4" />,
          feature: "attendance.verify"
        },
        {
          title: "Manage Attendance",
          href: "/hr/manage-attendance",
          icon: <Calendar className="h-4 w-4" />,
          feature: "attendance.mark"
        },
        {
          title: "Branch Submissions",
          href: "/hr/branch-attendance",
          icon: <Building2 className="h-4 w-4" />,
          feature: "attendance.view_branch_submissions"
        },
        {
          title: "Attendance Verification",
          href: "/hr/attendance-verification",
          icon: <ClipboardCheck className="h-4 w-4" />,
          feature: "attendance.verify"
        },
        {
          title: "Attendance Conflicts",
          href: "/hr/attendance-conflicts",
          icon: <AlertTriangle className="h-4 w-4" />,
          feature: "attendance.resolve_conflicts"
        },
      ]
    },
    {
      title: "Warnings & Compliance",
      icon: <AlertCircle className="h-5 w-5" />,
      feature: "users.manage",
      subItems: [
        {
          title: "Warnings",
          href: "/warnings",
          icon: <AlertTriangle className="h-4 w-4" />,
          feature: "users.manage"
        },
        {
          title: "Warning Types",
          href: "/warning-types",
          icon: <AlertCircle className="h-4 w-4" />,
          feature: "users.manage"
        },
      ]
    },
    {
      title: "Leave Management",
      icon: <CalendarCheck className="h-5 w-5" />,
      feature: "leave.view",
      subItems: [
        {
          title: "Leave Requests",
          href: "/leave-requests",
          icon: <CalendarCheck className="h-4 w-4" />,
          feature: "leave.view"
        },
      ]
    },
    {
      title: "Payroll & Finance",
      icon: <DollarSign className="h-5 w-5" />,
      feature: "salary.edit",
      subItems: [
        {
          title: "Salary Management",
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
          title: "Advances",
          href: "/advances",
          icon: <Wallet className="h-4 w-4" />,
          feature: "salary.view"
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
      title: "Reports & Analytics",
      icon: <FileText className="h-5 w-5" />,
      feature: "attendance.report",
      subItems: [
        {
          title: "Reports",
          href: "/reports",
          icon: <FileText className="h-4 w-4" />,
          feature: "attendance.report"
        },
        {
          title: "Activity Logs",
          href: "/activity-logs",
          icon: <History className="h-4 w-4" />,
          feature: "activity-logs.view"
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
      title: "Warnings", 
      href: "/warnings", 
      icon: <AlertTriangle className="h-5 w-5" />,
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
      title: "People Management",
      icon: <Users className="h-5 w-5" />,
      feature: "users.view",
      subItems: [
        {
          title: "Users",
          href: "/users",
          icon: <Users className="h-4 w-4" />,
          feature: "users.view"
        },
        {
          title: "Job Offers",
          href: "/job-offers",
          icon: <FileCheck className="h-4 w-4" />,
          feature: "users.manage"
        },
        {
          title: "Branches",
          href: "/branches",
          icon: <Building className="h-4 w-4" />,
          feature: "branch.view"
        },
        {
          title: "Departments",
          href: "/departments",
          icon: <Briefcase className="h-4 w-4" />,
          feature: "users.manage"
        },
      ]
    },
    {
      title: "Attendance & Time",
      icon: <Clock className="h-5 w-5" />,
      feature: "attendance.mark",
      subItems: [
        {
          title: "Branch Attendance",
          href: "/attendance",
          icon: <Clock className="h-4 w-4" />,
          feature: "attendance.mark"
        },
        {
          title: "Manager Attendance",
          href: "/hr/attendance",
          icon: <ClipboardCheck className="h-4 w-4" />,
          feature: "attendance.verify"
        },
        {
          title: "Manage Attendance",
          href: "/hr/manage-attendance",
          icon: <Calendar className="h-4 w-4" />,
          feature: "attendance.mark"
        },
        {
          title: "Branch Submissions",
          href: "/hr/branch-attendance",
          icon: <Building2 className="h-4 w-4" />,
          feature: "attendance.view_branch_submissions"
        },
        {
          title: "Attendance Verification",
          href: "/hr/attendance-verification",
          icon: <ClipboardCheck className="h-4 w-4" />,
          feature: "attendance.verify"
        },
        {
          title: "Attendance Conflicts",
          href: "/hr/attendance-conflicts",
          icon: <AlertTriangle className="h-4 w-4" />,
          feature: "attendance.resolve_conflicts"
        },
      ]
    },
    {
      title: "Warnings & Compliance",
      icon: <AlertCircle className="h-5 w-5" />,
      feature: "users.manage",
      subItems: [
        {
          title: "Warnings",
          href: "/warnings",
          icon: <AlertTriangle className="h-4 w-4" />,
          feature: "users.manage"
        },
        {
          title: "Warning Types",
          href: "/warning-types",
          icon: <AlertCircle className="h-4 w-4" />,
          feature: "users.manage"
        },
      ]
    },
    {
      title: "Leave Management",
      icon: <CalendarCheck className="h-5 w-5" />,
      feature: "leave.view",
      subItems: [
        {
          title: "Leave Requests",
          href: "/leave-requests",
          icon: <CalendarCheck className="h-4 w-4" />,
          feature: "leave.view"
        },
      ]
    },
    {
      title: "Payroll & Finance",
      icon: <DollarSign className="h-5 w-5" />,
      feature: "salary.edit",
      subItems: [
        {
          title: "Salary Management",
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
          title: "Advances",
          href: "/advances",
          icon: <Wallet className="h-4 w-4" />,
          feature: "salary.view"
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
      title: "Reports & Analytics",
      icon: <FileText className="h-5 w-5" />,
      feature: "attendance.report",
      subItems: [
        {
          title: "Reports",
          href: "/reports",
          icon: <FileText className="h-4 w-4" />,
          feature: "attendance.report"
        },
        {
          title: "Activity Logs",
          href: "/activity-logs",
          icon: <History className="h-4 w-4" />,
          feature: "activity-logs.view"
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
      title: "My Advances",
      href: "/advances",
      icon: <Wallet className="h-5 w-5" />,
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

interface SideNavProps {
  userRole: string;
}

// Badge component for notifications
function NavBadge({ badge }: { badge: NavItem["badge"] }) {
  if (!badge) return null;
  
  const variantStyles = {
    default: "bg-blue-500 text-white",
    warning: "bg-yellow-500 text-white",
    error: "bg-red-500 text-white",
  };
  
  return (
    <span 
      className={cn(
        "ml-auto flex h-5 min-w-[20px] items-center justify-center rounded-full px-1.5 text-xs font-medium",
        variantStyles[badge.variant || "default"]
      )}
    >
      {badge.count || ""}
    </span>
  );
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
    // Keep all menus expanded by default
    if (item.subItems) {
      return true;
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

  // Render separator
  if (item.isSeparator) {
    return <div className="my-4 border-t border-border" />;
  }

  // Check if item or any subitem is active
  const isActive = item.href 
    ? pathname === processHref(item.href) || pathname.startsWith(processHref(item.href) + "/")
    : false;

  const hasActiveSubItem = item.subItems?.some(subItem => {
    const href = subItem.href ? processHref(subItem.href) : "";
    return href && (pathname === href || pathname.startsWith(href + "/"));
  });

  if (item.subItems && item.subItems.length > 0) {
    const parentHref = item.href ? processHref(item.href) : null;
    const isParentActive = parentHref && (pathname === parentHref || pathname.startsWith(parentHref + "/"));
    const shouldHighlight = hasActiveSubItem || isParentActive;

    return (
      <Collapsible open={isOpen} onOpenChange={setIsOpen}>
        <div className="space-y-1">
          <div
            className={cn(
              "flex w-full items-center justify-between gap-3 rounded-lg px-3 py-2 text-sm transition-all",
              shouldHighlight
                ? "bg-primary/10 text-foreground font-medium"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            {parentHref ? (
              <Link
                href={parentHref}
                className="flex items-center gap-3 flex-1"
              >
                <span className={cn(
                  shouldHighlight ? "text-foreground" : "text-muted-foreground"
                )}>
                  {item.icon}
                </span>
                <span>{item.title}</span>
              </Link>
            ) : (
              <div className="flex items-center gap-3 flex-1">
                <span className={cn(
                  shouldHighlight ? "text-foreground" : "text-muted-foreground"
                )}>
                  {item.icon}
                </span>
                <span>{item.title}</span>
              </div>
            )}
            <div className="flex items-center gap-2">
              <NavBadge badge={item.badge} />
              <CollapsibleTrigger asChild>
                <button
                  className="flex items-center"
                  onClick={(e) => {
                    e.stopPropagation();
                  }}
                >
                  {isOpen ? (
                    <ChevronDown className="h-4 w-4 text-foreground" />
                  ) : (
                    <ChevronRight className="h-4 w-4" />
                  )}
                </button>
              </CollapsibleTrigger>
            </div>
          </div>
          <CollapsibleContent className="space-y-1 pt-1">
            {item.subItems.map((subItem) => {
              const subHref = subItem.href ? processHref(subItem.href) : "#";
              const isSubActive = pathname === subHref || pathname.startsWith(subHref + "/");
              
              return (
                <Link
                  key={subItem.href || subItem.title}
                  href={subHref}
                  className={cn(
                    "flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-all ml-4",
                    isSubActive
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  <span className={cn(
                    isSubActive ? "text-primary-foreground" : "text-muted-foreground"
                  )}>
                    {subItem.icon || <div className="h-4 w-4" />}
                  </span>
                  <span className="flex-1">{subItem.title}</span>
                  <NavBadge badge={subItem.badge} />
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
        "flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-all",
        isActive
          ? "bg-primary text-primary-foreground"
          : "text-muted-foreground hover:text-foreground"
      )}
    >
      <span className={cn(
        isActive ? "text-primary-foreground" : "text-muted-foreground"
      )}>
        {item.icon}
      </span>
      <span className="flex-1">{item.title}</span>
      <NavBadge badge={item.badge} />
    </Link>
  );
}

export function SideNav({ userRole }: SideNavProps) {
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
