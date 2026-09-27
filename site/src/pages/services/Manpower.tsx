import { ServicePageLayout } from "@/components/layout/ServicePageLayout";
import { CheckCircle2 } from "lucide-react";

const Manpower = () => {
  return (
    <ServicePageLayout 
      title="פתרונות כוח אדם, סבלות ולוגיסטיקה לעסקים"
      ctaText="צריכים ידיים עובדות מהיום למחר? חייגו: 077-5523053"
    >
      <p className="text-lg text-muted-foreground leading-relaxed mb-8">
        פתרונות כוח אדם גמישים ל"פיקים" ועומסים. כשאתם צריכים עובדים – אנחנו כאן.
      </p>

      <h2 className="text-2xl font-bold text-foreground mb-6">השירותים</h2>
      
      <div className="space-y-6 mb-8">
        <div className="bg-secondary/30 p-6 rounded-xl">
          <h3 className="text-xl font-semibold text-foreground mb-3">סבלים ופורקים</h3>
          <p className="text-muted-foreground">
            פריקת מכולות, סידור מחסנים והעברת ציוד.
          </p>
        </div>

        <div className="bg-secondary/30 p-6 rounded-xl">
          <h3 className="text-xl font-semibold text-foreground mb-3">מסחור וסידור סחורה</h3>
          <p className="text-muted-foreground">
            סידור מדפים, תיוג מוצרים וברקודים.
          </p>
        </div>

        <div className="bg-secondary/30 p-6 rounded-xl">
          <h3 className="text-xl font-semibold text-foreground mb-3">עובדי ייצור</h3>
          <p className="text-muted-foreground">
            תגבור לפסי ייצור בתקופות עמוסות.
          </p>
        </div>
      </div>

      <h2 className="text-2xl font-bold text-foreground mb-6">היתרון</h2>
      <p className="text-lg text-muted-foreground leading-relaxed mb-8">
        חוסכים יחסי עובד-מעביד. אתם מקבלים עובד נטו עם חשבונית – בלי כאב ראש בירוקרטי.
      </p>

      <ul className="space-y-3 mb-8">
        {[
          "גמישות מלאה בהיקף השעות",
          "עובדים מאומנים ואמינים",
          "חיסכון בעלויות העסקה",
          "מענה מהיר לצרכים משתנים",
          "ביטוח וזכויות מסודרות"
        ].map((item, index) => (
          <li key={index} className="flex items-start gap-3">
            <CheckCircle2 className="h-5 w-5 text-primary shrink-0 mt-0.5" />
            <span className="text-muted-foreground">{item}</span>
          </li>
        ))}
      </ul>
    </ServicePageLayout>
  );
};

export default Manpower;
