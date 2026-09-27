import React, { useState, useEffect } from "react";
import { Accessibility, Plus, Minus, Eye, Type, Link2, X } from "lucide-react";
import { Button } from "@/components/ui/button";

interface AccessibilitySettings {
  fontSize: number;
  grayscale: boolean;
  highContrast: boolean;
  underlineLinks: boolean;
  readableFont: boolean;
}

const AccessibilityWidget = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [settings, setSettings] = useState<AccessibilitySettings>({
    fontSize: 100,
    grayscale: false,
    highContrast: false,
    underlineLinks: false,
    readableFont: false,
  });

  // Load settings from localStorage
  useEffect(() => {
    const savedSettings = localStorage.getItem("accessibility-settings");
    if (savedSettings) {
      const parsed = JSON.parse(savedSettings);
      setSettings(parsed);
      applySettings(parsed);
    }
  }, []);

  // Save and apply settings
  const updateSettings = (newSettings: AccessibilitySettings) => {
    setSettings(newSettings);
    localStorage.setItem("accessibility-settings", JSON.stringify(newSettings));
    applySettings(newSettings);
  };

  const applySettings = (s: AccessibilitySettings) => {
    const root = document.documentElement;
    
    // Font size
    root.style.fontSize = `${s.fontSize}%`;
    
    // Grayscale
    if (s.grayscale) {
      root.classList.add("accessibility-grayscale");
    } else {
      root.classList.remove("accessibility-grayscale");
    }
    
    // High contrast
    if (s.highContrast) {
      root.classList.add("accessibility-high-contrast");
    } else {
      root.classList.remove("accessibility-high-contrast");
    }
    
    // Underline links
    if (s.underlineLinks) {
      root.classList.add("accessibility-underline-links");
    } else {
      root.classList.remove("accessibility-underline-links");
    }
    
    // Readable font
    if (s.readableFont) {
      root.classList.add("accessibility-readable-font");
    } else {
      root.classList.remove("accessibility-readable-font");
    }
  };

  const resetSettings = () => {
    const defaultSettings: AccessibilitySettings = {
      fontSize: 100,
      grayscale: false,
      highContrast: false,
      underlineLinks: false,
      readableFont: false,
    };
    updateSettings(defaultSettings);
  };

  const increaseFontSize = () => {
    if (settings.fontSize < 150) {
      updateSettings({ ...settings, fontSize: settings.fontSize + 10 });
    }
  };

  const decreaseFontSize = () => {
    if (settings.fontSize > 80) {
      updateSettings({ ...settings, fontSize: settings.fontSize - 10 });
    }
  };

  return (
    <>
      {/* Accessibility Toggle Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="fixed bottom-6 right-6 z-50 bg-primary hover:bg-primary/90 text-primary-foreground p-4 rounded-full shadow-lg transition-all duration-300 hover:scale-110 focus:outline-2 focus:outline-offset-2 focus:outline-ring"
        aria-label="פתח תפריט נגישות"
        aria-expanded={isOpen}
        aria-controls="accessibility-menu"
      >
        <Accessibility className="w-6 h-6" aria-hidden="true" />
      </button>

      {/* Accessibility Panel */}
      {isOpen && (
        <div
          id="accessibility-menu"
          role="dialog"
          aria-label="תפריט נגישות"
          className="fixed bottom-24 right-6 z-50 bg-card border border-border rounded-xl shadow-xl w-80 max-h-[80vh] overflow-y-auto"
        >
          <div className="p-4 border-b border-border flex items-center justify-between">
            <h2 className="text-lg font-bold text-foreground flex items-center gap-2">
              <Accessibility className="w-5 h-5" aria-hidden="true" />
              הגדרות נגישות
            </h2>
            <button
              onClick={() => setIsOpen(false)}
              className="p-1 hover:bg-muted rounded-md transition-colors focus:outline-2 focus:outline-offset-2 focus:outline-ring"
              aria-label="סגור תפריט נגישות"
            >
              <X className="w-5 h-5" aria-hidden="true" />
            </button>
          </div>

          <div className="p-4 space-y-4">
            {/* Font Size Controls */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground flex items-center gap-2">
                <Type className="w-4 h-4" aria-hidden="true" />
                גודל טקסט ({settings.fontSize}%)
              </label>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={decreaseFontSize}
                  disabled={settings.fontSize <= 80}
                  aria-label="הקטן גודל טקסט"
                  className="focus:outline-2 focus:outline-offset-2 focus:outline-ring"
                >
                  <Minus className="w-4 h-4" aria-hidden="true" />
                </Button>
                <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                  <div
                    className="h-full bg-primary transition-all duration-300"
                    style={{ width: `${((settings.fontSize - 80) / 70) * 100}%` }}
                  />
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={increaseFontSize}
                  disabled={settings.fontSize >= 150}
                  aria-label="הגדל גודל טקסט"
                  className="focus:outline-2 focus:outline-offset-2 focus:outline-ring"
                >
                  <Plus className="w-4 h-4" aria-hidden="true" />
                </Button>
              </div>
            </div>

            {/* Toggle Options */}
            <div className="space-y-3">
              {/* Grayscale */}
              <button
                onClick={() => updateSettings({ ...settings, grayscale: !settings.grayscale })}
                className={`w-full flex items-center justify-between p-3 rounded-lg border transition-colors focus:outline-2 focus:outline-offset-2 focus:outline-ring ${
                  settings.grayscale 
                    ? "bg-primary text-primary-foreground border-primary" 
                    : "bg-background border-border hover:border-primary/50"
                }`}
                aria-pressed={settings.grayscale}
              >
                <span className="flex items-center gap-2">
                  <Eye className="w-4 h-4" aria-hidden="true" />
                  מצב גווני אפור
                </span>
                <span className="text-xs">{settings.grayscale ? "פעיל" : "כבוי"}</span>
              </button>

              {/* High Contrast */}
              <button
                onClick={() => updateSettings({ ...settings, highContrast: !settings.highContrast })}
                className={`w-full flex items-center justify-between p-3 rounded-lg border transition-colors focus:outline-2 focus:outline-offset-2 focus:outline-ring ${
                  settings.highContrast 
                    ? "bg-primary text-primary-foreground border-primary" 
                    : "bg-background border-border hover:border-primary/50"
                }`}
                aria-pressed={settings.highContrast}
              >
                <span className="flex items-center gap-2">
                  <Eye className="w-4 h-4" aria-hidden="true" />
                  ניגודיות גבוהה
                </span>
                <span className="text-xs">{settings.highContrast ? "פעיל" : "כבוי"}</span>
              </button>

              {/* Underline Links */}
              <button
                onClick={() => updateSettings({ ...settings, underlineLinks: !settings.underlineLinks })}
                className={`w-full flex items-center justify-between p-3 rounded-lg border transition-colors focus:outline-2 focus:outline-offset-2 focus:outline-ring ${
                  settings.underlineLinks 
                    ? "bg-primary text-primary-foreground border-primary" 
                    : "bg-background border-border hover:border-primary/50"
                }`}
                aria-pressed={settings.underlineLinks}
              >
                <span className="flex items-center gap-2">
                  <Link2 className="w-4 h-4" aria-hidden="true" />
                  הדגש קישורים
                </span>
                <span className="text-xs">{settings.underlineLinks ? "פעיל" : "כבוי"}</span>
              </button>

              {/* Readable Font */}
              <button
                onClick={() => updateSettings({ ...settings, readableFont: !settings.readableFont })}
                className={`w-full flex items-center justify-between p-3 rounded-lg border transition-colors focus:outline-2 focus:outline-offset-2 focus:outline-ring ${
                  settings.readableFont 
                    ? "bg-primary text-primary-foreground border-primary" 
                    : "bg-background border-border hover:border-primary/50"
                }`}
                aria-pressed={settings.readableFont}
              >
                <span className="flex items-center gap-2">
                  <Type className="w-4 h-4" aria-hidden="true" />
                  גופן קריא
                </span>
                <span className="text-xs">{settings.readableFont ? "פעיל" : "כבוי"}</span>
              </button>
            </div>

            {/* Reset Button */}
            <Button
              variant="outline"
              className="w-full focus:outline-2 focus:outline-offset-2 focus:outline-ring"
              onClick={resetSettings}
            >
              איפוס הגדרות
            </Button>
          </div>
        </div>
      )}
    </>
  );
};

export default AccessibilityWidget;
