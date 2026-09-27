import { ServicePageLayout } from "@/components/layout/ServicePageLayout";
import { CheckCircle2 } from "lucide-react";

const IndustrialCleaning = () => {
  return (
    <ServicePageLayout 
      title="ניקיון תעשייתי – מפעלים, מרלוגים ומשטחי ענק"
      ctaText="לניקיון תעשייתי חסר פשרות: 077-5523053"
    >
      <p className="text-lg text-muted-foreground leading-relaxed mb-8">
        ניקיון האנגר או רצפת ייצור דורש עוצמה. לא מספיקה מגב ודלי – צריך מכונות כבדות וצוותים מיומנים.
      </p>

      <h2 className="text-2xl font-bold text-foreground mb-6">הפתרונות שלנו</h2>
      
      <div className="space-y-6 mb-8">
        <div className="bg-secondary/30 p-6 rounded-xl">
          <h3 className="text-xl font-semibold text-foreground mb-3">מכונות רכובות</h3>
          <p className="text-muted-foreground">
            לשטיפת שטחים עצומים וייבוש מיידי.
          </p>
        </div>

        <div className="bg-secondary/30 p-6 rounded-xl">
          <h3 className="text-xl font-semibold text-foreground mb-3">ניקיון בגובה במחסנים</h3>
          <p className="text-muted-foreground">
            ניקוי קונסטרוקציות ומדפים עליונים.
          </p>
        </div>

        <div className="bg-secondary/30 p-6 rounded-xl">
          <h3 className="text-xl font-semibold text-foreground mb-3">הסרת שומנים</h3>
          <p className="text-muted-foreground">
            שימוש בחומרים תעשייתיים להסרת גריז וסימני מלגזות.
          </p>
        </div>

        <div className="bg-secondary/30 p-6 rounded-xl">
          <h3 className="text-xl font-semibold text-foreground mb-3">בטיחות</h3>
          <p className="text-muted-foreground">
            עבודה עם ציוד מגן אישי מלא.
          </p>
        </div>
      </div>

      <h2 className="text-2xl font-bold text-foreground mb-6">התמחויות</h2>
      <ul className="space-y-3 mb-8">
        {[
          "מפעלי ייצור",
          "מרכזים לוגיסטיים",
          "מחסנים ואנגרים",
          "חניונים תת-קרקעיים",
          "אזורי תעשייה"
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

export default IndustrialCleaning;
