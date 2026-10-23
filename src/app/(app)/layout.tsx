import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { Sidebar } from "@/components/Sidebar";

/**
 * The guard for everything signed-in. Doing it here rather than in middleware
 * keeps the MongoDB adapter off the edge runtime, where it can't run.
 */
export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session?.user) redirect("/login");

  return (
    <div className="flex min-h-dvh flex-col md:flex-row">
      <Sidebar user={session.user} />
      <main className="min-w-0 flex-1">{children}</main>
    </div>
  );
}
