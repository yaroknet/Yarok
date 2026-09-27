import { ServicePageLayout } from "@/components/layout/ServicePageLayout";
import { CheckCircle2, Award, Users, Globe, ShieldCheck } from "lucide-react";

const About = () => {
  return (
    <ServicePageLayout 
      title="אודות חברת ירוק"
      ctaText="רוצים לשמוע עוד? צרו קשר: 077-5523053"
    >
      <p className="text-lg text-muted-foreground leading-relaxed mb-8">
        ירוק אחזקה, ניקיון ושירותי כוח אדם בע"מ היא חברה מובילה בתחומה, המספקת פתרונות מקצועיים לעסקים וארגונים בפריסה ארצית מאז 2009.
      </p>

      <div className="grid md:grid-cols-2 gap-6 mb-12">
        <div className="bg-secondary/30 p-6 rounded-xl flex items-start gap-4">
          <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
            <Award className="h-6 w-6 text-primary" />
          </div>
          <div>
            <h3 className="font-semibold text-foreground mb-2">ותק וניסיון</h3>
            <p className="text-muted-foreground text-sm">פעילים ומובילים במשק מאז 2009 עם הלקוחות הגדולים ביותר.</p>
          </div>
        </div>

        <div className="bg-secondary/30 p-6 rounded-xl flex items-start gap-4">
          <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
            <Globe className="h-6 w-6 text-primary" />
          </div>
          <div>
            <h3 className="font-semibold text-foreground mb-2">פריסה ארצית</h3>
            <p className="text-muted-foreground text-sm">נותנים שירות בכל רחבי הארץ – מקריית שמונה ועד אילת.</p>
          </div>
        </div>

        <div className="bg-secondary/30 p-6 rounded-xl flex items-start gap-4">
          <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
            <Users className="h-6 w-6 text-primary" />
          </div>
          <div>
            <h3 className="font-semibold text-foreground mb-2">תנאים סוציאליים מלאים</h3>
            <p className="text-muted-foreground text-sm">כל עובדינו מועסקים בתנאים מלאים ובהתאם לחוק.</p>
          </div>
        </div>

        <div className="bg-secondary/30 p-6 rounded-xl flex items-start gap-4">
          <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
            <ShieldCheck className="h-6 w-6 text-primary" />
          </div>
          <div>
            <h3 className="font-semibold text-foreground mb-2">ביטוח מקיף</h3>
            <p className="text-muted-foreground text-sm">ביטוחי צד ג' ומעבידים בהיקף של מיליוני שקלים.</p>
          </div>
        </div>
      </div>

      <h2 className="text-2xl font-bold text-foreground mb-6">הערכים שלנו</h2>
      <ul className="space-y-3 mb-8">
        {[
          "מקצועיות ללא פשרות",
          "שקיפות מלאה מול הלקוח",
          "זמינות 24/7",
          "שירות אישי ומותאם",
          "איכות ללא תחרות"
        ].map((item, index) => (
          <li key={index} className="flex items-start gap-3">
            <CheckCircle2 className="h-5 w-5 text-primary shrink-0 mt-0.5" />
            <span className="text-muted-foreground">{item}</span>
          </li>
        ))}
      </ul>

      <h2 className="text-2xl font-bold text-foreground mb-6">הסמכות ותקנים</h2>
      <p className="text-muted-foreground leading-relaxed">
        חברת ירוק מחזיקה בהסמכת ISO 9001 ועומדת בכל התקנים הנדרשים לעבודה מול גופים ציבוריים ופרטיים כאחד. אנו מחויבים לשמירה על רמה גבוהה של איכות ובטיחות בכל פרויקט.
      </p>
    </ServicePageLayout>
  );
};

export default About;
