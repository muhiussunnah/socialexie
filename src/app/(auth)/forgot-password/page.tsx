import type { Metadata } from "next";
import { RequestResetForm } from "@/components/auth/request-reset-form";

export const metadata: Metadata = {
  title: "Reset password",
  robots: { index: false, follow: false },
};

export default function ForgotPasswordPage() {
  return <RequestResetForm />;
}
