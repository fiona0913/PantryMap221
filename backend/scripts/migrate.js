const fs = require('fs');
const path = require('path');
const { db, runQuery, getQuery } = require('../database/db');

async function migratePantries() {
  console.log('🔄 Starting data migration...');

  // Read pantries.json from frontend bundle
  const pantriesPath = path.join(__dirname, '../../frontend/pantries.json');
  const pantriesData = JSON.parse(fs.readFileSync(pantriesPath, 'utf8'));

  console.log(`📦 Found ${pantriesData.length} pantries to migrate`);

  let successCount = 0;
  let errorCount = 0;

  for (const pantry of pantriesData) {
    try {
      // Insert pantry
      await runQuery(`
        INSERT OR REPLACE INTO pantries (
          id, name, status, address, latitude, longitude, pantry_type,
          accepted_food_types, hours, photos,
          contact_owner, contact_phone, contact_manager, contact_volunteer
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        pantry.id,
        pantry.name || 'Untitled Pantry',
        pantry.status || 'open',
        pantry.address || '',
        pantry.location?.lat || 0,
        pantry.location?.lng || 0,
        pantry.pantryType || 'shelf',
        JSON.stringify(pantry.acceptedFoodTypes || []),
        JSON.stringify(pantry.hours || {}),
        JSON.stringify(pantry.photos || []),
        pantry.contact?.owner || '',
        pantry.contact?.phone || '',
        pantry.contact?.manager || '',
        pantry.contact?.volunteer || ''
      ]);


      // Insert inventory
      if (pantry.inventory?.categories) {
        await runQuery('DELETE FROM inventory WHERE pantry_id = ?', [pantry.id]);
        for (const cat of pantry.inventory.categories) {
          await runQuery(
            'INSERT INTO inventory (pantry_id, category_name, quantity) VALUES (?, ?, ?)',
            [pantry.id, cat.name, cat.quantity || 0]
          );
        }
      }

      // Insert sensors
      if (pantry.sensors) {
        await runQuery(`
          INSERT OR REPLACE INTO sensors (
            pantry_id, weight_kg, last_door_event, food_condition, updated_at
          ) VALUES (?, ?, ?, ?, ?)
        `, [
          pantry.id,
          pantry.sensors.weightKg || 0,
          pantry.sensors.lastDoorEvent || '',
          pantry.sensors.foodCondition || '',
          pantry.sensors.updatedAt || new Date().toISOString()
        ]);
      }

      // Insert stats
      if (pantry.stats) {
        await runQuery(`
          INSERT OR REPLACE INTO stats (
            pantry_id, visits_per_day, visits_per_week,
            donation_avg_per_day_kg, donation_avg_per_week_kg, popular_times
          ) VALUES (?, ?, ?, ?, ?, ?)
        `, [
          pantry.id,
          pantry.stats.visitsPerDay || 0,
          pantry.stats.visitsPerWeek || 0,
          pantry.stats.donationAvgPerDayKg || 0,
          pantry.stats.donationAvgPerWeekKg || 0,
          JSON.stringify(pantry.stats.popularTimes || [])
        ]);
      }

      // Insert wishlist
      if (pantry.wishlist && Array.isArray(pantry.wishlist)) {
        await runQuery('DELETE FROM wishlist WHERE pantry_id = ?', [pantry.id]);
        for (const item of pantry.wishlist) {
          await runQuery(
            'INSERT INTO wishlist (pantry_id, item) VALUES (?, ?)',
            [pantry.id, item]
          );
        }
      }

      successCount++;
      if (successCount % 50 === 0) {
        console.log(`  ✅ Migrated ${successCount}/${pantriesData.length} pantries...`);
      }
    } catch (error) {
      console.error(`  ❌ Error migrating pantry ${pantry.id}:`, error.message);
      errorCount++;
    }
  }

  console.log(`\n✨ Migration complete!`);
  console.log(`   ✅ Success: ${successCount}`);
  console.log(`   ❌ Errors: ${errorCount}`);
  
  db.close();
}

// Run migration
migratePantries().catch(console.error);

