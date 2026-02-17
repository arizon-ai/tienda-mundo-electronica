import { createClient } from '@supabase/supabase-js';

// Backend client with service role key (full access)
export const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);
