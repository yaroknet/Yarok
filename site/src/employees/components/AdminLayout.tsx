import { SidebarProvider, SidebarTrigger } from "@/employees/components/ui/sidebar";
import { AdminSidebar } from "./AdminSidebar";
import yarokLogo from "@/employees/assets/yarok-logo.png";

interface AdminLayoutProps {
  children: React.ReactNode;
}

export function AdminLayout({ children }: AdminLayoutProps) {
  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full" dir="rtl">
        <AdminSidebar />
        <div className="flex-1 flex flex-col">
          <header className="h-14 flex items-center border-b bg-card px-4 gap-3">
            <SidebarTrigger />
            <div className="flex items-center gap-2">
              <img src={yarokLogo} alt="Yarok 360" className="h-8 w-auto" />
              <span className="font-semibold text-foreground">Yarok 360</span>
            </div>
          </header>
          <main className="flex-1 p-6 overflow-auto">{children}</main>
        </div>
      </div>
    </SidebarProvider>
  );
}
