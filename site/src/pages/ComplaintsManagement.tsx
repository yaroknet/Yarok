import { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { format, subDays, subMonths, startOfMonth, endOfMonth, isWithinInterval, parseISO } from 'date-fns';
import { he } from 'date-fns/locale';
import { 
  Plus, 
  Search, 
  Download, 
  AlertTriangle, 
  Users, 
  MessageSquare,
  CheckCircle,
  Clock,
  Filter,
  X,
  TrendingUp,
  CalendarDays,
  BarChart3
} from 'lucide-react';
import { CreateComplaintDialog } from '@/components/complaints/CreateComplaintDialog';
import { ViewComplaintDialog } from '@/components/complaints/ViewComplaintDialog';
import { UpdateComplaintDialog } from '@/components/complaints/UpdateComplaintDialog';
import { PieChart, Pie, Cell, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip as RechartsTooltip, Legend } from 'recharts';

interface Complaint {
  id: string;
  customer_name: string;
  customer_phone: string;
  branch_name: string;
  city: string;
  manager_id: string;
  manager_name: string;
  complaint_description: string;
  resolution_details: string | null;
  status: 'open' | 'in_progress' | 'closed';
  incident_date: string;
  created_at: string;
  notes: string | null;
  history_log: any[];
  created_by: string;
}

interface ComplaintWithAlerts extends Complaint {
  customerComplaintCount: number;
  managerComplaintCount: number;
}

export default function ComplaintsManagement() {
  const { user, isSuperAdmin, isManager } = useAuth();
  const [complaints, setComplaints] = useState<ComplaintWithAlerts[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [branchFilter, setBranchFilter] = useState<string>('all');
  const [managerFilter, setManagerFilter] = useState<string>('all');
  const [periodFilter, setPeriodFilter] = useState<string>('all');
  const [showFilters, setShowFilters] = useState(false);
  const [showStats, setShowStats] = useState(true);
  
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [viewDialogOpen, setViewDialogOpen] = useState(false);
  const [updateDialogOpen, setUpdateDialogOpen] = useState(false);
  const [selectedComplaint, setSelectedComplaint] = useState<ComplaintWithAlerts | null>(null);

  const canManage = isSuperAdmin || isManager;

  useEffect(() => {
    fetchComplaints();
  }, [user]);

  const fetchComplaints = async () => {
    if (!user) return;
    
    try {
      setLoading(true);
      
      const { data, error } = await supabase
        .from('complaints')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Get alert counts for each complaint
      const complaintsWithAlerts: ComplaintWithAlerts[] = await Promise.all(
        (data || []).map(async (complaint) => {
          const [customerCount, managerCount] = await Promise.all([
            supabase.rpc('get_customer_complaint_count', { phone: complaint.customer_phone }),
            supabase.rpc('get_manager_complaint_count', { mgr_id: complaint.manager_id })
          ]);

          return {
            ...complaint,
            history_log: Array.isArray(complaint.history_log) ? complaint.history_log : [],
            customerComplaintCount: customerCount.data || 0,
            managerComplaintCount: managerCount.data || 0
          } as ComplaintWithAlerts;
        })
      );

      setComplaints(complaintsWithAlerts);
    } catch (error: any) {
      console.error('Error fetching complaints:', error);
      toast.error('שגיאה בטעינת התלונות');
    } finally {
      setLoading(false);
    }
  };

  // Get unique values for filters
  const branches = useMemo(() => 
    [...new Set(complaints.map(c => c.branch_name).filter(Boolean))].sort(),
    [complaints]
  );
  
  const managers = useMemo(() => 
    [...new Set(complaints.map(c => c.manager_name).filter(Boolean))].sort(),
    [complaints]
  );

  // Period filter logic
  const getDateRange = (period: string) => {
    const now = new Date();
    switch (period) {
      case 'today':
        return { start: new Date(now.setHours(0, 0, 0, 0)), end: new Date() };
      case 'week':
        return { start: subDays(now, 7), end: new Date() };
      case 'month':
        return { start: startOfMonth(now), end: endOfMonth(now) };
      case 'quarter':
        return { start: subMonths(now, 3), end: new Date() };
      case 'year':
        return { start: subMonths(now, 12), end: new Date() };
      default:
        return null;
    }
  };

  // Filtered complaints
  const filteredComplaints = useMemo(() => {
    return complaints.filter(complaint => {
      const matchesSearch = searchTerm === '' || 
        complaint.customer_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        complaint.customer_phone.includes(searchTerm) ||
        complaint.complaint_description.toLowerCase().includes(searchTerm.toLowerCase()) ||
        complaint.branch_name.toLowerCase().includes(searchTerm.toLowerCase());
      
      const matchesStatus = statusFilter === 'all' || complaint.status === statusFilter;
      const matchesBranch = branchFilter === 'all' || complaint.branch_name === branchFilter;
      const matchesManager = managerFilter === 'all' || complaint.manager_name === managerFilter;
      
      let matchesPeriod = true;
      const dateRange = getDateRange(periodFilter);
      if (dateRange) {
        const incidentDate = parseISO(complaint.incident_date);
        matchesPeriod = isWithinInterval(incidentDate, { start: dateRange.start, end: dateRange.end });
      }
      
      return matchesSearch && matchesStatus && matchesBranch && matchesManager && matchesPeriod;
    });
  }, [complaints, searchTerm, statusFilter, branchFilter, managerFilter, periodFilter]);

  // Stats
  const stats = useMemo(() => ({
    total: filteredComplaints.length,
    open: filteredComplaints.filter(c => c.status === 'open').length,
    inProgress: filteredComplaints.filter(c => c.status === 'in_progress').length,
    closed: filteredComplaints.filter(c => c.status === 'closed').length,
    recurringCustomers: filteredComplaints.filter(c => c.customerComplaintCount > 2).length,
    managerAlerts: filteredComplaints.filter(c => c.managerComplaintCount > 2).length
  }), [filteredComplaints]);

  // Chart data - Status distribution
  const statusChartData = useMemo(() => [
    { name: 'פתוח', value: stats.open, color: 'hsl(var(--destructive))' },
    { name: 'בטיפול', value: stats.inProgress, color: '#f59e0b' },
    { name: 'סגור', value: stats.closed, color: '#10b981' }
  ].filter(d => d.value > 0), [stats]);

  // Chart data - By manager
  const managerChartData = useMemo(() => {
    const managerCounts = filteredComplaints.reduce((acc, complaint) => {
      const manager = complaint.manager_name || 'לא צוין';
      if (!acc[manager]) {
        acc[manager] = { name: manager, open: 0, inProgress: 0, closed: 0 };
      }
      if (complaint.status === 'open') acc[manager].open++;
      else if (complaint.status === 'in_progress') acc[manager].inProgress++;
      else acc[manager].closed++;
      return acc;
    }, {} as Record<string, { name: string; open: number; inProgress: number; closed: number }>);
    
    return Object.values(managerCounts).sort((a, b) => 
      (b.open + b.inProgress + b.closed) - (a.open + a.inProgress + a.closed)
    ).slice(0, 5);
  }, [filteredComplaints]);

  // Chart data - By branch
  const branchChartData = useMemo(() => {
    const branchCounts = filteredComplaints.reduce((acc, complaint) => {
      const branch = complaint.branch_name || 'לא צוין';
      acc[branch] = (acc[branch] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
    
    return Object.entries(branchCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([name, value]) => ({ name, value }));
  }, [filteredComplaints]);

  // Monthly trend data
  const monthlyTrendData = useMemo(() => {
    const months: Record<string, { month: string; count: number }> = {};
    const now = new Date();
    
    // Initialize last 6 months
    for (let i = 5; i >= 0; i--) {
      const date = subMonths(now, i);
      const key = format(date, 'yyyy-MM');
      const label = format(date, 'MMM', { locale: he });
      months[key] = { month: label, count: 0 };
    }
    
    complaints.forEach(complaint => {
      const key = format(parseISO(complaint.incident_date), 'yyyy-MM');
      if (months[key]) {
        months[key].count++;
      }
    });
    
    return Object.values(months);
  }, [complaints]);

  const exportToCSV = () => {
    const headers = [
      'שם לקוח',
      'איש קשר',
      'סניף',
      'מנהל אחראי',
      'תיאור תלונה',
      'פרטי טיפול',
      'סטטוס',
      'תאריך אירוע',
      'הערות'
    ];

    const rows = filteredComplaints.map(c => [
      c.customer_name,
      c.customer_phone,
      c.branch_name,
      c.manager_name,
      c.complaint_description,
      c.resolution_details || '',
      c.status === 'open' ? 'פתוח' : c.status === 'in_progress' ? 'בטיפול' : 'סגור',
      format(new Date(c.incident_date), 'dd/MM/yyyy'),
      c.notes || ''
    ]);

    const csvContent = '\uFEFF' + [headers, ...rows]
      .map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))
      .join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `complaints_${format(new Date(), 'yyyy-MM-dd')}.csv`;
    link.click();
    
    toast.success('הקובץ יוצא בהצלחה');
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'open':
        return <Badge variant="destructive">פתוח</Badge>;
      case 'in_progress':
        return <Badge className="bg-amber-500 hover:bg-amber-600">בטיפול</Badge>;
      case 'closed':
        return <Badge variant="secondary">סגור</Badge>;
      default:
        return <Badge>{status}</Badge>;
    }
  };

  const handleView = (complaint: ComplaintWithAlerts) => {
    setSelectedComplaint(complaint);
    setViewDialogOpen(true);
  };

  const handleUpdate = (complaint: ComplaintWithAlerts) => {
    setSelectedComplaint(complaint);
    setUpdateDialogOpen(true);
  };

  const clearFilters = () => {
    setStatusFilter('all');
    setBranchFilter('all');
    setManagerFilter('all');
    setPeriodFilter('all');
    setSearchTerm('');
  };

  const activeFiltersCount = [statusFilter, branchFilter, managerFilter, periodFilter]
    .filter(f => f !== 'all').length + (searchTerm ? 1 : 0);

  if (loading) {
    return (
      <div className="p-6 lg:p-8">
        <div className="flex items-center justify-center min-h-[60vh]">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 lg:p-8 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">ניהול תלונות לקוחות</h1>
          <p className="text-muted-foreground">מעקב וטיפול בתלונות לקוחות</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button 
            variant="outline" 
            onClick={() => setShowStats(!showStats)}
            size="sm"
          >
            <BarChart3 className="h-4 w-4 ml-2" />
            {showStats ? 'הסתר סטטיסטיקות' : 'הצג סטטיסטיקות'}
          </Button>
          <Button variant="outline" onClick={exportToCSV} size="sm">
            <Download className="h-4 w-4 ml-2" />
            ייצוא
          </Button>
          {canManage && (
            <Button onClick={() => setCreateDialogOpen(true)} size="sm">
              <Plus className="h-4 w-4 ml-2" />
              תלונה חדשה
            </Button>
          )}
        </div>
      </div>

      {/* Quick Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => setStatusFilter('all')}>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <MessageSquare className="h-5 w-5 text-muted-foreground" />
              <div>
                <p className="text-2xl font-bold">{stats.total}</p>
                <p className="text-xs text-muted-foreground">סה"כ תלונות</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => setStatusFilter('open')}>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-destructive" />
              <div>
                <p className="text-2xl font-bold text-destructive">{stats.open}</p>
                <p className="text-xs text-muted-foreground">פתוחות</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => setStatusFilter('in_progress')}>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <Clock className="h-5 w-5 text-amber-500" />
              <div>
                <p className="text-2xl font-bold text-amber-500">{stats.inProgress}</p>
                <p className="text-xs text-muted-foreground">בטיפול</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => setStatusFilter('closed')}>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <CheckCircle className="h-5 w-5 text-emerald-500" />
              <div>
                <p className="text-2xl font-bold text-emerald-500">{stats.closed}</p>
                <p className="text-xs text-muted-foreground">סגורות</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card className="border-destructive/50">
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <Users className="h-5 w-5 text-destructive" />
              <div>
                <p className="text-2xl font-bold text-destructive">{stats.recurringCustomers}</p>
                <p className="text-xs text-muted-foreground">לקוחות חוזרים</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card className="border-amber-500/50">
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-amber-500" />
              <div>
                <p className="text-2xl font-bold text-amber-500">{stats.managerAlerts}</p>
                <p className="text-xs text-muted-foreground">התראות מנהלים</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Statistics Dashboard */}
      {showStats && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Status Pie Chart */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">התפלגות לפי סטטוס</CardTitle>
            </CardHeader>
            <CardContent>
              {statusChartData.length > 0 ? (
                <ResponsiveContainer width="100%" height={180}>
                  <PieChart>
                    <Pie
                      data={statusChartData}
                      cx="50%"
                      cy="50%"
                      innerRadius={40}
                      outerRadius={70}
                      paddingAngle={2}
                      dataKey="value"
                      label={({ name, value }) => `${name}: ${value}`}
                      labelLine={false}
                    >
                      {statusChartData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <RechartsTooltip />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-[180px] flex items-center justify-center text-muted-foreground">
                  אין נתונים
                </div>
              )}
            </CardContent>
          </Card>

          {/* Monthly Trend */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <TrendingUp className="h-4 w-4" />
                מגמה חודשית
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={180}>
                <BarChart data={monthlyTrendData}>
                  <XAxis dataKey="month" fontSize={10} />
                  <YAxis fontSize={10} />
                  <RechartsTooltip />
                  <Bar dataKey="count" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* By Manager */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Users className="h-4 w-4" />
                לפי מנהל (טופ 5)
              </CardTitle>
            </CardHeader>
            <CardContent>
              {managerChartData.length > 0 ? (
                <ResponsiveContainer width="100%" height={180}>
                  <BarChart data={managerChartData} layout="vertical">
                    <XAxis type="number" fontSize={10} />
                    <YAxis type="category" dataKey="name" fontSize={10} width={60} />
                    <RechartsTooltip />
                    <Legend wrapperStyle={{ fontSize: '10px' }} />
                    <Bar dataKey="open" stackId="a" fill="hsl(var(--destructive))" name="פתוח" />
                    <Bar dataKey="inProgress" stackId="a" fill="#f59e0b" name="בטיפול" />
                    <Bar dataKey="closed" stackId="a" fill="#10b981" name="סגור" />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-[180px] flex items-center justify-center text-muted-foreground">
                  אין נתונים
                </div>
              )}
            </CardContent>
          </Card>

          {/* By Branch */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <CalendarDays className="h-4 w-4" />
                לפי סניף (טופ 5)
              </CardTitle>
            </CardHeader>
            <CardContent>
              {branchChartData.length > 0 ? (
                <div className="space-y-2">
                  {branchChartData.map((item, index) => (
                    <div key={index} className="flex items-center justify-between">
                      <span className="text-sm truncate max-w-[120px]">{item.name}</span>
                      <div className="flex items-center gap-2">
                        <div 
                          className="h-2 bg-primary rounded"
                          style={{ 
                            width: `${(item.value / branchChartData[0].value) * 80}px`,
                            minWidth: '10px'
                          }}
                        />
                        <span className="text-sm font-medium w-8 text-left">{item.value}</span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="h-[180px] flex items-center justify-center text-muted-foreground">
                  אין נתונים
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* Search and Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col gap-4">
            <div className="flex flex-col sm:flex-row gap-4">
              <div className="relative flex-1">
                <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="חיפוש לפי שם לקוח, סניף, תיאור..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pr-10"
                />
              </div>
              <Button
                variant="outline"
                onClick={() => setShowFilters(!showFilters)}
                className="sm:w-auto"
              >
                <Filter className="h-4 w-4 ml-2" />
                סינון
                {activeFiltersCount > 0 && (
                  <Badge variant="secondary" className="mr-2">{activeFiltersCount}</Badge>
                )}
              </Button>
            </div>

            {showFilters && (
              <div className="flex flex-col sm:flex-row gap-4 pt-4 border-t">
                <div className="flex-1">
                  <label className="text-sm text-muted-foreground mb-1 block">סטטוס</label>
                  <Select value={statusFilter} onValueChange={setStatusFilter}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">הכל</SelectItem>
                      <SelectItem value="open">פתוח</SelectItem>
                      <SelectItem value="in_progress">בטיפול</SelectItem>
                      <SelectItem value="closed">סגור</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                
                <div className="flex-1">
                  <label className="text-sm text-muted-foreground mb-1 block">סניף</label>
                  <Select value={branchFilter} onValueChange={setBranchFilter}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">הכל</SelectItem>
                      {branches.map(branch => (
                        <SelectItem key={branch} value={branch}>{branch}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                
                <div className="flex-1">
                  <label className="text-sm text-muted-foreground mb-1 block">מנהל אחראי</label>
                  <Select value={managerFilter} onValueChange={setManagerFilter}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">הכל</SelectItem>
                      {managers.map(manager => (
                        <SelectItem key={manager} value={manager}>{manager}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex-1">
                  <label className="text-sm text-muted-foreground mb-1 block">תקופה</label>
                  <Select value={periodFilter} onValueChange={setPeriodFilter}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">הכל</SelectItem>
                      <SelectItem value="today">היום</SelectItem>
                      <SelectItem value="week">שבוע אחרון</SelectItem>
                      <SelectItem value="month">החודש</SelectItem>
                      <SelectItem value="quarter">3 חודשים</SelectItem>
                      <SelectItem value="year">שנה</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                
                <div className="flex items-end">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={clearFilters}
                  >
                    <X className="h-4 w-4 ml-1" />
                    נקה
                  </Button>
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Table */}
      <Card>
        <CardHeader>
          <CardTitle>רשימת תלונות ({filteredComplaints.length})</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>תאריך</TableHead>
                  <TableHead>לקוח</TableHead>
                  <TableHead>סניף</TableHead>
                  <TableHead>מנהל אחראי</TableHead>
                  <TableHead>תיאור</TableHead>
                  <TableHead>סטטוס</TableHead>
                  <TableHead>פעולות</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredComplaints.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                      לא נמצאו תלונות
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredComplaints.map((complaint) => (
                    <TableRow key={complaint.id} className="cursor-pointer hover:bg-muted/50">
                      <TableCell>
                        {format(new Date(complaint.incident_date), 'dd/MM/yyyy', { locale: he })}
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col gap-1">
                          <span className="font-medium">{complaint.customer_name}</span>
                          {complaint.customer_phone && (
                            <span className="text-xs text-muted-foreground">{complaint.customer_phone}</span>
                          )}
                          {complaint.customerComplaintCount > 2 && (
                            <Badge variant="destructive" className="w-fit text-xs">
                              <AlertTriangle className="h-3 w-3 ml-1" />
                              לקוח חוזר ({complaint.customerComplaintCount})
                            </Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>{complaint.branch_name}</TableCell>
                      <TableCell>
                        <div className="flex flex-col gap-1">
                          <span>{complaint.manager_name}</span>
                          {complaint.managerComplaintCount > 2 && (
                            <Badge className="w-fit text-xs bg-amber-500 hover:bg-amber-600">
                              <AlertTriangle className="h-3 w-3 ml-1" />
                              נדרשת תשומת לב
                            </Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="max-w-[200px] truncate">
                        {complaint.complaint_description}
                      </TableCell>
                      <TableCell>{getStatusBadge(complaint.status)}</TableCell>
                      <TableCell>
                        <div className="flex gap-2">
                          <Button variant="ghost" size="sm" onClick={() => handleView(complaint)}>
                            צפה
                          </Button>
                          {canManage && (
                            <Button variant="ghost" size="sm" onClick={() => handleUpdate(complaint)}>
                              עדכן
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Dialogs */}
      <CreateComplaintDialog
        open={createDialogOpen}
        onOpenChange={setCreateDialogOpen}
        onSuccess={fetchComplaints}
      />

      {selectedComplaint && (
        <>
          <ViewComplaintDialog
            open={viewDialogOpen}
            onOpenChange={setViewDialogOpen}
            complaint={selectedComplaint}
          />
          
          <UpdateComplaintDialog
            open={updateDialogOpen}
            onOpenChange={setUpdateDialogOpen}
            complaint={selectedComplaint}
            onSuccess={fetchComplaints}
          />
        </>
      )}
    </div>
  );
}
