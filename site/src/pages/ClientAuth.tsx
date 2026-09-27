import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { Loader2, Building2, Eye, EyeOff, ArrowRight } from "lucide-react";
import { Link } from "react-router-dom";
import yarokLogo from "@/assets/yarok-logo.png";

// Convert phone to email format for Supabase Auth
const phoneToEmail = (phone: string): string => {
  const cleanPhone = phone.replace(/\D/g, '');
  return `${cleanPhone}@phone.local`;
};

const ClientAuth = () => {
  const navigate = useNavigate();
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!phone || !password) {
      toast.error("יש למלא את כל השדות");
      return;
    }

    setIsLoading(true);

    try {
      const email = phoneToEmail(phone);
      
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        console.error("Login error:", error);
        toast.error("שם משתמש או סיסמה שגויים");
        return;
      }

      if (data.user) {
        // Check if user has client role
        const { data: roles, error: rolesError } = await supabase
          .from("user_roles")
          .select("role")
          .eq("user_id", data.user.id);

        if (rolesError) {
          console.error("Error checking roles:", rolesError);
          await supabase.auth.signOut();
          toast.error("שגיאה בבדיקת הרשאות");
          return;
        }

        const isClient = roles?.some((r) => r.role === "client");

        if (!isClient) {
          await supabase.auth.signOut();
          toast.error("אין לך הרשאה לאזור הלקוחות");
          return;
        }

        toast.success("ברוך הבא לאזור הלקוחות!");
        navigate("/client-portal");
      }
    } catch (error) {
      console.error("Login error:", error);
      toast.error("שגיאה בהתחברות, נסה שוב");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary/5 via-background to-secondary/30 p-4" dir="rtl">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <Link to="/">
            <img src={yarokLogo} alt="ירוק" className="h-16 mx-auto mb-4" />
          </Link>
          <h1 className="text-2xl font-bold text-foreground">אזור לקוחות</h1>
          <p className="text-muted-foreground">התחבר לאזור האישי שלך</p>
        </div>

        <Card className="border-border/50 shadow-lg">
          <CardHeader className="text-center">
            <div className="mx-auto w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mb-4">
              <Building2 className="h-8 w-8 text-primary" />
            </div>
            <CardTitle>כניסה לאזור לקוחות</CardTitle>
            <CardDescription>
              הזן את פרטי ההתחברות שקיבלת מנציג החברה
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleLogin} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="phone">מספר טלפון</Label>
                <Input
                  id="phone"
                  type="tel"
                  placeholder="05XXXXXXXX"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value.replace(/\D/g, '').slice(0, 10))}
                  dir="ltr"
                  className="text-left"
                  disabled={isLoading}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="password">סיסמה</Label>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    placeholder="הזן סיסמה"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    dir="ltr"
                    className="text-left pl-12"
                    disabled={isLoading}
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="absolute left-1 top-1/2 -translate-y-1/2"
                    onClick={() => setShowPassword(!showPassword)}
                    disabled={isLoading}
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </Button>
                </div>
              </div>

              <Button type="submit" className="w-full" disabled={isLoading}>
                {isLoading ? (
                  <>
                    <Loader2 className="ml-2 h-4 w-4 animate-spin" />
                    מתחבר...
                  </>
                ) : (
                  "התחבר"
                )}
              </Button>
            </form>

            <div className="mt-6 text-center">
              <Link
                to="/"
                className="text-sm text-muted-foreground hover:text-primary transition-colors inline-flex items-center gap-1"
              >
                <ArrowRight className="h-4 w-4" />
                חזרה לעמוד הראשי
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default ClientAuth;
