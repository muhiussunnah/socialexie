import type { Metadata } from "next";
import { AutomationsWorkbench } from "@/components/automations/automations-workbench";

export const metadata: Metadata = { title: "Automations" };

export default function AutomationsPage() {
  return <AutomationsWorkbench />;
}
