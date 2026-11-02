import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { LandingNavigation } from "@/components/navigation/LandingNavigation";
import { LandingFooter } from "@/components/navigation/LandingFooter";
import { 
  Building2, 
  ShieldCheck,
  Phone,
  Mail,
  CheckCircle2,
  Award,
  Globe,
  HeartHandshake,
  Scaling,
  Loader2,
  ArrowDown,
  Clock,
  UserCheck,
  Wrench,
  Truck
} from "lucide-react";
import ursIsoLogo from "@/assets/urs-iso-logo-optimized.png";
import clientsLogos from "@/assets/clients-logos.webp";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useScrollAnimation } from "@/hooks/useScrollAnimation";
import { z } from "zod";

// Input validation schema
const contactSchema = z.object({
  name: z.string().trim().min(2, "שם חייב להכיל לפחות 2 תווים").max(100, "שם ארוך מדי"),
  email: z.string().trim().email("כתובת אימייל לא תקינה").max(255, "אימייל ארוך מדי"),
  phone: z.string().trim().regex(/^[\d\s\-\+\(\)]{7,20}$/, "מספר טלפון לא תקין").optional().or(z.literal("")),
  message: z.string().trim().min(10, "הודעה חייבת להכיל לפחות 10 תווים").max(1000, "הודעה ארוכה מדי")
});

// Main service categories (3 cards for SEO)
const serviceCategories = [
  {
    icon: Building2,
    title: "סביבת עבודה מנצחת וייצוגית",
    description: "אנו הופכים את המשרד או העסק שלכם לכרטיס ביקור מבריק. התמחות בניקיון רשתות קמעונאות, מוסדות, פארמה וחדרים נקיים ועוד בסטנדרט גבוה ביותר. צוותים קבועים, פיקוח צמוד ושירות שנותן לכם שקט נפשי."
  },
  {
    icon: Scaling,
    title: "טכנולוגיות ניקיון מתקדמות ועבודות גובה",
    description: "פתרונות קצה לאתגרים מורכבים: מניקיון חלונות בגובה באוסמוזה הפוכה וסנפלינג, ועד פוליש קריסטל וחידוש נכסים אחרי שיפוץ. אנו מחזירים לנכס את הברק והערך שלו באמצעות ציוד מכני מקצועי וצוותים מוכשרים."
  },
  {
    icon: Truck,
    title: "הזרוע הלוגיסטית הגמישה שלכם",
    description: "מענה מידי לכל צורך תפעולי: מתגבור כוח אדם לפריקת מכולות וסידור סחורה, ועד שירותי מסחור וסידור מדפים. אנו מספקים ידיים עובדות איכותיות בדיוק כשאתם צריכים אותן, ללא כאב ראש בירוקרטי."
  }
];

// Why choose us data
const whyChooseUs = [
  {
    icon: Award,
    title: "ותק וניסיון",
    description: "פעילים ומובילים במשק מאז 2009 עם הלקוחות הגדולים ביותר."
  },
  {
    icon: UserCheck,
    title: "שירות אישי",
    description: "לכל לקוח מוצמד רפרנט אישי ומנהלת קשרי לקוחות."
  },
  {
    icon: Clock,
    title: "זמינות מלאה",
    description: "מערך שירות הפועל 24/7 בפריסה ארצית מלאה."
  },
  {
    icon: Wrench,
    title: "ניהול מקצועי",
    description: "כל פרויקט מלווה במנהלי פרויקטים מנוסים לפיקוח על האיכות."
  }
];

const LandingPage = () => {
  const [formData, setFormData] = useState({
    name: "",
    phone: "",
    email: "",
    message: ""
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setValidationErrors({});
    setIsSubmitting(true);
    
    try {
      // Validate input
      const validationResult = contactSchema.safeParse(formData);
      if (!validationResult.success) {
        const errors: Record<string, string> = {};
        validationResult.error.errors.forEach((err) => {
          if (err.path[0]) {
            errors[err.path[0] as string] = err.message;
          }
        });
        setValidationErrors(errors);
        setIsSubmitting(false);
        return;
      }

      const sanitizedData = validationResult.data;
      
      const { error } = await supabase
        .from('contact_inquiries')
        .insert({
          full_name: sanitizedData.name,
          email: sanitizedData.email,
          phone: sanitizedData.phone || null,
          message: sanitizedData.message,
          status: 'new'
        });

      if (error) throw error;

      // Email the office (the inquiry is already saved, so a failed email is not shown to the visitor)
      const { error: notifyError } = await supabase.functions.invoke('contact-form', {
        body: {
          name: sanitizedData.name,
          phone: sanitizedData.phone || '',
          email: sanitizedData.email,
          message: sanitizedData.message,
        },
      });
      if (notifyError) console.error('Contact notification failed:', notifyError.message);

      toast.success("תודה על פנייתך! ניצור איתך קשר בהקדם.");
      setFormData({ name: "", phone: "", email: "", message: "" });
    } catch (error) {
      toast.error("אירעה שגיאה בשליחת הפנייה. אנא נסה שוב.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const scrollToContact = () => {
    const heading = document.getElementById("contact-heading");
    heading?.scrollIntoView({ behavior: "smooth" });
    // Images above load during the scroll and move the heading, so align again once it settles
    setTimeout(() => heading?.scrollIntoView({ behavior: "smooth" }), 1200);
  };

  // Scroll animations for sections
  const aboutAnimation = useScrollAnimation({ threshold: 0.2 });
  const servicesAnimation = useScrollAnimation({ threshold: 0.1 });
  const clientsAnimation = useScrollAnimation({ threshold: 0.2 });
  const contactAnimation = useScrollAnimation({ threshold: 0.2 });

  return (
    <div className="min-h-screen bg-background" dir="rtl" lang="he">
      {/* Floating WhatsApp Button */}
      <a
        href="https://wa.me/972503771149"
        target="_blank"
        rel="noopener noreferrer"
        className="fixed bottom-6 left-6 z-50 bg-[#25D366] hover:bg-[#20BD5A] text-white p-4 rounded-full shadow-lg transition-all duration-300 hover:scale-110"
        aria-label="צור קשר בוואטסאפ"
      >
        <svg 
          viewBox="0 0 24 24" 
          className="w-7 h-7 fill-current"
          aria-hidden="true"
        >
          <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
        </svg>
      </a>

      <LandingNavigation />

      {/* Main Content Landmark */}
      <main id="main-content">
      {/* Hero Section - Premium Immersive Design */}
      <section className="relative min-h-[100svh] md:min-h-[90vh] flex flex-col overflow-hidden" aria-labelledby="hero-heading">
        {/* Gradient Background */}
        <div className="absolute inset-0 bg-gradient-to-br from-primary via-primary/90 to-primary/80"></div>
        
        {/* Background Image Overlay */}
        <img 
          src="/images/hero-team.webp" 
          alt="" 
          aria-hidden="true"
          fetchPriority="high"
          width={1920}
          height={1080}
          className="absolute inset-0 w-full h-full object-cover opacity-20 mix-blend-overlay"
        />
        
        {/* Decorative Elements - Animated (hidden on mobile for performance) */}
        <div className="hidden md:block absolute top-20 left-10 w-72 h-72 bg-white/5 rounded-full blur-3xl animate-float"></div>
        <div className="hidden md:block absolute bottom-20 right-10 w-96 h-96 bg-white/5 rounded-full blur-3xl animate-float" style={{ animationDelay: '1.5s' }}></div>
        
        {/* Scroll indicator - hidden on mobile */}
        <div className="hidden md:flex absolute bottom-8 left-1/2 -translate-x-1/2 flex-col items-center gap-2 text-white/50 animate-bounce z-10">
          <span className="text-xs">גלול למטה</span>
          <ArrowDown className="h-4 w-4" />
        </div>
        
        {/* Hero Content Container */}
        <div className="container mx-auto px-6 md:px-8 relative z-10 flex-1 flex flex-col justify-center md:justify-between py-8 md:py-16">
          
          {/* Top Right Area - Main Headline & Subtitle */}
          <div className="lg:max-w-3xl lg:mr-0 lg:ml-auto text-center lg:text-right mt-32 sm:mt-8 md:mt-16 px-2 sm:px-0">
            {/* Main Headline */}
            <h1 id="hero-heading" className="text-3xl sm:text-4xl md:text-5xl lg:text-7xl font-extrabold text-white mb-3 md:mb-6 leading-snug sm:leading-tight tracking-tight">
              שירותי ניקיון,<br />
              אחזקה וכח אדם<br />
              בסטנדרטים גבוהים<br />
              ובפריסה ארצית רחבה
            </h1>
            
            {/* Sub-text */}
            <p className="text-sm sm:text-base md:text-2xl lg:text-3xl text-white/90 max-w-md sm:max-w-xl mx-auto lg:mx-0 lg:ml-0 leading-relaxed px-4 sm:px-0">
              פתרונות ניקיון מתקדמים למשרדים, רשתות קמעונאות, מרפאות, מוסדות ועוד מאז 2009.<br className="hidden sm:block" />
              <span className="sm:hidden"> </span>אנו זמינים ללקוחותינו 24/7 לכל מורכבות ולכל צורך.
            </p>
          </div>

          {/* Bottom Center Area - CTAs and Trust Badges */}
          <div className="text-center mt-8 md:mt-0 mb-16 md:mb-20">
            {/* CTA Buttons */}
            <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 justify-center mb-6 md:mb-8">
              <Button 
                size="lg" 
                onClick={scrollToContact} 
                className="btn-shine text-base sm:text-lg px-8 sm:px-10 py-5 sm:py-6 rounded-full bg-white text-primary hover:bg-white/95 shadow-lg shadow-primary/30 ring-1 ring-white/20 transition-all duration-300 hover:scale-105 hover:shadow-xl hover:shadow-primary/40 font-semibold w-full sm:w-auto"
              >
                קבל הצעת מחיר
              </Button>
              <a href="tel:077-5523053" className="w-full sm:w-auto">
                <Button 
                  size="lg" 
                  className="btn-shine text-base sm:text-lg px-8 sm:px-10 py-5 sm:py-6 rounded-full bg-white text-primary hover:bg-white/95 shadow-lg shadow-primary/30 ring-1 ring-white/20 transition-all duration-300 hover:scale-105 hover:shadow-xl hover:shadow-primary/40 font-semibold w-full"
                >
                  <Phone className="ml-2 h-5 w-5" />
                  התקשר עכשיו
                </Button>
              </a>
            </div>

            {/* Trust Badges - Below CTAs */}
            <div className="flex flex-row gap-3 sm:gap-6 justify-center">
              <div className="flex items-center gap-1 sm:gap-3 text-white/90">
                <div className="w-6 h-6 sm:w-10 sm:h-10 rounded-full bg-white/10 flex items-center justify-center shrink-0">
                  <Award className="h-3 w-3 sm:h-5 sm:w-5 text-white" />
                </div>
                <span className="text-[10px] sm:text-sm font-medium whitespace-nowrap">מאז 2009</span>
              </div>
              <div className="flex items-center gap-1 sm:gap-3 text-white/90">
                <div className="w-6 h-6 sm:w-10 sm:h-10 rounded-full bg-white/10 flex items-center justify-center shrink-0">
                  <Globe className="h-3 w-3 sm:h-5 sm:w-5 text-white" />
                </div>
                <span className="text-[10px] sm:text-sm font-medium whitespace-nowrap">פריסה ארצית</span>
              </div>
              <div className="flex items-center gap-1 sm:gap-3 text-white/90">
                <div className="w-6 h-6 sm:w-10 sm:h-10 rounded-full bg-white/10 flex items-center justify-center shrink-0">
                  <ShieldCheck className="h-3 w-3 sm:h-5 sm:w-5 text-white" />
                </div>
                <span className="text-[10px] sm:text-sm font-medium whitespace-nowrap">ISO 9001</span>
              </div>
            </div>
          </div>
        </div>
      </section>
      

      {/* About Section - Premium White Space with Scroll Animation */}
      <section id="about" className="py-16 md:py-24 lg:py-32 bg-secondary/30">
        <div 
          ref={aboutAnimation.ref}
          className={`container mx-auto px-6 sm:px-8 md:px-8 ${aboutAnimation.isVisible ? '' : 'scroll-hidden'}`}
        >
          <div className="max-w-6xl mx-auto">
            <div className="grid md:grid-cols-2 gap-10 md:gap-16 items-center">
              <div className={aboutAnimation.isVisible ? 'animate-slide-in-right' : ''}>
                
                <h2 className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-bold text-foreground mb-6 md:mb-8 tracking-tight">
                  אודות <span className="gradient-text">ירוק</span>
                </h2>
                <p className="text-base sm:text-lg text-muted-foreground mb-6 md:mb-8 leading-relaxed">
                  ירוק אחזקה, ניקיון ושירותי כוח אדם בע"מ היא חברה מובילה בתחומה, המספקת פתרונות מקצועיים לעסקים וארגונים בפריסה ארצית מאז 2009.
                </p>
                <div className="space-y-5 md:space-y-6">
                  <div className={`flex items-start gap-4 ${aboutAnimation.isVisible ? 'animate-fade-up delay-100' : ''}`}>
                    <div className="icon-circle shrink-0">
                      <CheckCircle2 className="h-5 w-5 sm:h-6 sm:w-6 text-primary" />
                    </div>
                    <div>
                      <h3 className="font-bold text-foreground text-base sm:text-lg mb-1">פריסה ארצית</h3>
                      <p className="text-sm sm:text-base text-muted-foreground leading-relaxed">מספקים שירות בכל רחבי הארץ עם צוותים מקומיים מקצועיים</p>
                    </div>
                  </div>
                  <div className={`flex items-start gap-4 ${aboutAnimation.isVisible ? 'animate-fade-up delay-200' : ''}`}>
                    <div className="icon-circle shrink-0">
                      <HeartHandshake className="h-5 w-5 sm:h-6 sm:w-6 text-primary" />
                    </div>
                    <div>
                      <h3 className="font-bold text-foreground text-base sm:text-lg mb-1">תנאים סוציאליים מלאים</h3>
                      <p className="text-sm sm:text-base text-muted-foreground leading-relaxed">אנו מעניקים לעובדינו תנאים סוציאליים מלאים ומקפידים על זכויותיהם</p>
                    </div>
                  </div>
                  <div className={`flex items-start gap-4 ${aboutAnimation.isVisible ? 'animate-fade-up delay-300' : ''}`}>
                    <div className="icon-circle shrink-0">
                      <ShieldCheck className="h-5 w-5 sm:h-6 sm:w-6 text-primary" />
                    </div>
                    <div>
                      <h3 className="font-bold text-foreground text-base sm:text-lg mb-1">ביטוח מקיף</h3>
                      <p className="text-sm sm:text-base text-muted-foreground leading-relaxed">ביטוח מעסיקים וצד שלישי מלא לשקט נפשי מוחלט</p>
                    </div>
                  </div>
                </div>
              </div>
              
              {/* ISO Badge - Premium Card Style */}
              <div className={`flex justify-center mt-8 md:mt-0 ${aboutAnimation.isVisible ? 'animate-slide-in-left delay-200' : 'scroll-hidden'}`}>
                <div className="premium-card glass-hover text-center max-w-sm w-full">
                  <img src={ursIsoLogo} alt="ISO 9001 Certified" className="h-32 sm:h-40 md:h-48 w-auto mx-auto mb-4 md:mb-6 object-contain" width={192} height={192} loading="lazy" />
                  <h3 className="text-xl sm:text-2xl font-bold text-foreground mb-2 md:mb-3 tracking-tight">תקן ISO 9001</h3>
                  <p className="text-sm sm:text-base text-muted-foreground leading-relaxed">
                    אנו מחזיקים בתקן ISO 9001 המעיד על מערכת ניהול איכות מוכחת ומחויבות למצוינות
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Services Section - 3 SEO-Optimized Cards */}
      <section id="services" className="py-16 md:py-24 lg:py-32 bg-white">
        <div 
          ref={servicesAnimation.ref}
          className="container mx-auto px-6 sm:px-8 md:px-8"
        >
          <div className={`text-center mb-10 md:mb-16 ${servicesAnimation.isVisible ? 'animate-fade-up' : 'scroll-hidden'}`}>
            
            <h2 className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-bold text-foreground mb-4 md:mb-6 tracking-tight">
              תחומי ההתמחות שלנו
            </h2>
            <p className="text-base sm:text-lg text-muted-foreground max-w-2xl mx-auto leading-relaxed">
              מגוון רחב של שירותי ניקיון ואחזקה מקצועיים לכל סוגי העסקים והמוסדות
            </p>
          </div>
          
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 md:gap-8 max-w-6xl mx-auto">
            {serviceCategories.map((service, index) => (
              <article 
                key={index} 
                className={`premium-card glass-hover group cursor-pointer ${servicesAnimation.isVisible ? 'animate-fade-in-scale' : 'scroll-hidden'}`}
                style={{ animationDelay: `${index * 150}ms` }}
              >
                <div className="icon-circle mb-4 md:mb-6 group-hover:scale-110 transition-transform duration-300">
                  <service.icon className="h-6 w-6 sm:h-7 sm:w-7 text-primary" />
                </div>
                <h3 className="text-lg sm:text-xl font-bold text-foreground mb-3 md:mb-4 tracking-tight">{service.title}</h3>
                <p className="text-sm sm:text-base text-muted-foreground leading-relaxed">{service.description}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* Why Choose Us Section */}
      <section id="why-us" className="py-16 md:py-24 lg:py-32 bg-primary/5">
        <div className="container mx-auto px-6 sm:px-8 md:px-8">
          <div className={`text-center mb-10 md:mb-16 ${servicesAnimation.isVisible ? 'animate-fade-up' : 'scroll-hidden'}`}>
            <h2 className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-bold text-foreground mb-4 md:mb-6 tracking-tight">
              למה לבחור בחברת ירוק?
            </h2>
            <p className="text-base sm:text-lg text-muted-foreground max-w-2xl mx-auto leading-relaxed">
              היתרונות שהופכים אותנו לשותפים המובילים לעסק שלכם
            </p>
          </div>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 md:gap-8 max-w-6xl mx-auto">
            {whyChooseUs.map((item, index) => (
              <div 
                key={index} 
                className={`premium-card glass-hover text-center ${servicesAnimation.isVisible ? 'animate-fade-in-scale' : 'scroll-hidden'}`}
                style={{ animationDelay: `${index * 100}ms` }}
              >
                <div className="icon-circle mb-4 mx-auto">
                  <item.icon className="h-6 w-6 text-primary" />
                </div>
                <h3 className="text-lg font-bold text-foreground mb-2">{item.title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{item.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Clients Section - Premium Layout with Scroll Animation */}
      <section id="clients" className="py-16 md:py-24 lg:py-32 bg-secondary/30">
        <div 
          ref={clientsAnimation.ref}
          className="container mx-auto px-6 sm:px-8 md:px-8"
        >
          <div className={`text-center mb-10 md:mb-16 ${clientsAnimation.isVisible ? 'animate-fade-up' : 'scroll-hidden'}`}>
            
            <h2 className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-bold text-foreground mb-4 md:mb-6 tracking-tight">
              המותגים המובילים שנותנים בנו אמון
            </h2>
            <p className="text-base sm:text-lg text-muted-foreground max-w-2xl mx-auto leading-relaxed">
              גאים לשרת את המותגים המובילים בישראל
            </p>
          </div>
          
          {/* Client Logos Image - Premium Display */}
          <div className={`max-w-4xl mx-auto premium-card glass-hover p-6 sm:p-8 md:p-12 ${clientsAnimation.isVisible ? 'animate-fade-in-scale delay-200' : 'scroll-hidden'}`}>
            <img 
              src={clientsLogos} 
              alt="לוגואים של לקוחות ירוק - Fox, Mango, Nike, Adidas, H&M, Lacoste, Nespresso ועוד" 
              className="w-full h-auto object-contain"
              width={1245}
              height={879}
              loading="lazy"
              decoding="async"
            />
          </div>
        </div>
      </section>

      {/* Contact Section - Premium Style with Scroll Animation */}
      <section id="contact" className="py-16 md:py-24 lg:py-32 bg-white">
        <div 
          ref={contactAnimation.ref}
          className="container mx-auto px-6 sm:px-8 md:px-8"
        >
          <div className="max-w-5xl mx-auto">
            <div id="contact-heading" className={`scroll-mt-28 text-center mb-10 md:mb-16 ${contactAnimation.isVisible ? 'animate-fade-up' : 'scroll-hidden'}`}>

              <h2 className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-bold text-foreground mb-4 md:mb-6 tracking-tight">
                נשמח לשמוע מכם
              </h2>
              <p className="text-base sm:text-lg text-muted-foreground max-w-2xl mx-auto leading-relaxed">
                נשמח לשמוע מכם ולהציע את הפתרון המתאים לצרכים שלכם
              </p>
            </div>

            <div className="grid md:grid-cols-2 gap-8 md:gap-12">
              {/* Contact Form - Premium Card */}
              <div className={`premium-card glass-hover ${contactAnimation.isVisible ? 'animate-slide-in-right delay-200' : 'scroll-hidden'}`}>
                <form onSubmit={handleSubmit} className="space-y-5 md:space-y-6">
                  <div className="space-y-2">
                    <Label htmlFor="name" className="text-sm font-semibold">שם מלא</Label>
                    <Input
                      id="name"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      placeholder="הזן את שמך"
                      required
                      className={`rounded-xl border-border/50 h-11 md:h-12 ${validationErrors.name ? "border-destructive" : ""}`}
                    />
                    {validationErrors.name && (
                      <p className="text-sm text-destructive">{validationErrors.name}</p>
                    )}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="phone" className="text-sm font-semibold">טלפון</Label>
                    <Input
                      id="phone"
                      type="tel"
                      value={formData.phone}
                      onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                      placeholder="050-000-0000"
                      required
                      className={`rounded-xl border-border/50 h-11 md:h-12 ${validationErrors.phone ? "border-destructive" : ""}`}
                    />
                    {validationErrors.phone && (
                      <p className="text-sm text-destructive">{validationErrors.phone}</p>
                    )}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="email" className="text-sm font-semibold">אימייל</Label>
                    <Input
                      id="email"
                      type="email"
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                      placeholder="email@example.com"
                      required
                      className={`rounded-xl border-border/50 h-11 md:h-12 ${validationErrors.email ? "border-destructive" : ""}`}
                    />
                    {validationErrors.email && (
                      <p className="text-sm text-destructive">{validationErrors.email}</p>
                    )}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="message" className="text-sm font-semibold">הודעה</Label>
                    <Textarea
                      id="message"
                      value={formData.message}
                      onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                      placeholder="ספר לנו על הצרכים שלך..."
                      rows={4}
                      required
                      className={`rounded-xl border-border/50 ${validationErrors.message ? "border-destructive" : ""}`}
                    />
                    {validationErrors.message && (
                      <p className="text-sm text-destructive">{validationErrors.message}</p>
                    )}
                  </div>
                  <Button type="submit" className="w-full rounded-full h-12 md:h-14 text-base font-semibold" size="lg" disabled={isSubmitting}>
                    {isSubmitting ? (
                      <>
                        <Loader2 className="ml-2 h-4 w-4 animate-spin" />
                        שולח...
                      </>
                    ) : (
                      "שלח פנייה"
                    )}
                  </Button>
                </form>
              </div>

              {/* Contact Info - Premium Style */}
              <div className={`space-y-6 md:space-y-8 ${contactAnimation.isVisible ? 'animate-slide-in-left delay-300' : 'scroll-hidden'}`}>
                <div>
                  <h3 className="text-xl sm:text-2xl font-bold text-foreground mb-6 md:mb-8 tracking-tight">פרטי התקשרות</h3>
                  <div className="space-y-4">
                    <a 
                      href="tel:077-5523053" 
                      className="premium-card glass-hover flex items-center gap-4 p-4 sm:p-6"
                    >
                      <div className="icon-circle shrink-0">
                        <Phone className="h-5 w-5 sm:h-6 sm:w-6 text-primary" />
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground mb-1">טלפון</p>
                        <p className="font-bold text-foreground text-base sm:text-lg" dir="ltr">077-5523053</p>
                      </div>
                    </a>
                    <a 
                      href="mailto:office@yaroknet.co.il" 
                      className="premium-card glass-hover flex items-center gap-4 p-4 sm:p-6"
                    >
                      <div className="icon-circle shrink-0">
                        <Mail className="h-5 w-5 sm:h-6 sm:w-6 text-primary" />
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground mb-1">אימייל</p>
                        <p className="font-bold text-foreground text-base sm:text-lg break-all">office@yaroknet.co.il</p>
                      </div>
                    </a>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>
      </main>

      <LandingFooter />
    </div>
  );
};

export default LandingPage;
