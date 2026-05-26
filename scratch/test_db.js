
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

async function test() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  
  if (!url || !key) {
    console.error('Missing Env vars');
    return;
  }

  const supabase = createClient(url, key);
  
  console.log('Testing connection to:', url);
  
  const { data: buyers, error: bError } = await supabase.from('buyers').select('id, name');
  if (bError) console.error('Buyers Error:', bError);
  else console.log('Buyers count:', buyers.length, buyers);

  const { data: users, error: uError } = await supabase.from('users').select('id, email');
  if (uError) console.error('Users Error:', uError);
  else console.log('Users count:', users.length, users);
}

test();
