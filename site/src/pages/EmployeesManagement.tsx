import { Link } from 'react-router-dom';
import { FileText, Users, Globe } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';

const FORMS = [
  { key: 'form_101', title: 'טופס 101', desc: 'טופס פרטים אישיים לעובד', icon: FileText },
  { key: 'employee_kit', title: 'קיט עובד', desc: 'טופס קליטת עובד חדש', icon: Users },
  { key: 'foreign_employee_kit', title: 'קיט עובד זר', desc: 'טופס קליטת עובד זר', icon: Globe },
] as const;

export default function EmployeesManagement() {
  return (
    <div dir="rtl" className="container mx-auto px-4 py-8">
      <header className="mb-8 text-center">
        <h1 className="text-3xl font-bold text-foreground">ניהול עובדים</h1>
        <p className="text-muted-foreground mt-2">בחר את סוג הטופס לניהול</p>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-5xl mx-auto">
        {FORMS.map(({ key, title, desc, icon: Icon }) => (
          <Link key={key} to={`/payroll/${key}`} className="focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-lg">
            <Card className="cursor-pointer transition-all duration-200 hover:shadow-lg hover:scale-[1.02] bg-card/90 hover:bg-card h-full">
              <CardHeader className="text-center">
                <div className="w-16 h-16 mx-auto rounded-xl flex items-center justify-center mb-3 bg-primary">
                  <Icon className="h-8 w-8 text-primary-foreground" />
                </div>
                <CardTitle className="text-xl">{title}</CardTitle>
              </CardHeader>
              <CardContent className="text-center">
                <CardDescription>{desc}</CardDescription>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
