"use client";

import { MainNav } from "./main-nav";
import { UserNav } from "./user-nav";
import { ThemeToggle } from "@/components/theme-toggle";
import {User} from "@/models/models";

interface NavWrapperProps {
  user: User;
  branchName: string;
  userRole: string;
}

export function NavWrapper({ user, branchName, userRole }: NavWrapperProps) {
  return (
    <div className="border-b">
      <div className="flex h-16 items-center px-4">
        <MainNav userRole={userRole} />
        <div className="ml-auto flex items-center space-x-4">
          <ThemeToggle />
          <UserNav user={user} branchName={branchName} />
        </div>
      </div>
    </div>
  );
} 
