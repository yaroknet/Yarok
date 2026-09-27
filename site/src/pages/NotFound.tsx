import { useLocation, Link } from "react-router-dom";
import { useEffect, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Home, ArrowRight, Search } from "lucide-react";
import { LandingNavigation } from "@/components/navigation/LandingNavigation";
import { LandingFooter } from "@/components/navigation/LandingFooter";

const NotFound = () => {
  const location = useLocation();
  
  // Check if this is a legacy .asp page request
  const isLegacyAspPage = useMemo(() => {
    return location.pathname.toLowerCase().endsWith('.asp');
  }, [location.pathname]);

  useEffect(() => {
    // Log 404 for monitoring
    console.error("404 Error: User attempted to access non-existent route:", location.pathname);
  }, [location.pathname]);

  return (
    <div className="min-h-screen bg-background flex flex-col" dir="rtl" lang="he">
      <LandingNavigation />
      
      <main id="main-content" className="flex-1 flex items-center justify-center py-16 px-6">
        <div className="text-center max-w-lg">
          {/* 404 Visual */}
          <div className="mb-8">
            <span className="text-8xl md:text-9xl font-bold text-primary/20">404</span>
          </div>
          
          {/* Message */}
          <h1 className="text-2xl md:text-3xl font-bold text-foreground mb-4">
            {isLegacyAspPage ? "הדף עבר לכתובת חדשה" : "הדף לא נמצא"}
          </h1>
          
          <p className="text-muted-foreground mb-8 leading-relaxed">
            {isLegacyAspPage ? (
              <>
                האתר שלנו עבר שדרוג מקיף והדף שחיפשת כבר לא קיים בכתובת זו.
                <br />
                <span className="text-sm opacity-75">({location.pathname})</span>
              </>
            ) : (
              "הדף שחיפשת לא נמצא. ייתכן שהכתובת שגויה או שהדף הוסר."
            )}
          </p>
          
          {/* Action Buttons */}
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link to="/">
              <Button size="lg" className="gap-2 w-full sm:w-auto">
                <Home className="h-5 w-5" />
                חזרה לדף הבית
              </Button>
            </Link>
            <Link to="/contact">
              <Button size="lg" variant="outline" className="gap-2 w-full sm:w-auto">
                <Search className="h-5 w-5" />
                צור קשר
              </Button>
            </Link>
          </div>
          
          {/* Quick Links for Legacy Users */}
          {isLegacyAspPage && (
            <div className="mt-12 pt-8 border-t border-border">
              <p className="text-sm text-muted-foreground mb-4">אולי התכוונת לאחד מהדפים הבאים:</p>
              <div className="flex flex-wrap gap-2 justify-center">
                <Link to="/services/office-cleaning" className="text-sm text-primary hover:underline">ניקיון משרדים</Link>
                <span className="text-muted-foreground">•</span>
                <Link to="/services/retail-cleaning" className="text-sm text-primary hover:underline">ניקיון חנויות</Link>
                <span className="text-muted-foreground">•</span>
                <Link to="/services/manpower" className="text-sm text-primary hover:underline">כוח אדם</Link>
                <span className="text-muted-foreground">•</span>
                <Link to="/about" className="text-sm text-primary hover:underline">אודות</Link>
              </div>
            </div>
          )}
        </div>
      </main>
      
      <LandingFooter />
    </div>
  );
};

export default NotFound;
