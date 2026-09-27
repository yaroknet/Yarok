import { useEffect, useState } from "react";
import { Truck } from "lucide-react";

export const SplashScreen = () => {
  const [show, setShow] = useState(true);
  const [fadeOut, setFadeOut] = useState(false);

  useEffect(() => {
    // Check if running as PWA
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches;
    const isInWebAppiOS = (window.navigator as any).standalone === true;
    
    if (!isStandalone && !isInWebAppiOS) {
      setShow(false);
      return;
    }

    // Show splash for 1.5 seconds then fade out
    const fadeTimer = setTimeout(() => {
      setFadeOut(true);
    }, 1200);

    const hideTimer = setTimeout(() => {
      setShow(false);
    }, 1500);

    return () => {
      clearTimeout(fadeTimer);
      clearTimeout(hideTimer);
    };
  }, []);

  if (!show) return null;

  return (
    <div 
      className={`fixed inset-0 z-[100] bg-gradient-to-b from-primary to-primary/80 flex flex-col items-center justify-center transition-opacity duration-300 ${
        fadeOut ? 'opacity-0' : 'opacity-100'
      }`}
    >
      <div className="animate-pulse">
        <div className="bg-white/20 backdrop-blur-sm rounded-3xl p-6 mb-6">
          <Truck className="h-16 w-16 text-white" />
        </div>
      </div>
      
      <h1 className="text-3xl font-bold text-white mb-2">Yarok Fleet</h1>
      <p className="text-white/80 text-sm">ניהול צי רכב מתקדם</p>
      
      <div className="absolute bottom-12 left-0 right-0 flex justify-center">
        <div className="flex gap-1">
          <div className="w-2 h-2 bg-white/60 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
          <div className="w-2 h-2 bg-white/60 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
          <div className="w-2 h-2 bg-white/60 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
        </div>
      </div>
    </div>
  );
};
