import { Sidebar } from "@/components/Sidebar";

/**
 * No auth guard — the hub is open. This layout exists only to put the sidebar
 * beside every page.
 */
export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col md:flex-row">
      <Sidebar />
      <main className="min-w-0 flex-1">{children}</main>
    </div>
  );
}
