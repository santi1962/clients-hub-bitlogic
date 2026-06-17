/**
 * Job: HestiaCP Sync Daily
 * Phase 4E.1: Detection only (no sync performed yet)
 */
import pool from "../db/pool.js";

export async function hestiaSyncDaily() {
  // Find all services with hestia_username
  const query = `
    SELECT
      id,
      domain,
      client_id,
      hestia_username,
      storage_used_gb
    FROM hosting_services
    WHERE hestia_username IS NOT NULL
    AND hestia_username != ''
    ORDER BY domain ASC
  `;

  const result = await pool.query(query);
  const services = result.rows;

  const summary = {
    servicesWithHestia: services.length,
    usersDetected: new Set(),
    storageByUser: {},
    summary: "Ready for manual sync",
  };

  // Count unique users and aggregate storage
  for (const service of services) {
    if (service.hestia_username) {
      summary.usersDetected.add(service.hestia_username);

      if (!summary.storageByUser[service.hestia_username]) {
        summary.storageByUser[service.hestia_username] = {
          count: 0,
          totalGb: 0,
        };
      }

      summary.storageByUser[service.hestia_username].count += 1;
      summary.storageByUser[service.hestia_username].totalGb += parseFloat(service.storage_used_gb || 0);
    }
  }

  // Convert Set to array for JSON serialization
  const usersArray = Array.from(summary.usersDetected);

  const finalSummary = {
    servicesWithHestia: summary.servicesWithHestia,
    uniqueUsers: usersArray.length,
    usersDetected: usersArray,
    storageByUser: summary.storageByUser,
    status: "ready_for_sync",
  };

  console.log(`[Job] hestiaSyncDaily: ${services.length} services, ${usersArray.length} unique users`);

  return finalSummary;
}
