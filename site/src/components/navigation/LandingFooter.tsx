import { Link } from "react-router-dom";
import { Phone, Mail, MapPin } from "lucide-react";
import yarokLogo from "@/assets/yarok-logo.png";
import ursIsoLogo from "@/assets/urs-iso-logo-optimized.png";

export const LandingFooter = () => {
  return (
    <footer className="bg-primary text-white py-12 md:py-16">
      <div className="container mx-auto px-6 md:px-8">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8 mb-12">
          {/* Company Info */}
          <div itemScope itemType="https://schema.org/LocalBusiness">
            <div className="flex items-center gap-3 mb-4">
              <img src={yarokLogo} alt="ירוק לוגו" className="h-12 w-auto bg-white rounded-lg p-1" width={48} height={48} loading="lazy" />
              <span className="text-xl font-bold" itemProp="name">ירוק</span>
            </div>
            <p className="text-white/90 mb-4" itemProp="description">
              שירותי אחזקה, ניקיון וכוח אדם בע"מ
            </p>
            <div className="flex items-start gap-2 mb-2" itemProp="address" itemScope itemType="https://schema.org/PostalAddress">
              <MapPin className="h-4 w-4 text-white/90 shrink-0 mt-0.5" />
              <span className="text-white/90 text-sm" itemProp="streetAddress">רחוב ברוך הירש 14, בני ברק</span>
            </div>
            <div className="flex items-center gap-2 mb-2">
              <Phone className="h-4 w-4 text-white/90 shrink-0" />
              <a href="tel:077-5523053" className="text-white/90 text-sm hover:text-white" itemProp="telephone">077-5523053</a>
            </div>
            <div className="flex items-center gap-2">
              <Mail className="h-4 w-4 text-white/90 shrink-0" />
              <a href="mailto:office@yaroknet.co.il" className="text-white/90 text-sm hover:text-white" itemProp="email">office@yaroknet.co.il</a>
            </div>
          </div>

          {/* Services Links */}
          <div>
            <h3 className="font-semibold text-lg mb-4">שירותי ניקיון</h3>
            <ul className="space-y-2">
              <li><Link to="/services/office-cleaning" className="text-white/90 text-sm hover:text-white">ניקיון משרדים</Link></li>
              <li><Link to="/services/medical-cleaning" className="text-white/90 text-sm hover:text-white">ניקיון מרפאות</Link></li>
              <li><Link to="/services/retail-cleaning" className="text-white/90 text-sm hover:text-white">ניקיון חנויות</Link></li>
              <li><Link to="/services/cleanroom-cleaning" className="text-white/90 text-sm hover:text-white">חדרים נקיים</Link></li>
              <li><Link to="/services/institutional-cleaning" className="text-white/90 text-sm hover:text-white">ניקיון מוסדי</Link></li>
            </ul>
          </div>

          {/* More Services */}
          <div>
            <h3 className="font-semibold text-lg mb-4">אחזקה ופרויקטים</h3>
            <ul className="space-y-2">
              <li><Link to="/services/polish-floors" className="text-white/90 text-sm hover:text-white">פוליש רצפות</Link></li>
              <li><Link to="/services/carpet-cleaning" className="text-white/90 text-sm hover:text-white">ניקוי שטיחים</Link></li>
              <li><Link to="/services/post-construction" className="text-white/90 text-sm hover:text-white">ניקיון אחרי שיפוץ</Link></li>
              <li><Link to="/services/windows-height" className="text-white/90 text-sm hover:text-white">ניקיון חלונות בגובה</Link></li>
              <li><Link to="/services/manpower" className="text-white/90 text-sm hover:text-white">כוח אדם</Link></li>
            </ul>
          </div>

          {/* Quick Links */}
          <div>
            <h3 className="font-semibold text-lg mb-4">קישורים מהירים</h3>
            <ul className="space-y-2">
              <li><Link to="/about" className="text-white/90 text-sm hover:text-white">אודות החברה</Link></li>
              <li><Link to="/knowledge" className="text-white/90 text-sm hover:text-white">מרכז ידע</Link></li>
              <li><Link to="/#contact" className="text-white/90 text-sm hover:text-white">צור קשר</Link></li>
              <li><Link to="/accessibility" className="text-white/90 text-sm hover:text-white">הצהרת נגישות</Link></li>
              <li><a href="/employees/" className="text-white/90 text-sm hover:text-white">כניסת עובדים</a></li>
            </ul>
            <div className="mt-4">
              <img src={ursIsoLogo} alt="ISO 9001 Certified" className="h-16 w-auto opacity-90" width={64} height={64} loading="lazy" />
            </div>
          </div>
        </div>

        {/* Bottom Bar */}
        <div className="border-t border-white/20 pt-8 flex flex-col md:flex-row justify-between items-center gap-4">
          <p className="text-white/90 text-sm text-center md:text-right">
            © {new Date().getFullYear()} ירוק שירותי אחזקה ניקיון וכח אדם בע"מ. כל הזכויות שמורות.
          </p>
          <p className="text-white/90 text-xs">
            שירות בפריסה ארצית | זמינות 24/7
          </p>
        </div>
      </div>
    </footer>
  );
};
