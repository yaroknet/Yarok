import { useEffect, useState } from 'react';
import { Plus, Trash2, Users, Loader2, UserPlus, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface Team {
  id: string;
  name: string;
  manager_id: string | null;
  created_at: string;
}

interface TeamMember {
  id: string;
  team_id: string;
  user_id: string;
}

interface Profile {
  id: string;
  user_id: string;
  full_name: string;
  email: string | null;
}

export const TeamsManager = () => {
  const [teams, setTeams] = useState<Team[]>([]);
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [newTeamName, setNewTeamName] = useState('');
  const [newTeamManagerId, setNewTeamManagerId] = useState('');
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isAddMemberDialogOpen, setIsAddMemberDialogOpen] = useState(false);
  const [selectedTeamId, setSelectedTeamId] = useState<string | null>(null);
  const [selectedUserId, setSelectedUserId] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [teamsRes, membersRes, profilesRes] = await Promise.all([
        supabase.from('teams').select('*').order('created_at', { ascending: false }),
        supabase.from('team_members').select('*'),
        supabase.from('profiles').select('id, user_id, full_name, email'),
      ]);

      if (teamsRes.error) throw teamsRes.error;
      if (membersRes.error) throw membersRes.error;
      if (profilesRes.error) throw profilesRes.error;

      setTeams(teamsRes.data || []);
      setTeamMembers(membersRes.data || []);
      setProfiles(profilesRes.data || []);
    } catch (error) {
      console.error('Error fetching data:', error);
      toast.error('שגיאה בטעינת הנתונים');
    } finally {
      setLoading(false);
    }
  };

  const getProfileByUserId = (userId: string) => {
    return profiles.find(p => p.user_id === userId);
  };

  const getTeamMembers = (teamId: string) => {
    return teamMembers
      .filter(tm => tm.team_id === teamId)
      .map(tm => ({
        ...tm,
        profile: getProfileByUserId(tm.user_id),
      }));
  };

  const getAvailableUsersForTeam = (teamId: string) => {
    const existingMemberIds = teamMembers
      .filter(tm => tm.team_id === teamId)
      .map(tm => tm.user_id);

    return profiles.filter(p => !existingMemberIds.includes(p.user_id));
  };

  const handleCreateTeam = async () => {
    if (!newTeamName.trim()) {
      toast.error('נא להזין שם לצוות');
      return;
    }

    setSaving(true);
    try {
      const { data, error } = await supabase
        .from('teams')
        .insert({
          name: newTeamName,
          manager_id: newTeamManagerId || null,
        })
        .select()
        .single();

      if (error) throw error;

      setTeams(prev => [data, ...prev]);
      setNewTeamName('');
      setNewTeamManagerId('');
      setIsCreateDialogOpen(false);
      toast.success('הצוות נוצר בהצלחה');
    } catch (error) {
      console.error('Error creating team:', error);
      toast.error('שגיאה ביצירת הצוות');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteTeam = async (teamId: string) => {
    if (!confirm('האם אתה בטוח שברצונך למחוק את הצוות?')) return;

    try {
      const { error } = await supabase.from('teams').delete().eq('id', teamId);

      if (error) throw error;

      setTeams(prev => prev.filter(t => t.id !== teamId));
      setTeamMembers(prev => prev.filter(tm => tm.team_id !== teamId));
      toast.success('הצוות נמחק בהצלחה');
    } catch (error) {
      console.error('Error deleting team:', error);
      toast.error('שגיאה במחיקת הצוות');
    }
  };

  const handleAddMember = async () => {
    if (!selectedTeamId || !selectedUserId) {
      toast.error('נא לבחור משתמש');
      return;
    }

    setSaving(true);
    try {
      const { data, error } = await supabase
        .from('team_members')
        .insert({
          team_id: selectedTeamId,
          user_id: selectedUserId,
        })
        .select()
        .single();

      if (error) throw error;

      setTeamMembers(prev => [...prev, data]);
      setSelectedUserId('');
      setIsAddMemberDialogOpen(false);
      toast.success('החבר נוסף לצוות');
    } catch (error) {
      console.error('Error adding member:', error);
      toast.error('שגיאה בהוספת החבר');
    } finally {
      setSaving(false);
    }
  };

  const handleRemoveMember = async (memberId: string) => {
    try {
      const { error } = await supabase.from('team_members').delete().eq('id', memberId);

      if (error) throw error;

      setTeamMembers(prev => prev.filter(tm => tm.id !== memberId));
      toast.success('החבר הוסר מהצוות');
    } catch (error) {
      console.error('Error removing member:', error);
      toast.error('שגיאה בהסרת החבר');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              ניהול צוותים
            </CardTitle>
            <CardDescription>
              צור וערוך צוותים להגדרת היררכיית הנתונים
            </CardDescription>
          </div>

          <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
            <DialogTrigger asChild>
              <Button className="gap-2">
                <Plus className="h-4 w-4" />
                צוות חדש
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>יצירת צוות חדש</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="team-name">שם הצוות</Label>
                  <Input
                    id="team-name"
                    value={newTeamName}
                    onChange={e => setNewTeamName(e.target.value)}
                    placeholder="הזן שם לצוות"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="team-manager">מנהל הצוות</Label>
                  <Select value={newTeamManagerId} onValueChange={setNewTeamManagerId}>
                    <SelectTrigger>
                      <SelectValue placeholder="בחר מנהל צוות" />
                    </SelectTrigger>
                    <SelectContent>
                      {profiles.map(profile => (
                        <SelectItem key={profile.user_id} value={profile.user_id}>
                          {profile.full_name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setIsCreateDialogOpen(false)}>
                  ביטול
                </Button>
                <Button onClick={handleCreateTeam} disabled={saving}>
                  {saving && <Loader2 className="h-4 w-4 animate-spin ml-2" />}
                  צור צוות
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </CardHeader>

        <CardContent>
          <div className="space-y-4">
            {teams.map(team => {
              const members = getTeamMembers(team.id);
              const manager = team.manager_id ? getProfileByUserId(team.manager_id) : null;

              return (
                <Card key={team.id} className="overflow-hidden">
                  <div className="p-4 bg-muted/30 border-b border-border">
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="font-semibold text-foreground">{team.name}</h3>
                        {manager && (
                          <p className="text-sm text-muted-foreground">
                            מנהל: {manager.full_name}
                          </p>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant="secondary">{members.length} חברים</Badge>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleDeleteTeam(team.id)}
                          className="text-destructive hover:text-destructive"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </div>

                  <div className="p-4">
                    <div className="flex flex-wrap gap-2 mb-3">
                      {members.map(member => (
                        <Badge
                          key={member.id}
                          variant="outline"
                          className="flex items-center gap-1 pr-1"
                        >
                          {member.profile?.full_name || 'משתמש לא ידוע'}
                          <button
                            onClick={() => handleRemoveMember(member.id)}
                            className="p-0.5 hover:bg-destructive/20 rounded"
                          >
                            <X className="h-3 w-3" />
                          </button>
                        </Badge>
                      ))}
                    </div>

                    <Dialog
                      open={isAddMemberDialogOpen && selectedTeamId === team.id}
                      onOpenChange={open => {
                        setIsAddMemberDialogOpen(open);
                        if (!open) setSelectedTeamId(null);
                      }}
                    >
                      <DialogTrigger asChild>
                        <Button
                          variant="outline"
                          size="sm"
                          className="gap-2"
                          onClick={() => setSelectedTeamId(team.id)}
                        >
                          <UserPlus className="h-4 w-4" />
                          הוסף חבר
                        </Button>
                      </DialogTrigger>
                      <DialogContent>
                        <DialogHeader>
                          <DialogTitle>הוספת חבר לצוות</DialogTitle>
                        </DialogHeader>
                        <div className="space-y-4 py-4">
                          <div className="space-y-2">
                            <Label>בחר משתמש</Label>
                            <Select value={selectedUserId} onValueChange={setSelectedUserId}>
                              <SelectTrigger>
                                <SelectValue placeholder="בחר משתמש" />
                              </SelectTrigger>
                              <SelectContent>
                                {getAvailableUsersForTeam(team.id).map(profile => (
                                  <SelectItem key={profile.user_id} value={profile.user_id}>
                                    {profile.full_name}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                        </div>
                        <DialogFooter>
                          <Button
                            variant="outline"
                            onClick={() => setIsAddMemberDialogOpen(false)}
                          >
                            ביטול
                          </Button>
                          <Button onClick={handleAddMember} disabled={saving}>
                            {saving && <Loader2 className="h-4 w-4 animate-spin ml-2" />}
                            הוסף
                          </Button>
                        </DialogFooter>
                      </DialogContent>
                    </Dialog>
                  </div>
                </Card>
              );
            })}

            {teams.length === 0 && (
              <div className="text-center py-8 text-muted-foreground">
                לא נמצאו צוותים. לחץ על "צוות חדש" ליצירת צוות.
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
