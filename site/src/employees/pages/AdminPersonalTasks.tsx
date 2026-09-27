import { AdminLayout } from "@/employees/components/AdminLayout";
import { PersonalTasksBoard } from "@/employees/components/personal-tasks/PersonalTasksBoard";

export default function AdminPersonalTasks() {
  return (
    <AdminLayout>
      <PersonalTasksBoard />
    </AdminLayout>
  );
}
