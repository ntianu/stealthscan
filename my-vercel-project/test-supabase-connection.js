import { createClient } from '@supabase/supabase-js';

// Get environment variables
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

// Check if environment variables are set
if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Error: Missing Supabase environment variables');
  console.error('Make sure NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are set');
  process.exit(1);
}

// Create Supabase client
const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function testConnection() {
  console.log('Testing Supabase connection...');
  
  try {
    // Test connection by querying the style_personas table
    const { data, error } = await supabase
      .from('style_personas')
      .select('*')
      .limit(1);
    
    if (error) {
      console.error('Error querying Supabase:', error.message);
      return false;
    }
    
    console.log('Successfully connected to Supabase!');
    console.log('Sample data:', data);
    
    // Check if tables exist
    console.log('\nChecking if tables exist...');
    
    const tables = ['wardrobe_items', 'style_personas', 'essential_items', 'user_style_personas'];
    
    for (const table of tables) {
      const { data, error } = await supabase
        .from(table)
        .select('count(*)', { count: 'exact' });
      
      if (error) {
        console.error(`Error checking table ${table}:`, error.message);
      } else {
        console.log(`Table ${table} exists with ${data.length} rows`);
      }
    }
    
    return true;
  } catch (error) {
    console.error('Unexpected error:', error.message);
    return false;
  }
}

// Run the test
testConnection()
  .then(success => {
    if (success) {
      console.log('\nAll tests completed successfully!');
    } else {
      console.error('\nSome tests failed. Please check the errors above.');
    }
  })
  .catch(error => {
    console.error('Fatal error:', error);
  });

// Run this script with `node test-supabase-connection.js`
// If successful, you should see output like:
// Testing Supabase connection...
// Successfully connected to Supabase!
// Sample data: [ { id: '1', name: 'Classic', description: 'Timeless and elegant' } ]
