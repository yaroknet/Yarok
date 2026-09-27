import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, Eye, EyeOff, Phone, ArrowRight } from 'lucide-react';
import { z } from 'zod';
import { toast } from 'sonner';
import yarokLogo from '@/assets/yarok-logo.png';

// Israeli phone number validation
const phoneSchema = z.object({
  phone: z.string()
    .min(1, 'יש להזין מספר טלפון')
    .regex(/^05\d{8}$/, 'מספר טלפון לא תקין (נדרש פורמט 05XXXXXXXX)'),
  password: z.string().min(6, 'סיסמה חייבת להכיל לפחות 6 תווים'),
});

// Convert phone to email format for Supabase Auth
const phoneToEmail = (phone: string): string => {
  return `${phone}@phone.local`;
};

const Auth = () => {
  const navigate = useNavigate();
  const { user, signIn, isLoading: authLoading } = useAuth();
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (user) {
      navigate('/portal');
    }
  }, [user, navigate]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});
    
    const result = phoneSchema.safeParse({ phone, password });
    if (!result.success) {
      const formErrors: Record<string, string> = {};
      result.error.errors.forEach((err) => {
        if (err.path[0]) {
          formErrors[err.path[0].toString()] = err.message;
        }
      });
      setErrors(formErrors);
      return;
    }

    setIsLoading(true);
    
    try {
      // Convert phone to email format
      const email = phoneToEmail(phone);
      
      const { error } = await signIn(email, password);
      setIsLoading(false);
      
      if (!error) {
        navigate('/portal');
      }
    } catch (error) {
      console.error('Login error:', error);
      toast.error('שגיאה בהתחברות');
      setIsLoading(false);
    }
  };

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-10 w-10 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen min-h-[100dvh] flex flex-col items-center justify-center bg-background p-4 sm:p-6">
      {/* Back to home link */}
      <Link to="/" className="mb-6 flex items-center gap-2 text-muted-foreground hover:text-primary transition-colors">
        <ArrowRight className="h-4 w-4" />
        חזרה לדף הבית
      </Link>
      
      <div className="w-full max-w-lg">
        {/* Logo and Company Name */}
        <div className="flex flex-col items-center justify-center gap-4 mb-6 sm:mb-10">
          <img 
            src={yarokLogo} 
            alt="לוגו קבוצת ירוק" 
            className="w-32 h-32 sm:w-40 sm:h-40 object-contain"
          />
          <div className="text-center">
            <h1 className="font-bold text-xl sm:text-2xl text-foreground leading-tight">
              ירוק - שירותי אחזקה ניקיון וכח אדם בע"מ
            </h1>
          </div>
        </div>

        <Card className="border-2 border-border shadow-xl">
          <CardHeader className="text-center pb-4 sm:pb-6 px-4 sm:px-6">
            <CardTitle className="text-2xl sm:text-3xl">התחברות למערכת</CardTitle>
            <CardDescription className="text-base sm:text-lg">הזן את מספר הטלפון והסיסמה שלך</CardDescription>
          </CardHeader>
          <CardContent className="px-4 sm:px-6">
            <form onSubmit={handleLogin} className="space-y-4 sm:space-y-6">
              <div className="space-y-2 sm:space-y-3">
                <Label htmlFor="phone" className="text-base sm:text-sm flex items-center gap-2">
                  <Phone className="h-4 w-4" />
                  מספר טלפון
                </Label>
                <Input
                  id="phone"
                  type="tel"
                  inputMode="tel"
                  autoComplete="tel"
                  placeholder="05XXXXXXXX"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value.replace(/\D/g, '').slice(0, 10))}
                  className="text-left h-12 sm:h-10 text-base text-xl tracking-wider"
                  dir="ltr"
                  aria-describedby={errors.phone ? "phone-error" : undefined}
                  aria-invalid={!!errors.phone}
                />
                {errors.phone && (
                  <p id="phone-error" className="text-sm sm:text-base text-destructive font-medium" role="alert">
                    {errors.phone}
                  </p>
                )}
              </div>
              
              <div className="space-y-2 sm:space-y-3">
                <Label htmlFor="password" className="text-base sm:text-sm">סיסמה</Label>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    inputMode="text"
                    autoComplete="current-password"
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="text-left pl-14 h-12 sm:h-10 text-base"
                    dir="ltr"
                    aria-describedby={errors.password ? "password-error" : undefined}
                    aria-invalid={!!errors.password}
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="absolute left-2 top-1/2 -translate-y-1/2 h-10 w-10 touch-manipulation"
                    onClick={() => setShowPassword(!showPassword)}
                    aria-label={showPassword ? 'הסתר סיסמה' : 'הצג סיסמה'}
                  >
                    {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                  </Button>
                </div>
                {errors.password && (
                  <p id="password-error" className="text-sm sm:text-base text-destructive font-medium" role="alert">
                    {errors.password}
                  </p>
                )}
              </div>
              
              <Button 
                type="submit" 
                className="w-full text-lg sm:text-xl py-6 sm:py-7 touch-manipulation" 
                size="lg" 
                disabled={isLoading}
              >
                {isLoading ? (
                  <>
                    <Loader2 className="ml-3 h-5 w-5 sm:h-6 sm:w-6 animate-spin" />
                    מתחבר...
                  </>
                ) : (
                  'התחבר למערכת'
                )}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Auth;
