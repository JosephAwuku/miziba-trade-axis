import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error("Missing Supabase credentials in .env.local");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function check() {
  const { data: users, error: error1 } = await supabase.from('users').select('*');
  console.log("Users in DB:", users?.length, error1 ? error1.message : "");
  
  const { data: trades, error: error2 } = await supabase.from('trades').select('*');
  console.log("Trades in DB:", trades?.length, error2 ? error2.message : "");
}
check();
