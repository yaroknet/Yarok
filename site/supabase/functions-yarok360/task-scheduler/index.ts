const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    const today = new Date();
    const todayStr = today.toISOString().split("T")[0];

    // --- 1. RECURRING TASK DUPLICATION ---
    // Find recurring tasks that need a new instance for the current period
    const { data: recurringTasks, error: rErr } = await supabase
      .from("tasks")
      .select("*")
      .eq("is_recurring", true)
      .in("frequency", ["monthly", "quarterly"]);

    if (rErr) throw rErr;

    let tasksCreated = 0;
    for (const task of recurringTasks || []) {
      // Calculate the next period start date
      const dueDate = task.due_date ? new Date(task.due_date) : new Date(task.created_at);
      let nextDue: Date;

      if (task.frequency === "monthly") {
        nextDue = new Date(dueDate);
        nextDue.setMonth(nextDue.getMonth() + 1);
      } else if (task.frequency === "quarterly") {
        nextDue = new Date(dueDate);
        nextDue.setMonth(nextDue.getMonth() + 3);
      } else {
        continue;
      }

      // Only create if the next period has started and no child task exists
      if (nextDue > today) continue;

      // Check if a child task already exists for this parent
      const { data: existing } = await supabase
        .from("tasks")
        .select("id")
        .eq("parent_task_id", task.id)
        .gte("created_at", nextDue.toISOString().split("T")[0])
        .limit(1);

      if (existing && existing.length > 0) continue;

      // Calculate new due date
      let newDue: Date;
      if (task.frequency === "monthly") {
        newDue = new Date(nextDue);
        newDue.setMonth(newDue.getMonth() + 1);
        newDue.setDate(newDue.getDate() - 1); // end of month
      } else {
        newDue = new Date(nextDue);
        newDue.setMonth(newDue.getMonth() + 3);
        newDue.setDate(newDue.getDate() - 1);
      }

      const { error: insertErr } = await supabase.from("tasks").insert({
        branch_id: task.branch_id,
        work_type: task.work_type,
        frequency: task.frequency,
        sides_required: task.sides_required,
        total_client_price: task.total_client_price,
        total_contractor_price: task.total_contractor_price,
        assigned_to: task.assigned_to,
        executor: task.executor,
        due_date: newDue.toISOString().split("T")[0],
        requires_photo: task.requires_photo,
        requires_video: task.requires_video,
        is_recurring: true,
        parent_task_id: task.id,
        admin_notes: task.admin_notes,
        status: "pending",
      });

      if (!insertErr) tasksCreated++;
    }

    // --- 2. OVERDUE ALERTS (one_time tasks overdue by 14+ days) ---
    const { data: overdueTasks, error: oErr } = await supabase
      .from("tasks")
      .select("id, work_type, assigned_to, executor, due_date, branch_id, branches(name, networks(name))")
      .eq("frequency", "one_time")
      .not("due_date", "is", null)
      .not("status", "in", "(completed,cancelled)");

    if (oErr) throw oErr;

    // Get super_admin user ids
    const { data: adminRoles } = await supabase
      .from("user_roles")
      .select("user_id")
      .eq("role", "super_admin");
    const adminIds = (adminRoles || []).map((r: any) => r.user_id);

    let alertsSent = 0;
    for (const task of overdueTasks || []) {
      const dueDate = new Date(task.due_date);
      const daysDiff = Math.floor((today.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24));
      if (daysDiff < 14) continue;

      const networkName = (task as any).branches?.networks?.name || "";
      const branchName = (task as any).branches?.name || "";
      const body = `⚠️ משימה באיחור של ${daysDiff} ימים\n\nרשת: ${networkName}\nסניף: ${branchName}\nסוג עבודה: ${task.work_type}\nמבצע: ${task.executor || "לא משויך"}\nתאריך יעד: ${task.due_date}`;

      // Send to assignee
      if (task.assigned_to) {
        // Check if we already sent an alert today
        const { data: existingMsg } = await supabase
          .from("internal_messages")
          .select("id")
          .eq("recipient_id", task.assigned_to)
          .ilike("subject", `%${task.id}%`)
          .gte("created_at", todayStr)
          .limit(1);

        if (!existingMsg || existingMsg.length === 0) {
          const senderId = adminIds[0] || task.assigned_to;
          await supabase.from("internal_messages").insert({
            sender_id: senderId,
            recipient_id: task.assigned_to,
            subject: `התראת איחור: ${task.work_type} [${task.id}]`,
            body,
          });
          alertsSent++;
        }
      }

      // Send to all super admins
      for (const adminId of adminIds) {
        if (adminId === task.assigned_to) continue;
        const { data: existingMsg } = await supabase
          .from("internal_messages")
          .select("id")
          .eq("recipient_id", adminId)
          .ilike("subject", `%${task.id}%`)
          .gte("created_at", todayStr)
          .limit(1);

        if (!existingMsg || existingMsg.length === 0) {
          const senderId = adminIds[0] || adminId;
          await supabase.from("internal_messages").insert({
            sender_id: senderId,
            recipient_id: adminId,
            subject: `התראת איחור: ${task.work_type} [${task.id}]`,
            body,
          });
          alertsSent++;
        }
      }
    }

    // --- 4. TWO-DAY REMINDER (tasks due in exactly 2 days) ---
    const twoDaysFromNow = new Date(today);
    twoDaysFromNow.setDate(twoDaysFromNow.getDate() + 2);
    const twoDaysStr = twoDaysFromNow.toISOString().split("T")[0];

    const { data: dueSoonTasks, error: dsErr } = await supabase
      .from("tasks")
      .select("id, work_type, assigned_to, executor, due_date, branch_id, branches(name, networks(name))")
      .eq("due_date", twoDaysStr)
      .not("status", "in", "(completed,cancelled)");

    if (dsErr) throw dsErr;

    let dueSoonReminders = 0;
    for (const task of dueSoonTasks || []) {
      const networkName = (task as any).branches?.networks?.name || "";
      const branchName = (task as any).branches?.name || "";
      const body = `⏰ תזכורת: משימה מתוזמנת בעוד יומיים!\n\nרשת: ${networkName}\nסניף: ${branchName}\nסוג עבודה: ${task.work_type}\nמבצע: ${task.executor || "לא משויך"}\nתאריך יעד: ${task.due_date}`;

      const recipients = new Set<string>();
      if (task.assigned_to) recipients.add(task.assigned_to);
      for (const adminId of adminIds) recipients.add(adminId);

      for (const recipientId of Array.from(recipients)) {
        const { data: existingMsg } = await supabase
          .from("internal_messages")
          .select("id")
          .eq("recipient_id", recipientId)
          .ilike("subject", `%תזכורת יומיים%${task.id}%`)
          .gte("created_at", todayStr)
          .limit(1);

        if (!existingMsg || existingMsg.length === 0) {
          const senderId = adminIds[0] || recipientId;
          await supabase.from("internal_messages").insert({
            sender_id: senderId,
            recipient_id: recipientId,
            subject: `⏰ תזכורת יומיים: ${task.work_type} [${task.id}]`,
            body,
          });
          dueSoonReminders++;
        }
      }
    }

    // --- 5. PERIOD-END REMINDERS ---
    // Monthly: last week of month => send summary of open tasks
    // Quarterly: 2 weeks before quarter ends
    const dayOfMonth = today.getDate();
    const daysInMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate();
    const isLastWeekOfMonth = dayOfMonth > daysInMonth - 7;

    // Quarter ends: March 31, June 30, Sep 30, Dec 31
    const quarterEndMonth = Math.ceil((today.getMonth() + 1) / 3) * 3; // 3, 6, 9, 12
    const quarterEnd = new Date(today.getFullYear(), quarterEndMonth, 0); // last day of quarter
    const daysToQuarterEnd = Math.floor((quarterEnd.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    const isTwoWeeksBeforeQuarterEnd = daysToQuarterEnd <= 14 && daysToQuarterEnd >= 0;

    let remindersSent = 0;

    if (isLastWeekOfMonth) {
      // Get open monthly tasks per assignee
      const { data: monthlyTasks } = await supabase
        .from("tasks")
        .select("id, work_type, assigned_to, executor, branches(name, networks(name))")
        .eq("frequency", "monthly")
        .not("status", "in", "(completed,cancelled)");

      const byAssignee: Record<string, any[]> = {};
      for (const t of monthlyTasks || []) {
        const key = t.assigned_to || "unassigned";
        if (!byAssignee[key]) byAssignee[key] = [];
        byAssignee[key].push(t);
      }

      for (const [assigneeId, tasks] of Object.entries(byAssignee)) {
        if (assigneeId === "unassigned") continue;
        const lines = tasks.map((t: any) =>
          `• ${(t as any).branches?.networks?.name || ""} — ${(t as any).branches?.name || ""}: ${t.work_type}`
        ).join("\n");
        const body = `📋 תזכורת סוף חודש — ${tasks.length} משימות חודשיות פתוחות:\n\n${lines}`;

        // Dedup: check if sent today
        const { data: ex } = await supabase
          .from("internal_messages")
          .select("id")
          .eq("recipient_id", assigneeId)
          .ilike("subject", "%תזכורת סוף חודש%")
          .gte("created_at", todayStr)
          .limit(1);

        if (!ex || ex.length === 0) {
          const senderId = adminIds[0] || assigneeId;
          await supabase.from("internal_messages").insert({
            sender_id: senderId,
            recipient_id: assigneeId,
            subject: `תזכורת סוף חודש: ${tasks.length} משימות פתוחות`,
            body,
          });
          remindersSent++;
        }

        // Also send to admins
        for (const adminId of adminIds) {
          if (adminId === assigneeId) continue;
          const { data: ex2 } = await supabase
            .from("internal_messages")
            .select("id")
            .eq("recipient_id", adminId)
            .ilike("subject", "%תזכורת סוף חודש%")
            .gte("created_at", todayStr)
            .limit(1);
          if (!ex2 || ex2.length === 0) {
            await supabase.from("internal_messages").insert({
              sender_id: adminIds[0] || adminId,
              recipient_id: adminId,
              subject: `תזכורת סוף חודש: ${tasks.length} משימות פתוחות (${tasks[0]?.executor || "כללי"})`,
              body,
            });
            remindersSent++;
          }
        }
      }
    }

    if (isTwoWeeksBeforeQuarterEnd) {
      const { data: quarterlyTasks } = await supabase
        .from("tasks")
        .select("id, work_type, assigned_to, executor, frequency, branches(name, networks(name))")
        .in("frequency", ["quarterly"])
        .not("status", "in", "(completed,cancelled)");

      const byAssignee: Record<string, any[]> = {};
      for (const t of quarterlyTasks || []) {
        const key = t.assigned_to || "unassigned";
        if (!byAssignee[key]) byAssignee[key] = [];
        byAssignee[key].push(t);
      }

      for (const [assigneeId, tasks] of Object.entries(byAssignee)) {
        if (assigneeId === "unassigned") continue;
        const lines = tasks.map((t: any) =>
          `• ${(t as any).branches?.networks?.name || ""} — ${(t as any).branches?.name || ""}: ${t.work_type}`
        ).join("\n");
        const body = `📋 תזכורת סוף רבעון — ${tasks.length} משימות רבעוניות פתוחות (${daysToQuarterEnd} ימים לסיום הרבעון):\n\n${lines}`;

        const { data: ex } = await supabase
          .from("internal_messages")
          .select("id")
          .eq("recipient_id", assigneeId)
          .ilike("subject", "%תזכורת סוף רבעון%")
          .gte("created_at", todayStr)
          .limit(1);

        if (!ex || ex.length === 0) {
          await supabase.from("internal_messages").insert({
            sender_id: adminIds[0] || assigneeId,
            recipient_id: assigneeId,
            subject: `תזכורת סוף רבעון: ${tasks.length} משימות פתוחות`,
            body,
          });
          remindersSent++;
        }

        for (const adminId of adminIds) {
          if (adminId === assigneeId) continue;
          const { data: ex2 } = await supabase
            .from("internal_messages")
            .select("id")
            .eq("recipient_id", adminId)
            .ilike("subject", "%תזכורת סוף רבעון%")
            .gte("created_at", todayStr)
            .limit(1);
          if (!ex2 || ex2.length === 0) {
            await supabase.from("internal_messages").insert({
              sender_id: adminIds[0] || adminId,
              recipient_id: adminId,
              subject: `תזכורת סוף רבעון: ${tasks.length} משימות פתוחות (${tasks[0]?.executor || "כללי"})`,
              body,
            });
            remindersSent++;
          }
        }
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        tasks_created: tasksCreated,
        alerts_sent: alertsSent,
        due_soon_reminders: dueSoonReminders,
        reminders_sent: remindersSent,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
    );
  } catch (error: any) {
    console.error("task-scheduler error:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
    );
  }
});
