import { Link } from "react-router-dom";
import { LandingNavigation } from "@/components/navigation/LandingNavigation";
import { LandingFooter } from "@/components/navigation/LandingFooter";
import { Button } from "@/components/ui/button";
import { ArrowRight, Calendar, Clock } from "lucide-react";
import articleImage from "@/assets/article-office-cleaning.jpg";

const ArticleOfficeCleaningGuide = () => {
  return (
    <div className="min-h-screen bg-background" dir="rtl" lang="he">
      <LandingNavigation />

      {/* Article Header */}
      <article className="pb-16">
        {/* Featured Image */}
        <div className="w-full max-h-[480px] overflow-hidden">
          <img
            src={articleImage}
            alt="מקצוען ניקיון מפעיל מכונת קרצוף בלובי משרדי מודרני"
            className="w-full h-auto object-cover"
            loading="eager"
          />
        </div>

        {/* Article Content Container */}
        <div className="container mx-auto px-6 md:px-8 max-w-4xl">
          {/* Breadcrumb */}
          <nav className="flex items-center gap-2 text-sm text-muted-foreground mt-8 mb-6">
            <Link to="/" className="hover:text-primary transition-colors">בית</Link>
            <span>/</span>
            <Link to="/articles" className="hover:text-primary transition-colors">מאמרים</Link>
            <span>/</span>
            <span className="text-foreground">בחירת חברת ניקיון למשרד</span>
          </nav>

          {/* Meta */}
          <div className="flex items-center gap-4 text-sm text-muted-foreground mb-4">
            <span className="flex items-center gap-1.5">
              <Calendar className="h-4 w-4" />
              מרץ 2026
            </span>
            <span className="flex items-center gap-1.5">
              <Clock className="h-4 w-4" />
              5 דקות קריאה
            </span>
          </div>

          {/* Headline */}
          <h1 className="text-3xl md:text-4xl lg:text-5xl font-extrabold text-foreground leading-tight mb-6">
            המדריך המלא לבחירת חברת ניקיון למשרד: 5 דברים שאסור להתפשר עליהם
          </h1>

          {/* Excerpt */}
          <p className="text-lg md:text-xl text-muted-foreground leading-relaxed mb-10 border-r-4 border-primary pr-4">
            איך בוחרים חברת ניקיון משרדים מקצועית באמת? אל תתפשרו על איכות, ביטוחים ופיקוח. חברת "ירוק, אחזקה ניקיון וכח אדם בע"מ" מציגה את 5 הנקודות הקריטיות לשקט נפשי ומשרד מבריק.
          </p>

          {/* Main Content */}
          <div className="prose prose-lg max-w-none text-foreground">
            <p className="text-lg leading-relaxed mb-8">
              המשרד שלכם הוא הרבה יותר מחלל עבודה; הוא כרטיס הביקור המרכזי של העסק מול לקוחות, שותפים ועובדים. רמת התחזוקה משדרת באופן לא מודע את רמת הרצינות והיסודיות של הארגון כולו. עם זאת, בחירת השותף הנכון למשימה היא החלטה ניהולית מורכבת.
            </p>

            <p className="text-lg leading-relaxed mb-10">
              חברת <strong>ירוק, אחזקה ניקיון וכח אדם בע"מ</strong> ריכזה עבורכם את חמשת הפרמטרים הקריטיים שיבטיחו לכם שקט תעשייתי ומשרד מבריק לאורך זמן:
            </p>

            {/* Section 1 */}
            <div className="bg-secondary/30 rounded-2xl p-6 md:p-8 mb-6">
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-bold text-xl shrink-0">1</div>
                <div>
                  <h2 className="text-2xl font-bold text-foreground mb-3 mt-0">רישיונות ורגולציה: הביטחון המשפטי שלכם</h2>
                  <p className="text-muted-foreground leading-relaxed mb-4">
                    בענף הניקיון, חברה ללא רישיון בתוקף ממשרד העבודה היא פצצה מתקתקת. כחברה מזמינה, אתם עלולים לשאת באחריות פלילית ואזרחית על העסקת עובדים דרך קבלן לא מורשה.
                  </p>
                  <p className="text-muted-foreground leading-relaxed">
                    ב<strong>ירוק, אחזקה ניקיון וכח אדם בע"מ</strong>, אנו מקפידים על שקיפות מלאה, מחזיקים בכל הרישיונות הנדרשים ומציגים אישורי העסקה כדי שאתם תוכלו לישון בשקט.
                  </p>
                </div>
              </div>
            </div>

            {/* Section 2 */}
            <div className="bg-secondary/30 rounded-2xl p-6 md:p-8 mb-6">
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-bold text-xl shrink-0">2</div>
                <div>
                  <h2 className="text-2xl font-bold text-foreground mb-3 mt-0">מערך פיקוח ובקרה בשטח</h2>
                  <p className="text-muted-foreground leading-relaxed mb-4">
                    הבטחות לחוד ומציאות לחוד. ההבדל בין חברה מקצועית לחובבנית טמון ב"עיניים" שרואות את השטח. האם יש מנהל אזור שבודק את איכות העבודה? האם יש לכם כתובת למענה מיידי? ללא פיקוח הדוק, רמת הניקיון תרד בהדרגה תוך שבועות בודדים.
                  </p>
                  <p className="text-muted-foreground leading-relaxed">
                    ודאו שהחברה מפעילה מערך בקרה הכולל ביקורי פתע ודיווחים שוטפים.
                  </p>
                </div>
              </div>
            </div>

            {/* Section 3 */}
            <div className="bg-secondary/30 rounded-2xl p-6 md:p-8 mb-6">
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-bold text-xl shrink-0">3</div>
                <div>
                  <h2 className="text-2xl font-bold text-foreground mb-3 mt-0">יציבות כוח אדם וזכויות סוציאליות</h2>
                  <p className="text-muted-foreground leading-relaxed">
                    עובד שטוב לו – עובד טוב יותר. חברה ששומרת על זכויות עובדיה (פנסיה, הבראה, תנאים סוציאליים) נהנית מתחלופה נמוכה של כוח אדם. עבורכם זה אומר צוות קבוע שמכיר את המשרד, את הקודים ואת הצרכים המיוחדים שלכם, ללא צורך בהדרכת עובדים חדשים מדי שבוע.
                  </p>
                </div>
              </div>
            </div>

            {/* Section 4 */}
            <div className="bg-secondary/30 rounded-2xl p-6 md:p-8 mb-6">
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-bold text-xl shrink-0">4</div>
                <div>
                  <h2 className="text-2xl font-bold text-foreground mb-3 mt-0">שימוש בטכנולוגיה וחומרים תקניים</h2>
                  <p className="text-muted-foreground leading-relaxed">
                    ניקיון מודרני דורש יותר מסמרטוט ודלי. האם החברה משתמשת בחומרים ידידותיים לסביבה שאינם פוגעים בנשימה של העובדים? האם יש לה מכשור מתקדם לקרצוף רצפות או לניקוי שטיחים? שימוש בחומרים לא תקניים עלול להרוס ציוד משרדי יקר ורצפות רגישות.
                  </p>
                </div>
              </div>
            </div>

            {/* Section 5 */}
            <div className="bg-secondary/30 rounded-2xl p-6 md:p-8 mb-8">
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-bold text-xl shrink-0">5</div>
                <div>
                  <h2 className="text-2xl font-bold text-foreground mb-3 mt-0">זמינות למקרי חירום (SLA)</h2>
                  <p className="text-muted-foreground leading-relaxed">
                    מה קורה כשיש הצפה בקומה ב-7 בבוקר? או כשצריך ניקיון דחוף לפני ישיבת דירקטוריון לא מתוכננת? רמת השירות נמדדת בדיוק ברגעים הללו. בחרו בחברה עם גב חזק ומערך כוח אדם זמין שיודע לתת פתרון ב"זמן אמת".
                  </p>
                </div>
              </div>
            </div>

            {/* CTA Section */}
            <div className="bg-primary/5 border border-primary/20 rounded-2xl p-8 md:p-10 text-center mt-12">
              <h3 className="text-2xl md:text-3xl font-bold text-foreground mb-4">
                רוצים להפוך את המשרד שלכם לסביבת עבודה מושלמת?
              </h3>
              <p className="text-lg text-muted-foreground mb-8 max-w-2xl mx-auto">
                חברת <strong>ירוק, אחזקה ניקיון וכח אדם בע"מ</strong> מעמידה לרשותכם ניסיון מקצועי רב שנים, סטנדרטים בינלאומיים של שירות, ומחויבות מלאה לניקיון ללא פשרות.
              </p>
              <Link to="/contact">
                <Button size="xl" className="text-lg px-10">
                  צרו קשר לייעוץ ראשוני ללא התחייבות
                </Button>
              </Link>
            </div>
          </div>

          {/* Back to articles */}
          <div className="mt-12 pt-8 border-t border-border">
            <Link to="/articles" className="inline-flex items-center gap-2 text-primary font-medium hover:underline">
              <ArrowRight className="h-4 w-4" />
              חזרה לכל המאמרים
            </Link>
          </div>
        </div>
      </article>

      <LandingFooter />
    </div>
  );
};

export default ArticleOfficeCleaningGuide;
