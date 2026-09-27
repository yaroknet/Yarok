import { ServicePageLayout } from "@/components/layout/ServicePageLayout";
import { CheckCircle2 } from "lucide-react";

const PolishFloors = () => {
  return (
    <ServicePageLayout 
      title="שירותי פוליש וחידוש רצפות – הברקה קריסטלית וטיפול באבן"
      ctaText="רוצים רצפה חדשה? הזמינו פוליש מקצועי: 077-5523053"
    >
      <p className="text-lg text-muted-foreground leading-relaxed mb-8">
        הרצפה היא המשטח הגדול ביותר בעסק. עם השנים, המרצפות נשחקות ומאבדות ברק. שירותי הפוליש שלנו מחזירים לרצפה את היופי והברק המקוריים.
      </p>

      <h2 className="text-2xl font-bold text-foreground mb-6">סוגי הפוליש</h2>
      
      <div className="space-y-6 mb-8">
        <div className="bg-secondary/30 p-6 rounded-xl">
          <h3 className="text-xl font-semibold text-foreground mb-3">פוליש קריסטל</h3>
          <p className="text-muted-foreground">
            החדרת מגנזיום למראה רטוב ויוקרתי. עמיד ואינו מחליק.
          </p>
        </div>

        <div className="bg-secondary/30 p-6 rounded-xl">
          <h3 className="text-xl font-semibold text-foreground mb-3">פוליש ווקס</h3>
          <p className="text-muted-foreground">
            ניקוי עמוק ומריחת שכבת מגן מבריקה.
          </p>
        </div>

        <div className="bg-secondary/30 p-6 rounded-xl">
          <h3 className="text-xl font-semibold text-foreground mb-3">סילר</h3>
          <p className="text-muted-foreground">
            איטום לרצפות בטון ואבן טבעית למניעת ספיגת כתמים.
          </p>
        </div>
      </div>

      <h2 className="text-2xl font-bold text-foreground mb-6">תהליך העבודה</h2>
      <ul className="space-y-3 mb-8">
        {[
          "שימוש במכונות מתקדמות",
          "קרצוף השכבה המלוכלכת",
          "החלקה ויישור פני השטח",
          "הברקה עד לתוצאה מושלמת",
          "מתן אחריות על העבודה"
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

export default PolishFloors;
