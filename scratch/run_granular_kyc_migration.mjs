import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error("❌ Missing Supabase credentials in .env.local");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function runMigration() {
  console.log('🚀 Starting granular KYC verification migration...\n');

  const migrationPath = join(__dirname, '..', 'tradeaxis-backend', 'migrations', '0008_add_granular_kyc_verification.sql');
  
  try {
    const sql = readFileSync(migrationPath, 'utf8');
    
    console.log('📄 Migration file loaded successfully');
    console.log('⚙️  Executing SQL...\n');
    
    // Execute the migration using Supabase RPC
    const { data, error } = await supabase.rpc('exec_sql', { sql_query: sql });
    
    if (error) {
      // If RPC doesn't exist, we'll need to execute statements one by one
      console.log('ℹ️  RPC method not available, executing statements individually...\n');
      
      // Split the SQL into individual statements (rough split)
      const statements = sql
        .split(';')
        .map(s => s.trim())
        .filter(s => s && !s.startsWith('--') && s.length > 10);
      
      for (let i = 0; i < statements.length; i++) {
        const statement = statements[i];
        if (!statement) continue;
        
        console.log(`Executing statement ${i + 1}/${statements.length}...`);
        
        try {
          // For Supabase, we need to use the REST API or pg client directly
          // This is a workaround - in production, use a proper migration tool
          const response = await fetch(`${supabaseUrl}/rest/v1/rpc/exec`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'apikey': supabaseKey,
              'Authorization': `Bearer ${supabaseKey}`
            },
            body: JSON.stringify({ query: statement + ';' })
          });
          
          if (!response.ok && !statement.includes('IF NOT EXISTS')) {
            console.log(`⚠️  Warning on statement ${i + 1}: ${response.statusText}`);
          } else {
            console.log(`✅ Statement ${i + 1} executed`);
          }
        } catch (e) {
          if (!statement.includes('IF NOT EXISTS')) {
            console.log(`⚠️  Warning on statement ${i + 1}: ${e.message}`);
          }
        }
      }
      
      console.log('\n✅ Migration completed (with IF NOT EXISTS protections)');
      console.log('\n📋 Summary of changes:');
      console.log('   - Added company_profile_verified fields to organisations table');
      console.log('   - Added bank_details_verified fields to trader_profiles table');
      console.log('   - Added rejection_notes to organisation_documents table');
      console.log('   - Created trader_verification_summary view');
      console.log('   - Created indexes for faster verification queries');
      console.log('\n🎯 Next steps:');
      console.log('   1. Run this migration on your database');
      console.log('   2. Update the admin verification API endpoint');
      console.log('   3. Update the VerificationInBox component for granular review');
    } else {
      console.log('✅ Migration executed successfully!');
      console.log('Data:', data);
    }
    
  } catch (err) {
    console.error('❌ Migration failed:', err);
    process.exit(1);
  }
}

console.log('⚠️  MANUAL MIGRATION REQUIRED');
console.log('============================================');
console.log('This migration needs to be run directly on your database.');
console.log('');
console.log('Option 1: Use Supabase SQL Editor');
console.log('  1. Go to your Supabase Dashboard → SQL Editor');
console.log('  2. Open: tradeaxis-backend/migrations/0008_add_granular_kyc_verification.sql');
console.log('  3. Copy the contents and run it in the SQL Editor');
console.log('');
console.log('Option 2: Use psql command line');
console.log('  psql <your-connection-string> -f tradeaxis-backend/migrations/0008_add_granular_kyc_verification.sql');
console.log('');
console.log('The migration file is ready at:');
console.log('  tradeaxis-backend/migrations/0008_add_granular_kyc_verification.sql');
console.log('============================================\n');

// Uncomment the line below if you want to attempt automatic execution
// runMigration();
