"use client";

import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { format, isToday } from "date-fns";
import { CalendarIcon, ChevronLeft, ChevronRight } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";

interface DateSwitcherProps {
  currentDate: Date;
}

export function DateSwitcher({ currentDate }: DateSwitcherProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  console.log(currentDate);

  const handleDateChange = (date: Date | undefined) => {
    console.log("handleDateChange", date);
    if (!date) return;

    const params = new URLSearchParams(searchParams);
    console.log(params);
    if (isToday(date)) {
      params.delete('date');
    } else {
      console.log("setting date", `${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()}`);
      params.set('date', `${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()}`);
    }
    router.push(`/attendance?${params.toString()}`);
  };

  const handlePrevDay = () => {
    console.log("prev day");
    console.log(currentDate);
    const prevDay = new Date(currentDate);
    prevDay.setDate(currentDate.getDate() - 1);
    handleDateChange(prevDay);
  };

  const handleNextDay = () => {
    console.log("next day");
    console.log(currentDate);
    const nextDay = new Date(currentDate);
    nextDay.setDate(nextDay.getDate() + 1);
    handleDateChange(nextDay);
  };

  return (
    <div className="flex items-center gap-2">
      <Button
        variant="outline"
        size="icon"
        onClick={handlePrevDay}
      >
        <ChevronLeft className="h-4 w-4" />
      </Button>
      
      <Popover>
        <PopoverTrigger asChild>
          <Button
            variant={"outline"}
            className={cn(
              "w-[240px] justify-start text-left font-normal",
              !currentDate && "text-muted-foreground"
            )}
          >
            <CalendarIcon className="mr-2 h-4 w-4" />
            {format(currentDate, "PPP")}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <Calendar
            mode="single"
            selected={currentDate}
            onSelect={handleDateChange}
            initialFocus
          />
        </PopoverContent>
      </Popover>

      <Button
        variant="outline"
        size="icon"
        onClick={handleNextDay}
        disabled={isToday(currentDate)}
      >
        <ChevronRight className="h-4 w-4" />
      </Button>
    </div>
  );
} 