import { Sidebar } from "@/components/ui/Sidebar";
import { Header } from "@/components/ui/Header";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar />
      <div className="flex flex-col flex-1 ml-64">
        <Header />
        <main className="flex-1 p-6">{children}</main>
      </div>
    </div>
  );
}
