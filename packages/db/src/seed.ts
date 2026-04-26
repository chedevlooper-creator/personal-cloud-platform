import { db } from './client';
import * as schema from './schema';

async function main() {
  console.log('🌱 Starting database seeding...');
  
  try {
    // Add your seed logic here
    // Example:
    // await db.insert(schema.users).values([
    //   { name: 'Admin User', email: 'admin@example.com' }
    // ]);
    
    console.log('✅ Seeding completed successfully');
  } catch (error) {
    console.error('❌ Seeding failed:', error);
    process.exit(1);
  } finally {
    process.exit(0);
  }
}

main();