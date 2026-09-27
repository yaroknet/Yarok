import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';

export type DataScope = 'personal' | 'team' | 'global';

interface DataScopeResult {
  scope: DataScope;
  teamMemberIds: string[];
  loading: boolean;
  canViewFinancialData: boolean;
  canViewOtherUsers: boolean;
}

export const useDataScope = (moduleName: string = 'fleet_management'): DataScopeResult => {
  const { user, userRole } = useAuth();
  const [scope, setScope] = useState<DataScope>('personal');
  const [teamMemberIds, setTeamMemberIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchDataScope = async () => {
      if (!user) {
        setLoading(false);
        return;
      }

      // Super admins always have global access
      if (userRole === 'super_admin') {
        setScope('global');
        setLoading(false);
        return;
      }

      try {
        // Get user's module permission
        const { data: modules } = await supabase
          .from('modules')
          .select('id')
          .eq('name', moduleName)
          .single();

        if (modules) {
          const { data: permission } = await supabase
            .from('user_module_permissions')
            .select('data_scope')
            .eq('user_id', user.id)
            .eq('module_id', modules.id)
            .single();

          const userScope = (permission?.data_scope as DataScope) || 'personal';
          setScope(userScope);

          // If team scope, fetch team member IDs
          if (userScope === 'team') {
            const { data: teams } = await supabase
              .from('teams')
              .select('id')
              .eq('manager_id', user.id);

            if (teams && teams.length > 0) {
              const teamIds = teams.map(t => t.id);
              
              const { data: members } = await supabase
                .from('team_members')
                .select('user_id')
                .in('team_id', teamIds);

              if (members) {
                const memberIds = members.map(m => m.user_id);
                // Include the user's own ID
                setTeamMemberIds([...new Set([user.id, ...memberIds])]);
              }
            } else {
              // User is not a manager of any team, only show their own data
              setTeamMemberIds([user.id]);
            }
          }
        }
      } catch (error) {
        console.error('Error fetching data scope:', error);
        setScope('personal');
      } finally {
        setLoading(false);
      }
    };

    fetchDataScope();
  }, [user, userRole, moduleName]);

  // Derived permissions based on scope
  // Only 'global' scope can view financial data and other users' data
  const canViewFinancialData = scope === 'global';
  const canViewOtherUsers = scope === 'global';

  return { scope, teamMemberIds, loading, canViewFinancialData, canViewOtherUsers };
};

// Helper function to build query filters based on scope
export const buildScopeFilter = (
  scope: DataScope,
  userId: string,
  teamMemberIds: string[],
  fieldName: string = 'driver_id'
) => {
  switch (scope) {
    case 'global':
      return null; // No filter needed
    case 'team':
      return { field: fieldName, operator: 'in', value: teamMemberIds };
    case 'personal':
    default:
      return { field: fieldName, operator: 'eq', value: userId };
  }
};

// Helper to check if user can view specific data
export const canViewUserData = (
  scope: DataScope, 
  userId: string, 
  teamMemberIds: string[], 
  targetUserId: string
): boolean => {
  switch (scope) {
    case 'global':
      return true;
    case 'team':
      return teamMemberIds.includes(targetUserId);
    case 'personal':
    default:
      return userId === targetUserId;
  }
};
