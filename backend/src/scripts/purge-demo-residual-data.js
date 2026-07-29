#!/usr/bin/env node

/**
 * Purge Demo Residual Data
 *
 * Script seguro para eliminar datos demo residuales de la BD
 * - Respeta FK constraints
 * - No toca datos reales
 * - Listifica antes de eliminar
 * - Verifica después
 */

import 'dotenv/config';
import pkg from 'pg';
const { Pool } = pkg;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

// IDs de demo a eliminar
const DEMO_DATA = {
  clients: [
    { id: '22222222-2222-2222-2222-000000000008', name: 'Joaquín Méndez', reason: 'Demo ID pattern' },
    { id: '22222222-2222-2222-2222-000000000007', name: 'Romina Vidal', reason: 'Demo ID pattern + old date' },
  ],
  services: [
    { id: '33333333-3333-3333-3333-000000000009', domain: 'dentalplus.com', price: 18, reason: 'Demo ID pattern, cancelled' },
    { id: '33333333-3333-3333-3333-000000000010', domain: 'tiendamendez.com', price: 18, reason: 'Demo ID pattern' },
    { id: 'c41ec652-d11d-409e-bc7f-a428a03c3eec', domain: 'premieresrl.com.ar', price: 18, reason: 'Old duplicate, demo price' },
  ],
  plans: [
    { id: '11111111-1111-1111-1111-000000000001', name: 'Starter', price: 8, reason: 'Demo ID pattern' },
    { id: '11111111-1111-1111-1111-000000000002', name: 'Pro', price: 18, reason: 'Demo ID pattern' },
    { id: '11111111-1111-1111-1111-000000000003', name: 'Business', price: 35, reason: 'Demo ID pattern' },
  ],
  domains: [
    // Dominios dudosos sin ID o fecha (vinculados a demo)
    { condition: "domain = 'premieresrl.com.ar' AND created_at IS NULL", reason: 'No metadata' },
  ],
};

async function listDemoData(client) {
  console.log('📋 DATOS DEMO A ELIMINAR:');
  console.log('');

  // Clientes
  console.log('❌ CLIENTES:');
  for (const { id, name, reason } of DEMO_DATA.clients) {
    const result = await client.query('SELECT id, name, company, status FROM clients WHERE id = $1', [id]);
    if (result.rows.length > 0) {
      const row = result.rows[0];
      console.log(`   ${name} (${id})`);
      console.log(`   → Company: ${row.company}, Status: ${row.status}, Reason: ${reason}`);
    }
  }
  console.log('');

  // Servicios
  console.log('❌ SERVICIOS:');
  for (const { id, domain, price, reason } of DEMO_DATA.services) {
    const result = await client.query('SELECT id, domain, monthly_price, status FROM hosting_services WHERE id = $1', [id]);
    if (result.rows.length > 0) {
      const row = result.rows[0];
      console.log(`   ${domain} (${id})`);
      console.log(`   → Price: $${row.monthly_price}, Status: ${row.status}, Reason: ${reason}`);
    }
  }
  console.log('');

  // Planes
  console.log('❌ PLANES:');
  for (const { id, name, price, reason } of DEMO_DATA.plans) {
    const result = await client.query('SELECT id, name, monthly_price, status FROM hosting_plans WHERE id = $1', [id]);
    if (result.rows.length > 0) {
      const row = result.rows[0];
      console.log(`   ${name} (${id})`);
      console.log(`   → Price: $${row.monthly_price}, Status: ${row.status}, Reason: ${reason}`);
    }
  }
  console.log('');

  // Dominios dudosos
  console.log('❌ DOMINIOS DUDOSOS:');
  const domainResult = await client.query(
    `SELECT id, domain, created_at FROM domains WHERE domain = 'premieresrl.com.ar' AND created_at IS NULL`
  );
  if (domainResult.rows.length > 0) {
    for (const row of domainResult.rows) {
      console.log(`   ${row.domain} (${row.id || 'SIN ID'})`);
      console.log(`   → Created: ${row.created_at || 'NULL'}, Reason: No metadata`);
    }
  } else {
    console.log('   (none)');
  }
  console.log('');
}

async function deleteData(client) {
  console.log('🗑️  ELIMINANDO DATOS DEMO:');
  console.log('');

  // Eliminar servicios primero (FK a clientes y planes)
  console.log('Paso 1: Eliminando servicios demo...');
  let deletedServices = 0;
  for (const { id } of DEMO_DATA.services) {
    const result = await client.query('DELETE FROM hosting_services WHERE id = $1', [id]);
    if (result.rowCount > 0) {
      deletedServices += result.rowCount;
      console.log(`  ✓ Servicio ${id.substring(0, 8)}... eliminado`);
    }
  }
  console.log(`  Total: ${deletedServices} servicios eliminados`);
  console.log('');

  // Eliminar dominios dudosos
  console.log('Paso 2: Eliminando dominios dudosos...');
  let deletedDomains = 0;
  for (const { condition } of DEMO_DATA.domains) {
    const result = await client.query(`DELETE FROM domains WHERE ${condition}`);
    if (result.rowCount > 0) {
      deletedDomains += result.rowCount;
      console.log(`  ✓ ${result.rowCount} dominio(s) eliminado(s)`);
    }
  }
  console.log(`  Total: ${deletedDomains} dominios eliminados`);
  console.log('');

  // Eliminar planes demo (algunos pueden tener FKs)
  console.log('Paso 3: Eliminando planes demo...');
  let deletedPlans = 0;
  for (const { id } of DEMO_DATA.plans) {
    try {
      const result = await client.query('DELETE FROM hosting_plans WHERE id = $1', [id]);
      if (result.rowCount > 0) {
        deletedPlans += result.rowCount;
        console.log(`  ✓ Plan ${id.substring(0, 8)}... eliminado`);
      }
    } catch (err) {
      if (err.code === '23503') {
        console.log(`  ⚠️  Plan ${id.substring(0, 8)}... no se puede eliminar (FK constraint)`);
      } else {
        throw err;
      }
    }
  }
  console.log(`  Total: ${deletedPlans} planes eliminados`);
  console.log('');

  // Eliminar clientes demo (últimos, pueden tener referencias)
  console.log('Paso 4: Eliminando clientes demo...');
  let deletedClients = 0;
  for (const { id } of DEMO_DATA.clients) {
    try {
      const result = await client.query('DELETE FROM clients WHERE id = $1', [id]);
      if (result.rowCount > 0) {
        deletedClients += result.rowCount;
        console.log(`  ✓ Cliente ${id.substring(0, 8)}... eliminado`);
      }
    } catch (err) {
      if (err.code === '23503') {
        console.log(`  ⚠️  Cliente ${id.substring(0, 8)}... no se puede eliminar (FK constraint)`);
      } else {
        throw err;
      }
    }
  }
  console.log(`  Total: ${deletedClients} clientes eliminados`);
  console.log('');

  return { deletedServices, deletedPlans, deletedDomains, deletedClients };
}

async function verifyCleanup(client) {
  console.log('✅ VERIFICACIÓN POST-LIMPIEZA:');
  console.log('');

  const results = {};

  // Verificar clientes reales
  const clientsReal = await client.query(
    `SELECT COUNT(*) as count FROM clients WHERE status = 'active' AND company IN ('BitLogic', 'Dem-Ber', 'FB Tools Herramientas', 'Premiere SRL')`
  );
  results.realClients = parseInt(clientsReal.rows[0].count);
  console.log(`✓ Clientes reales activos: ${results.realClients} (esperado: 4)`);

  // Verificar servicios reales
  const servicesReal = await client.query(
    `SELECT COUNT(*) as count FROM hosting_services WHERE status = 'active' AND monthly_price > 100`
  );
  results.realServices = parseInt(servicesReal.rows[0].count);
  console.log(`✓ Servicios reales (precio > $100): ${results.realServices} (esperado: 4)`);

  // Verificar planes reales
  const plansReal = await client.query(
    `SELECT COUNT(*) as count FROM hosting_plans WHERE monthly_price > 100 AND name IN ('Emprendedor', 'Profesional', 'Empresa')`
  );
  results.realPlans = parseInt(plansReal.rows[0].count);
  console.log(`✓ Planes reales: ${results.realPlans} (esperado: 3)`);

  // Verificar MRR
  const mrr = await client.query(
    `SELECT SUM(monthly_price) as total FROM hosting_services WHERE status = 'active' AND monthly_price > 100`
  );
  results.mrr = parseInt(mrr.rows[0].total || 0);
  console.log(`✓ MRR total: $${results.mrr} (esperado: 109600)`);

  // Verificar que no queda demo
  const demoCounts = await client.query(
    `SELECT COUNT(*) as count FROM clients WHERE id::text LIKE '22222222%' OR id::text LIKE '33333333%' OR id::text LIKE '11111111%'`
  );
  results.demoCount = parseInt(demoCounts.rows[0].count);
  console.log(`✓ Registros demo residuales: ${results.demoCount} (esperado: 0)`);

  console.log('');
  return results;
}

async function main() {
  const client = await pool.connect();

  try {
    console.log('═══════════════════════════════════════════════════════════════════');
    console.log('🧹 PURGE DEMO RESIDUAL DATA');
    console.log('═══════════════════════════════════════════════════════════════════');
    console.log('');

    // Listar datos a eliminar
    await listDemoData(client);

    // Eliminar
    const deleted = await deleteData(client);

    // Verificar
    const verify = await verifyCleanup(client);

    // Resumen
    console.log('═══════════════════════════════════════════════════════════════════');
    console.log('📊 RESUMEN DE LIMPIEZA');
    console.log('═══════════════════════════════════════════════════════════════════');
    console.log('');
    console.log(`Eliminado:`);
    console.log(`  - ${deleted.deletedClients} clientes demo`);
    console.log(`  - ${deleted.deletedServices} servicios demo`);
    console.log(`  - ${deleted.deletedPlans} planes demo`);
    console.log(`  - ${deleted.deletedDomains} dominios dudosos`);
    console.log('');
    console.log(`Estado actual:`);
    console.log(`  - Clientes reales: ${verify.realClients}/4 ✓`);
    console.log(`  - Servicios reales: ${verify.realServices}/4 ✓`);
    console.log(`  - Planes reales: ${verify.realPlans}/3 ✓`);
    console.log(`  - MRR: $${verify.mrr} (esperado: $109,600) ${verify.mrr === 109600 ? '✓' : '⚠️'}`);
    console.log(`  - Demo residual: ${verify.demoCount} ${verify.demoCount === 0 ? '✓ LIMPIO' : '❌ ENCONTRADO'}`);
    console.log('');

    if (verify.realClients === 4 && verify.realServices === 4 && verify.realPlans === 3 && verify.demoCount === 0) {
      console.log('✅ LIMPIEZA EXITOSA — Base de datos lista para producción');
    } else {
      console.log('⚠️  LIMPIEZA INCOMPLETA — Verificar manualmente');
    }

    process.exit(0);
  } catch (err) {
    console.error('❌ ERROR:', err.message);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

main();
