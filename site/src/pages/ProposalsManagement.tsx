import { useState, useEffect, useMemo, useRef } from 'react';
import { escapeHtml } from '@/lib/escapeHtml';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useDataScope } from '@/hooks/useDataScope';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { he } from 'date-fns/locale';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import {
  Plus,
  Search,
  FileText,
  CheckCircle,
  Clock,
  Send,
  Eye,
  Copy,
  Trash2,
  TrendingUp,
  DollarSign,
  Edit,
  Download,
  FileSignature,
  ExternalLink
} from 'lucide-react';
import { CreateProposalDialog } from '@/components/proposals/CreateProposalDialog';
import { ViewProposalDialog } from '@/components/proposals/ViewProposalDialog';
import { EditProposalDialog } from '@/components/proposals/EditProposalDialog';
import { DeleteProposalDialog } from '@/components/proposals/DeleteProposalDialog';

interface Proposal {
  id: string;
  proposal_number: string;
  client_name: string;
  company_id: string | null;
  contact_person: string;
  contact_email: string;
  service_type: string;
  location: string;
  price: number;
  payment_terms: string;
  materials: string;
  notes: string | null;
  include_profile: boolean;
  include_client_form: boolean;
  status: string;
  created_by: string;
  created_at: string;
  updated_at: string;
  signed_at: string | null;
  signature_url: string | null;
}

export default function ProposalsManagement() {
  const { user } = useAuth();
  const { canViewFinancialData, scope } = useDataScope('proposals');
  const [proposals, setProposals] = useState<Proposal[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [viewDialogOpen, setViewDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedProposal, setSelectedProposal] = useState<Proposal | null>(null);
  const [downloadingPdf, setDownloadingPdf] = useState<string | null>(null);

  // Only global scope users can access proposals (financial data)
  const canAccessProposals = canViewFinancialData;

  const fetchProposals = async () => {
    if (!user || !canAccessProposals) return;
    
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('proposals')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setProposals(data || []);
    } catch (error: any) {
      console.error('Error fetching proposals:', error);
      toast.error('שגיאה בטעינת ההצעות');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (canAccessProposals) {
      fetchProposals();
    }
  }, [user, canAccessProposals]);

  // Move useMemo hooks BEFORE any early returns
  const filteredProposals = useMemo(() => {
    if (!searchTerm) return proposals;
    
    const search = searchTerm.toLowerCase();
    return proposals.filter(proposal => {
      const searchableFields = [
        proposal.client_name,
        proposal.proposal_number,
        proposal.contact_person,
        proposal.contact_email,
        proposal.service_type,
        proposal.location,
        proposal.notes,
        proposal.company_id,
        proposal.payment_terms,
        String(proposal.price),
      ].filter(Boolean);
      
      return searchableFields.some(field => 
        field?.toLowerCase().includes(search)
      );
    });
  }, [proposals, searchTerm]);

  const stats = useMemo(() => ({
    total: proposals.length,
    draft: proposals.filter(p => p.status === 'draft').length,
    sent: proposals.filter(p => p.status === 'sent').length,
    signed: proposals.filter(p => p.status === 'signed').length,
    totalValue: proposals.reduce((sum, p) => sum + Number(p.price), 0),
    signedValue: proposals.filter(p => p.status === 'signed').reduce((sum, p) => sum + Number(p.price), 0)
  }), [proposals]);

  // If user doesn't have access to financial data, show restricted message
  if (!canAccessProposals) {
    return (
      <div className="container mx-auto px-4 py-6" dir="rtl">
        <Card className="max-w-lg mx-auto mt-12">
          <CardContent className="py-12 text-center">
            <FileText className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
            <h2 className="text-xl font-bold mb-2">גישה מוגבלת</h2>
            <p className="text-muted-foreground">
              ניהול הצעות מחיר כולל נתונים כספיים וזמין רק למשתמשים עם הרשאות גלובליות.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'draft':
        return <Badge variant="secondary">טיוטה</Badge>;
      case 'sent':
        return <Badge className="bg-amber-500 hover:bg-amber-600">נשלח</Badge>;
      case 'signed':
        return <Badge className="bg-emerald-500 hover:bg-emerald-600">נחתם</Badge>;
      default:
        return <Badge>{status}</Badge>;
    }
  };

  const handleView = (proposal: Proposal) => {
    setSelectedProposal(proposal);
    setViewDialogOpen(true);
  };

  const handleEdit = (proposal: Proposal) => {
    setSelectedProposal(proposal);
    setEditDialogOpen(true);
  };

  const handleDelete = (proposal: Proposal) => {
    setSelectedProposal(proposal);
    setDeleteDialogOpen(true);
  };

  const copyLink = (proposalId: string) => {
    const link = `${window.location.origin}/proposal/${proposalId}`;
    navigator.clipboard.writeText(link);
    toast.success('הלינק הועתק ללוח');
  };

  const markAsSent = async (proposalId: string) => {
    try {
      const { error } = await supabase
        .from('proposals')
        .update({ status: 'sent' })
        .eq('id', proposalId);

      if (error) throw error;
      toast.success('ההצעה סומנה כנשלחה');
      fetchProposals();
    } catch (error) {
      console.error('Error updating proposal:', error);
      toast.error('שגיאה בעדכון ההצעה');
    }
  };

  const viewSignature = (signatureUrl: string) => {
    window.open(signatureUrl, '_blank');
  };

  const downloadSignedPdf = async (proposal: Proposal) => {
    if (!proposal.signature_url) {
      toast.error('לא נמצאה חתימה להצעה זו');
      return;
    }
    
    setDownloadingPdf(proposal.id);
    try {
      // Fetch services for this proposal
      const { data: services } = await supabase
        .from('proposal_services')
        .select('*')
        .eq('proposal_id', proposal.id)
        .order('sort_order');

      const displayServices: Array<{id: string; service_description: string; frequency: string | null; price: number; sort_order: number}> = services && services.length > 0 
        ? services 
        : [{
            id: 'fallback',
            service_description: proposal.service_type,
            frequency: (proposal as any).frequency || null,
            price: proposal.price,
            sort_order: 0
          }];

      const totalPrice = displayServices.reduce((sum, s) => sum + Number(s.price), 0);

      const getMaterialsText = (materials: string) => {
        switch (materials) {
          case 'basic': return 'כולל חומרי ניקיון בסיסיים בלבד';
          case 'toiletries': return 'כולל חומרים ומוצרי טואלטיקה';
          case 'none': return 'ללא חומרים כלל';
          case 'not_relevant': return null;
          default: return materials;
        }
      };

      const materialsText = getMaterialsText(proposal.materials);

      // Create a professional PDF container with signature
      const container = document.createElement('div');
      container.style.cssText = 'position: absolute; left: -9999px; top: 0; width: 794px; background: white; font-family: "Segoe UI", Tahoma, Arial, sans-serif;';
      container.dir = 'rtl';
      
      container.innerHTML = `
        <div style="padding: 40px; font-size: 14px; line-height: 1.8; color: #1a1a1a;">
          <!-- Header with Logo -->
          <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 30px; border-bottom: 3px solid #16a34a; padding-bottom: 20px;">
            <div style="text-align: right;">
              <h1 style="font-size: 32px; color: #16a34a; margin: 0 0 5px 0; font-weight: 700;">הצעת מחיר - נחתמה ✓</h1>
              <p style="font-size: 13px; color: #666; margin: 0;">מספר: ${escapeHtml(proposal.proposal_number)}</p>
              <p style="font-size: 13px; color: #666; margin: 0;">תאריך הצעה: ${format(new Date(proposal.created_at), 'dd/MM/yyyy', { locale: he })}</p>
              <p style="font-size: 13px; color: #16a34a; font-weight: 600; margin: 0;">תאריך חתימה: ${proposal.signed_at ? format(new Date(proposal.signed_at), 'dd/MM/yyyy HH:mm', { locale: he }) : '-'}</p>
            </div>
            <div style="text-align: left;">
              <div style="background: linear-gradient(135deg, #16a34a 0%, #22c55e 100%); color: white; padding: 15px 25px; border-radius: 8px;">
                <span style="font-size: 28px; font-weight: 700;">ירוק</span>
              </div>
            </div>
          </div>
          
          <!-- Company Info -->
          <div style="background: #f8faf8; padding: 20px; border-radius: 8px; margin-bottom: 25px; border-right: 4px solid #16a34a;">
            <p style="font-weight: 700; font-size: 16px; margin: 0 0 8px 0; color: #16a34a;">ירוק שירותי אחזקה ניקיון וכח אדם בע"מ</p>
            <p style="margin: 3px 0; color: #444;">ח.פ: 514854116</p>
            <p style="margin: 3px 0; color: #444;">ברוך הירש 14, בני ברק</p>
            <p style="margin: 3px 0; color: #444;">טלפון: 077-5523053 | פקס: 077-6623053</p>
            <p style="margin: 3px 0; color: #444;">דוא"ל: office@yaroknet.co.il</p>
          </div>
          
          <!-- Client Info -->
          <div style="background: #fff; padding: 20px; border: 2px solid #e5e7eb; border-radius: 8px; margin-bottom: 25px;">
            <h2 style="font-size: 14px; color: #666; margin: 0 0 10px 0; font-weight: 600;">לכבוד</h2>
            <p style="font-weight: 700; font-size: 18px; margin: 0; color: #1a1a1a;">${escapeHtml(proposal.client_name)}</p>
            ${proposal.company_id ? `<p style="margin: 5px 0 0 0; color: #666;">ח.פ: ${escapeHtml(proposal.company_id)}</p>` : ''}
          </div>
          
          <p style="margin-bottom: 25px; color: #444; font-size: 14px;">בהמשך לשיחתנו ולאחר קבלת כל הפרטים הנדרשים, אנו מתכבדים להגיש את הצעתנו למתן שירותים וזאת על פי המפרט והנתונים אשר הובאו לידיעתנו.</p>
          
          <!-- Services Table -->
          <table style="width: 100%; border-collapse: collapse; margin-bottom: 25px; box-shadow: 0 2px 8px rgba(0,0,0,0.08); border-radius: 8px; overflow: hidden;">
            <thead>
              <tr style="background: linear-gradient(135deg, #16a34a 0%, #22c55e 100%);">
                <th style="padding: 14px 16px; text-align: right; color: white; font-weight: 600; font-size: 14px;">תיאור השירות</th>
                <th style="padding: 14px 16px; text-align: center; color: white; font-weight: 600; font-size: 14px;">תדירות השירות</th>
                <th style="padding: 14px 16px; text-align: center; color: white; font-weight: 600; font-size: 14px;">סכום לפני מע"מ</th>
              </tr>
            </thead>
            <tbody>
              ${displayServices.map((s, idx) => `
                <tr style="background: ${idx % 2 === 0 ? '#ffffff' : '#f9fafb'};">
                  <td style="padding: 14px 16px; border-bottom: 1px solid #e5e7eb; font-size: 14px;">${escapeHtml(s.service_description)}</td>
                  <td style="padding: 14px 16px; border-bottom: 1px solid #e5e7eb; text-align: center; font-size: 14px;">${escapeHtml(s.frequency) || '-'}</td>
                  <td style="padding: 14px 16px; border-bottom: 1px solid #e5e7eb; text-align: center; font-size: 14px; font-weight: 600;">₪${Number(s.price).toLocaleString()}</td>
                </tr>
              `).join('')}
              <tr style="background: #16a34a;">
                <td colspan="2" style="padding: 14px 16px; text-align: left; font-weight: 700; color: white; font-size: 15px;">סה"כ לתשלום:</td>
                <td style="padding: 14px 16px; text-align: center; font-weight: 700; color: white; font-size: 18px;">₪${totalPrice.toLocaleString()}</td>
              </tr>
            </tbody>
          </table>
          
          ${materialsText ? `<div style="background: #ecfdf5; padding: 12px 16px; border-radius: 6px; margin-bottom: 20px; border-right: 3px solid #16a34a;"><span style="color: #16a34a; font-weight: 600;">✓</span> ${materialsText}</div>` : ''}
          
          ${proposal.notes ? `<div style="background: #fefce8; padding: 16px; margin-bottom: 20px; border-radius: 8px; border-right: 4px solid #eab308;"><p style="font-weight: 600; margin: 0 0 8px 0; color: #854d0e;">הערות:</p><p style="margin: 0; color: #713f12;">${escapeHtml(proposal.notes)}</p></div>` : ''}
          
          <!-- Terms & Conditions -->
          <div style="background: #f8fafc; padding: 20px; border-radius: 8px; margin-bottom: 25px;">
            <h3 style="font-size: 14px; color: #16a34a; margin: 0 0 12px 0; font-weight: 700;">תנאים והתחייבויות</h3>
            <div style="font-size: 11px; color: #475569; line-height: 1.7;">
              <p style="margin: 4px 0;">• עבור שעות נוספות ושעות שבת יחולו תוספות עפ"י חוק</p>
              <p style="margin: 4px 0;">• לחברת ירוק שירותי אחזקה, ניקיון וכ"א בע"מ קיים הניסיון והידע לאספקת שירותי ניקיון</p>
              <p style="margin: 4px 0;">• לחברתנו כל הביטוחים הנדרשים על פי חוק לרבות צד ג', אחריות מקצועית וחבות מעבידים</p>
              <p style="margin: 4px 0;">• שכר העובד לא יפחת משכר המינימום והחברה מתחייבת לשלם את כל התנאים הסוציאליים עפ"י חוק</p>
              <p style="margin: 4px 0;">• החיוב צמוד לשכר המינימום במשק בישראל</p>
              <p style="margin: 4px 0;">• תנאי תשלום: <strong>${escapeHtml(proposal.payment_terms)}</strong></p>
              <p style="margin: 8px 0 0 0; font-weight: 600; color: #16a34a;">מס' רישיון קבלן שירות: 3570 | מס' קבלן כח אדם: 1021</p>
            </div>
          </div>
          
          <!-- Signature Area with actual signature -->
          <div style="background: linear-gradient(135deg, #f0fdf4 0%, #ecfdf5 100%); padding: 25px; border-radius: 12px; border: 2px solid #16a34a;">
            <div style="display: flex; justify-content: space-between; align-items: center;">
              <div>
                <p style="font-size: 14px; color: #16a34a; font-weight: 700; margin: 0 0 10px 0;">חתימת הלקוח:</p>
                <img src="${proposal.signature_url}" style="max-height: 60px; max-width: 180px; background: white; padding: 8px; border-radius: 6px; border: 1px solid #d1d5db;" crossorigin="anonymous" />
              </div>
              <div style="text-align: center;">
                <div style="background: #16a34a; color: white; padding: 10px 20px; border-radius: 6px; font-weight: 700;">
                  ✓ הצעה חתומה ומאושרת
                </div>
              </div>
            </div>
          </div>
        </div>
      `;
      
      document.body.appendChild(container);
      
      const canvas = await html2canvas(container, {
        scale: 3,
        useCORS: true,
        logging: false,
        backgroundColor: '#ffffff',
        windowWidth: 794,
        windowHeight: 1123
      });
      
      document.body.removeChild(container);
      
      const imgData = canvas.toDataURL('image/png', 1.0);
      const pdf = new jsPDF('p', 'mm', 'a4');
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = pdf.internal.pageSize.getHeight();
      const imgWidth = canvas.width;
      const imgHeight = canvas.height;
      const ratio = Math.min(pdfWidth / imgWidth, pdfHeight / imgHeight);
      const imgX = (pdfWidth - imgWidth * ratio) / 2;
      const imgY = 0;
      
      pdf.addImage(imgData, 'PNG', imgX, imgY, imgWidth * ratio, imgHeight * ratio);
      pdf.save(`הצעה-חתומה-${proposal.proposal_number}.pdf`);
      
      toast.success('ה-PDF החתום הורד בהצלחה');
    } catch (error) {
      console.error('Error generating signed PDF:', error);
      toast.error('שגיאה ביצירת ה-PDF החתום');
    } finally {
      setDownloadingPdf(null);
    }
  };

  const downloadPdf = async (proposal: Proposal) => {
    setDownloadingPdf(proposal.id);
    try {
      // Fetch services for this proposal
      const { data: services } = await supabase
        .from('proposal_services')
        .select('*')
        .eq('proposal_id', proposal.id)
        .order('sort_order');

      const displayServices: Array<{id: string; service_description: string; frequency: string | null; price: number; sort_order: number}> = services && services.length > 0 
        ? services 
        : [{
            id: 'fallback',
            service_description: proposal.service_type,
            frequency: (proposal as any).frequency || null,
            price: proposal.price,
            sort_order: 0
          }];

      const totalPrice = displayServices.reduce((sum, s) => sum + Number(s.price), 0);

      const getMaterialsText = (materials: string) => {
        switch (materials) {
          case 'basic': return 'כולל חומרי ניקיון בסיסיים בלבד';
          case 'toiletries': return 'כולל חומרים ומוצרי טואלטיקה';
          case 'none': return 'ללא חומרים כלל';
          case 'not_relevant': return null;
          default: return materials;
        }
      };

      const materialsText = getMaterialsText(proposal.materials);

      // Create a professional PDF container
      const container = document.createElement('div');
      container.style.cssText = 'position: absolute; left: -9999px; top: 0; width: 794px; background: white; font-family: "Segoe UI", Tahoma, Arial, sans-serif;';
      container.dir = 'rtl';
      
      container.innerHTML = `
        <div style="padding: 40px; font-size: 14px; line-height: 1.8; color: #1a1a1a;">
          <!-- Header with Logo -->
          <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 30px; border-bottom: 3px solid #16a34a; padding-bottom: 20px;">
            <div style="text-align: right;">
              <h1 style="font-size: 32px; color: #16a34a; margin: 0 0 5px 0; font-weight: 700;">הצעת מחיר</h1>
              <p style="font-size: 13px; color: #666; margin: 0;">מספר: ${escapeHtml(proposal.proposal_number)}</p>
              <p style="font-size: 13px; color: #666; margin: 0;">תאריך: ${format(new Date(proposal.created_at), 'dd/MM/yyyy', { locale: he })}</p>
            </div>
            <div style="text-align: left;">
              <div style="background: linear-gradient(135deg, #16a34a 0%, #22c55e 100%); color: white; padding: 15px 25px; border-radius: 8px;">
                <span style="font-size: 28px; font-weight: 700;">ירוק</span>
              </div>
            </div>
          </div>
          
          <!-- Company Info -->
          <div style="background: #f8faf8; padding: 20px; border-radius: 8px; margin-bottom: 25px; border-right: 4px solid #16a34a;">
            <p style="font-weight: 700; font-size: 16px; margin: 0 0 8px 0; color: #16a34a;">ירוק שירותי אחזקה ניקיון וכח אדם בע"מ</p>
            <p style="margin: 3px 0; color: #444;">ח.פ: 514854116</p>
            <p style="margin: 3px 0; color: #444;">ברוך הירש 14, בני ברק</p>
            <p style="margin: 3px 0; color: #444;">טלפון: 077-5523053 | פקס: 077-6623053</p>
            <p style="margin: 3px 0; color: #444;">דוא"ל: office@yaroknet.co.il</p>
          </div>
          
          <!-- Client Info -->
          <div style="background: #fff; padding: 20px; border: 2px solid #e5e7eb; border-radius: 8px; margin-bottom: 25px;">
            <h2 style="font-size: 14px; color: #666; margin: 0 0 10px 0; font-weight: 600;">לכבוד</h2>
            <p style="font-weight: 700; font-size: 18px; margin: 0; color: #1a1a1a;">${escapeHtml(proposal.client_name)}</p>
            ${proposal.company_id ? `<p style="margin: 5px 0 0 0; color: #666;">ח.פ: ${escapeHtml(proposal.company_id)}</p>` : ''}
          </div>
          
          <p style="margin-bottom: 25px; color: #444; font-size: 14px;">בהמשך לשיחתנו ולאחר קבלת כל הפרטים הנדרשים, אנו מתכבדים להגיש את הצעתנו למתן שירותים וזאת על פי המפרט והנתונים אשר הובאו לידיעתנו.</p>
          
          <!-- Services Table -->
          <table style="width: 100%; border-collapse: collapse; margin-bottom: 25px; box-shadow: 0 2px 8px rgba(0,0,0,0.08); border-radius: 8px; overflow: hidden;">
            <thead>
              <tr style="background: linear-gradient(135deg, #16a34a 0%, #22c55e 100%);">
                <th style="padding: 14px 16px; text-align: right; color: white; font-weight: 600; font-size: 14px;">תיאור השירות</th>
                <th style="padding: 14px 16px; text-align: center; color: white; font-weight: 600; font-size: 14px;">תדירות השירות</th>
                <th style="padding: 14px 16px; text-align: center; color: white; font-weight: 600; font-size: 14px;">סכום לפני מע"מ</th>
              </tr>
            </thead>
            <tbody>
              ${displayServices.map((s, idx) => `
                <tr style="background: ${idx % 2 === 0 ? '#ffffff' : '#f9fafb'};">
                  <td style="padding: 14px 16px; border-bottom: 1px solid #e5e7eb; font-size: 14px;">${escapeHtml(s.service_description)}</td>
                  <td style="padding: 14px 16px; border-bottom: 1px solid #e5e7eb; text-align: center; font-size: 14px;">${escapeHtml(s.frequency) || '-'}</td>
                  <td style="padding: 14px 16px; border-bottom: 1px solid #e5e7eb; text-align: center; font-size: 14px; font-weight: 600;">₪${Number(s.price).toLocaleString()}</td>
                </tr>
              `).join('')}
              <tr style="background: #16a34a;">
                <td colspan="2" style="padding: 14px 16px; text-align: left; font-weight: 700; color: white; font-size: 15px;">סה"כ לתשלום:</td>
                <td style="padding: 14px 16px; text-align: center; font-weight: 700; color: white; font-size: 18px;">₪${totalPrice.toLocaleString()}</td>
              </tr>
            </tbody>
          </table>
          
          ${materialsText ? `<div style="background: #ecfdf5; padding: 12px 16px; border-radius: 6px; margin-bottom: 20px; border-right: 3px solid #16a34a;"><span style="color: #16a34a; font-weight: 600;">✓</span> ${materialsText}</div>` : ''}
          
          ${proposal.notes ? `<div style="background: #fefce8; padding: 16px; margin-bottom: 20px; border-radius: 8px; border-right: 4px solid #eab308;"><p style="font-weight: 600; margin: 0 0 8px 0; color: #854d0e;">הערות:</p><p style="margin: 0; color: #713f12;">${escapeHtml(proposal.notes)}</p></div>` : ''}
          
          <!-- Terms & Conditions -->
          <div style="background: #f8fafc; padding: 20px; border-radius: 8px; margin-bottom: 25px;">
            <h3 style="font-size: 14px; color: #16a34a; margin: 0 0 12px 0; font-weight: 700;">תנאים והתחייבויות</h3>
            <div style="font-size: 11px; color: #475569; line-height: 1.7;">
              <p style="margin: 4px 0;">• עבור שעות נוספות ושעות שבת יחולו תוספות עפ"י חוק</p>
              <p style="margin: 4px 0;">• לחברת ירוק שירותי אחזקה, ניקיון וכ"א בע"מ קיים הניסיון והידע לאספקת שירותי ניקיון</p>
              <p style="margin: 4px 0;">• לחברתנו כל הביטוחים הנדרשים על פי חוק לרבות צד ג', אחריות מקצועית וחבות מעבידים</p>
              <p style="margin: 4px 0;">• שכר העובד לא יפחת משכר המינימום והחברה מתחייבת לשלם את כל התנאים הסוציאליים עפ"י חוק</p>
              <p style="margin: 4px 0;">• החיוב צמוד לשכר המינימום במשק בישראל</p>
              <p style="margin: 4px 0;">• תנאי תשלום: <strong>${escapeHtml(proposal.payment_terms)}</strong></p>
              <p style="margin: 8px 0 0 0; font-weight: 600; color: #16a34a;">מס' רישיון קבלן שירות: 3570 | מס' קבלן כח אדם: 1021</p>
            </div>
          </div>
          
          <!-- Footer -->
          <div style="text-align: center; padding: 20px; background: linear-gradient(135deg, #f0fdf4 0%, #ecfdf5 100%); border-radius: 8px; margin-bottom: 30px;">
            <p style="font-size: 16px; font-weight: 700; color: #16a34a; margin: 0;">כאן לשירותך וזמינים לשאלות ובירורים</p>
            <p style="font-size: 13px; color: #666; margin: 8px 0 0 0;">077-5523053 | office@yaroknet.co.il</p>
          </div>
          
          <!-- Signature Area -->
          <div style="display: flex; justify-content: space-between; align-items: flex-end; padding-top: 20px; border-top: 2px dashed #d1d5db;">
            <div style="flex: 1;">
              <p style="font-size: 12px; color: #666; margin: 0 0 8px 0;">חתימת הלקוח:</p>
              <div style="border-bottom: 2px solid #1a1a1a; width: 200px; height: 40px;"></div>
            </div>
            <div style="flex: 1; text-align: left;">
              <p style="font-size: 12px; color: #666; margin: 0 0 8px 0;">תאריך:</p>
              <div style="border-bottom: 2px solid #1a1a1a; width: 120px; height: 40px;"></div>
            </div>
          </div>
        </div>
      `;
      
      document.body.appendChild(container);
      
      const canvas = await html2canvas(container, {
        scale: 3,
        useCORS: true,
        logging: false,
        backgroundColor: '#ffffff',
        windowWidth: 794,
        windowHeight: 1123
      });
      
      document.body.removeChild(container);
      
      const imgData = canvas.toDataURL('image/png', 1.0);
      const pdf = new jsPDF('p', 'mm', 'a4');
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = pdf.internal.pageSize.getHeight();
      const imgWidth = canvas.width;
      const imgHeight = canvas.height;
      const ratio = Math.min(pdfWidth / imgWidth, pdfHeight / imgHeight);
      const imgX = (pdfWidth - imgWidth * ratio) / 2;
      const imgY = 0;
      
      pdf.addImage(imgData, 'PNG', imgX, imgY, imgWidth * ratio, imgHeight * ratio);
      pdf.save(`הצעה-${proposal.proposal_number}.pdf`);
      
      toast.success('ה-PDF הורד בהצלחה');
    } catch (error) {
      console.error('Error generating PDF:', error);
      toast.error('שגיאה ביצירת ה-PDF');
    } finally {
      setDownloadingPdf(null);
    }
  };

  if (loading) {
    return (
      <div className="p-6 lg:p-8">
        <div className="flex items-center justify-center min-h-[60vh]">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 lg:p-8 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">הצעות מחיר</h1>
          <p className="text-muted-foreground">יצירה וניהול הצעות מחיר ללקוחות</p>
        </div>
        <Button onClick={() => setCreateDialogOpen(true)}>
          <Plus className="h-4 w-4 ml-2" />
          הצעה חדשה
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <FileText className="h-5 w-5 text-muted-foreground" />
              <div>
                <p className="text-2xl font-bold">{stats.total}</p>
                <p className="text-xs text-muted-foreground">סה"כ הצעות</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <Clock className="h-5 w-5 text-muted-foreground" />
              <div>
                <p className="text-2xl font-bold">{stats.draft}</p>
                <p className="text-xs text-muted-foreground">טיוטות</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <Send className="h-5 w-5 text-amber-500" />
              <div>
                <p className="text-2xl font-bold text-amber-500">{stats.sent}</p>
                <p className="text-xs text-muted-foreground">נשלחו</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <CheckCircle className="h-5 w-5 text-emerald-500" />
              <div>
                <p className="text-2xl font-bold text-emerald-500">{stats.signed}</p>
                <p className="text-xs text-muted-foreground">נחתמו</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <DollarSign className="h-5 w-5 text-primary" />
              <div>
                <p className="text-2xl font-bold">₪{stats.totalValue.toLocaleString()}</p>
                <p className="text-xs text-muted-foreground">סה"כ שווי</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card className="border-emerald-500/50">
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-emerald-500" />
              <div>
                <p className="text-2xl font-bold text-emerald-500">₪{stats.signedValue.toLocaleString()}</p>
                <p className="text-xs text-muted-foreground">עסקאות סגורות</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Search */}
      <Card>
        <CardContent className="p-4">
          <div className="relative">
            <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="חיפוש חופשי: לקוח, שירות, איש קשר, טלפון, מחיר, הערות..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pr-10"
            />
          </div>
        </CardContent>
      </Card>

      {/* Table */}
      <Card>
        <CardHeader>
          <CardTitle>רשימת הצעות ({filteredProposals.length})</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>מס' הצעה</TableHead>
                  <TableHead>תאריך</TableHead>
                  <TableHead>לקוח</TableHead>
                  <TableHead>שירות</TableHead>
                  <TableHead>מחיר</TableHead>
                  <TableHead>סטטוס</TableHead>
                  <TableHead>פעולות</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredProposals.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                      לא נמצאו הצעות
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredProposals.map((proposal) => (
                    <TableRow key={proposal.id}>
                      <TableCell className="font-mono">{proposal.proposal_number}</TableCell>
                      <TableCell>
                        {format(new Date(proposal.created_at), 'dd/MM/yyyy', { locale: he })}
                      </TableCell>
                      <TableCell>
                        <div>
                          <span className="font-medium">{proposal.client_name}</span>
                          <br />
                          <span className="text-xs text-muted-foreground">{proposal.contact_person}</span>
                        </div>
                      </TableCell>
                      <TableCell>{proposal.service_type}</TableCell>
                      <TableCell className="font-medium">₪{Number(proposal.price).toLocaleString()}</TableCell>
                      <TableCell>{getStatusBadge(proposal.status)}</TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          <Button variant="ghost" size="icon" onClick={() => handleView(proposal)} title="צפה">
                            <Eye className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="icon" onClick={() => handleEdit(proposal)} title="ערוך">
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            onClick={() => downloadPdf(proposal)} 
                            title="הורד PDF"
                            disabled={downloadingPdf === proposal.id}
                          >
                            <Download className={`h-4 w-4 ${downloadingPdf === proposal.id ? 'animate-pulse' : ''}`} />
                          </Button>
                          {proposal.status === 'signed' && proposal.signature_url && (
                            <>
                              <Button 
                                variant="ghost" 
                                size="icon" 
                                onClick={() => viewSignature(proposal.signature_url!)} 
                                title="צפה בחתימה"
                                className="text-emerald-600"
                              >
                                <FileSignature className="h-4 w-4" />
                              </Button>
                              <Button 
                                variant="ghost" 
                                size="icon" 
                                onClick={() => downloadSignedPdf(proposal)} 
                                title="הורד הצעה חתומה"
                                disabled={downloadingPdf === proposal.id}
                                className="text-emerald-600"
                              >
                                <ExternalLink className={`h-4 w-4 ${downloadingPdf === proposal.id ? 'animate-pulse' : ''}`} />
                              </Button>
                            </>
                          )}
                          <Button variant="ghost" size="icon" onClick={() => copyLink(proposal.id)} title="העתק לינק">
                            <Copy className="h-4 w-4" />
                          </Button>
                          {proposal.status === 'draft' && (
                            <Button variant="ghost" size="icon" onClick={() => markAsSent(proposal.id)} title="סמן כנשלח">
                              <Send className="h-4 w-4" />
                            </Button>
                          )}
                          <Button variant="ghost" size="icon" onClick={() => handleDelete(proposal)} title="מחק" className="text-destructive">
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Dialogs */}
      <CreateProposalDialog
        open={createDialogOpen}
        onOpenChange={setCreateDialogOpen}
        onSuccess={fetchProposals}
      />

      {selectedProposal && (
        <>
          <ViewProposalDialog
            open={viewDialogOpen}
            onOpenChange={setViewDialogOpen}
            proposal={selectedProposal}
          />
          <EditProposalDialog
            open={editDialogOpen}
            onOpenChange={setEditDialogOpen}
            proposal={selectedProposal}
            onSuccess={fetchProposals}
          />
          <DeleteProposalDialog
            open={deleteDialogOpen}
            onOpenChange={setDeleteDialogOpen}
            proposal={selectedProposal}
            onSuccess={fetchProposals}
          />
        </>
      )}
    </div>
  );
}