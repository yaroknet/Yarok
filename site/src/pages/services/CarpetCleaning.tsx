import { ServicePageLayout } from "@/components/layout/ServicePageLayout";
import { CheckCircle2 } from "lucide-react";

const CarpetCleaning = () => {
  return (
    <ServicePageLayout 
      title="ניקוי שטיחים מקיר לקיר וכסאות משרדיים"
      ctaText="הגיע הזמן לרענן את המשרד. לניקוי שטיחים: 077-5523053"
    >
      <p className="text-lg text-muted-foreground leading-relaxed mb-8">
        שטיחים וכסאות הם "מגנט" לאבק וכתמים. שואב רגיל מנקה רק מלמעלה – אנחנו מנקים לעומק.
      </p>

      <h2 className="text-2xl font-bold text-foreground mb-6">השיטה שלנו (הזרקה-יניקה)</h2>
      <div className="bg-secondary/30 p-6 rounded-xl mb-8">
        <p className="text-muted-foreground">
          המכונה מזריקה חומרי ניקוי לעומק הסיב בלחץ גבוה ומיד שואבת את המים המלוכלכים. התוצאה – שטיח נקי לעומק, יבש תוך שעות ספורות.
        </p>
      </div>

      <h2 className="text-2xl font-bold text-foreground mb-6">למה זה קריטי?</h2>
      
      <div className="space-y-6 mb-8">
        <div className="bg-secondary/30 p-6 rounded-xl">
          <h3 className="text-xl font-semibold text-foreground mb-3">מראה ייצוגי</h3>
          <p className="text-muted-foreground">
            שטיח נקי משדרג את מראה המשרד ומשאיר רושם חיובי.
          </p>
        </div>

        <div className="bg-secondary/30 p-6 rounded-xl">
          <h3 className="text-xl font-semibold text-foreground mb-3">בריאות העובדים</h3>
          <p className="text-muted-foreground">
            חיסול קרדית האבק והאלרגנים לאוויר נקי יותר.
          </p>
        </div>

        <div className="bg-secondary/30 p-6 rounded-xl">
          <h3 className="text-xl font-semibold text-foreground mb-3">חיסכון כספי</h3>
          <p className="text-muted-foreground">
            ניקוי מקצועי מאריך את חיי הריהוט והשטיחים.
          </p>
        </div>
      </div>

      <h2 className="text-2xl font-bold text-foreground mb-6">השירותים שלנו</h2>
      <ul className="space-y-3 mb-8">
        {[
          "ניקוי שטיחים מקיר לקיר",
          "ניקוי כסאות משרדיים",
          "ניקוי ספות וריפודים",
          "הסרת כתמים עקשניים",
          "טיפול במריחות ובעיות ריח"
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

export default CarpetCleaning;
