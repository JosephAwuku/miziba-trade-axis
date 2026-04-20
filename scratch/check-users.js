
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

async function checkUsers() {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );

  const { data, error } = await supabase.from('users').select('id, email, role');
  if (error) {
    console.error('Error fetching users:', error);
  } else {
    console.log('Users found:', data);
  }
}

checkUsers();
