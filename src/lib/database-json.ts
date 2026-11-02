import type { Json } from "@/types/supabase";
/** Normalize domain values to PostgreSQL JSON, dropping undefined object fields. */
export function toDatabaseJson(value: unknown): Json {
  return JSON.parse(JSON.stringify(value)) as Json;
}
