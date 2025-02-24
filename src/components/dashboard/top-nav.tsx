import Link from "next/link";
import { UserNav } from "./user-nav";
import { ThemeToggle } from "@/components/theme-toggle";

export function TopNav() {
  return (
    <div className="border-b">
      <div className="flex h-16 items-center px-4">
        <Link href="/dashboard" className="font-semibold">
          HRMS Dashboard
        </Link>
        <div className="ml-auto flex items-center space-x-4">
          <ThemeToggle />
          <UserNav />
        </div>
      </div>
    </div>
  );
} 