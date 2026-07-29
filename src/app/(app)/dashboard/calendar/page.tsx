import type { Metadata } from "next";
import { CalendarView } from "@/components/calendar/calendar-view";
import { demoWorkspace } from "@/lib/demo";

export const metadata: Metadata = { title: "Calendar" };

// "Today" has to mean today, so the grid is anchored per request.
export const dynamic = "force-dynamic";

export default function CalendarPage() {
  return (
    <CalendarView
      nowIso={new Date().toISOString()}
      timeZone={demoWorkspace.timezone}
    />
  );
}
