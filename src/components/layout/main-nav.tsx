"use client";

import { Menu } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetTrigger,
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
        <SheetTrigger asChild>
          <Button variant="ghost" size="icon" className="lg:hidden">
            <Menu className="h-6 w-6" />
            <span className="sr-only">Toggle navigation menu</span>
          </Button>
        </SheetTrigger>
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