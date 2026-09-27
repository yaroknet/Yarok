import { ServicePageLayout } from "@/components/layout/ServicePageLayout";
import { CheckCircle2 } from "lucide-react";

const MedicalCleaning = () => {
  return (
    <ServicePageLayout 
      title="ניקיון מרפאות, קליניקות ומרכזים רפואיים – סטנדרט של בריאות"
      ctaText="לניקיון שמשדר בריאות ומקצועיות – צרו קשר: 077-5523053"
    >
      <p className="text-lg text-muted-foreground leading-relaxed mb-8">
        במרפאה, הניקיון הוא הרבה מעבר לאסתטיקה – הוא כרטיס הביקור הראשון של הרופא והבסיס לתחושת הביטחון של המטופל. מטופל שנכנס לחדר המתנה מבריק ולחדר טיפולים מצוחצח, יודע שהוא נמצא בידיים מקצועיות. חברת ירוק מתמחה בניקיון מוסדות רפואיים, מרפאות שיניים, קופות חולים וקליניקות פרטיות, תוך הבנה עמוקה של הרגישות והסטנדרטים הנדרשים במקומות אלו.
      </p>

      <h2 className="text-2xl font-bold text-foreground mb-6">מה מיוחד בניקיון מרפאות?</h2>
      
      <div className="space-y-6 mb-8">
        <div className="bg-secondary/30 p-6 rounded-xl">
          <h3 className="text-xl font-semibold text-foreground mb-3">חיטוי וסטריליזציה</h3>
          <p className="text-muted-foreground">
            אנו לא רק "מנקים לכלוך", אלא משתמשים בחומרי חיטוי ייעודיים להשמדת חיידקים באזורים רגישים: ידיות דלתות, דלפקי קבלה, משענות כיסאות ומתגים.
          </p>
        </div>

        <div className="bg-secondary/30 p-6 rounded-xl">
          <h3 className="text-xl font-semibold text-foreground mb-3">ניקיון שקט ודיסקרטי</h3>
          <p className="text-muted-foreground">
            אנו מבינים את הצורך בשקט ובפרטיות. ניתן לתאם ניקיון בשעות הערב או בוקר מוקדם כדי לא להפריע לטיפולים.
          </p>
        </div>

        <div className="bg-secondary/30 p-6 rounded-xl">
          <h3 className="text-xl font-semibold text-foreground mb-3">חדרי שירותים למופת</h3>
          <p className="text-muted-foreground">
            חדר שירותים במרפאה חייב להיות נקי ברמה של בית מלון, עם הקפדה על חיטוי כלים סניטריים.
          </p>
        </div>
      </div>

      <h2 className="text-2xl font-bold text-foreground mb-6">השירותים שלנו למרפאות</h2>
      <ul className="space-y-3 mb-8">
        {[
          "שטיפה וחיטוי רצפות יסודי",
          "ניגוב אבק ממכשור רפואי בזהירות",
          "ריקון פחים וסילוק אשפה רפואית",
          "ניקיון חלונות ודלתות זכוכית",
          "חיטוי משטחים ונקודות מגע"
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

export default MedicalCleaning;
