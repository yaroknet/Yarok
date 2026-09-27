import { useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';

const Index = () => {
  const navigate = useNavigate();

  const handleEnterApp = () => {
    navigate('/dashboard');
  };

  return (
    <div className="min-h-screen bg-background/40 flex flex-col items-center justify-center p-6">
      {/* Logo and Title */}
      <div className="flex flex-col items-center gap-8 mb-12">
        <img 
          src="/assets/yarok-logo.png" 
          alt="ירוק שירותי אחזקה ניקיון וכח אדם" 
          className="w-32 h-32 md:w-40 md:h-40 rounded-2xl shadow-lg object-contain"
        />
        <div className="text-center">
          <h1 className="text-2xl md:text-3xl font-bold text-foreground mb-2">ירוק שירותי אחזקה ניקיון וכח אדם</h1>
          <p className="text-xl text-muted-foreground">מערכת ניהול</p>
        </div>
      </div>

      {/* Enter Button */}
      <Button 
        size="lg" 
        onClick={handleEnterApp}
        className="gap-3 text-lg px-8 py-6 rounded-xl shadow-lg hover:shadow-xl transition-all"
      >
        <span>כניסה למערכת</span>
        <ArrowLeft className="h-5 w-5" />
      </Button>

      {/* Footer */}
      <p className="mt-12 text-sm text-muted-foreground">
        © {new Date().getFullYear()} ירוק שירותי אחזקה ניקיון וכח אדם בע"מ. כל הזכויות שמורות.
      </p>
    </div>
  );
};

export default Index;
