import { ServicePageLayout } from "@/components/layout/ServicePageLayout";
import { CheckCircle2 } from "lucide-react";

const CleanroomCleaning = () => {
  return (
    <ServicePageLayout 
      title="ניקיון חדרים נקיים, מעבדות ובתי מרקחת בסטנדרט מחמיר"
      ctaText="לניקיון שעומד בתקנים המחמירים – פנו למומחים: 077-5523053"
    >
      <p className="text-lg text-muted-foreground leading-relaxed mb-8">
        ניקיון בסביבה רפואית או תעשייתית רגישה אינו סובל טעויות. חברת ירוק מתמחה באספקת שירותי ניקיון לחדרים נקיים (Clean Rooms), מפעלים ומעבדות תחת תקני GMP.
      </p>

      <h2 className="text-2xl font-bold text-foreground mb-6">הסטנדרט שלנו</h2>
      
      <div className="space-y-6 mb-8">
        <div className="bg-secondary/30 p-6 rounded-xl">
          <h3 className="text-xl font-semibold text-foreground mb-3">צוות ייעודי</h3>
          <p className="text-muted-foreground">
            עובדים שעברו הכשרה לסביבה סטרילית ומקפידים על נהלי לבוש.
          </p>
        </div>

        <div className="bg-secondary/30 p-6 rounded-xl">
          <h3 className="text-xl font-semibold text-foreground mb-3">חומרים וציוד</h3>
          <p className="text-muted-foreground">
            חומרי חיטוי מאושרים ומטליות ללא סיבים (Lint Free).
          </p>
        </div>

        <div className="bg-secondary/30 p-6 rounded-xl">
          <h3 className="text-xl font-semibold text-foreground mb-3">שיטות עבודה</h3>
          <p className="text-muted-foreground">
            עבודה לפי פרוטוקולים (SOP) ותיעוד מלא.
          </p>
        </div>
      </div>

      <h2 className="text-2xl font-bold text-foreground mb-6">התמחויות</h2>
      <ul className="space-y-3 mb-8">
        {[
          "חדרים נקיים בתעשיית הפארמה",
          "מעבדות מחקר",
          "בתי מרקחת",
          "מפעלי מזון",
          "חברות ביוטכנולוגיה"
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

export default CleanroomCleaning;
