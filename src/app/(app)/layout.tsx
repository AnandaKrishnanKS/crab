import { requireAuthPage } from "@/lib/auth-guard";
import { AppShell } from "@/components/app-shell";

export const dynamic = "force-dynamic";

export default async function AuthenticatedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await requireAuthPage();

  return <AppShell userEmail={user.email}>{children}</AppShell>;
}

