import { useState } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSub,
  DropdownMenuSubTrigger,
  DropdownMenuSubContent,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import {
  Sheet,
  SheetContent,
  SheetTrigger,
  SheetClose,
} from "@/components/ui/sheet";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { 
  ChevronDown, 
  Briefcase, 
  Building2, 
  Receipt,
  Menu,
} from "lucide-react";
import yarokLogo from "@/assets/yarok-logo.png";

const cleaningServices = [
  { label: "ניקיון משרדים", href: "/services/office-cleaning" },
  { label: "ניקיון מרפאות וקליניקות", href: "/services/medical-cleaning" },
  { label: "ניקיון מוסדי וממשלתי", href: "/services/institutional-cleaning" },
  { label: "ניקיון חנויות ורשתות", href: "/services/retail-cleaning" },
  { label: "ניקיון חדרים נקיים", href: "/services/cleanroom-cleaning" },
];

const maintenanceServices = [
  { label: "פוליש וחידוש רצפות", href: "/services/polish-floors" },
  { label: "ניקוי שטיחים וריפודים", href: "/services/carpet-cleaning" },
  { label: "ניקוי מזגנים ופילטרים", href: "/services/ac-cleaning" },
];

const projectServices = [
  { label: "ניקיון אחרי שיפוץ", href: "/services/post-construction" },
  { label: "ניקיון חלונות בגובה", href: "/services/windows-height" },
  { label: "ניקיון תעשייתי", href: "/services/industrial-cleaning" },
];

export const LandingNavigation = () => {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [servicesOpen, setServicesOpen] = useState(false);
  const [cleaningOpen, setCleaningOpen] = useState(false);
  const [maintenanceOpen, setMaintenanceOpen] = useState(false);
  const [projectsOpen, setProjectsOpen] = useState(false);

  return (
    <header className="sticky top-0 z-40 bg-white/90 backdrop-blur-xl border-b border-border/30">
      <div className="container mx-auto px-4 md:px-8 py-4">
        <div className="flex items-center justify-between">
          {/* Logo */}
          <Link to="/" className="flex items-center gap-3">
            <img src={yarokLogo} alt="ירוק לוגו" className="h-12 w-auto" width={48} height={48} />
            <div className="hidden sm:block">
              <span className="text-xl font-bold text-primary leading-tight block tracking-tight">ירוק</span>
              <span className="text-xs text-muted-foreground block">אחזקה, ניקיון וכוח אדם</span>
            </div>
          </Link>

          {/* Desktop Navigation */}
          <nav className="hidden md:flex items-center gap-6 lg:gap-10">
            <Link to="/" className="text-base font-medium text-foreground/70 hover:text-primary transition-colors py-2">
              בית
            </Link>
            <Link to="/about" className="text-base font-medium text-foreground/70 hover:text-primary transition-colors py-2">
              אודות
            </Link>

            {/* Services Mega-Dropdown */}
            <DropdownMenu>
              <DropdownMenuTrigger className="flex items-center gap-1.5 text-base font-medium text-foreground/70 hover:text-primary transition-colors py-2">
                שירותים
                <ChevronDown className="h-4 w-4" />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="center" className="w-60 bg-white z-50">
                {/* Cleaning sub */}
                <DropdownMenuSub>
                  <DropdownMenuSubTrigger className="cursor-pointer font-medium">שירותי ניקיון</DropdownMenuSubTrigger>
                  <DropdownMenuSubContent className="bg-white w-56">
                    {cleaningServices.map((item) => (
                      <DropdownMenuItem key={item.href} asChild>
                        <Link to={item.href} className="cursor-pointer">{item.label}</Link>
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuSubContent>
                </DropdownMenuSub>

                {/* Maintenance sub */}
                <DropdownMenuSub>
                  <DropdownMenuSubTrigger className="cursor-pointer font-medium">אחזקה וחידוש</DropdownMenuSubTrigger>
                  <DropdownMenuSubContent className="bg-white w-56">
                    {maintenanceServices.map((item) => (
                      <DropdownMenuItem key={item.href} asChild>
                        <Link to={item.href} className="cursor-pointer">{item.label}</Link>
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuSubContent>
                </DropdownMenuSub>

                {/* Projects sub */}
                <DropdownMenuSub>
                  <DropdownMenuSubTrigger className="cursor-pointer font-medium">פרויקטים וגובה</DropdownMenuSubTrigger>
                  <DropdownMenuSubContent className="bg-white w-56">
                    {projectServices.map((item) => (
                      <DropdownMenuItem key={item.href} asChild>
                        <Link to={item.href} className="cursor-pointer">{item.label}</Link>
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuSubContent>
                </DropdownMenuSub>

                <DropdownMenuSeparator />
                <DropdownMenuItem asChild>
                  <Link to="/services/manpower" className="cursor-pointer font-medium">כוח אדם</Link>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            <Link to="/articles" className="text-base font-medium text-foreground/70 hover:text-primary transition-colors py-2">
              מאמרים
            </Link>
            <Link to="/faq" className="text-base font-medium text-foreground/70 hover:text-primary transition-colors py-2">
              שאלות ותשובות
            </Link>
            <Link to="/contact" className="text-base font-medium text-foreground/70 hover:text-primary transition-colors py-2">
              צור קשר
            </Link>
          </nav>

          {/* Personal Area + Mobile */}
          <div className="flex items-center gap-3">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" className="hidden md:flex rounded-full border-primary/30 text-primary hover:bg-primary hover:text-white gap-2 px-6 transition-all duration-300">
                  אזור אישי
                  <ChevronDown className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48 bg-white z-50">
                <DropdownMenuItem asChild>
                  <a href="/employees/" className="flex items-center gap-2 cursor-pointer">
                    <Briefcase className="h-4 w-4" />
                    עובדים
                  </a>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link to="/client-auth" className="flex items-center gap-2 cursor-pointer">
                    <Building2 className="h-4 w-4" />
                    לקוחות
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <a href="https://michpaliram.co.il/signIn" target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 cursor-pointer">
                    <Receipt className="h-4 w-4" />
                    תלושי שכר
                  </a>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            {/* Mobile Menu */}
            <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon" className="md:hidden">
                  <Menu className="h-6 w-6" />
                </Button>
              </SheetTrigger>
              <SheetContent side="right" className="w-80 bg-white">
                <div className="flex flex-col gap-4 mt-8">
                  <SheetClose asChild>
                    <Link to="/" className="text-lg font-medium py-2 hover:text-primary">בית</Link>
                  </SheetClose>
                  <SheetClose asChild>
                    <Link to="/about" className="text-lg font-medium py-2 hover:text-primary">אודות</Link>
                  </SheetClose>

                  {/* Mobile Services Collapsible */}
                  <Collapsible open={servicesOpen} onOpenChange={setServicesOpen}>
                    <CollapsibleTrigger className="flex items-center justify-between w-full text-lg font-medium py-2 hover:text-primary">
                      שירותים
                      <ChevronDown className={`h-4 w-4 transition-transform ${servicesOpen ? 'rotate-180' : ''}`} />
                    </CollapsibleTrigger>
                    <CollapsibleContent className="pr-4 space-y-1 mt-1">
                      {/* Cleaning */}
                      <Collapsible open={cleaningOpen} onOpenChange={setCleaningOpen}>
                        <CollapsibleTrigger className="flex items-center justify-between w-full text-base font-medium py-2 hover:text-primary">
                          שירותי ניקיון
                          <ChevronDown className={`h-3.5 w-3.5 transition-transform ${cleaningOpen ? 'rotate-180' : ''}`} />
                        </CollapsibleTrigger>
                        <CollapsibleContent className="pr-4 space-y-1">
                          {cleaningServices.map((item) => (
                            <SheetClose key={item.href} asChild>
                              <Link to={item.href} className="block py-1.5 text-muted-foreground hover:text-primary text-sm">{item.label}</Link>
                            </SheetClose>
                          ))}
                        </CollapsibleContent>
                      </Collapsible>

                      {/* Maintenance */}
                      <Collapsible open={maintenanceOpen} onOpenChange={setMaintenanceOpen}>
                        <CollapsibleTrigger className="flex items-center justify-between w-full text-base font-medium py-2 hover:text-primary">
                          אחזקה וחידוש
                          <ChevronDown className={`h-3.5 w-3.5 transition-transform ${maintenanceOpen ? 'rotate-180' : ''}`} />
                        </CollapsibleTrigger>
                        <CollapsibleContent className="pr-4 space-y-1">
                          {maintenanceServices.map((item) => (
                            <SheetClose key={item.href} asChild>
                              <Link to={item.href} className="block py-1.5 text-muted-foreground hover:text-primary text-sm">{item.label}</Link>
                            </SheetClose>
                          ))}
                        </CollapsibleContent>
                      </Collapsible>

                      {/* Projects */}
                      <Collapsible open={projectsOpen} onOpenChange={setProjectsOpen}>
                        <CollapsibleTrigger className="flex items-center justify-between w-full text-base font-medium py-2 hover:text-primary">
                          פרויקטים וגובה
                          <ChevronDown className={`h-3.5 w-3.5 transition-transform ${projectsOpen ? 'rotate-180' : ''}`} />
                        </CollapsibleTrigger>
                        <CollapsibleContent className="pr-4 space-y-1">
                          {projectServices.map((item) => (
                            <SheetClose key={item.href} asChild>
                              <Link to={item.href} className="block py-1.5 text-muted-foreground hover:text-primary text-sm">{item.label}</Link>
                            </SheetClose>
                          ))}
                        </CollapsibleContent>
                      </Collapsible>

                      <SheetClose asChild>
                        <Link to="/services/manpower" className="block text-base font-medium py-2 hover:text-primary">כוח אדם</Link>
                      </SheetClose>
                    </CollapsibleContent>
                  </Collapsible>

                  <SheetClose asChild>
                    <Link to="/articles" className="text-lg font-medium py-2 hover:text-primary">מאמרים</Link>
                  </SheetClose>
                  <SheetClose asChild>
                    <Link to="/faq" className="text-lg font-medium py-2 hover:text-primary">שאלות ותשובות</Link>
                  </SheetClose>
                  <SheetClose asChild>
                    <Link to="/contact" className="text-lg font-medium py-2 hover:text-primary">צור קשר</Link>
                  </SheetClose>

                  <div className="border-t pt-4 mt-4 space-y-2">
                    <SheetClose asChild>
                      <a href="/employees/" className="flex items-center gap-2 py-2 text-muted-foreground hover:text-primary">
                        <Briefcase className="h-4 w-4" />
                        כניסת עובדים
                      </a>
                    </SheetClose>
                    <SheetClose asChild>
                      <Link to="/client-auth" className="flex items-center gap-2 py-2 text-muted-foreground hover:text-primary">
                        <Building2 className="h-4 w-4" />
                        כניסת לקוחות
                      </Link>
                    </SheetClose>
                    <SheetClose asChild>
                      <a href="https://michpaliram.co.il/signIn" target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 py-2 text-muted-foreground hover:text-primary">
                        <Receipt className="h-4 w-4" />
                        תלושי שכר
                      </a>
                    </SheetClose>
                  </div>
                </div>
              </SheetContent>
            </Sheet>
          </div>
        </div>
      </div>
    </header>
  );
};
