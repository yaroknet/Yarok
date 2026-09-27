import { MessageCircle } from "lucide-react";

export function WhatsAppFab() {
  const phone = "972503771149";
  const url = `https://wa.me/${phone}`;

  const handleClick = () => {
    window.open(url, "_blank", "noopener,noreferrer");
  };

  return (
    <button
      onClick={handleClick}
      className="fixed bottom-20 left-6 z-40 flex flex-col items-center gap-1 group cursor-pointer"
    >
      <span className="text-xs font-medium text-foreground bg-card px-2 py-1 rounded shadow-md opacity-90 group-hover:opacity-100 transition-opacity">
        צור קשר
      </span>
      <div className="w-14 h-14 rounded-full bg-[#25D366] flex items-center justify-center shadow-lg hover:scale-110 transition-transform">
        <MessageCircle className="h-7 w-7 text-white" />
      </div>
    </button>
  );
}
