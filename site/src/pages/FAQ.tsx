import { Link } from "react-router-dom";
import { LandingNavigation } from "@/components/navigation/LandingNavigation";
import { LandingFooter } from "@/components/navigation/LandingFooter";
import { Button } from "@/components/ui/button";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Home, ChevronLeft, MessageCircle } from "lucide-react";
import faqHero from "@/assets/faq-hero.jpg";

const faqItems = [
  {
    question: "האם חברת 'ירוק' מחזיקה ברישיונות להעסקת עובדי ניקיון וכוח אדם?",
    answer:
      'בהחלט. חברת ירוק, אחזקה ניקיון וכח אדם בע"מ מחזיקה ברישיון בתוקף מטעם משרד הכלכלה. אנו מקפידים על שקיפות מלאה ומספקים ללקוחותינו את כל האישורים הנדרשים.',
  },
  {
    question: "האם אתם מספקים שירות בפריסה ארצית לרשתות אופנה?",
    answer:
      "כן. אנו מתמחים במתן פתרונות ניקיון ותחזוקה לרשתות קמעונאות ואופנה בפריסה ארצית. מערך הפיקוח שלנו מאפשר לנו לשמור על סטנדרט אחיד וגבוה בכל סניף, מקריית שמונה ועד אילת.",
  },
  {
    question: "האם אתם מבצעים עבודות מיוחדות כמו ניקוי חלונות בגובה או פוליש?",
    answer:
      "בוודאי. מעבר לניקיון שוטף, אנו מציעים חבילת שירותים משלימה הכוללת: ניקוי חלונות בסנפלינג ובמות הרמה, פוליש קריסטל וחידוש רצפות, ניקוי פילטרים במזגנים, ניקיון אחרי שיפוץ ועוד.",
  },
  {
    question: "באילו חומרי ניקיון אתם משתמשים?",
    answer:
      'איכות ללא פשרות היא נר לרגלינו. חברת ירוק, אחזקה ניקיון וכח אדם בע"מ עובדת אך ורק עם חומרי ניקוי תקניים המיוצרים על ידי הספקים המובילים והמוכרים ביותר בישראל. כל החומרים שברשותנו עומדים בתקני הבטיחות המחמירים ביותר, הם בטוחים לשימוש בסביבת עובדים ולקוחות, ומותאמים ספציפית לסוג המשטח (שיש, פרקט, זכוכית וכו\') כדי להבטיח שמירה מקסימלית על הנכס שלכם לאורך שנים.',
  },
  {
    question: "איך אתם מפקחים על איכות העבודה בשטח?",
    answer:
      "מערך הבקרה שלנו כולל מנהלי אזור שמבצעים ביקורי פתע וביקורות סדירות בכל אתר. בנוסף, אנו משתמשים במערכות דיווח טכנולוגיות המאפשרות מעקב בזמן אמת אחר נוכחות.",
  },
  {
    question: "האם יש לכם ביטוח שמכסה נזקים פוטנציאליים?",
    answer:
      'כן. לחברה פוליסת ביטוח מקיפה הכוללת חבות מעבידים וצד ג\'.',
  },
];

const FAQ = () => {
  return (
    <div className="min-h-screen bg-background" dir="rtl" lang="he">
      <LandingNavigation />

      {/* Hero */}
      <section className="relative bg-gradient-to-br from-primary via-primary/90 to-primary/80 py-16 md:py-24">
        <div className="container mx-auto px-6 md:px-8">
          <nav className="flex items-center gap-2 text-white/70 text-sm mb-6">
            <Link to="/" className="hover:text-white transition-colors flex items-center gap-1">
              <Home className="h-4 w-4" />
              בית
            </Link>
            <ChevronLeft className="h-4 w-4" />
            <span className="text-white">שאלות ותשובות</span>
          </nav>
          <h1 className="text-3xl md:text-4xl lg:text-5xl font-bold text-white leading-tight max-w-3xl">
            שאלות נפוצות - כל מה שצריך לדעת על ניקיון, אחזקה וכוח אדם
          </h1>
        </div>
      </section>

      {/* Featured image */}
      <div className="container mx-auto px-6 md:px-8 -mt-8 relative z-10">
        <div className="max-w-4xl mx-auto">
          <img
            src={faqHero}
            alt="שולחן עבודה מודרני עם מחשב נייד, מחברת וצמח ירוק"
            className="w-full h-48 md:h-64 object-cover rounded-2xl shadow-lg"
            loading="lazy"
          />
        </div>
      </div>

      {/* FAQ Accordion */}
      <main className="py-12 md:py-16">
        <div className="container mx-auto px-6 md:px-8">
          <div className="max-w-4xl mx-auto">
            <Accordion type="single" collapsible className="space-y-4">
              {faqItems.map((item, index) => (
                <AccordionItem
                  key={index}
                  value={`item-${index}`}
                  className="border border-border/60 rounded-xl px-6 bg-card shadow-sm hover:shadow-md transition-shadow"
                >
                  <AccordionTrigger className="text-base md:text-lg font-semibold text-foreground hover:text-primary hover:no-underline py-5 gap-4 text-right">
                    {item.question}
                  </AccordionTrigger>
                  <AccordionContent className="text-muted-foreground leading-relaxed text-base pb-5">
                    {item.answer}
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>

            {/* CTA */}
            <div className="mt-14 p-8 bg-secondary/50 rounded-2xl text-center">
              <p className="text-lg md:text-xl font-medium text-foreground mb-6">
                עדיין יש לכם שאלות? אנחנו כאן בשבילכם.
              </p>
              <a
                href="https://wa.me/972775523053"
                target="_blank"
                rel="noopener noreferrer"
              >
                <Button size="lg" className="rounded-full px-8 py-6 text-lg gap-2">
                  <MessageCircle className="h-5 w-5" />
                  עדיין יש לכם שאלות? דברו איתנו בווטסאפ
                </Button>
              </a>
            </div>
          </div>
        </div>
      </main>

      <LandingFooter />
    </div>
  );
};

export default FAQ;
