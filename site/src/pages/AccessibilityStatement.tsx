import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ArrowRight, Phone, Mail } from "lucide-react";
import yarokLogo from "@/assets/yarok-logo.png";

const AccessibilityStatement = () => {
  return (
    <div className="min-h-screen bg-background" dir="rtl">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-card/95 backdrop-blur-md border-b border-border/50 shadow-sm">
        <div className="container mx-auto px-4 py-3">
          <div className="flex items-center justify-between">
            <Link to="/" className="flex items-center gap-3">
              <img src={yarokLogo} alt="ירוק לוגו" className="h-12 w-auto" />
              <div className="hidden sm:block">
                <span className="text-lg font-bold text-primary leading-tight">ירוק</span>
                <p className="text-xs text-muted-foreground">אחזקה, ניקיון וכוח אדם</p>
              </div>
            </Link>
            <Link to="/">
              <Button variant="outline" className="gap-2">
                <ArrowRight className="h-4 w-4" aria-hidden="true" />
                חזרה לעמוד הבית
              </Button>
            </Link>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main id="main-content" className="container mx-auto px-4 py-12">
        <article className="max-w-3xl mx-auto prose prose-lg">
          <h1 className="text-3xl md:text-4xl font-bold text-foreground mb-8">
            הצהרת נגישות
          </h1>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold text-foreground mb-4">מחויבותנו לנגישות</h2>
            <p className="text-muted-foreground leading-relaxed">
              חברת ירוק אחזקה, ניקיון ושירותי כוח אדם בע"מ מחויבת להנגשת האתר שלה לאנשים עם מוגבלויות. 
              אנו מאמינים שלכל אדם מגיעה גישה שווה למידע ולשירותים המוצעים באתר.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold text-foreground mb-4">תקן הנגישות</h2>
            <p className="text-muted-foreground leading-relaxed">
              האתר תוכנן ונבנה בהתאם לתקן הישראלי 5568 המבוסס על הנחיות WCAG 2.1 ברמה AA. 
              התקן קובע הנחיות ליצירת תוכן נגיש עבור אנשים עם מגוון מוגבלויות, כולל:
            </p>
            <ul className="list-disc list-inside text-muted-foreground mt-4 space-y-2">
              <li>מוגבלויות ראייה</li>
              <li>מוגבלויות שמיעה</li>
              <li>מוגבלויות מוטוריות</li>
              <li>מוגבלויות קוגניטיביות</li>
            </ul>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold text-foreground mb-4">התאמות הנגישות באתר</h2>
            <p className="text-muted-foreground leading-relaxed mb-4">
              האתר כולל את ההתאמות הבאות:
            </p>
            <ul className="list-disc list-inside text-muted-foreground space-y-2">
              <li>תמיכה בניווט מקלדת מלא</li>
              <li>תאימות לקוראי מסך</li>
              <li>טקסטים חלופיים לתמונות</li>
              <li>יחס ניגודיות מתאים בין טקסט לרקע</li>
              <li>אפשרות להגדלת טקסט עד 200%</li>
              <li>כפתור "דלג לתוכן" בתחילת כל דף</li>
              <li>מבנה כותרות היררכי ונכון</li>
              <li>תוויות לשדות טפסים</li>
              <li>הודעות שגיאה ברורות</li>
              <li>תפריט נגישות עם אפשרויות התאמה אישית</li>
            </ul>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold text-foreground mb-4">תפריט הנגישות</h2>
            <p className="text-muted-foreground leading-relaxed">
              בפינה הימנית התחתונה של האתר קיים כפתור נגישות (אייקון של דמות עם זרועות פתוחות). 
              לחיצה על הכפתור תפתח תפריט המאפשר:
            </p>
            <ul className="list-disc list-inside text-muted-foreground mt-4 space-y-2">
              <li>הגדלה והקטנה של גודל הטקסט</li>
              <li>מעבר למצב גווני אפור</li>
              <li>מעבר למצב ניגודיות גבוהה</li>
              <li>הדגשת קישורים</li>
              <li>מעבר לגופן קריא</li>
            </ul>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold text-foreground mb-4">דפדפנים נתמכים</h2>
            <p className="text-muted-foreground leading-relaxed">
              האתר תומך בדפדפנים הנפוצים בגרסאותיהם העדכניות:
            </p>
            <ul className="list-disc list-inside text-muted-foreground mt-4 space-y-2">
              <li>Google Chrome</li>
              <li>Mozilla Firefox</li>
              <li>Microsoft Edge</li>
              <li>Apple Safari</li>
            </ul>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold text-foreground mb-4">יצירת קשר בנושא נגישות</h2>
            <p className="text-muted-foreground leading-relaxed mb-4">
              אם נתקלתם בבעיית נגישות באתר או שיש לכם הצעות לשיפור, נשמח לשמוע מכם:
            </p>
            <div className="bg-card border border-border rounded-lg p-6 space-y-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                  <Phone className="h-5 w-5 text-primary" aria-hidden="true" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">טלפון</p>
                  <a href="tel:077-5523053" className="font-semibold text-foreground hover:text-primary" dir="ltr">
                    077-5523053
                  </a>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                  <Mail className="h-5 w-5 text-primary" aria-hidden="true" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">אימייל</p>
                  <a href="mailto:office@yaroknet.co.il" className="font-semibold text-foreground hover:text-primary">
                    office@yaroknet.co.il
                  </a>
                </div>
              </div>
            </div>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold text-foreground mb-4">תאריך עדכון</h2>
            <p className="text-muted-foreground leading-relaxed">
              הצהרה זו עודכנה לאחרונה בתאריך: {new Date().toLocaleDateString('he-IL')}
            </p>
          </section>
        </article>
      </main>

      {/* Footer */}
      <footer className="bg-foreground text-background py-8">
        <div className="container mx-auto px-4 text-center">
          <p className="text-sm opacity-70">
            © {new Date().getFullYear()} ירוק אחזקה, ניקיון ושירותי כוח אדם בע"מ. כל הזכויות שמורות.
          </p>
        </div>
      </footer>
    </div>
  );
};

export default AccessibilityStatement;
