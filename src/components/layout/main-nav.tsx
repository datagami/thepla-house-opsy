"use client";

import {
  Sheet,
  SheetContent,
} from "@/components/ui/sheet";
import { SideNav } from "./side-nav";
import { Logo } from "./logo";

interface MainNavProps {
  userRole: string;
}

export function MainNav({ userRole }: MainNavProps) {
  return (
    <div className="flex items-center gap-4">
      <Sheet>
        <SheetContent side="left" className="w-[240px] sm:w-[300px] p-0">
          <aside className="w-full h-full border-r bg-muted/10 p-6">
            <SideNav userRole={userRole} />
          </aside>
        </SheetContent>
      </Sheet>
      <Logo />
    </div>
  );
} 
