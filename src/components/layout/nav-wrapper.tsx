"use client";

import { MainNav } from "./main-nav";
import { UserNav } from "./user-nav";

interface NavWrapperProps {
  user: {
    role: string;
    name: string | null;
    email: string | null;
    branchName?: string | null;
  };
}

export function NavWrapper({ user }: NavWrapperProps) {
  return (
    <div className="border-b">
      <div className="flex h-16 items-center px-4">
        <MainNav />
        <div className="ml-auto flex items-center space-x-4">
          <UserNav user={user} />
        </div>
      </div>
    </div>
  );
} 