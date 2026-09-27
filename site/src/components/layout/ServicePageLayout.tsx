import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Phone, ChevronLeft, Home } from "lucide-react";
import yarokLogo from "@/assets/yarok-logo.png";
import { LandingNavigation } from "@/components/navigation/LandingNavigation";
import { LandingFooter } from "@/components/navigation/LandingFooter";

interface ServicePageLayoutProps {
  title: string;
  children: React.ReactNode;
  ctaText?: string;
}

export const ServicePageLayout = ({ 
  title, 
  children, 
  ctaText = "לתיאום פגישה או הצעת מחיר – צרו קשר: 077-5523053" 
}: ServicePageLayoutProps) => {
  return (
    <div className="min-h-screen bg-background" dir="rtl" lang="he">
      <LandingNavigation />
      
      {/* Hero Banner */}
      <section className="bg-gradient-to-br from-primary via-primary/90 to-primary/80 py-16 md:py-24">
        <div className="container mx-auto px-6 md:px-8">
          <nav className="flex items-center gap-2 text-white/70 text-sm mb-6">
            <Link to="/" className="hover:text-white transition-colors flex items-center gap-1">
              <Home className="h-4 w-4" />
              בית
            </Link>
            <ChevronLeft className="h-4 w-4" />
            <span className="text-white">{title}</span>
          </nav>
          <h1 className="text-3xl md:text-4xl lg:text-5xl font-bold text-white leading-tight">
            {title}
          </h1>
        </div>
      </section>

      {/* Content */}
      <main className="py-12 md:py-16">
        <div className="container mx-auto px-6 md:px-8">
          <article className="max-w-4xl mx-auto prose prose-lg prose-green">
            {children}
          </article>

          {/* CTA Section */}
          <div className="max-w-4xl mx-auto mt-12 p-8 bg-secondary/50 rounded-2xl text-center">
            <p className="text-lg md:text-xl font-medium text-foreground mb-6">
              {ctaText}
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <a href="tel:077-5523053">
                <Button size="lg" className="rounded-full px-8 py-6 text-lg">
                  <Phone className="ml-2 h-5 w-5" />
                  077-5523053
                </Button>
              </a>
              <Link to="/#contact">
                <Button size="lg" variant="outline" className="rounded-full px-8 py-6 text-lg">
                  השאירו פרטים
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </main>

      <LandingFooter />
    </div>
  );
};
