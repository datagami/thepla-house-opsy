"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard,
  Calendar,
  Clock,
  UserCog,
  Menu,
  Building,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useState } from "react";
import { useSession } from "next-auth/react"

const routes = [
  {
    label: "Dashboard",
    icon: LayoutDashboard,
    href: "/dashboard",
    color: "text-sky-500",
  },
  {
    label: "Attendance",
    icon: Calendar,
    href: "/attendance",
    color: "text-violet-500",
  },
  {
    label: "Leave Requests",
    icon: Clock,
    href: "/leave-requests",
    color: "text-pink-700",
  },
  {
    label: "User Management",
    icon: UserCog,
    href: "/users",
    color: "text-orange-700",
  },
];

export function SideNav() {
  const pathname = usePathname();
  const [isCollapsed, setIsCollapsed] = useState(false);
  const { data: session } = useSession();

  // @ts-expect-error - We check for role
  const role = session?.user.role;

  return (
    <div className={cn(
      "relative h-full border-r pt-16 bg-gray-50/50",
      isCollapsed ? "w-16" : "w-64"
    )}>
      <Button
        variant="ghost"
        className="absolute right-[-20px] top-2"
        onClick={() => setIsCollapsed(!isCollapsed)}
      >
        <Menu className="h-4 w-4" />
      </Button>
      <div className="space-y-4 py-4">
        <div className="px-3 py-2">
          <div className="space-y-1">
            {routes.map((route) => (
              <Link
                key={route.href}
                href={route.href}
                className={cn(
                  "flex items-center gap-x-2 rounded-lg px-3 py-2 text-sm font-medium hover:bg-gray-100",
                  pathname === route.href ? "bg-gray-100" : "text-gray-700",
                  isCollapsed && "justify-center"
                )}
              >
                <route.icon className={cn("h-5 w-5", route.color)} />
                {!isCollapsed && <span>{route.label}</span>}
              </Link>
            ))}
            {role === "MANAGEMENT" && (
              <li>
                <Link
                  href="/branches"
                  className="flex items-center gap-2 rounded-lg px-3 py-2 text-gray-500 transition-all hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-50"
                >
                  <Building className="h-4 w-4" />
                  Branch Management
                </Link>
              </li>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
