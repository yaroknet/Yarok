import yarokLogo from "@/employees/assets/yarok-logo.png";
import isoBadge from "@/employees/assets/iso-9001-badge.jpg";

export function QuoteBrandedHeader() {
  return (
    <div className="flex items-start justify-between border-b-2 border-primary/20 pb-4 mb-6">
      <div className="flex items-center">
        <img src={isoBadge} alt="ISO 9001" className="h-20 w-auto" />
      </div>
      <div className="flex flex-col items-end text-right">
        <img src={yarokLogo} alt="קבוצת ירוק" className="h-20 w-auto" />
        <p className="text-xs text-muted-foreground mt-1">אחזקה • ניקיון • כח אדם</p>
      </div>
    </div>
  );
}

export function QuoteBrandedFooter() {
  return (
    <div className="border-t-2 border-primary/20 pt-4 mt-8 text-xs text-muted-foreground space-y-2 leading-relaxed">
      <p className="font-semibold text-foreground text-sm">תנאים והתחייבויות:</p>
      <p>• לחברת ירוק שירותי אחזקה, ניקיון וכ"א בע"מ קיים הניסיון והידע לאספקת שירותי ניקיון.</p>
      <p>• לחברתנו כל הביטוחים הנדרשים על פי חוק לרבות צד ג', אחריות מקצועית, וחבות מעבידים, ועם מסירת העבודה לידנו אנו פוטרים אתכם מכל יחס של מעביד ועובד לגבי העובדים שיועסקו על ידינו.</p>
      <p>• שכר העובד לא יפחת משכר המינימום והחברה מתחייבת לשלם לעובד את כל התנאים הסוציאליים המחויבים עפ"י חוק.</p>
      <p>• המחיר צמוד לשכר המינימום במשק בישראל ו/או לשינויי תנאי השכר במשק ובענף הניקיון בהוראת הממשלה ו/או משרד התמ"ת.</p>
      <p>• עבור שעות נוספות ו/או שעות שבת יחולו חיובים נוספים ע"פ חוק.</p>
      <p>• מוסכם בזאת בין הצדדים כי בגין יום חג ו/או ימי שבתון לא תופחת התמורה המשולמת לחברה.</p>
      <p>• הלקוח לא יקלוט לשורותיו עובד חברת ירוק שירותי אחזקה, ניקיון וכ"א בע"מ ללא הסכמה בכתב מהחברה.</p>
      <p>• הפסקת עבודה מחייבת את שני הצדדים בהודעה בכתב ובהתראה מראש בת 30 ימים.</p>
      <p>• החברה רשומה כחוק הנדרש במשרדי התמ"ת.</p>
      <p>• על המזמין לספק שלטי אזהרה נגד החלקה ולהקפיד כי ייוצבו בעת שטיפת הרצפה באתר.</p>
      <p className="font-semibold text-foreground mt-2">מס' רישיון קבלן שירות - 3570 | מס' קבלן כח אדם - 1021</p>
    </div>
  );
}
