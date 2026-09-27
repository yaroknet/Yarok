import { ServicePageLayout } from "@/components/layout/ServicePageLayout";
import { CheckCircle2 } from "lucide-react";

const PostConstruction = () => {
  return (
    <ServicePageLayout 
      title="ניקיון אחרי שיפוץ ולפני אכלוס (טופס 4)"
      ctaText="אל תתפשרו על הפיניש. לתיאום ניקיון אחרי שיפוץ: 077-5523053"
    >
      <p className="text-lg text-muted-foreground leading-relaxed mb-8">
        ניקיון אחרי שיפוץ דורש ציוד תעשייתי וידע מקצועי. אי אפשר לנקות אבק בנייה עם מטלית רגילה – צריך מכונות וחומרים מיוחדים.
      </p>

      <h2 className="text-2xl font-bold text-foreground mb-6">האתגרים</h2>
      
      <div className="space-y-6 mb-8">
        <div className="bg-secondary/30 p-6 rounded-xl">
          <h3 className="text-xl font-semibold text-foreground mb-3">הסרת רובה ומלט</h3>
          <p className="text-muted-foreground">
            שימוש במכונות קרצוף וחומרים מפרקי מלט.
          </p>
        </div>

        <div className="bg-secondary/30 p-6 rounded-xl">
          <h3 className="text-xl font-semibold text-foreground mb-3">אבק בנייה</h3>
          <p className="text-muted-foreground">
            שאיבה תעשייתית ממסילות, שקעים ומזגנים.
          </p>
        </div>

        <div className="bg-secondary/30 p-6 rounded-xl">
          <h3 className="text-xl font-semibold text-foreground mb-3">כתמי צבע ודבק</h3>
          <p className="text-muted-foreground">
            הסרה עדינה מחלונות וכלים סניטריים.
          </p>
        </div>
      </div>

      <h2 className="text-2xl font-bold text-foreground mb-6">מה אנו מציעים?</h2>
      <ul className="space-y-3 mb-8">
        {[
          "צוות עם ציוד כבד ומקצועי",
          "הכנת הנכס לכניסה מיידית",
          "ניקיון יסודי של כל החללים",
          "הברקת חלונות וזגוגיות",
          "ניקיון שירותים ומטבחים",
          "שאיבת אבק מכל הפינות"
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

export default PostConstruction;
