import { Link } from "react-router-dom";
import { LandingNavigation } from "@/components/navigation/LandingNavigation";
import { LandingFooter } from "@/components/navigation/LandingFooter";
import { Button } from "@/components/ui/button";
import { ArrowRight, Calendar, Clock } from "lucide-react";
import articleImage from "@/assets/article-height-cleaning.jpg";

const ArticleHeightCleaning = () => {
  return (
    <div className="min-h-screen bg-background" dir="rtl" lang="he">
      <LandingNavigation />

      <article className="pb-16">
        <div className="w-full max-h-[480px] overflow-hidden">
          <img
            src={articleImage}
            alt="ניקוי חלונות בסנפלינג ומדפי תצוגה בחנות יוקרה"
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
            <span className="text-foreground">ניקוי ותחזוקה בגובה</span>
          </nav>

          <div className="flex items-center gap-4 text-sm text-muted-foreground mb-4">
            <span className="flex items-center gap-1">
              <Calendar className="h-4 w-4" />
              מרץ 2026
            </span>
            <span className="flex items-center gap-1">
              <Clock className="h-4 w-4" />
              7 דקות קריאה
            </span>
          </div>

          <h1 className="text-3xl md:text-4xl lg:text-5xl font-bold text-foreground leading-tight mb-6">
            מעבר לקו העין: המדריך המלא לניקוי ותחזוקה בגובה – מחלונות סנפלינג ועד לפינות הנסתרות
          </h1>

          <p className="text-lg text-muted-foreground leading-relaxed mb-10 border-r-4 border-primary pr-4">
            ניקיון בגובה דורש הרבה יותר מסולם. חברת "ירוק, אחזקה ניקיון וכח אדם בע"מ" מסבירה איך לבצע עבודות גובה בבטחות ובמקצועיות, כולל הסרת כורי עכביש, אבק מצטבר, וניקיון ייעודי של תאי מדידה גבוהים.
          </p>

          <div className="prose prose-lg max-w-none text-foreground">
            <p>
              במרחבים מסחריים מודרניים ובחנויות אופנה יוקרתיות, הגובה הוא אלמנט עיצובי מרכזי. תקרות גבוהות, חלונות ראווה רחבי ידיים ומדפי תצוגה המגיעים עד לתקרה יוצרים תחושת מרחב ויוקרה. אך יחד עם היופי, מגיע האתגר התפעולי: איך שומרים על הניקיון בנקודות שקשה להגיע אליהן?
            </p>

            <p>
              חברת <strong>ירוק, אחזקה ניקיון וכח אדם בע"מ</strong> מתמחה בפתרונות גובה מקיפים, המשלבים בטיחות ללא פשרות עם תוצאות מבריקות:
            </p>

            <h2 className="text-2xl font-bold mt-10 mb-4 text-foreground">1. ניקוי חלונות בסנפלינג: הפנים של המבנה</h2>
            <p>
              בנייני משרדים וקניונים עם חיפויי זכוכית (קירות מסך) דורשים תחזוקה שוטפת כדי לשמור על המראה המודרני שלהם. ניקוי בסנפלינג מאפשר הגעה לכל פינה בבניין בצורה יעילה, אך הוא מחייב מומחיות.
            </p>
            <p>
              אצלנו ב<strong>ירוק</strong>, כל עובד גובה מחזיק בתעודות הסמכה בתוקף ועובר הדרכות בטיחות מחמירות. אנו משתמשים בציוד הרמה וחבלים שעוברים בדיקות תקופתיות, כדי להבטיח שחלונות הראווה שלכם יהיו שקופים לחלוטין, ללא סימני מים או אבק.
            </p>

            <h2 className="text-2xl font-bold mt-10 mb-4 text-foreground">2. הסרת אבק וכורי עכביש: המלחמה ב"לכלוך השקוף"</h2>
            <p>
              אחד האתגרים הגדולים בגובה הוא האבק ששוקע על אלמנטים דקורטיביים, גופי תאורה מורכבים ותעלות מיזוג אוויר. הלכלוך הזה אינו נראה ביום-יומי, אך הוא פוגע משמעותית באיכות האוויר בחנות ובנראות הכללית תחת התאורה החזקה.
            </p>
            <p>
              הצוותים שלנו משתמשים במוטות טלסקופיים, סולמות טלסקופיים, שואבי גב ומיכון ייעודי כדי לבצע הסרה יסודית של אבק, וכן <strong>ללכוד ולפנות כורי עכביש</strong> המצטברים בפינות הגבוהות ביותר של התקרה, מבלי לפגוע באלמנטים העיצוביים ומבלי להפריע למהלך העבודה.
            </p>

            <h2 className="text-2xl font-bold mt-10 mb-4 text-foreground">3. ניקוי גובה ייעודי של תאי מדידה</h2>
            <p>
              תאי מדידה בחנויות אופנה הם חללים קטנים וסגורים עם תחלופה גבוהה. בעוד שהניקיון ב"גובה העין" מתוחזק, רבים מזניחים את הניקיון מעל קו הווילון או הדלת. הצטברות אבק על המראות הגבוהות, על גופי התאורה הפנימיים או על הווילונות עצמם פוגעת בתחושת הסטריליות של הלקוח. אנו מבצעים ניקוי יסודי של כל האלמנטים הגבוהים בתא המדידה, כדי להבטיח ללקוח שלכם חוויה מושלמת.
            </p>

            <h2 className="text-2xl font-bold mt-10 mb-4 text-foreground">4. אתגר "המדף העליון" ושלטים</h2>
            <p>
              בחנויות מותג רבות, המדפים העליונים מגיעים עד לתקרה. אנו מספקים מענה מקצועי לניקוי יסודי של המדפים הללו ושל שלטי הלוגו הפנימיים, מבלי להזיז את הסחורה ומבלי לסכן את העובדים או הלקוחות. אנו מנקים שלטים ומצגי גובה בשיטות עדינות המבטיחות שלא ייגרם נזק למערכות החשמל או למשטחים הרגישים.
            </p>

            <h2 className="text-2xl font-bold mt-10 mb-4 text-foreground">5. בטיחות מעל הכל: אחריות המעסיק והלקוח</h2>
            <p>
              עבודה בגובה היא תחום רגיש מבחינה משפטית. כחברה מזמינה, עליכם לוודא שהקבלן מבצע "סקר סיכונים" לפני תחילת העבודה.
            </p>
            <p>
              ב<strong>ירוק, אחזקה ניקיון וכח אדם בע"מ</strong>, אנו מגדרים את אזור העבודה, מציבים משגיח בטיחות בקרקע ודואגים לביטוח חבות מעבידים וצד ג' מורחב הכולל סעיף עבודה בגובה. כך אתם נהנים ממשרד או חנות מבריקים, עם שקט נפשי מלא.
            </p>

            <hr className="my-10 border-border" />

            <p className="text-lg font-semibold text-foreground">
              אל תתנו לאבק להצטבר איפה שהעין לא מגיעה.
            </p>
            <p>
              חברת <strong>ירוק, אחזקה ניקיון וכח אדם בע"מ</strong> כאן כדי להגיע לכל פינה – גבוהה ככל שתהיה, בתוך החנות ומחוצה לה. צרו איתנו קשר לתיאום עבודת גובה מקצועית, בטוחה ומקיפה.
            </p>

            <hr className="my-10 border-border" />

            <div className="text-center my-10">
              <Link to="/contact">
                <Button size="lg" className="text-lg px-8 py-6 gap-2">
                  הזמינו עכשיו ניקוי חלונות וגובה מקצועי
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

export default ArticleHeightCleaning;
