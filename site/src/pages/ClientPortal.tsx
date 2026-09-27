import { useEffect, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, LogOut, Building2, FileText, Receipt, ExternalLink, Eye, CheckCircle, Clock, AlertCircle, ClipboardList } from "lucide-react";
import { toast } from "sonner";
import yarokLogo from "@/assets/yarok-logo.png";
import { format } from "date-fns";
import { he } from "date-fns/locale";
import SatisfactionSurveyForm from "@/components/client-portal/SatisfactionSurveyForm";

interface Proposal {
  id: string;
  proposal_number: string;
  client_name: string;
  price: number;
  status: string;
  created_at: string;
  signed_at: string | null;
}

interface Invoice {
  id: string;
  invoice_number: string;
  invoice_date: string;
  amount: number;
  description: string | null;
  file_url: string | null;
  status: string;
}

const statusLabels: Record<string, string> = {
  draft: 'טיוטה',
  sent: 'נשלח',
  signed: 'נחתם',
  pending: 'ממתין',
  unpaid: 'לא שולם',
  paid: 'שולם',
  cancelled: 'בוטל'
};

const statusColors: Record<string, string> = {
  draft: 'bg-muted text-muted-foreground',
  sent: 'bg-blue-100 text-blue-800',
  signed: 'bg-green-100 text-green-800',
  pending: 'bg-yellow-100 text-yellow-800',
  unpaid: 'bg-red-100 text-red-800',
  paid: 'bg-green-100 text-green-800',
  cancelled: 'bg-muted text-muted-foreground'
};

const ClientPortal = () => {
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);
  const [profile, setProfile] = useState<{ full_name: string } | null>(null);
  const [proposals, setProposals] = useState<Proposal[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [activeTab, setActiveTab] = useState<'proposals' | 'invoices' | 'survey'>('proposals');
  const [pendingSurveysCount, setPendingSurveysCount] = useState(0);

  useEffect(() => {
    const checkAuth = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        navigate("/client-auth");
        return;
      }

      setUserId(session.user.id);

      // Check if user has client role
      const { data: roles, error: rolesError } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", session.user.id);

      if (rolesError || !roles?.some((r) => r.role === "client")) {
        await supabase.auth.signOut();
        navigate("/client-auth");
        toast.error("אין לך הרשאה לאזור הלקוחות");
        return;
      }

      // Get profile
      const { data: profileData } = await supabase
        .from("profiles")
        .select("full_name")
        .eq("user_id", session.user.id)
        .single();

      setProfile(profileData);

      // Fetch proposals for this client
      const { data: proposalsData } = await supabase
        .from("proposals")
        .select("id, proposal_number, client_name, price, status, created_at, signed_at")
        .eq("client_user_id", session.user.id)
        .order("created_at", { ascending: false });

      if (proposalsData) {
        setProposals(proposalsData);
      }

      // Fetch invoices for this client
      const { data: invoicesData } = await supabase
        .from("client_invoices")
        .select("*")
        .eq("client_user_id", session.user.id)
        .order("invoice_date", { ascending: false });

      if (invoicesData) {
        setInvoices(invoicesData);
      }

      // Check for pending surveys
      const { count: surveyCount } = await supabase
        .from("satisfaction_surveys")
        .select("*", { count: "exact", head: true })
        .eq("client_user_id", session.user.id)
        .eq("status", "pending");

      setPendingSurveysCount(surveyCount || 0);

      setIsLoading(false);
    };

    checkAuth();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_OUT") {
        navigate("/client-auth");
      }
    });

    return () => subscription.unsubscribe();
  }, [navigate]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    toast.success("התנתקת בהצלחה");
    navigate("/");
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'signed':
      case 'paid':
        return <CheckCircle className="h-4 w-4" />;
      case 'sent':
      case 'pending':
        return <Clock className="h-4 w-4" />;
      case 'unpaid':
        return <AlertCircle className="h-4 w-4" />;
      default:
        return null;
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/5 via-background to-secondary/30" dir="rtl">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-card/95 backdrop-blur-md border-b border-border/50 shadow-sm">
        <div className="container mx-auto px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <img src={yarokLogo} alt="ירוק לוגו" className="h-10 w-auto" />
              <div>
                <h1 className="text-lg font-bold text-primary leading-tight">אזור לקוחות</h1>
                <p className="text-xs text-muted-foreground">שלום, {profile?.full_name}</p>
              </div>
            </div>

            <Button variant="outline" onClick={handleLogout} className="gap-2">
              <LogOut className="h-4 w-4" />
              התנתק
            </Button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-8">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-8">
            <div className="mx-auto w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center mb-4">
              <Building2 className="h-10 w-10 text-primary" />
            </div>
            <h2 className="text-2xl font-bold text-foreground mb-2">ברוך הבא לאזור הלקוחות</h2>
            <p className="text-muted-foreground">
              צפה בהצעות מחיר וחשבוניות
            </p>
          </div>

          {/* Tab Buttons */}
          <div className="flex gap-4 justify-center mb-8 flex-wrap">
            <Button
              variant={activeTab === 'survey' ? 'default' : 'outline'}
              onClick={() => setActiveTab('survey')}
              className="gap-2 min-w-[140px] relative"
            >
              <ClipboardList className="h-5 w-5" />
              סקר שביעות רצון
              {pendingSurveysCount > 0 && (
                <Badge variant="destructive" className="absolute -top-2 -right-2 h-5 min-w-5 text-xs">
                  {pendingSurveysCount}
                </Badge>
              )}
            </Button>
            <Button
              variant={activeTab === 'proposals' ? 'default' : 'outline'}
              onClick={() => setActiveTab('proposals')}
              className="gap-2 min-w-[140px]"
            >
              <FileText className="h-5 w-5" />
              הצעות מחיר
              {proposals.length > 0 && (
                <Badge variant="secondary" className="mr-1">{proposals.length}</Badge>
              )}
            </Button>
            <Button
              variant={activeTab === 'invoices' ? 'default' : 'outline'}
              onClick={() => setActiveTab('invoices')}
              className="gap-2 min-w-[140px]"
            >
              <Receipt className="h-5 w-5" />
              חשבוניות
              {invoices.length > 0 && (
                <Badge variant="secondary" className="mr-1">{invoices.length}</Badge>
              )}
            </Button>
          </div>

          {/* Survey Tab */}
          {activeTab === 'survey' && userId && (
            <SatisfactionSurveyForm userId={userId} />
          )}

          {/* Proposals Tab */}
          {activeTab === 'proposals' && (
            <div className="space-y-4">
              {proposals.length === 0 ? (
                <Card className="text-center py-12">
                  <CardContent>
                    <FileText className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                    <p className="text-muted-foreground">אין הצעות מחיר להצגה</p>
                  </CardContent>
                </Card>
              ) : (
                proposals.map((proposal) => (
                  <Card key={proposal.id} className="hover:shadow-lg transition-shadow">
                    <CardHeader className="flex flex-row items-center justify-between pb-2">
                      <div>
                        <CardTitle className="text-lg">הצעה #{proposal.proposal_number}</CardTitle>
                        <CardDescription>
                          {format(new Date(proposal.created_at), "dd/MM/yyyy", { locale: he })}
                        </CardDescription>
                      </div>
                      <Badge className={statusColors[proposal.status] || 'bg-muted'}>
                        {getStatusIcon(proposal.status)}
                        <span className="mr-1">{statusLabels[proposal.status] || proposal.status}</span>
                      </Badge>
                    </CardHeader>
                    <CardContent>
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm text-muted-foreground">סכום:</p>
                          <p className="text-xl font-bold">₪{proposal.price.toLocaleString()}</p>
                        </div>
                        <div className="flex gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            asChild
                          >
                            <Link to={`/proposal/${proposal.id}`} target="_blank">
                              <Eye className="h-4 w-4 ml-1" />
                              צפייה
                            </Link>
                          </Button>
                          {proposal.status !== 'signed' && (
                            <Button
                              size="sm"
                              asChild
                            >
                              <Link to={`/proposal/${proposal.id}`} target="_blank">
                                <ExternalLink className="h-4 w-4 ml-1" />
                                חתימה
                              </Link>
                            </Button>
                          )}
                        </div>
                      </div>
                      {proposal.signed_at && (
                        <p className="text-xs text-muted-foreground mt-2">
                          נחתם ב-{format(new Date(proposal.signed_at), "dd/MM/yyyy HH:mm", { locale: he })}
                        </p>
                      )}
                    </CardContent>
                  </Card>
                ))
              )}
            </div>
          )}

          {/* Invoices Tab */}
          {activeTab === 'invoices' && (
            <div className="space-y-4">
              {invoices.length === 0 ? (
                <Card className="text-center py-12">
                  <CardContent>
                    <Receipt className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                    <p className="text-muted-foreground">אין חשבוניות להצגה</p>
                  </CardContent>
                </Card>
              ) : (
                invoices.map((invoice) => (
                  <Card key={invoice.id} className="hover:shadow-lg transition-shadow">
                    <CardHeader className="flex flex-row items-center justify-between pb-2">
                      <div>
                        <CardTitle className="text-lg">חשבונית #{invoice.invoice_number}</CardTitle>
                        <CardDescription>
                          {format(new Date(invoice.invoice_date), "dd/MM/yyyy", { locale: he })}
                        </CardDescription>
                      </div>
                      <Badge className={statusColors[invoice.status] || 'bg-muted'}>
                        {getStatusIcon(invoice.status)}
                        <span className="mr-1">{statusLabels[invoice.status] || invoice.status}</span>
                      </Badge>
                    </CardHeader>
                    <CardContent>
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm text-muted-foreground">סכום:</p>
                          <p className="text-xl font-bold">₪{invoice.amount.toLocaleString()}</p>
                          {invoice.description && (
                            <p className="text-sm text-muted-foreground mt-1">{invoice.description}</p>
                          )}
                        </div>
                        {invoice.file_url && (
                          <Button
                            variant="outline"
                            size="sm"
                            asChild
                          >
                            <a href={invoice.file_url} target="_blank" rel="noopener noreferrer">
                              <ExternalLink className="h-4 w-4 ml-1" />
                              הורדה
                            </a>
                          </Button>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                ))
              )}
            </div>
          )}
        </div>
      </main>

      {/* Footer */}
      <footer className="py-6 mt-auto border-t border-border/50">
        <div className="container mx-auto px-4 text-center text-sm text-muted-foreground">
          © {new Date().getFullYear()} ירוק אחזקה, ניקיון ושירותי כוח אדם בע"מ. כל הזכויות שמורות.
        </div>
      </footer>
    </div>
  );
};

export default ClientPortal;