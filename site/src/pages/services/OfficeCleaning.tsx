import { ServicePageLayout } from "@/components/layout/ServicePageLayout";
import { CheckCircle2 } from "lucide-react";

const OfficeCleaning = () => {
  return (
    <ServicePageLayout 
      title="שירותי ניקיון משרדים בפריסה ארצית – בוקר וערב"
      ctaText="מעוניינים במשרד נקי ומצוחצח? צרו קשר לקבלת הצעת מחיר: 077-5523053"
    >
      <p className="text-lg text-muted-foreground leading-relaxed mb-8">
        משרד נקי הוא משרד פרודוקטיבי. מחקרים מוכיחים כי סביבת עבודה נקייה ואסתטית משפרת את תפוקת העובדים ומשאירה רושם חיובי ומקצועי על לקוחות המבקרים במקום. בחברת ירוק, אנו מספקים שירותי ניקיון משרדים בהתאמה אישית מלאה לצרכי העסק.
      </p>

      <h2 className="text-2xl font-bold text-foreground mb-6">מסלולי השירות שלנו</h2>
      
      <div className="space-y-6 mb-8">
        <div className="bg-secondary/30 p-6 rounded-xl">
          <h3 className="text-xl font-semibold text-foreground mb-3">ניקיון משרדים בערב</h3>
          <p className="text-muted-foreground">
            היתרון הגדול הוא שהניקיון מתבצע לאחר שעות הפעילות, ללא הפרעה למהלך העבודה התקין. הצוות מגיע, מנקה ביסודיות, ובבוקר המשרד ממתין לכם מבריק ומוכן לעבודה.
          </p>
        </div>

        <div className="bg-secondary/30 p-6 rounded-xl">
          <h3 className="text-xl font-semibold text-foreground mb-3">ניקיון משרדים בבוקר</h3>
          <p className="text-muted-foreground">
            מתאים למשרדים הזקוקים לתחזוקה שוטפת במהלך היום – ניקיון מטבחונים, שירותים וחדרי ישיבות בזמן אמת.
          </p>
        </div>
      </div>

      <h2 className="text-2xl font-bold text-foreground mb-6">מה כולל השירות?</h2>
      <ul className="space-y-3 mb-8">
        {[
          "ריקון פחים ופינוי אשפה",
          "שאיבת שטיחים יסודית",
          "ניגוב אבק מעמדות עבודה",
          "חיטוי מקלדות וטלפונים",
          "ניקיון יסודי של מטבחונים",
          "ניקיון וחיטוי חדרי שירותים",
          "שטיפת רצפות בחומרים איכותיים המותירים ריח רענן"
        ].map((item, index) => (
          <li key={index} className="flex items-start gap-3">
            <CheckCircle2 className="h-5 w-5 text-primary shrink-0 mt-0.5" />
            <span className="text-muted-foreground">{item}</span>
          </li>
        ))}
      </ul>

      <h2 className="text-2xl font-bold text-foreground mb-6">למה לבחור בנו?</h2>
      <p className="text-muted-foreground leading-relaxed">
        אנו מספקים מנהל פרויקט אישי לכל לקוח, פיקוח הדוק על איכות הניקיון, וזמינות מלאה לכל בקשה. הצוותים שלנו מקצועיים, אמינים ומחויבים לסטנדרט הגבוה ביותר.
      </p>
    </ServicePageLayout>
  );
};

export default OfficeCleaning;
