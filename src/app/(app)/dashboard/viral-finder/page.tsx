import type { Metadata } from "next";
import { ViralFinder } from "@/components/app/viral-finder";

export const metadata: Metadata = { title: "Viral finder" };

export default function ViralFinderPage() {
  return <ViralFinder />;
}
