import type { Metadata } from "next";
import { UpdatePasswordForm } from "@/components/auth/update-password-form";

export const metadata: Metadata = {
  title: "Set a new password",
  robots: { index: false, follow: false },
};

export default function ResetPasswordPage() {
  return <UpdatePasswordForm />;
}
