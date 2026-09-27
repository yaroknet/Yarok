import { Link } from "react-router-dom";
import { LandingNavigation } from "@/components/navigation/LandingNavigation";
import { LandingFooter } from "@/components/navigation/LandingFooter";
import { Card, CardContent } from "@/components/ui/card";
import { ArrowLeft, Calendar, Clock } from "lucide-react";
import articleImage from "@/assets/article-office-cleaning.jpg";
import articleEmployerImage from "@/assets/article-employer-responsibility.jpg";
import articleHeightImage from "@/assets/article-height-cleaning.jpg";
import articleAcImage from "@/assets/article-ac-filters.jpg";

const articles = [
  {
    title: "יותר מקירור: המדריך לתחזוקת פילטרים ומיזוג אוויר ברשתות אופנה",
    slug: "ac-filters",
    excerpt: "בחנויות אופנה, המזגן הוא הרבה יותר ממכשיר חשמלי – הוא חלק מחוויית הקנייה. חברת \"ירוק\" מסבירה איך ניקוי פילטרים שומר על בריאות העובדים, חוסך בחשמל ומונע ריחות.",
    image: articleAcImage,
    date: "מרץ 2026",
    readTime: "5 דקות קריאה",
  },
  {
    title: "מעבר לקו העין: המדריך המלא לניקוי ותחזוקה בגובה – מחלונות סנפלינג ועד לפינות הנסתרות",
    slug: "height-cleaning",
    excerpt: "ניקיון בגובה דורש הרבה יותר מסולם. חברת \"ירוק\" מסבירה איך לבצע עבודות גובה בבטחות ובמקצועיות, כולל הסרת כורי עכביש, אבק מצטבר, וניקיון ייעודי של תאי מדידה גבוהים.",
    image: articleHeightImage,
    date: "מרץ 2026",
    readTime: "7 דקות קריאה",
  },
  {
    title: "אחריות מעסיק ושמירה על זכויות עובדים בענף הניקיון: מה אתם חייבים לדעת כחברה מזמינה?",
    slug: "employer-responsibility",
    excerpt: "בעולם הניקיון והתחזוקה, האחריות על זכויות העובדים אינה עוצרת אצל הקבלן. חברת \"ירוק\" מסבירה את חשיבות הציות לחוק ואיך להגן על עצמכם ועל העובדים.",
    image: articleEmployerImage,
    date: "מרץ 2026",
    readTime: "6 דקות קריאה",
  },
  {
    title: "המדריך המלא לבחירת חברת ניקיון למשרד: 5 דברים שאסור להתפשר עליהם",
    slug: "office-cleaning-guide",
    excerpt: "איך בוחרים חברת ניקיון משרדים מקצועית באמת? אל תתפשרו על איכות, ביטוחים ופיקוח. חברת \"ירוק\" מציגה את 5 הנקודות הקריטיות.",
    image: articleImage,
    date: "מרץ 2026",
    readTime: "5 דקות קריאה",
  },
];

const Knowledge = () => {
  return (
    <div className="min-h-screen bg-background" dir="rtl" lang="he">
      <LandingNavigation />

      {/* Hero */}
      <section className="bg-gradient-to-br from-primary via-primary/90 to-primary/80 py-16 md:py-24">
        <div className="container mx-auto px-6 md:px-8">
          <h1 className="text-3xl md:text-4xl lg:text-5xl font-bold text-primary-foreground leading-tight">
            מאמרים
          </h1>
          <p className="text-primary-foreground/80 mt-4 text-lg">
            מאמרים ומדריכים מקצועיים בתחום הניקיון, האחזקה וכוח האדם
          </p>
        </div>
      </section>

      {/* Articles Grid */}
      <main className="py-12 md:py-16">
        <div className="container mx-auto px-6 md:px-8">
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            {articles.map((article) => (
              <Link key={article.slug} to={`/articles/${article.slug}`}>
                <Card className="h-full hover:shadow-xl transition-all duration-300 overflow-hidden group">
                  <div className="aspect-video overflow-hidden">
                    <img
                      src={article.image}
                      alt={article.title}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                      loading="lazy"
                    />
                  </div>
                  <CardContent className="p-6">
                    <div className="flex items-center gap-4 text-xs text-muted-foreground mb-3">
                      <span className="flex items-center gap-1">
                        <Calendar className="h-3.5 w-3.5" />
                        {article.date}
                      </span>
                      <span className="flex items-center gap-1">
                        <Clock className="h-3.5 w-3.5" />
                        {article.readTime}
                      </span>
                    </div>
                    <h2 className="text-lg font-bold text-foreground mb-3 leading-snug">{article.title}</h2>
                    <p className="text-sm text-muted-foreground mb-4 line-clamp-3">{article.excerpt}</p>
                    <div className="flex items-center text-primary font-medium text-sm">
                      קרא עוד
                      <ArrowLeft className="h-4 w-4 mr-2 group-hover:-translate-x-1 transition-transform" />
                    </div>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        </div>
      </main>

      <LandingFooter />
    </div>
  );
};

export default Knowledge;
