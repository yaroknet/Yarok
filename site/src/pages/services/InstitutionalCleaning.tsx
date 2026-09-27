import { ServicePageLayout } from "@/components/layout/ServicePageLayout";
import { CheckCircle2 } from "lucide-react";

const InstitutionalCleaning = () => {
  return (
    <ServicePageLayout 
      title="ניקיון מוסדי, ממשלתי ומבני ציבור – עמידה בתקנים מחמירים"
      ctaText="זקוקים לקבלן ניקיון אמין למכרז? צרו קשר: 077-5523053"
    >
      <p className="text-lg text-muted-foreground leading-relaxed mb-8">
        מוסדות ציבור, משרדי ממשלה ורשויות מקומיות דורשים סטנדרט אחר של ניקיון. לא מדובר רק בניקיון ויזואלי, אלא בעמידה בנהלי בטיחות, עבודה מול מכרזים, והעסקת עובדים בהתאם לחוקי המגן המחמירים ביותר. חברת ירוק מביאה איתה ניסיון עשיר בעבודה מול המגזר הציבורי.
      </p>

      <h2 className="text-2xl font-bold text-foreground mb-6">ההתמחות שלנו</h2>
      
      <div className="space-y-6 mb-8">
        <div className="bg-secondary/30 p-6 rounded-xl">
          <h3 className="text-xl font-semibold text-foreground mb-3">משרדי ממשלה ורשויות</h3>
          <p className="text-muted-foreground">
            מתן שירותי ניקיון למבנים עם קבלת קהל רחבה, תוך שמירה על ייצוגיות ודיסקרטיות.
          </p>
        </div>

        <div className="bg-secondary/30 p-6 rounded-xl">
          <h3 className="text-xl font-semibold text-foreground mb-3">מרכזים קהילתיים</h3>
          <p className="text-muted-foreground">
            הקפדה על היגיינה ברמה סניטרית גבוהה למניעת זיהומים במקומות הומי אדם.
          </p>
        </div>
      </div>

      <h2 className="text-2xl font-bold text-foreground mb-6">למה מוסדות בוחרים בירוק?</h2>
      <ul className="space-y-3 mb-8">
        {[
          "מחזיקים בכל הרישיונות הנדרשים (קבלן שירות/כוח אדם)",
          "עמידה מלאה בתנאי מכרזים",
          "הקפדה על זכויות עובדים וחוקי המגן",
          "מנהל אזור זמין לכל פנייה",
          "ניסיון עשיר בעבודה מול המגזר הציבורי"
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

export default InstitutionalCleaning;
