import { useState, useEffect, useRef } from 'react';
import { useParams } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { he } from 'date-fns/locale';
import { CheckCircle, FileText, Loader2, Download } from 'lucide-react';
import yarokLogo from '@/assets/yarok-logo.png';
import SignatureCanvas from 'react-signature-canvas';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
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

export default function ProposalClientView() {
  const { id } = useParams<{ id: string }>();
  const [proposal, setProposal] = useState<Proposal | null>(null);
  const [services, setServices] = useState<ProposalService[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [downloadingPdf, setDownloadingPdf] = useState(false);
  const sigCanvas = useRef<SignatureCanvas>(null);
  const proposalSignatureRef = useRef<SignatureCanvas>(null);
  const proposalContentRef = useRef<HTMLDivElement>(null);
  
  const [formData, setFormData] = useState({
    full_name: '',
    id_number: '',
    billing_address: '',
    po_box: '',
    postal_code: '',
    contact_name: '',
    phone: '',
    office_phone: '',
    fax: '',
    email: '',
    notes: '',
    form_filler_name: '',
    form_filler_role: ''
  });

  useEffect(() => {
    fetchProposal();
  }, [id]);

  const fetchProposal = async () => {
    if (!id) return;
    
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('proposals')
        .select('*')
        .eq('id', id)
        .single();

      if (error) throw error;
      setProposal(data);
      
      if (data.status === 'signed') {
        setSubmitted(true);
      }

      // Fetch services
      const { data: servicesData } = await supabase
        .from('proposal_services')
        .select('*')
        .eq('proposal_id', id)
        .order('sort_order');

      if (servicesData) {
        setServices(servicesData);
      }
    } catch (error: any) {
      console.error('Error fetching proposal:', error);
      toast.error('שגיאה בטעינת ההצעה');
    } finally {
      setLoading(false);
    }
  };

  const clearSignature = () => {
    sigCanvas.current?.clear();
  };

  const clearProposalSignature = () => {
    proposalSignatureRef.current?.clear();
  };

  const downloadClientPdf = async () => {
    if (!proposal || !proposalContentRef.current) return;
    
    // Check if proposal signature is signed
    if (proposalSignatureRef.current?.isEmpty()) {
      toast.error('נא לחתום על ההצעה לפני ההורדה');
      return;
    }
    
    setDownloadingPdf(true);
    try {
      const signatureData = proposalSignatureRef.current?.toDataURL('image/png');
      
      const canvas = await html2canvas(proposalContentRef.current, {
        scale: 2,
        useCORS: true,
        logging: false,
        backgroundColor: '#ffffff',
      });
      
      const imgData = canvas.toDataURL('image/png', 1.0);
      const pdf = new jsPDF('p', 'mm', 'a4');
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = pdf.internal.pageSize.getHeight();
      const imgWidth = canvas.width;
      const imgHeight = canvas.height;
      const ratio = Math.min(pdfWidth / imgWidth, pdfHeight / imgHeight);
      
      pdf.addImage(imgData, 'PNG', 0, 0, imgWidth * ratio, imgHeight * ratio);
      pdf.save(`הצעת-מחיר-${proposal.proposal_number}.pdf`);
      
      toast.success('ה-PDF הורד בהצלחה');
    } catch (error) {
      console.error('Error generating PDF:', error);
      toast.error('שגיאה ביצירת ה-PDF');
    } finally {
      setDownloadingPdf(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!proposal || !id) return;
    
    if (!formData.full_name || !formData.id_number || !formData.phone || 
        !formData.email || !formData.billing_address) {
      toast.error('נא למלא את כל השדות המסומנים בכוכבית');
      return;
    }

    if (sigCanvas.current?.isEmpty()) {
      toast.error('נא לחתום על המסמך');
      return;
    }

    setSubmitting(true);
    try {
      const signatureData = sigCanvas.current?.toDataURL('image/png');
      const signatureBlob = await fetch(signatureData!).then(r => r.blob());
      const signatureFileName = `${id}/${Date.now()}.png`;
      
      const { error: uploadError } = await supabase.storage
        .from('proposal-signatures')
        .upload(signatureFileName, signatureBlob);

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('proposal-signatures')
        .getPublicUrl(signatureFileName);

      const { error: formError } = await supabase
        .from('proposal_client_forms')
        .insert({
          proposal_id: id,
          full_name: formData.full_name,
          id_number: formData.id_number,
          billing_address: formData.billing_address,
          po_box: formData.po_box || null,
          postal_code: formData.postal_code || null,
          contact_name: formData.contact_name || null,
          phone: formData.phone,
          office_phone: formData.office_phone || null,
          fax: formData.fax || null,
          email: formData.email,
          notes: formData.notes || null,
          form_filler_name: formData.form_filler_name || null,
          form_filler_role: formData.form_filler_role || null,
          signature_url: publicUrl
        });

      if (formError) throw formError;

      const { error: updateError } = await supabase
        .from('proposals')
        .update({ 
          status: 'signed',
          signed_at: new Date().toISOString(),
          signature_url: publicUrl,
          client_signature_data: formData
        })
        .eq('id', id);

      if (updateError) throw updateError;

      // Create notification for proposal signature
      try {
        const { data: proposalData } = await supabase
          .from('proposals')
          .select('created_by, proposal_number, client_name')
          .eq('id', id)
          .single();

        if (proposalData?.created_by) {
          await supabase.from('notifications').insert({
            title: 'הצעת מחיר נחתמה!',
            body: `ההצעה ${proposalData.proposal_number} ללקוח ${proposalData.client_name} נחתמה`,
            type: 'proposal_signed',
            target_type: 'user',
            target_user_id: proposalData.created_by,
            sent_at: new Date().toISOString(),
            created_by: proposalData.created_by,
            data: { proposal_id: id, proposal_number: proposalData.proposal_number }
          });
        }
      } catch (notifError) {
        console.error('Error creating notification:', notifError);
        // Don't fail the main submission if notification fails
      }

      setSubmitted(true);
      toast.success('ההצעה נחתמה בהצלחה!');
    } catch (error: any) {
      console.error('Error submitting:', error);
      toast.error('שגיאה בשליחת הטופס');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!proposal) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Card className="max-w-md mx-4">
          <CardContent className="p-6 text-center">
            <FileText className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <h2 className="text-xl font-bold mb-2">הצעה לא נמצאה</h2>
            <p className="text-muted-foreground">הקישור אינו תקין או שההצעה הוסרה.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (submitted) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="max-w-md w-full">
          <CardContent className="p-8 text-center">
            <CheckCircle className="h-16 w-16 mx-auto text-emerald-500 mb-4" />
            <h2 className="text-2xl font-bold mb-2">תודה!</h2>
            <p className="text-muted-foreground mb-4">ההצעה נחתמה בהצלחה.</p>
            <p className="text-sm">מספר הצעה: {proposal.proposal_number}</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const materialsText = getMaterialsText(proposal.materials);
  const totalPrice = services.length > 0 
    ? services.reduce((sum, s) => sum + Number(s.price), 0) 
    : Number(proposal.price);

  // Use services if available, otherwise fallback to single service
  const displayServices = services.length > 0 ? services : [{
    id: 'fallback',
    service_description: proposal.service_type,
    frequency: proposal.frequency || null,
    price: proposal.price,
    sort_order: 0
  }];

  return (
    <div className="min-h-screen bg-muted/30 py-8 px-4" dir="rtl">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Proposal Document */}
        <Card>
          <CardContent className="p-8 space-y-6" ref={proposalContentRef}>
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

            <p className="text-sm">תאריך: {format(new Date(proposal.created_at), 'dd/MM/yyyy', { locale: he })}</p>

            {/* To Section */}
            <div>
              <h2 className="text-xl font-bold mb-2">לכבוד</h2>
              <p className="font-medium">{proposal.client_name}</p>
              {proposal.company_id && <p className="text-sm">ח.פ: {proposal.company_id}</p>}
            </div>

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
                  {displayServices.length > 1 && (
                    <tr className="border-t bg-muted/30">
                      <td colSpan={2} className="p-3 text-left font-bold border-l">סה"כ:</td>
                      <td className="p-3 font-bold text-lg">₪{totalPrice.toLocaleString()}</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {proposal.notes && (
              <div className="bg-muted/50 p-4 rounded-lg">
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

            <p className="text-lg font-bold text-center text-primary">כאן לשירותך וזמינים לשאלות ובירורים.</p>

            {/* Digital Signature Section - IN THE PROPOSAL */}
            <div className="pt-4 border-t-2 border-primary/30">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-lg">חתימת הלקוח על ההצעה:</span>
                  <Button 
                    type="button" 
                    variant="outline" 
                    size="sm" 
                    onClick={clearProposalSignature}
                  >
                    נקה חתימה
                  </Button>
                </div>
                <div className="border-2 border-dashed border-primary/40 rounded-lg bg-white p-2">
                  <SignatureCanvas
                    ref={proposalSignatureRef}
                    penColor="black"
                    canvasProps={{
                      className: 'w-full h-28 rounded-lg',
                      style: { width: '100%', height: '112px' }
                    }}
                  />
                </div>
                <p className="text-sm text-muted-foreground text-center">
                  בחתימתי אני מאשר/ת את תנאי ההצעה המפורטים לעיל
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Download PDF Button */}
        <div className="flex justify-center">
          <Button 
            onClick={downloadClientPdf} 
            disabled={downloadingPdf}
            size="lg"
            className="gap-2"
          >
            {downloadingPdf ? (
              <>
                <Loader2 className="h-5 w-5 animate-spin" />
                מייצר PDF...
              </>
            ) : (
              <>
                <Download className="h-5 w-5" />
                הורד הצעה כ-PDF
              </>
            )}
          </Button>
        </div>

        {/* Client Form */}
        {proposal.include_client_form && (
          <Card>
            <CardContent className="p-8 space-y-6">
              {/* Header */}
              <div className="flex justify-end items-start">
                <img src={yarokLogo} alt="ירוק" className="h-20 object-contain" />
              </div>

              {/* Title */}
              <div className="border-b-4 border-primary pb-2">
                <h1 className="text-3xl font-bold text-primary">טופס פרטי לקוח</h1>
              </div>

              <form onSubmit={handleSubmit} className="space-y-6">
                <div className="space-y-2">
                  <Label htmlFor="full_name" className="text-lg">שם הלקוח / חברה (כפי שמופיע בחשבונית) *</Label>
                  <Input
                    id="full_name"
                    value={formData.full_name}
                    onChange={(e) => setFormData(prev => ({ ...prev, full_name: e.target.value }))}
                    className="text-lg"
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="id_number" className="text-lg">מספר תעודת זהות / ח.פ *</Label>
                  <Input
                    id="id_number"
                    value={formData.id_number}
                    onChange={(e) => setFormData(prev => ({ ...prev, id_number: e.target.value }))}
                    dir="ltr"
                    className="text-lg"
                    required
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="space-y-2 md:col-span-1">
                    <Label htmlFor="billing_address" className="text-lg">כתובת למשלוח דיור *</Label>
                    <Input
                      id="billing_address"
                      value={formData.billing_address}
                      onChange={(e) => setFormData(prev => ({ ...prev, billing_address: e.target.value }))}
                      className="text-lg"
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="po_box" className="text-lg">ת.ד</Label>
                    <Input
                      id="po_box"
                      value={formData.po_box}
                      onChange={(e) => setFormData(prev => ({ ...prev, po_box: e.target.value }))}
                      dir="ltr"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="postal_code" className="text-lg">מיקוד</Label>
                    <Input
                      id="postal_code"
                      value={formData.postal_code}
                      onChange={(e) => setFormData(prev => ({ ...prev, postal_code: e.target.value }))}
                      dir="ltr"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="contact_name" className="text-lg">שם איש קשר מטעם החברה</Label>
                    <Input
                      id="contact_name"
                      value={formData.contact_name}
                      onChange={(e) => setFormData(prev => ({ ...prev, contact_name: e.target.value }))}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="phone" className="text-lg">מספר נייד *</Label>
                    <Input
                      id="phone"
                      type="tel"
                      value={formData.phone}
                      onChange={(e) => setFormData(prev => ({ ...prev, phone: e.target.value }))}
                      dir="ltr"
                      required
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="office_phone" className="text-lg">מספר הנייח במשרד</Label>
                    <Input
                      id="office_phone"
                      type="tel"
                      value={formData.office_phone}
                      onChange={(e) => setFormData(prev => ({ ...prev, office_phone: e.target.value }))}
                      dir="ltr"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="fax" className="text-lg">מספר הפקס במשרד</Label>
                    <Input
                      id="fax"
                      type="tel"
                      value={formData.fax}
                      onChange={(e) => setFormData(prev => ({ ...prev, fax: e.target.value }))}
                      dir="ltr"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="email" className="text-lg">כתובת דוא"ל *</Label>
                  <Input
                    id="email"
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
                    dir="ltr"
                    className="text-lg"
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="notes" className="text-lg">הערות נוספות</Label>
                  <Textarea
                    id="notes"
                    value={formData.notes}
                    onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
                    rows={3}
                  />
                </div>

                <div className="border-t pt-6">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                    <div className="space-y-2">
                      <Label htmlFor="form_filler_name" className="text-lg">שם ממלא הטופס</Label>
                      <Input
                        id="form_filler_name"
                        value={formData.form_filler_name}
                        onChange={(e) => setFormData(prev => ({ ...prev, form_filler_name: e.target.value }))}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="form_filler_role" className="text-lg">תפקיד</Label>
                      <Input
                        id="form_filler_role"
                        value={formData.form_filler_role}
                        onChange={(e) => setFormData(prev => ({ ...prev, form_filler_role: e.target.value }))}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-lg">חתימה *</Label>
                      <div className="border rounded-lg bg-white">
                        <SignatureCanvas
                          ref={sigCanvas}
                          penColor="black"
                          canvasProps={{
                            className: 'w-full h-24 rounded-lg',
                            style: { width: '100%', height: '96px' }
                          }}
                        />
                      </div>
                      <Button type="button" variant="outline" size="sm" onClick={clearSignature}>
                        נקה חתימה
                      </Button>
                    </div>
                  </div>
                </div>

                <Button type="submit" className="w-full text-lg py-6" disabled={submitting}>
                  {submitting ? (
                    <>
                      <Loader2 className="h-5 w-5 ml-2 animate-spin" />
                      שולח...
                    </>
                  ) : (
                    'אשר וחתום'
                  )}
                </Button>
              </form>
            </CardContent>
          </Card>
        )}

        {/* Profile PDF Link */}
        {proposal.include_profile && (
          <Card>
            <CardContent className="p-4">
              <a 
                href="/templates/company-profile.pdf" 
                target="_blank" 
                className="flex items-center gap-2 text-primary hover:underline"
              >
                <FileText className="h-5 w-5" />
                צפה בפרופיל החברה
              </a>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}