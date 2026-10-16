/**
 * Conexión con Supabase.
 *
 * La clave "publishable" es pública por diseño: va dentro de la app y solo
 * permite lo que dejan las reglas de seguridad de supabase/schema.sql.
 * Nunca pongas aquí una clave "secret" o "service_role".
 */
export const SUPABASE_URL = "https://pnuwlpwomiltzypqpwrn.supabase.co";
export const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_gF8pXSZosxzCUgCn0IdysA_JDQl3fWx";
