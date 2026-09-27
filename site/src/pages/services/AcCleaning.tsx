import { ServicePageLayout } from "@/components/layout/ServicePageLayout";
import { CheckCircle2 } from "lucide-react";

const AcCleaning = () => {
  return (
    <ServicePageLayout 
      title="ניקוי וחיטוי פילטרים למזגנים"
      ctaText="המזגן לא סוחב? הזמינו ניקוי פילטרים: 077-5523053"
    >
      <p className="text-lg text-muted-foreground leading-relaxed mb-8">
        מערכות האוורור הן "הריאות" של הבניין. פילטר סתום פוגע בבריאות וגורם לבזבוז חשמל. ניקוי תקופתי חוסך כסף ומשפר את איכות האוויר.
      </p>

      <h2 className="text-2xl font-bold text-foreground mb-6">השירות שלנו</h2>
      
      <div className="space-y-6 mb-8">
        <div className="bg-secondary/30 p-6 rounded-xl">
          <h3 className="text-xl font-semibold text-foreground mb-3">ניקוי וחיטוי פילטרים</h3>
          <p className="text-muted-foreground">
            שטיפה וחיטוי נגד עובש ("מחלת המזגנים").
          </p>
        </div>
      </div>

      <h2 className="text-2xl font-bold text-foreground mb-6">יתרונות הניקוי</h2>
      <ul className="space-y-3 mb-8">
        {[
          "שיפור איכות האוויר",
          "הפחתת צריכת החשמל",
          "הארכת חיי המזגן",
          "מניעת ריחות רעים",
          "עמידה בתקנות בטיחות"
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

export default AcCleaning;
