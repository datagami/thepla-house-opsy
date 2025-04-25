"use client";

import { MainNav } from "./main-nav";
import { UserNav } from "./user-nav";
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
          <UserNav user={user} branchName={branchName} />
        </div>
      </div>
    </div>
  );
} 
