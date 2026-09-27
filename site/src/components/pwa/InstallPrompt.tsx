import { Download, X, Smartphone } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useInstallPWA } from "@/hooks/useInstallPWA";
import { useState, useEffect } from "react";

export const InstallPrompt = () => {
  const { isInstallable, isInstalled, installApp } = useInstallPWA();
  const [dismissed, setDismissed] = useState(false);
  const [showIOSInstructions, setShowIOSInstructions] = useState(false);

  // Check if iOS
  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
  const isSafari = /^((?!chrome|android).)*safari/i.test(navigator.userAgent);
  const showIOSPrompt = isIOS && isSafari && !isInstalled;

  useEffect(() => {
    // Check if user has dismissed the prompt before
    const wasDismissed = localStorage.getItem('pwa-prompt-dismissed');
    if (wasDismissed) {
      const dismissedDate = new Date(wasDismissed);
      const daysSinceDismissed = (Date.now() - dismissedDate.getTime()) / (1000 * 60 * 60 * 24);
      // Show again after 7 days
      if (daysSinceDismissed < 7) {
        setDismissed(true);
      }
    }
  }, []);

  const handleDismiss = () => {
    setDismissed(true);
    localStorage.setItem('pwa-prompt-dismissed', new Date().toISOString());
  };

  const handleInstall = async () => {
    const success = await installApp();
    if (success) {
      setDismissed(true);
    }
  };

  // Don't show if dismissed, installed, or not installable (except for iOS)
  if (dismissed || isInstalled) return null;
  if (!isInstallable && !showIOSPrompt) return null;

  // iOS instructions modal
  if (showIOSInstructions) {
    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
        <div className="bg-card rounded-lg p-6 max-w-sm w-full shadow-xl">
          <div className="flex items-center justify-between mb-4">
            <p className="text-lg font-semibold">התקנה ב-iPhone</p>
            <Button 
              variant="ghost" 
              size="icon" 
              onClick={() => setShowIOSInstructions(false)}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
          
          <div className="space-y-4 text-sm text-muted-foreground">
            <div className="flex items-start gap-3">
              <div className="bg-primary/10 rounded-full w-6 h-6 flex items-center justify-center shrink-0 text-primary font-bold text-xs">1</div>
              <p>לחץ על כפתור השיתוף <span className="inline-block">⬆️</span> בתחתית Safari</p>
            </div>
            <div className="flex items-start gap-3">
              <div className="bg-primary/10 rounded-full w-6 h-6 flex items-center justify-center shrink-0 text-primary font-bold text-xs">2</div>
              <p>גלול למטה ובחר "הוסף למסך הבית"</p>
            </div>
            <div className="flex items-start gap-3">
              <div className="bg-primary/10 rounded-full w-6 h-6 flex items-center justify-center shrink-0 text-primary font-bold text-xs">3</div>
              <p>לחץ "הוסף" בפינה העליונה</p>
            </div>
          </div>
          
          <Button 
            className="w-full mt-6" 
            onClick={() => {
              setShowIOSInstructions(false);
              handleDismiss();
            }}
          >
            הבנתי
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed bottom-4 left-4 right-4 md:left-auto md:right-4 md:w-80 bg-card border border-border rounded-lg p-4 shadow-lg z-50 animate-in slide-in-from-bottom-4">
      <div className="flex items-start gap-3">
        <div className="bg-primary/10 rounded-lg p-2">
          <Smartphone className="h-5 w-5 text-primary" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-sm">התקן את Yarok</p>
          <p className="text-xs text-muted-foreground mt-1">
            התקן את האפליקציה למסך הבית לגישה מהירה
          </p>
        </div>
        <Button 
          variant="ghost" 
          size="icon" 
          className="shrink-0 -mt-1 -mr-1"
          onClick={handleDismiss}
        >
          <X className="h-4 w-4" />
        </Button>
      </div>
      
      <div className="flex gap-2 mt-3">
        <Button 
          variant="outline" 
          size="sm" 
          className="flex-1"
          onClick={handleDismiss}
        >
          לא עכשיו
        </Button>
        <Button 
          size="sm" 
          className="flex-1 gap-1"
          onClick={showIOSPrompt ? () => setShowIOSInstructions(true) : handleInstall}
        >
          <Download className="h-4 w-4" />
          התקן
        </Button>
      </div>
    </div>
  );
};
