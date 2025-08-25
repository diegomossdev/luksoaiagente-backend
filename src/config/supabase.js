import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";

dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_ANON_KEY;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey || !supabaseServiceKey) {
  throw new Error("Missing Supabase configuration in environment variables");
}

// Cliente para operações públicas (auth, etc)
export const supabase = createClient(supabaseUrl, supabaseKey);

// Cliente administrativo para operações privilegiadas
export const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

export { supabaseUrl, supabaseKey };
