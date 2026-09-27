import { ServicePageLayout } from "@/components/layout/ServicePageLayout";
import { CheckCircle2 } from "lucide-react";

const RetailCleaning = () => {
  return (
    <ServicePageLayout 
      title="ניקיון חנויות ורשתות קמעונאות – בהתאמה אישית"
      ctaText="רוצים שהחנות תבריק? בואו נתאים לכם תוכנית ניקיון: 077-5523053"
    >
      <p className="text-lg text-muted-foreground leading-relaxed mb-8">
        בחנות או אולם תצוגה, הניקיון הוא חלק בלתי נפרד מחוויית הקנייה. לקוח שנכנס לחנות מבריקה עם ריח טוב, קונה יותר. אנו בונים "חליפת ניקיון" המותאמת בדיוק לאופי הפעילות שלכם.
      </p>

      <h2 className="text-2xl font-bold text-foreground mb-6">התאמת צרכים אישית</h2>
      
      <div className="space-y-6 mb-8">
        <div className="bg-secondary/30 p-6 rounded-xl">
          <h3 className="text-xl font-semibold text-foreground mb-3">לרשתות אופנה</h3>
          <p className="text-muted-foreground">
            דגש על ניקיון תאי מדידה, מראות נקיות ורצפה מבריקה.
          </p>
        </div>

        <div className="bg-secondary/30 p-6 rounded-xl">
          <h3 className="text-xl font-semibold text-foreground mb-3">לאולמות תצוגה</h3>
          <p className="text-muted-foreground">
            ניקיון ויטרינות ענק ופוליש מיוחד לרצפות יוקרה.
          </p>
        </div>
      </div>

      <h2 className="text-2xl font-bold text-foreground mb-6">מודל הגמישות</h2>
      <ul className="space-y-3 mb-8">
        {[
          "מנקה בבוקר לפני הפתיחה",
          "צוות תגבור לחגים ומבצעים",
          "סבב ניקיון באמצע היום",
          "התאמת שעות ותדירות לצרכים שלכם",
          "שירות מותאם לסניפים מרובים"
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

export default RetailCleaning;
