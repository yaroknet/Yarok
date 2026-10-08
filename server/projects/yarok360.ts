import { getDb } from "../db.ts";
import { hasRole, type RequestContext } from "../policies.ts";

/** Portal module (site `modules` table) that gives office staff the "360" button into Yarok 360 */
export const YAROK360_MODULE = "yarok360";

/** Roles inside Yarok 360 (super_admin aside) */
export const YAROK360_ROLES = ["office_manager", "team_leader", "contractor", "contractor_worker", "customer"];

/**
 * Whether the caller may enter Yarok 360. super_admin always may (as with every portal module);
 * everyone else needs the "360" module switched on in the portal admin screen.
 */
export async function canEnterYarok360(ctx: RequestContext): Promise<boolean> {
  if (!ctx.uid) return false;
  if (hasRole(ctx, "super_admin")) return true;
  const mod = await getDb().collection("modules").findOne({ name: YAROK360_MODULE, is_active: true });
  if (!mod) return false;
  const permission = await getDb()
    .collection("user_module_permissions")
    .findOne({ user_id: ctx.uid, module_id: mod._id, has_access: true });
  return !!permission;
}
