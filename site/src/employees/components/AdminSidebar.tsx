import { useState, useEffect } from "react";
import { useAuth } from "@/employees/contexts/AuthContext";
import {
  LayoutDashboard,
  ClipboardList,
  Users,
  Building2,
  FileSpreadsheet,
  Settings,
  LogOut,
  MessageSquare,
  CalendarDays,
  Wrench,
  StickyNote,
  FileText,
  LayoutGrid,
} from "lucide-react";
import { NavLink } from "@/employees/components/NavLink";
import { useLocation } from "react-router-dom";
import { supabase } from "@/employees/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { Badge } from "@/employees/components/ui/badge";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarFooter,
  useSidebar,
} from "@/employees/components/ui/sidebar";
import { useIsMobile } from "@/employees/hooks/use-mobile";

const QUOTES_ALLOWED_USER_IDS = [
  "d0175b71-1a13-4a93-93b2-d984738cf346", // אורית
  "78e34772-303e-469e-9771-a38aa93ddc2c", // מאיה
  "5a5d0194-6ce1-448b-a1a7-da4466fcdffc", // עוזי
];

const mainItems = [
  { title: "לוח בקרה", url: "/admin", icon: LayoutDashboard },
  { title: "משימות", url: "/admin/tasks", icon: ClipboardList },
  { title: "ניהול שירות", url: "/admin/services", icon: Wrench },
  { title: "לוח שנה", url: "/admin/calendar", icon: CalendarDays },
  { title: "הצעות מחיר", url: "/admin/quotes", icon: FileText, restrictedToUserIds: QUOTES_ALLOWED_USER_IDS },
  { title: "הודעות", url: "/admin/messages", icon: MessageSquare, badge: true },
  { title: "רשתות", url: "/admin/networks", icon: Building2 },
  { title: "ייבוא/ייצוא", url: "/admin/data", icon: FileSpreadsheet },
  { title: "לוח אישי", url: "/admin/personal-tasks", icon: StickyNote },
  { title: "הגדרות", url: "/admin/settings", icon: Settings },
];

const bottomItems = [
  { title: "ניהול משתמשים", url: "/admin/team", icon: Users },
];

export function AdminSidebar() {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const location = useLocation();
  const { signOut, user } = useAuth();
  

  const { data: unreadCount = 0, refetch } = useQuery({
    queryKey: ["unread-messages-count", user?.id],
    queryFn: async () => {
      if (!user) return 0;
      const { count, error } = await supabase
        .from("internal_messages")
        .select("id", { count: "exact", head: true })
        .eq("recipient_id", user.id)
        .eq("is_read", false)
        .eq("is_archived", false);
      if (error) return 0;
      return count || 0;
    },
    enabled: !!user,
    refetchInterval: 30000,
  });

  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel("sidebar-unread")
      .on("postgres_changes", { event: "*", schema: "public", table: "internal_messages" }, () => {
        refetch();
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user, refetch]);

  return (
    <Sidebar collapsible="icon" side="right">
      <SidebarContent>
        {!collapsed && (
          <div className="p-4 pb-2">
            <div className="flex items-center gap-2">
              <div className="w-9 h-9 rounded-lg bg-sidebar-primary flex items-center justify-center">
                <span className="text-sidebar-primary-foreground font-bold">Y</span>
              </div>
              <div>
                <p className="font-semibold text-sidebar-foreground text-sm">Yarok 360</p>
                <p className="text-xs text-sidebar-foreground/60">ניהול תפעול ושטח</p>
              </div>
            </div>
          </div>
        )}
        <SidebarGroup>
          <SidebarGroupLabel>ניהול</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {mainItems
                .filter((item) => !item.restrictedToUserIds || (user && item.restrictedToUserIds.includes(user.id)))
                .map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton
                    asChild
                    isActive={location.pathname === item.url}
                  >
                    <NavLink to={item.url} end activeClassName="bg-sidebar-accent text-sidebar-accent-foreground">
                      <item.icon className="h-4 w-4" />
                      {!collapsed && <span>{item.title}</span>}
                      {item.badge && unreadCount > 0 && (
                        <Badge variant="destructive" className="mr-auto text-xs px-1.5 py-0 min-w-[20px] text-center">
                          {unreadCount}
                        </Badge>
                      )}
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter>
        <SidebarMenu>
          {bottomItems.map((item) => (
            <SidebarMenuItem key={item.title}>
              <SidebarMenuButton asChild isActive={location.pathname === item.url}>
                <NavLink to={item.url} end activeClassName="bg-sidebar-accent text-sidebar-accent-foreground">
                  <item.icon className="h-4 w-4" />
                  {!collapsed && <span>{item.title}</span>}
                </NavLink>
              </SidebarMenuButton>
            </SidebarMenuItem>
          ))}
          <SidebarMenuItem>
            <SidebarMenuButton asChild>
              <a href="/portal">
                <LayoutGrid className="h-4 w-4" />
                {!collapsed && <span>חזרה לאזור האישי</span>}
              </a>
            </SidebarMenuButton>
          </SidebarMenuItem>
          <SidebarMenuItem>
            <SidebarMenuButton onClick={() => signOut()}>
              <LogOut className="h-4 w-4" />
              {!collapsed && <span>התנתקות</span>}
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
      
    </Sidebar>
  );
}
