"use client";

import * as React from "react";
import { ChevronDown, ChevronLeft, ChevronRight, ChevronUp } from "lucide-react";
import { DayPicker, type ChevronProps } from "react-day-picker";

import { cn } from "@/lib/utils";
import { buttonVariants } from "@/components/ui/button";

export type CalendarProps = React.ComponentProps<typeof DayPicker>;

function CalendarChevron({ orientation, className, style, size = 16 }: ChevronProps) {
  const Icon =
    orientation === "left"
      ? ChevronLeft
      : orientation === "up"
        ? ChevronUp
        : orientation === "down"
          ? ChevronDown
          : ChevronRight;
  return <Icon aria-hidden="true" className={cn("h-4 w-4", className)} style={style} size={size} />;
}

function Calendar({ className, classNames, showOutsideDays = true, ...props }: CalendarProps) {
  return (
    <DayPicker
      showOutsideDays={showOutsideDays}
      className={cn("p-3", className)}
      classNames={{
        months: "relative flex w-fit flex-col sm:flex-row space-y-4 sm:space-x-4 sm:space-y-0",
        month: "space-y-4",
        month_caption: "flex h-7 justify-center items-center",
        caption_label: "text-sm font-medium",
        nav: "absolute inset-x-0 top-0 flex justify-between items-center",
        button_previous: cn(
          buttonVariants({ variant: "outline" }),
          "h-7 w-7 bg-transparent p-0 opacity-50 hover:opacity-100"
        ),
        button_next: cn(
          buttonVariants({ variant: "outline" }),
          "h-7 w-7 bg-transparent p-0 opacity-50 hover:opacity-100"
        ),
        month_grid: "w-full border-collapse space-y-1",
        weekdays: "flex",
        weekday: "text-muted-foreground rounded-md w-9 font-normal text-[0.8rem]",
        week: "flex w-full mt-2",
        day: "h-9 w-9 text-center text-sm p-0 relative rounded-md focus-within:relative focus-within:z-20",
        day_button: cn(
          buttonVariants({ variant: "ghost" }),
          "h-9 w-9 p-0 font-normal aria-selected:opacity-100"
        ),
        range_start:
          "rounded-l-md bg-accent [&>button]:bg-primary [&>button]:text-primary-foreground",
        range_end:
          "rounded-r-md bg-accent [&>button]:bg-primary [&>button]:text-primary-foreground",
        selected:
          "[&:not(.day-range-middle)>button]:bg-primary [&:not(.day-range-middle)>button]:text-primary-foreground [&:not(.day-range-middle)>button]:hover:bg-primary",
        today: "bg-accent text-accent-foreground",
        outside: "text-muted-foreground [&[aria-selected]]:bg-accent/50",
        disabled: "text-muted-foreground opacity-50",
        range_middle:
          "day-range-middle rounded-none bg-accent [&>button]:bg-accent [&>button]:text-accent-foreground",
        hidden: "invisible",
        ...classNames,
      }}
      components={{
        Chevron: CalendarChevron,
      }}
      {...props}
    />
  );
}
Calendar.displayName = "Calendar";

export { Calendar };
