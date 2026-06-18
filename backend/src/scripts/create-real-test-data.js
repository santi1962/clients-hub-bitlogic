#!/usr/bin/env node
/**
 * SCRIPT: Crear datos reales mínimos para prueba pre-deploy
 * ─────────────────────────────────────────────────────────────────
 * Crea un set mínimo de datos REALES para validar la app:
 *
 * Clientes:
 *   1. Bitlogic (Santiago Conrero)
 *   2. Premiere S.R.L.
 *
 * Servicios:
 *   - bitlogic.com.ar (Business plan)
 *   - premieresrl.com.ar (Pro plan)
 *
 * Dominios:
 *   - bitlogic.com.ar
 *   - premieresrl.com.ar
 *
 * IMPORTANTE:
 *   - Solo crea si NO EXISTEN
 *   - No sobrescribe datos
 *   - Idempotente
 *   - No crea pagos/avisos
 *   - Usa datos reales, no mocks
 *
 * USO:
 *   npm run create-real-test-data
 * ─────────────────────────────────────────────────────────────────
 */

import "dotenv/config";
import pool from "../db/pool.js";
import { v4 as uuidv4 } from "uuid";
import * as readline from "readline";

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

function prompt(question) {
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      resolve(answer);
    });
  });
}

async function createTestData() {
  console.log("\n" + "=".repeat(70));
  console.log("📊 CREAR DATOS REALES MÍNIMOS PARA PRUEBA PRE-DEPLOY");
  console.log("=".repeat(70) + "\n");

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    // ──────────────────────────────────────────────────────────────
    // 1. VERIFICAR/CREAR PLANES
    // ──────────────────────────────────────────────────────────────
    console.log("📋 Verificando planes de hosting...\n");

    const plansRes = await client.query(
      "SELECT id, name FROM hosting_plans ORDER BY monthly_price DESC",
    );
    let businessPlanId, proPlanId;

    if (plansRes.rows.length === 0) {
      console.log("  ⚠️  No hay planes de hosting. Creando planes...");
      // Crear planes
      const plans = [
        ["Business", "Para empresas con alta demanda", 40, null, null, 35.0],
        ["Pro", "Ideal para negocios en crecimiento", 15, 3, 20, 18.0],
        ["Starter", "Plan básico para sitios pequeños", 5, 1, 5, 8.0],
      ];

      for (const [name, desc, storage, websites, emails, price] of plans) {
        const planId = uuidv4();
        await client.query(
          `INSERT INTO hosting_plans (id, name, description, storage_gb, websites_limit, emails_limit, monthly_price, status)
           VALUES ($1, $2, $3, $4, $5, $6, $7, 'active')`,
          [planId, name, desc, storage, websites, emails, price],
        );
        console.log(`    ✓ Plan ${name} creado`);

        if (name === "Business") businessPlanId = planId;
        if (name === "Pro") proPlanId = planId;
      }
    } else {
      // Obtener IDs de planes existentes
      for (const plan of plansRes.rows) {
        if (plan.name === "Business") businessPlanId = plan.id;
        if (plan.name === "Pro") proPlanId = plan.id;
      }
      console.log(
        `  ✓ Planes existentes: ${plansRes.rows.map((p) => p.name).join(", ")}`,
      );
    }

    if (!businessPlanId || !proPlanId) {
      throw new Error("No se encontraron planes Business y Pro");
    }

    // ──────────────────────────────────────────────────────────────
    // 2. VERIFICAR/CREAR CLIENTES
    // ──────────────────────────────────────────────────────────────
    console.log("\n📧 Verificando/creando clientes...\n");

    let bitlogicClientId, premiereClientId;

    // Cliente 1: Bitlogic
    const bitlogicRes = await client.query(
      "SELECT id FROM clients WHERE email = $1",
      ["santiconrero@hotmail.com"],
    );

    if (bitlogicRes.rows.length === 0) {
      bitlogicClientId = uuidv4();
      await client.query(
        `INSERT INTO clients (id, name, company, email, phone, status)
         VALUES ($1, $2, $3, $4, $5, 'active')`,
        [bitlogicClientId, "Santiago Conrero", "Bitlogic", "santiconrero@hotmail.com", null],
      );
      console.log("  ✓ Cliente Bitlogic (Santiago Conrero) creado");
    } else {
      bitlogicClientId = bitlogicRes.rows[0].id;
      console.log("  → Cliente Bitlogic ya existe");
    }

    // Cliente 2: Premiere
    const premiereEmail = "info@premieresrl.com.ar";
    const premiereRes = await client.query(
      "SELECT id FROM clients WHERE company = $1",
      ["Premiere S.R.L."],
    );

    if (premiereRes.rows.length === 0) {
      premiereClientId = uuidv4();
      await client.query(
        `INSERT INTO clients (id, name, company, email, phone, status)
         VALUES ($1, $2, $3, $4, $5, 'active')`,
        [premiereClientId, "Premiere S.R.L.", "Premiere S.R.L.", premiereEmail, null],
      );
      console.log("  ✓ Cliente Premiere S.R.L. creado");
    } else {
      premiereClientId = premiereRes.rows[0].id;
      console.log("  → Cliente Premiere S.R.L. ya existe");
    }

    // ──────────────────────────────────────────────────────────────
    // 3. VERIFICAR/CREAR SERVICIOS
    // ──────────────────────────────────────────────────────────────
    console.log("\n🌐 Verificando/creando servicios de hosting...\n");

    // Servicio 1: bitlogic.com.ar
    const bitlogicServiceRes = await client.query(
      "SELECT id FROM hosting_services WHERE domain = $1",
      ["bitlogic.com.ar"],
    );

    if (bitlogicServiceRes.rows.length === 0) {
      const serviceId = uuidv4();
      const today = new Date().toISOString().split("T")[0];
      const nextDue = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];

      await client.query(
        `INSERT INTO hosting_services
         (id, client_id, plan_id, domain, status, monthly_price, setup_date, next_due_date,
          storage_total_gb, hestia_username, hestia_url)
         VALUES ($1, $2, $3, $4, 'active', $5, $6, $7, $8, $9, $10)`,
        [
          serviceId,
          bitlogicClientId,
          businessPlanId,
          "bitlogic.com.ar",
          35.0,
          today,
          nextDue,
          40.0,
          "santi1961",
          "https://panel.bitlogic.com.ar:8083",
        ],
      );
      console.log("  ✓ Servicio bitlogic.com.ar (Business) creado");
    } else {
      console.log("  → Servicio bitlogic.com.ar ya existe");
    }

    // Servicio 2: premieresrl.com.ar
    const premiereServiceRes = await client.query(
      "SELECT id FROM hosting_services WHERE domain = $1",
      ["premieresrl.com.ar"],
    );

    if (premiereServiceRes.rows.length === 0) {
      const serviceId = uuidv4();
      const today = new Date().toISOString().split("T")[0];
      const nextDue = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];

      await client.query(
        `INSERT INTO hosting_services
         (id, client_id, plan_id, domain, status, monthly_price, setup_date, next_due_date,
          storage_total_gb, hestia_username, hestia_url)
         VALUES ($1, $2, $3, $4, 'active', $5, $6, $7, $8, $9, $10)`,
        [
          serviceId,
          premiereClientId,
          proPlanId,
          "premieresrl.com.ar",
          18.0,
          today,
          nextDue,
          15.0,
          "premieresrl",
          "https://panel.bitlogic.com.ar:8083",
        ],
      );
      console.log("  ✓ Servicio premieresrl.com.ar (Pro) creado");
    } else {
      console.log("  → Servicio premieresrl.com.ar ya existe");
    }

    // ──────────────────────────────────────────────────────────────
    // 4. VERIFICAR/CREAR DOMINIOS
    // ──────────────────────────────────────────────────────────────
    console.log("\n🔗 Verificando/creando dominios...\n");

    // Dominio 1: bitlogic.com.ar
    const bitlogicDomainRes = await client.query(
      "SELECT id FROM domains WHERE domain = $1",
      ["bitlogic.com.ar"],
    );

    if (bitlogicDomainRes.rows.length === 0) {
      const domainId = uuidv4();
      const expDate = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];

      await client.query(
        `INSERT INTO domains (id, client_id, domain, status, expiration_date, registrar, created_at)
         VALUES ($1, $2, $3, 'active', $4, 'NIC.ar', now())`,
        [domainId, bitlogicClientId, "bitlogic.com.ar", expDate],
      );
      console.log("  ✓ Dominio bitlogic.com.ar creado");
    } else {
      console.log("  → Dominio bitlogic.com.ar ya existe");
    }

    // Dominio 2: premieresrl.com.ar
    const premiereDomainRes = await client.query(
      "SELECT id FROM domains WHERE domain = $1",
      ["premieresrl.com.ar"],
    );

    if (premiereDomainRes.rows.length === 0) {
      const domainId = uuidv4();
      const expDate = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];

      await client.query(
        `INSERT INTO domains (id, client_id, domain, status, expiration_date, registrar, created_at)
         VALUES ($1, $2, $3, 'active', $4, 'NIC.ar', now())`,
        [domainId, premiereClientId, "premieresrl.com.ar", expDate],
      );
      console.log("  ✓ Dominio premieresrl.com.ar creado");
    } else {
      console.log("  → Dominio premieresrl.com.ar ya existe");
    }

    await client.query("COMMIT");

    console.log("\n" + "=".repeat(70));
    console.log("✅ DATOS REALES CREADOS/VERIFICADOS EXITOSAMENTE");
    console.log("=".repeat(70) + "\n");

    console.log("📊 PRÓXIMOS PASOS:");
    console.log("  1. npm run build (frontend)");
    console.log("  2. Verificar dashboard: http://localhost:4173/dashboard");
    console.log("  3. Verificar servicios: http://localhost:4173/servicios");
    console.log("  4. Verificar dominios: http://localhost:4173/dominios");
    console.log("\n📝 CREDENCIALES DE PRUEBA:");
    console.log("  Email: santiconrero@hotmail.com");
    console.log("  (O cualquier admin/cliente creado en los seeds)\n");
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("\n❌ Error:", err.message);
    process.exit(1);
  } finally {
    client.release();
    rl.close();
  }
}

await createTestData();
