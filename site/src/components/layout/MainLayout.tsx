interface MainLayoutProps {
  children: React.ReactNode;
}

// Sidebar removed — fleet module has its own in-page navigation (FleetHub).
export const MainLayout = ({ children }: MainLayoutProps) => {
  return (
    <main className="min-h-screen">
      <div className="p-6 lg:p-8">{children}</div>
    </main>
  );
};
