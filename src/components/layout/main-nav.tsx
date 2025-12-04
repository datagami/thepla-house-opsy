"use client";

import {
  Sheet,
  SheetContent,
  SheetTrigger,
} from "@/components/ui/sheet";
import { MobileNav } from "./mobile-nav";
import { Logo } from "./logo";
import { Button } from "@/components/ui/button";
import { Menu } from "lucide-react";

interface MainNavProps {
  userRole: string;
}

export function MainNav({ userRole }: MainNavProps) {
  return (
    <div className="flex items-center gap-4">
      {/* Mobile Menu Button - Only visible on mobile */}
      <Sheet>
        <SheetTrigger asChild>
          <Button variant="ghost" size="icon" className="lg:hidden">
            <Menu className="h-6 w-6" />
            <span className="sr-only">Toggle navigation menu</span>
          </Button>
        </SheetTrigger>
        <SheetContent side="left" className="w-[280px] sm:w-[320px] p-0 z-50">
          <aside className="w-full h-full border-r bg-muted/10 p-6">
            <MobileNav userRole={userRole} />
          </aside>
        </SheetContent>
      </Sheet>
      <Logo />
    </div>
  );
} 
