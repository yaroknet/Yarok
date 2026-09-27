import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/employees/integrations/supabase/client";
import { Card, CardContent } from "@/employees/components/ui/card";
import { Button } from "@/employees/components/ui/button";
import { Textarea } from "@/employees/components/ui/textarea";
import { Label } from "@/employees/components/ui/label";
import { Badge } from "@/employees/components/ui/badge";
import { Save, RotateCcw } from "lucide-react";
import { toast } from "sonner";
import { useState } from "react";

interface Template {
  id: string;
  template_key: string;
  label: string;
  template_text: string;
  is_active: boolean;
}

const VARIABLE_HINTS: Record<string, string> = {
  new_task_intro: "{employee_name} - שם העובד",
  reminder_intro: "{employee_name} - שם העובד",
  update_intro: "{employee_name} - שם העובד",
  cancelled_message: "{employee_name} - שם העובד, {site_name} - שם האתר",
  closing_morning: "ללא משתנים",
  closing_evening: "ללא משתנים",
  no_tasks_today: "{recipient_name} - שם הנמען",
  stop_service_note: "ללא משתנים",
};

export function WhatsAppTemplates() {
  const queryClient = useQueryClient();
  const [editedTexts, setEditedTexts] = useState<Record<string, string>>({});

  const { data: templates = [], isLoading } = useQuery({
    queryKey: ["whatsapp-templates"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("whatsapp_templates")
        .select("*")
        .order("created_at");
      if (error) throw error;
      return data as Template[];
    },
  });

  const saveMutation = useMutation({
    mutationFn: async ({ id, template_text }: { id: string; template_text: string }) => {
      const { error } = await supabase
        .from("whatsapp_templates")
        .update({ template_text })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: ["whatsapp-templates"] });
      setEditedTexts((prev) => { const n = { ...prev }; delete n[id]; return n; });
      toast.success("תבנית עודכנה בהצלחה");
    },
  });

  const isEdited = (t: Template) => editedTexts[t.id] !== undefined && editedTexts[t.id] !== t.template_text;

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold">תבניות הודעות</h2>
        <p className="text-xs text-muted-foreground mt-1">ערוך את הנוסחים של ההודעות הנשלחות. השתמש במשתנים בסוגריים מסולסלים.</p>
      </div>

      {isLoading ? (
        <p className="text-muted-foreground text-sm">טוען...</p>
      ) : (
        <div className="grid gap-3">
          {templates.map((t) => {
            const currentText = editedTexts[t.id] ?? t.template_text;
            const edited = isEdited(t);

            return (
              <Card key={t.id}>
                <CardContent className="p-4 space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Label className="font-semibold">{t.label}</Label>
                      <Badge variant="outline" className="text-xs font-mono">{t.template_key}</Badge>
                    </div>
                    <div className="flex items-center gap-1.5">
                      {edited && (
                        <>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => setEditedTexts((p) => { const n = { ...p }; delete n[t.id]; return n; })}
                          >
                            <RotateCcw className="h-3.5 w-3.5 ml-1" />
                            בטל
                          </Button>
                          <Button
                            size="sm"
                            onClick={() => saveMutation.mutate({ id: t.id, template_text: currentText })}
                            disabled={saveMutation.isPending}
                          >
                            <Save className="h-3.5 w-3.5 ml-1" />
                            שמור
                          </Button>
                        </>
                      )}
                    </div>
                  </div>
                  <Textarea
                    value={currentText}
                    onChange={(e) => setEditedTexts((p) => ({ ...p, [t.id]: e.target.value }))}
                    className="min-h-[60px] text-sm"
                    dir="rtl"
                  />
                  <p className="text-xs text-muted-foreground">
                    משתנים: {VARIABLE_HINTS[t.template_key] || "ללא"}
                  </p>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
