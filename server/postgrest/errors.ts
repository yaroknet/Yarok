/** Error shaped like PostgREST / Postgres errors so supabase-js surfaces them unchanged */
export class PgError extends Error {
  status: number;
  code: string;
  details: string | null;
  hint: string | null;

  constructor(status: number, code: string, message: string, details: string | null = null, hint: string | null = null) {
    super(message);
    this.status = status;
    this.code = code;
    this.details = details;
    this.hint = hint;
  }

  toJSON() {
    return { code: this.code, details: this.details, hint: this.hint, message: this.message };
  }
}

export function rlsViolation(table: string, anonymous: boolean): PgError {
  return new PgError(
    anonymous ? 401 : 403,
    "42501",
    `new row violates row-level security policy for table "${table}"`,
  );
}
