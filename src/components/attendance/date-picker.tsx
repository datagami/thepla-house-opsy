"use client";

import { format } from "date-fns";
import { Calendar as CalendarIcon } from "lucide-react";
import { Calendar as CalendarPicker } from "@/components/ui/calendar";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { useRouter } from "next/navigation";

interface DatePickerProps {
  date: Date;
}

export function DatePicker({ date }: DatePickerProps) {
  const router = useRouter();

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          className={cn(
            "w-[240px] justify-start text-left font-normal",
            !date && "text-muted-foreground"
          )}
        >
          <CalendarIcon className="mr-2 h-4 w-4" />
          {format(date, "PPP")}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="end">
        <CalendarPicker
          mode="single"
          selected={date}
          onSelect={(date) => {
            if (date) {
              router.push(`/hr/attendance?date=${format(date, "yyyy-MM-dd")}`);
            }
          }}
          disabled={(date) => date > new Date()}
          initialFocus
        />
      </PopoverContent>
    </Popover>
  );
} 