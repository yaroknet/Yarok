import { useEffect, useState } from "react";
import { Button } from "@/employees/components/ui/button";
import { Input } from "@/employees/components/ui/input";
import { Label } from "@/employees/components/ui/label";
import { Card, CardContent, CardHeader } from "@/employees/components/ui/card";
import { useAuth } from "@/employees/contexts/AuthContext";
import { useToast } from "@/employees/hooks/use-toast";

export default function LoginPage() {
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const { signIn, user, loading } = useAuth();
  const { toast } = useToast();

  // Everyone continues to the portal hub, where Yarok 360 is one of the modules
  useEffect(() => {
    if (!loading && user) window.location.replace("/portal");
  }, [loading, user]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    const { error } = await signIn(identifier, password);

    if (error) {
      toast({
        title: "שגיאת התחברות",
        description: "אימייל או סיסמה שגויים",
        variant: "destructive",
      });
      setIsLoading(false);
      return;
    }

    setIsLoading(false);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4" dir="rtl">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="w-16 h-16 rounded-2xl gradient-hero mx-auto mb-4 flex items-center justify-center shadow-elevated">
            <span className="text-primary-foreground font-bold text-2xl">Y</span>
          </div>
          <h1 className="text-2xl font-bold text-foreground">Yarok 360</h1>
          <p className="text-muted-foreground text-sm mt-1">ניהול תפעול ושטח</p>
        </div>

        <Card className="shadow-elevated">
          <CardHeader className="pb-4">
            <h2 className="text-lg font-semibold text-foreground text-center">התחברות</h2>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleLogin} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="identifier">אימייל או מספר טלפון</Label>
                <Input
                  id="identifier"
                  type="text"
                  placeholder="your@email.com / 050-1234567"
                  value={identifier}
                  onChange={(e) => setIdentifier(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">סיסמה</Label>
                <Input
                  id="password"
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
              </div>
              <Button
                type="submit"
                className="w-full gradient-primary text-primary-foreground"
                disabled={isLoading}
              >
                {isLoading ? "מתחבר..." : "התחברות"}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
