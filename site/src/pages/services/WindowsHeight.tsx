import { ServicePageLayout } from "@/components/layout/ServicePageLayout";
import { CheckCircle2 } from "lucide-react";

const WindowsHeight = () => {
  return (
    <ServicePageLayout 
      title="ניקיון חלונות בגובה, ויטרינות ושלטים"
      ctaText="הגיע הזמן לראות שקוף. צרו קשר: 077-5523053"
    >
      <p className="text-lg text-muted-foreground leading-relaxed mb-8">
        אנו מתמחים בניקיון חלונות ראווה ומסך – מויטרינות קטנות ועד קירות זכוכית במגדלי משרדים.
      </p>

      <h2 className="text-2xl font-bold text-foreground mb-6">השיטות שלנו</h2>
      
      <div className="space-y-6 mb-8">
        <div className="bg-secondary/30 p-6 rounded-xl">
          <h3 className="text-xl font-semibold text-foreground mb-3">אוסמוזה הפוכה</h3>
          <p className="text-muted-foreground">
            ניקוי במים טהורים ללא סימנים באמצעות מוטות טלסקופיים (ללא סנפלינג). מתאים לגובה עד 4 קומות.
          </p>
        </div>

        <div className="bg-secondary/30 p-6 rounded-xl">
          <h3 className="text-xl font-semibold text-foreground mb-3">סנפלינג</h3>
          <p className="text-muted-foreground">
            לניקיון מגדלים על ידי גולשים מוסמכים. בטיחות מלאה וציוד מתקדם.
          </p>
        </div>

        <div className="bg-secondary/30 p-6 rounded-xl">
          <h3 className="text-xl font-semibold text-foreground mb-3">במות הרמה</h3>
          <p className="text-muted-foreground">
            לחזיתות ושילוט. פתרון יעיל לגבהים בינוניים.
          </p>
        </div>
      </div>

      <h2 className="text-2xl font-bold text-foreground mb-6">סוגי עבודות</h2>
      <ul className="space-y-3 mb-8">
        {[
          "ניקיון ויטרינות חנויות",
          "ניקיון קירות מסך",
          "ניקיון שלטי חוצות",
          "ניקיון חלונות משרדים",
          "ניקיון מעקות ומרפסות זכוכית"
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

export default WindowsHeight;
