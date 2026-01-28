const fs = require('fs');
const path = require('path');
const { pool, runQuery, getQuery } = require('../database/db-pg');

async function migratePantries() {
  console.log('🔄 Starting PostgreSQL data migration...');

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
        INSERT INTO pantries (
          id, name, status, address, latitude, longitude, pantry_type,
          accepted_food_types, hours, photos,
          contact_owner, contact_phone, contact_manager, contact_volunteer
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
        ON CONFLICT (id) DO UPDATE SET
          name = EXCLUDED.name,
          status = EXCLUDED.status,
          address = EXCLUDED.address,
          latitude = EXCLUDED.latitude,
          longitude = EXCLUDED.longitude,
          pantry_type = EXCLUDED.pantry_type,
          accepted_food_types = EXCLUDED.accepted_food_types,
          hours = EXCLUDED.hours,
          photos = EXCLUDED.photos,
          contact_owner = EXCLUDED.contact_owner,
          contact_phone = EXCLUDED.contact_phone,
          contact_manager = EXCLUDED.contact_manager,
          contact_volunteer = EXCLUDED.contact_volunteer,
          updated_at = CURRENT_TIMESTAMP
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
        await runQuery('DELETE FROM inventory WHERE pantry_id = $1', [pantry.id]);
        for (const cat of pantry.inventory.categories) {
          await runQuery(
            'INSERT INTO inventory (pantry_id, category_name, quantity) VALUES ($1, $2, $3)',
            [pantry.id, cat.name, cat.quantity || 0]
          );
        }
      }

      // Insert sensors
      if (pantry.sensors) {
        await runQuery(`
          INSERT INTO sensors (
            pantry_id, weight_kg, last_door_event, food_condition, updated_at
          ) VALUES ($1, $2, $3, $4, $5)
          ON CONFLICT (pantry_id) DO UPDATE SET
            weight_kg = EXCLUDED.weight_kg,
            last_door_event = EXCLUDED.last_door_event,
            food_condition = EXCLUDED.food_condition,
            updated_at = EXCLUDED.updated_at
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
          INSERT INTO stats (
            pantry_id, visits_per_day, visits_per_week,
            donation_avg_per_day_kg, donation_avg_per_week_kg, popular_times
          ) VALUES ($1, $2, $3, $4, $5, $6)
          ON CONFLICT (pantry_id) DO UPDATE SET
            visits_per_day = EXCLUDED.visits_per_day,
            visits_per_week = EXCLUDED.visits_per_week,
            donation_avg_per_day_kg = EXCLUDED.donation_avg_per_day_kg,
            donation_avg_per_week_kg = EXCLUDED.donation_avg_per_week_kg,
            popular_times = EXCLUDED.popular_times
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
        await runQuery('DELETE FROM wishlist WHERE pantry_id = $1', [pantry.id]);
        for (const item of pantry.wishlist) {
          await runQuery(
            'INSERT INTO wishlist (pantry_id, item) VALUES ($1, $2)',
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
  
  await pool.end();
}

// Run migration
migratePantries().catch(console.error);




