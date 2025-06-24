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
  Plus,
  DollarSign,
  Menu
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";

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
      title: "Leave Requests", 
      href: "/leave-requests", 
      icon: <CalendarCheck className="h-5 w-5" />,
      feature: "leave.view" 
    },
    {
      title: "Salary",
      href: "/salary",
      icon: <DollarSign className="h-5 w-5" />,
      feature: "salary.edit"
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
    {
      title: "Salary",
      href: "/salary",
      icon: <DollarSign className="h-5 w-5" />,
      feature: "salary.edit"
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

interface SideNavProps {
  userRole: string;
}

export function SideNav({ userRole }: SideNavProps) {
  const pathname = usePathname();
  const navItems = roleNavItems[userRole] || [];
  const [isOpen, setIsOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const { data: session } = useSession();

  // Replace <user_id> with actual user id for all roles
  let processedNavItems = navItems;
  if (
    session &&
    session.user &&
    typeof session.user.id === "string"
  ) {
    const userId = session.user.id;
    processedNavItems = navItems.map((item) =>
      item.href.includes("<user_id>")
        ? { ...item, href: item.href.replace("<user_id>", userId) }
        : item
    );
  }

  // Handle window resize
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 1024); // lg breakpoint
    };
    
    // Check initially
    checkMobile();
    
    // Add resize listener
    window.addEventListener('resize', checkMobile);
    
    // Cleanup
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  const NavLinks = () => (
    <nav className="space-y-2">
      {processedNavItems.map((item) => (
        <Link
          key={item.href}
          href={item.href}
          onClick={() => isMobile && setIsOpen(false)}
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

  return (
    <>
      {/* Mobile Menu Button - Only visible on mobile */}
      <div className="lg:hidden">
        <Sheet open={isOpen} onOpenChange={setIsOpen}>
          <SheetTrigger asChild>
            <Button variant="ghost" size="icon" className="lg:hidden">
              <Menu className="h-6 w-6" />
              <span className="sr-only">Toggle navigation menu</span>
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="w-[240px] sm:w-[300px]">
            <SheetHeader>
              <SheetTitle>Menu</SheetTitle>
            </SheetHeader>
            <div className="mt-4">
              <NavLinks />
            </div>
          </SheetContent>
        </Sheet>
      </div>

      {/* Desktop Sidebar - Only visible on desktop */}
      <aside className="hidden lg:block w-64 border-r bg-muted/10 p-6">
        <NavLinks />
      </aside>
    </>
  );
} 
