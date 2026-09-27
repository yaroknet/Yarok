import { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Copy, ExternalLink } from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { he } from 'date-fns/locale';
import { supabase } from '@/integrations/supabase/client';
import yarokLogo from '@/assets/yarok-logo.png';

interface Proposal {
  id: string;
  proposal_number: string;
  client_name: string;
  company_id: string | null;
  contact_person: string;
  contact_email: string;
  service_type: string;
  frequency?: string | null;
  location: string;
  price: number;
  payment_terms: string;
  materials: string;
  notes: string | null;
  include_profile: boolean;
  include_client_form: boolean;
  status: string;
  created_at: string;
  signed_at: string | null;
}

interface ProposalService {
  id: string;
  service_description: string;
  frequency: string | null;
  price: number;
  sort_order: number;
}

interface ViewProposalDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  proposal: Proposal;
}

const getMaterialsText = (materials: string) => {
  switch (materials) {
    case 'basic':
      return 'כולל חומרי ניקיון בסיסיים בלבד';
    case 'toiletries':
      return 'כולל חומרים ומוצרי טואלטיקה';
    case 'none':
      return 'ללא חומרים כלל';
    case 'not_relevant':
      return null;
    default:
      return materials;
  }
};

export function ViewProposalDialog({ open, onOpenChange, proposal }: ViewProposalDialogProps) {
  const [services, setServices] = useState<ProposalService[]>([]);

  useEffect(() => {
    if (open && proposal.id) {
      fetchServices();
    }
  }, [open, proposal.id]);

  const fetchServices = async () => {
    const { data, error } = await supabase
      .from('proposal_services')
      .select('*')
      .eq('proposal_id', proposal.id)
      .order('sort_order');

    if (!error && data) {
      setServices(data);
    }
  };

  const copyLink = () => {
    const link = `${window.location.origin}/proposal/${proposal.id}`;
    navigator.clipboard.writeText(link);
    toast.success('הלינק הועתק ללוח');
  };

  const openClientView = () => {
    window.open(`/proposal/${proposal.id}`, '_blank');
  };

  const materialsText = getMaterialsText(proposal.materials);
  const totalPrice = services.length > 0 
    ? services.reduce((sum, s) => sum + Number(s.price), 0) 
    : Number(proposal.price);

  // Use services if available, otherwise fallback to single service from proposal
  const displayServices = services.length > 0 ? services : [{
    id: 'fallback',
    service_description: proposal.service_type,
    frequency: proposal.frequency || null,
    price: proposal.price,
    sort_order: 0
  }];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <DialogTitle>הצעת מחיר {proposal.proposal_number}</DialogTitle>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={copyLink}>
                <Copy className="h-4 w-4 ml-2" />
                העתק לינק
              </Button>
              <Button variant="outline" size="sm" onClick={openClientView}>
                <ExternalLink className="h-4 w-4 ml-2" />
                פתח תצוגת לקוח
              </Button>
            </div>
          </div>
        </DialogHeader>

        {/* Proposal Preview */}
        <div className="bg-white border rounded-lg p-8 space-y-6" dir="rtl">
          {/* Header */}
          <div className="flex justify-end items-start">
            <img src={yarokLogo} alt="ירוק" className="h-20 object-contain" />
          </div>

          {/* Title */}
          <div className="border-b-4 border-primary pb-2">
            <h1 className="text-3xl font-bold text-primary">הצעת מחיר</h1>
          </div>

          {/* Company Info */}
          <div className="text-right space-y-1">
            <p className="font-bold text-lg">ירוק שירותי אחזקה ניקיון וכח אדם בע"מ</p>
            <p className="text-sm">514854116</p>
            <p className="text-sm">ברוך הירש 14, בני ברק</p>
            <p className="text-sm">טלפון 077-5523053 פקס 077-6623053</p>
            <p className="text-sm">דואר אלקטרוני office@yaroknet.co.il</p>
          </div>

          {/* Date and Status */}
          <div className="flex justify-between items-center">
            <p>תאריך: {format(new Date(proposal.created_at), 'dd/MM/yyyy', { locale: he })}</p>
            <Badge variant={proposal.status === 'signed' ? 'default' : 'secondary'}>
              {proposal.status === 'draft' ? 'טיוטה' : proposal.status === 'sent' ? 'נשלח' : 'נחתם'}
            </Badge>
          </div>

          {/* To Section */}
          <div>
            <h2 className="text-xl font-bold mb-2">לכבוד</h2>
            <p className="font-medium">{proposal.client_name}</p>
            {proposal.company_id && <p className="text-sm">ח.פ: {proposal.company_id}</p>}
          </div>

          {/* Introduction */}
          <p>
            בהמשך לשיחתנו ולאחר קבלת כל הפרטים הנדרשים, אנו מתכבדים להגיש את הצעתנו למתן שירותים וזאת על פי המפרט והנתונים אשר הובאו לידיעתנו.
          </p>

          {/* Service Details Table - Multiple rows */}
          <div className="border rounded-lg overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="bg-primary/10">
                    <th className="p-3 text-right font-bold border-l border-primary/20">תיאור השירות</th>
                    <th className="p-3 text-right font-bold border-l border-primary/20">תדירות השירות</th>
                    <th className="p-3 text-right font-bold">סכום לתשלום לפני מע"מ</th>
                </tr>
              </thead>
              <tbody>
                {displayServices.map((service, index) => (
                  <tr key={service.id} className={index > 0 ? 'border-t' : ''}>
                    <td className="p-3 border-l">{service.service_description}</td>
                    <td className="p-3 border-l">{service.frequency || '-'}</td>
                    <td className="p-3">₪{Number(service.price).toLocaleString()}</td>
                  </tr>
                ))}
                {/* Total Row */}
                <tr className="border-t bg-muted/30">
                  <td colSpan={2} className="p-3 text-left font-bold border-l">סה"כ:</td>
                  <td className="p-3 font-bold text-lg">₪{totalPrice.toLocaleString()}</td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* Materials */}
          {materialsText && (
            <p className="text-sm">• {materialsText}</p>
          )}

          {proposal.notes && (
            <div className="bg-muted/30 p-4 rounded-lg">
              <p className="font-medium mb-1">הערות:</p>
              <p>{proposal.notes}</p>
            </div>
          )}

          {/* Legal Terms */}
          <div className="text-xs space-y-2 border-t pt-4">
            <p>• עבור שעות נוספות ושעות שבת יחולו תוספות עפ"י חוק</p>
            {materialsText && <p>• {materialsText}</p>}
            <p>• לחברת ירוק שירותי אחזקה, ניקיון וכ"א בע"מ קיים הניסיון הידע לאספקת שירותי ניקיון.</p>
            <p>• לחברתנו כל הביטוחים הנדרשים על פי חוק לרבות צד ג' אחריות מקצועיות, וחבות מעבידים, ועם מסירת העבודה לידינו אנו פוטרים אתכם מכל יחס של מעביד ועובד לגבי העובדים שיועסקו על ידינו.</p>
            <p>• שכר העובד לא יפחת משכר המינימום והחברה מתחייבת לשלם לעובד את כל התנאים הסוציאליים המחויבים עפ"י חוק.</p>
            <p>• החיוב צמוד לשכר המינימום במשק בישראל ו/או לשינויי תנאי השכר במשק ובענף הניקיון בהוראת הממשלה ו/או משרד התמ"ת.</p>
            <p>• עבור שעות נוספות ו/או שעות שבת יחולו חיובים נוספים ע"פ חוק.</p>
            <p>• מוסכם בזאת בין הצדדים כי בגין יום חג ו/או ימי שבתון לא תופחת התמורה המשולמת לחברה.</p>
            <p>• הלקוח לא יקלוט לשורותיו עובד חברת ירוק שירותי אחזקה, ניקיון וכ"א בע"מ ללא הסכמה בכתב מהחברה</p>
            <p>• הפסקת עבודה מחייבת את שני הצדדים בהודעה בכתב ובהתראה מראש. בחצי השנה הראשונה על כל חודש יום, לאחר מכן 30 ימי התראה מוקדמת</p>
            <p>• תנאי תשלום: {proposal.payment_terms}</p>
            <p>• החברה רשומה כחוק הנדרש במשרדי התמ"ת</p>
            <p>• על המזמין לספק שלטי אזהרה נגד החלקה ולהקפיד כי ייצבו בעת שטיפת הרצפה באתר</p>
            <p className="font-bold">• מס' רישיון קבלן שירות - 3570, מס קבלן כח אדם - 1021</p>
          </div>

          {/* Footer */}
          <p className="text-lg font-bold text-center text-primary">כאן לשירותך וזמינים לשאלות ובירורים.</p>

          {/* Signature Area */}
          <div className="pt-4">
            <div className="flex items-end gap-2">
              <span>חתימת הלקוח:</span>
              <div className="border-b-2 border-foreground flex-1 h-8">
                {proposal.status === 'signed' && proposal.signed_at && (
                  <p className="text-xs text-muted-foreground">
                    נחתם ב-{format(new Date(proposal.signed_at), 'dd/MM/yyyy HH:mm', { locale: he })}
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}