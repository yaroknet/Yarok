import { Link } from "react-router-dom";
import { LandingNavigation } from "@/components/navigation/LandingNavigation";
import { LandingFooter } from "@/components/navigation/LandingFooter";
import { Button } from "@/components/ui/button";
import { ArrowRight, Calendar, Clock } from "lucide-react";
import articleImage from "@/assets/article-employer-responsibility.jpg";

const ArticleEmployerResponsibility = () => {
  return (
    <div className="min-h-screen bg-background" dir="rtl" lang="he">
      <LandingNavigation />

      <article className="pb-16">
        <div className="w-full max-h-[480px] overflow-hidden">
          <img
            src={articleImage}
            alt="חוזה עסקי על שולחן עם משקפיים ועט ירוק, ברקע עובדי ירוק במדים"
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
            <span className="text-foreground">אחריות מעסיק וזכויות עובדים</span>
          </nav>

          <div className="flex items-center gap-4 text-sm text-muted-foreground mb-4">
            <span className="flex items-center gap-1.5">
              <Calendar className="h-4 w-4" />
              מרץ 2026
            </span>
            <span className="flex items-center gap-1.5">
              <Clock className="h-4 w-4" />
              6 דקות קריאה
            </span>
          </div>

          <h1 className="text-3xl md:text-4xl lg:text-5xl font-extrabold text-foreground leading-tight mb-6">
            אחריות מעסיק ושמירה על זכויות עובדים בענף הניקיון: מה אתם חייבים לדעת כחברה מזמינה?
          </h1>

          <p className="text-lg md:text-xl text-muted-foreground leading-relaxed mb-10 border-r-4 border-primary pr-4">
            בעולם הניקיון והתחזוקה, האחריות על זכויות העובדים אינה עוצרת אצל הקבלן. חברת "ירוק, אחזקה ניקיון וכח אדם בע"מ" מסבירה את חשיבות הציות לחוק ואיך אתם, כחברה מזמינה, יכולים להגן על עצמכם ועל העובדים.
          </p>

          <div className="prose prose-lg max-w-none text-foreground">
            <p className="text-lg leading-relaxed mb-8">
              ענף הניקיון והאחזקה בישראל מוסדר תחת חקיקה קפדנית וצווי הרחבה ייעודיים, שמטרתם להבטיח את זכויותיהם הסוציאליות של העובדים. עבור חברות וארגונים המזמינים שירותי ניקיון, הכרת החוקים הללו אינה רק עניין של אתיקה, אלא הכרח משפטי וכלכלי ראשון במעלה.
            </p>

            <p className="text-lg leading-relaxed mb-10">
              חברת <strong>ירוק, אחזקה ניקיון וכח אדם בע"מ</strong> מדגישה את הנקודות הקריטיות שכל מנהל רכש או בעל עסק חייב להכיר בנושא אחריות המעסיק:
            </p>

            {/* Section 1 */}
            <div className="bg-secondary/30 rounded-2xl p-6 md:p-8 mb-6">
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-bold text-xl shrink-0">1</div>
                <div>
                  <h2 className="text-2xl font-bold text-foreground mb-3 mt-0">"אחריות משולחת": האחריות המשפטית שלכם כחברה מזמינה</h2>
                  <p className="text-muted-foreground leading-relaxed">
                    רבים טועים לחשוב שאם הם שוכרים שירותי קבלן חיצוני, הם פטורים מכל אחריות כלפי העובד. החוק בישראל קובע אחרת באמצעות מושג ה"אחריות המשולחת". המשמעות היא שבמקרים מסוימים, אם קבלן הניקיון אינו עומד בחובותיו כלפי העובד (כמו תשלום שכר מינימום, פנסיה או הבראה), העובד רשאי לתבוע את זכויותיו ישירות מהחברה המזמינה את השירות.
                  </p>
                </div>
              </div>
            </div>

            {/* Section 2 */}
            <div className="bg-secondary/30 rounded-2xl p-6 md:p-8 mb-6">
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-bold text-xl shrink-0">2</div>
                <div>
                  <h2 className="text-2xl font-bold text-foreground mb-3 mt-0">חובת הפיקוח על תלושי השכר והפרשות סוציאליות</h2>
                  <p className="text-muted-foreground leading-relaxed mb-4">
                    כדי להימנע מתביעות ומסיכונים משפטיים, על החברה המזמינה חלה חובה (מוסרית ומשפטית) לוודא שהקבלן פועל כחוק. זה כולל דרישה לקבלת אישורים תקופתיים מרואה חשבון או בודק שכר מוסמך, המאשרים כי כל הזכויות הסוציאליות שולמו לעובדים המועסקים באתר שלכם.
                  </p>
                  <p className="text-muted-foreground leading-relaxed">
                    ב<strong>ירוק, אחזקה ניקיון וכח אדם בע"מ</strong>, אנו מקפידים על שקיפות מלאה ומספקים ללקוחותינו את כל האישורים הנדרשים המוכיחים עמידה מלאה בדרישות החוק.
                  </p>
                </div>
              </div>
            </div>

            {/* Section 3 */}
            <div className="bg-secondary/30 rounded-2xl p-6 md:p-8 mb-6">
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-bold text-xl shrink-0">3</div>
                <div>
                  <h2 className="text-2xl font-bold text-foreground mb-3 mt-0">היזהרו מ"מחיר הפסד" (Contract at a Loss)</h2>
                  <p className="text-muted-foreground leading-relaxed">
                    אחת הנורות האדומות הבוהקות ביותר היא הצעת מחיר נמוכה באופן מחשיד. אם המחיר השעתי שהקבלן מציע לכם נמוך מעלות השכר המינימלית בתוספת ההפרשות הסוציאליות המחויבות בחוק (כולל רווח קבלני מינימלי), מדובר ב"חוזה הפסד". חוזה כזה הוא לא חוקי, והוא חושף אתכם ישירות לתביעות עתידיות מצד העובדים או הרשויות.
                  </p>
                </div>
              </div>
            </div>

            {/* Section 4 */}
            <div className="bg-secondary/30 rounded-2xl p-6 md:p-8 mb-8">
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-bold text-xl shrink-0">4</div>
                <div>
                  <h2 className="text-2xl font-bold text-foreground mb-3 mt-0">שמירה על כבוד העובד ותנאי עבודה נאותים</h2>
                  <p className="text-muted-foreground leading-relaxed">
                    מעבר להיבט הכספי, חשוב לוודא שהעובדים מקבלים סביבת עבודה בטוחה ומכבדת. זה כולל אספקת ציוד מגן אישי (PPE), הדרכות בטיחות שוטפות, וגישה לתנאים בסיסיים כמו פינת מנוחה ומים לשתייה. עובד שמרגיש שזכויותיו נשמרות ושכבודו נשמר, הוא עובד נאמן יותר שיעניק לכם שירות איכותי בהרבה.
                  </p>
                </div>
              </div>
            </div>

            {/* CTA Section */}
            <div className="bg-primary/5 border border-primary/20 rounded-2xl p-8 md:p-10 text-center mt-12">
              <h3 className="text-2xl md:text-3xl font-bold text-foreground mb-4">
                אל תקחו סיכונים מיותרים. בחרו בשותף מקצועי ששומר על החוק ועל העובדים.
              </h3>
              <p className="text-lg text-muted-foreground mb-8 max-w-2xl mx-auto">
                חברת <strong>ירוק, אחזקה ניקיון וכח אדם בע"מ</strong> חרטה על דגלה הגינות, שקיפות ושמירה קפדנית על זכויות עובדיה. אנחנו כאן כדי להעניק לכם שקט נפשי וביטחון משפטי מלא.
              </p>
              <Link to="/contact">
                <Button size="xl" className="text-lg px-10">
                  צרו קשר למידע נוסף על פתרונות הניקיון והאחזקה שלנו
                </Button>
              </Link>
            </div>
          </div>

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

export default ArticleEmployerResponsibility;
