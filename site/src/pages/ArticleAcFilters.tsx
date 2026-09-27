import { Link } from "react-router-dom";
import { LandingNavigation } from "@/components/navigation/LandingNavigation";
import { LandingFooter } from "@/components/navigation/LandingFooter";
import { Button } from "@/components/ui/button";
import { ArrowRight, Calendar, Clock } from "lucide-react";
import articleImage from "@/assets/article-ac-filters.jpg";

const ArticleAcFilters = () => {
  return (
    <div className="min-h-screen bg-background" dir="rtl" lang="he">
      <LandingNavigation />

      <article className="pb-16">
        <div className="w-full max-h-[480px] overflow-hidden">
          <img
            src={articleImage}
            alt="טכנאי אחזקה מנקה פילטר מזגן בחנות אופנה יוקרתית"
            className="w-full h-auto object-cover"
            loading="eager"
          />
        </div>

        <div className="container mx-auto px-6 md:px-8 max-w-4xl">
          <nav className="flex items-center gap-2 text-sm text-muted-foreground mt-8 mb-6">
            <Link to="/" className="hover:text-primary transition-colors">בית</Link>
            <span>/</span>
            <Link to="/articles" className="hover:text-primary transition-colors">מאמרים</Link>
            <span>/</span>
            <span className="text-foreground">תחזוקת פילטרים ומיזוג אוויר</span>
          </nav>

          <div className="flex items-center gap-4 text-sm text-muted-foreground mb-4">
            <span className="flex items-center gap-1">
              <Calendar className="h-4 w-4" />
              מרץ 2026
            </span>
            <span className="flex items-center gap-1">
              <Clock className="h-4 w-4" />
              5 דקות קריאה
            </span>
          </div>

          <h1 className="text-3xl md:text-4xl lg:text-5xl font-bold text-foreground leading-tight mb-6">
            יותר מקירור: המדריך לתחזוקת פילטרים ומיזוג אוויר ברשתות אופנה
          </h1>

          <p className="text-lg text-muted-foreground leading-relaxed mb-10 border-r-4 border-primary pr-4">
            בחנויות אופנה, המזגן הוא הרבה יותר ממכשיר חשמלי – הוא חלק מחוויית הקנייה. חברת "ירוק, אחזקה ניקיון וכח אדם בע"מ" מסבירה איך ניקוי פילטרים שומר על בריאות העובדים, חוסך בחשמל ומונע ריחות לא נעימים בחנות.
          </p>

          <div className="prose prose-lg max-w-none text-foreground">
            <p>
              עבור חנות אופנה, האווירה היא הכל. לקוח שנכנס לחנות מצפה לחוויה חושית מושלמת: עיצוב מרהיב, תאורה נכונה וטמפרטורה נעימה. אך מאחורי הקלעים, מערכת מיזוג האוויר עובדת שעות ארוכות וסופגת אבק, סיבי בדים מהקולקציות וזיהומים מהחוץ.
            </p>

            <p>
              חברת <strong>ירוק, אחזקה ניקיון וכח אדם בע"מ</strong> ריכזה עבורכם את 4 הסיבות הקריטיות שבגללן אסור לכם להזניח את ניקוי הפילטרים בחנות:
            </p>

            <h2 className="text-2xl font-bold mt-10 mb-4 text-foreground">1. לנשום נקי: בריאות העובדים והלקוחות</h2>
            <p>
              הפילטרים הם הקו הראשון בהגנה על איכות האוויר. כשהם נסתמים, המזגן מתחיל לפזר חלקיקי אבק ובקטריות בחלל החנות. עבור עובדים השוהים בחנות שעות ארוכות, מדובר בסכנה לאלרגיות, כאבי ראש ועייפות כרונית. ניקיון תקופתי מבטיח שהאוויר שהלקוחות והעובדים נושמים יהיה צלול ובריא.
            </p>

            <h2 className="text-2xl font-bold mt-10 mb-4 text-foreground">2. הקשר הישיר לחשבון החשמל שלכם</h2>
            <p>
              בחנויות גדולות, המיזוג הוא אחד מצרכני האנרגיה הגדולים ביותר. פילטרים סתומים מאלצים את המדחס לעבוד במאמץ כפול כדי להזרים אוויר, מה שמוביל לקפיצה משמעותית בצריכת החשמל. תחזוקה מונעת פשוטה יכולה לחסוך לרשת שלכם עשרות אחוזים בהוצאות האנרגיה החודשיות.
            </p>

            <h2 className="text-2xl font-bold mt-10 mb-4 text-foreground">3. מניעת ריחות "טחובים" ושמירה על הבגדים</h2>
            <p>
              סיבי הבדים בחנויות אופנה נוטים להישאב למערכת המיזוג ולהיצמד ללחות שבפילטרים. השילוב הזה יוצר ריח "טחוב" ולא נעים שנספג בבגדים החדשים שעל המדפים. חיטוי וניקוי פילטרים שומרים על ריח רענן בחנות ומונעים נזק לקולקציות היקרות שלכם.
            </p>

            <h2 className="text-2xl font-bold mt-10 mb-4 text-foreground">4. צ'ק ליסט לתחזוקה מונעת: מה עושים ומתי?</h2>
            <p>
              אל תחכו לרגע שבו המזגן יפסיק לקרר בשיא הקיץ. אנו ממליצים על שגרת תחזוקה הכוללת ניקוי פילטרים על ידי צוות הניקיון בשטח.
            </p>

            <hr className="my-10 border-border" />

            <p className="text-lg font-semibold text-foreground">
              רוצים לשדרג את האווירה בחנות שלכם?
            </p>
            <p>
              חברת <strong>ירוק, אחזקה ניקיון וכח אדם בע"מ</strong> מעניקה מעטפת אחזקה מלאה לרשתות אופנה, כדי שאתם תוכלו להתמקד במכירות ואנחנו נדאג לאוויר שלכם.
            </p>

            <hr className="my-10 border-border" />

            <div className="text-center my-10">
              <Link to="/contact">
                <Button size="lg" className="text-lg px-8 py-6 gap-2">
                  צרו קשר לתיאום שירות תחזוקה תקופתי לרשת
                  <ArrowRight className="h-5 w-5" />
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </article>

      <LandingFooter />
    </div>
  );
};

export default ArticleAcFilters;
