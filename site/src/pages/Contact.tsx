import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { LandingNavigation } from "@/components/navigation/LandingNavigation";
import { LandingFooter } from "@/components/navigation/LandingFooter";
import { Phone, Mail, MapPin, Clock, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { z } from "zod";

// Input validation schema
const contactSchema = z.object({
  name: z.string().trim().min(2, "שם חייב להכיל לפחות 2 תווים").max(100, "שם ארוך מדי"),
  email: z.string().trim().email("כתובת אימייל לא תקינה").max(255, "אימייל ארוך מדי"),
  phone: z.string().trim().regex(/^[\d\s\-\+\(\)]{7,20}$/, "מספר טלפון לא תקין").optional().or(z.literal("")),
  message: z.string().trim().min(10, "הודעה חייבת להכיל לפחות 10 תווים").max(1000, "הודעה ארוכה מדי")
});

const contactDetails = [
  {
    icon: Phone,
    label: "טלפון",
    value: "077-5523053",
    href: "tel:077-5523053"
  },
  {
    icon: Mail,
    label: "אימייל",
    value: "office@yaroknet.co.il",
    href: "mailto:office@yaroknet.co.il"
  },
  {
    icon: MapPin,
    label: "כתובת",
    value: "רחוב ברוך הירש 14, בני ברק",
    href: "https://maps.google.com/?q=ברוך+הירש+14+בני+ברק"
  },
  {
    icon: Clock,
    label: "שעות פעילות",
    value: "א-ה 7:00-17:00 | יום ו 08:00-12:00",
    href: null
  }
];

const Contact = () => {
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
      
      // Send to Make.com webhook
      const webhookResponse = await fetch('https://hook.us2.make.com/bn07g51y98he78lsfthr7fdw4sg8bwfa', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: sanitizedData.name,
          phone: sanitizedData.phone || '',
          email: sanitizedData.email,
          message: sanitizedData.message,
        }),
      });

      if (!webhookResponse.ok) {
        console.error('Webhook failed:', webhookResponse.status);
      }

      // Also save to Supabase
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

      toast.success("תודה על פנייתך! ניצור איתך קשר בהקדם.");
      setFormData({ name: "", phone: "", email: "", message: "" });
    } catch (error) {
      toast.error("אירעה שגיאה בשליחת הפנייה. אנא נסה שוב.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-background" dir="rtl" lang="he">
      <LandingNavigation />

      <main id="main-content">
        {/* Hero Section */}
        <section className="bg-gradient-to-br from-primary via-primary/90 to-primary/80 py-16 md:py-24">
          <div className="container mx-auto px-6 md:px-8 text-center">
            <h1 className="text-3xl md:text-4xl lg:text-5xl font-bold text-white mb-4">
              צור קשר
            </h1>
            <p className="text-lg md:text-xl text-white/90 max-w-2xl mx-auto">
              נשמח לשמוע מכם ולהציע את הפתרון המתאים לצרכים שלכם
            </p>
          </div>
        </section>

        {/* Contact Content */}
        <section className="py-16 md:py-24">
          <div className="container mx-auto px-6 md:px-8">
            <div className="max-w-6xl mx-auto">
              <div className="grid lg:grid-cols-2 gap-12 lg:gap-16">
                
                {/* Contact Details & Map */}
                <div className="space-y-8">
                  <div>
                    <h2 className="text-2xl md:text-3xl font-bold text-foreground mb-6">
                      פרטי התקשרות
                    </h2>
                    <div className="space-y-4">
                      {contactDetails.map((detail, index) => (
                        <Card key={index} className="border-border/50 hover:shadow-md transition-shadow">
                          <CardContent className="p-4">
                            {detail.href ? (
                              <a 
                                href={detail.href}
                                target={detail.href.startsWith('http') ? '_blank' : undefined}
                                rel={detail.href.startsWith('http') ? 'noopener noreferrer' : undefined}
                                className="flex items-center gap-4 group"
                              >
                                <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center shrink-0 group-hover:bg-primary/20 transition-colors">
                                  <detail.icon className="h-5 w-5 text-primary" />
                                </div>
                                <div className="text-right">
                                  <p className="text-sm text-muted-foreground">{detail.label}</p>
                                  <p className="font-semibold text-foreground group-hover:text-primary transition-colors">
                                    {detail.value}
                                  </p>
                                </div>
                              </a>
                            ) : (
                              <div className="flex items-center gap-4">
                                <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                                  <detail.icon className="h-5 w-5 text-primary" />
                                </div>
                                <div className="text-right">
                                  <p className="text-sm text-muted-foreground">{detail.label}</p>
                                  <p className="font-semibold text-foreground">{detail.value}</p>
                                </div>
                              </div>
                            )}
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  </div>

                  {/* Google Map */}
                  <div>
                    <h3 className="text-xl font-bold text-foreground mb-4">המיקום שלנו</h3>
                    <div className="rounded-xl overflow-hidden shadow-lg border border-border/50">
                      <iframe
                        src="https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3380.7!2d34.8356!3d32.0853!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x151d4b9c3de2a99d%3A0x0!2sBaruch%20Hirsch%2014%2C%20Bnei%20Brak%2C%20Israel!5e0!3m2!1sen!2sil!4v1699999999999!5m2!1sen!2sil"
                        width="100%"
                        height="300"
                        style={{ border: 0 }}
                        allowFullScreen
                        loading="lazy"
                        referrerPolicy="no-referrer-when-downgrade"
                        title="מיקום המשרד - ברוך הירש 14, בני ברק"
                        className="w-full"
                      />
                    </div>
                    <p className="text-sm text-muted-foreground mt-3 text-center">
                      רחוב ברוך הירש 14, בני ברק, ישראל
                    </p>
                  </div>
                </div>

                {/* Contact Form */}
                <div>
                  <Card className="border-border/50 shadow-lg">
                    <CardContent className="p-6 md:p-8">
                      <h2 className="text-2xl md:text-3xl font-bold text-foreground mb-6">
                        שלחו לנו הודעה
                      </h2>
                      <form onSubmit={handleSubmit} className="space-y-5">
                        <div className="space-y-2">
                          <Label htmlFor="name">שם מלא *</Label>
                          <Input
                            id="name"
                            placeholder="הזן את שמך"
                            value={formData.name}
                            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                            className={validationErrors.name ? "border-destructive" : ""}
                            required
                          />
                          {validationErrors.name && (
                            <p className="text-sm text-destructive">{validationErrors.name}</p>
                          )}
                        </div>
                        
                        <div className="space-y-2">
                          <Label htmlFor="phone">טלפון</Label>
                          <Input
                            id="phone"
                            type="tel"
                            placeholder="050-000-0000"
                            value={formData.phone}
                            onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                            className={validationErrors.phone ? "border-destructive" : ""}
                          />
                          {validationErrors.phone && (
                            <p className="text-sm text-destructive">{validationErrors.phone}</p>
                          )}
                        </div>
                        
                        <div className="space-y-2">
                          <Label htmlFor="email">אימייל *</Label>
                          <Input
                            id="email"
                            type="email"
                            placeholder="email@example.com"
                            value={formData.email}
                            onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                            className={validationErrors.email ? "border-destructive" : ""}
                            required
                          />
                          {validationErrors.email && (
                            <p className="text-sm text-destructive">{validationErrors.email}</p>
                          )}
                        </div>
                        
                        <div className="space-y-2">
                          <Label htmlFor="message">הודעה *</Label>
                          <Textarea
                            id="message"
                            placeholder="ספר לנו על הצרכים שלך..."
                            value={formData.message}
                            onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                            className={`min-h-[120px] ${validationErrors.message ? "border-destructive" : ""}`}
                            required
                          />
                          {validationErrors.message && (
                            <p className="text-sm text-destructive">{validationErrors.message}</p>
                          )}
                        </div>
                        
                        <Button 
                          type="submit" 
                          size="lg" 
                          className="w-full rounded-lg"
                          disabled={isSubmitting}
                        >
                          {isSubmitting ? (
                            <>
                              <Loader2 className="ml-2 h-5 w-5 animate-spin" />
                              שולח...
                            </>
                          ) : (
                            "שלח פנייה"
                          )}
                        </Button>
                      </form>
                    </CardContent>
                  </Card>
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

export default Contact;
