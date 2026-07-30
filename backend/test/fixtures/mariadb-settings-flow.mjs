// Fixture ejecutado en un proceso hijo separado por settings-mariadb.test.js,
// mismo patrón de guard que fixtures/mariadb-clients-flow.mjs. Corre contra
// el schema.sql COMPLETO (aplicado por apply-mariadb-schema.mjs antes de
// invocar este archivo), no un subconjunto — necesario para ejercitar el
// trigger real de fila única de company_settings.
if (process.env.MARIADB_FIXTURE_RUN !== "1") {
  process.exit(0);
}

import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import bcrypt from "bcrypt";
import app from "../../src/app.js";
import pool from "../../src/db/pool.js";
import { signAccessToken } from "../../src/utils/jwt.js";
import { startEphemeralServer } from "../helpers/server.js";

const PASSWORD = "Password123!";
const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

async function run() {
  const passwordHash = await bcrypt.hash(PASSWORD, 12);
  const adminId = randomUUID();
  await pool.query(
    `INSERT INTO users (id, name, email, password_hash, role, status) VALUES (?, 'Admin Fixture', 'admin@fixture.test', ?, 'super_admin', 'active')`,
    [adminId, passwordHash],
  );
  const adminToken = signAccessToken({ sub: adminId, role: "super_admin", clientId: null });
  const adminHeaders = { Authorization: `Bearer ${adminToken}`, "Content-Type": "application/json" };

  const { baseUrl, close } = await startEphemeralServer(app);

  try {
    // ── GET /company sin configurar todavía -> {} (null mapeado por el controller) ──
    const getEmptyRes = await fetch(`${baseUrl}/api/settings/company`, { headers: adminHeaders });
    assert.equal(getEmptyRes.status, 200);
    assert.deepEqual(await getEmptyRes.json(), {}, "sin fila configurada, el endpoint debe devolver {} (no null ni 404)");

    // ── subir logo ANTES de guardar la empresa -> 409 controlado, no 500,
    // y no queda ninguna fila incompleta creada (bug corregido en esta fase) ──
    const logoBeforeCompanyRes = await fetch(`${baseUrl}/api/settings/company/logo`, {
      method: "POST",
      headers: { Authorization: adminHeaders.Authorization },
      body: (() => {
        const form = new FormData();
        form.append("logo", new Blob([new Uint8Array([0x89, 0x50, 0x4e, 0x47])], { type: "image/png" }), "logo-temprano.png");
        return form;
      })(),
    });
    assert.equal(logoBeforeCompanyRes.status, 409, "sin company_settings todavía, debe rechazar con 409, no con un 500 genérico por NOT NULL");
    const logoBeforeCompanyBody = await logoBeforeCompanyRes.json();
    assert.match(logoBeforeCompanyBody.error.message, /configuración de la empresa/i);
    const { rows: countBeforeRows } = await pool.query(`SELECT COUNT(*) AS c FROM company_settings`);
    assert.equal(Number(countBeforeRows[0].c), 0, "no debe haberse creado ninguna fila incompleta en company_settings");

    // ── PUT /company: crea la primera fila, UUID v4 app-side ──
    const createRes = await fetch(`${baseUrl}/api/settings/company`, {
      method: "PUT",
      headers: adminHeaders,
      body: JSON.stringify({
        companyName: "Bitlogic SRL", contactEmail: "hola@bitlogic.com.ar",
        phone: "+54 11 5555-0000", taxId: "30-12345678-9", address: "Av. Siempre Viva 742",
        currency: "USD",
      }),
    });
    assert.equal(createRes.status, 200);
    const created = await createRes.json();
    assert.match(created.id, UUID_V4, "el id debe ser un UUID v4 generado por la app, no DEFAULT (UUID())");
    assert.equal(created.companyName, "Bitlogic SRL");
    assert.equal(created.currency, "USD");
    assert.equal(created.logoUrl, null);

    // ── GET /company ahora sí devuelve la fila real ──
    const getAfterCreateRes = await fetch(`${baseUrl}/api/settings/company`, { headers: adminHeaders });
    const afterCreate = await getAfterCreateRes.json();
    assert.equal(afterCreate.id, created.id);
    assert.equal(afterCreate.contactEmail, "hola@bitlogic.com.ar");

    // ── PUT /company de nuevo: debe hacer UPDATE (mismo id, no una fila nueva) ──
    const { rows: beforeRows } = await pool.query(`SELECT updated_at FROM company_settings WHERE id = ?`, [created.id]);
    await new Promise((r) => setTimeout(r, 1100));
    const updateRes = await fetch(`${baseUrl}/api/settings/company`, {
      method: "PUT",
      headers: adminHeaders,
      body: JSON.stringify({ companyName: "Bitlogic S.R.L. (actualizada)", currency: "ARS" }),
    });
    assert.equal(updateRes.status, 200);
    const updated = await updateRes.json();
    assert.equal(updated.id, created.id, "un segundo PUT debe reusar el mismo id (UPDATE), no crear una fila nueva");
    assert.equal(updated.companyName, "Bitlogic S.R.L. (actualizada)");
    assert.equal(updated.currency, "ARS");
    const { rows: afterRows } = await pool.query(`SELECT updated_at FROM company_settings WHERE id = ?`, [created.id]);
    assert.ok(new Date(afterRows[0].updated_at) > new Date(beforeRows[0].updated_at), "updated_at debe avanzar tras el UPDATE");

    const { rows: countRows } = await pool.query(`SELECT COUNT(*) AS c FROM company_settings`);
    assert.equal(Number(countRows[0].c), 1, "debe seguir habiendo una sola fila (el trigger de fila única no se vio afectado, y el service tampoco intentó insertar una segunda)");

    // ── nombre de empresa faltante -> 400 ──
    const putNoNameRes = await fetch(`${baseUrl}/api/settings/company`, {
      method: "PUT", headers: adminHeaders, body: JSON.stringify({ currency: "ARS" }),
    });
    assert.equal(putNoNameRes.status, 400);

    // ── placeholder detectado -> 400 ──
    const putPlaceholderRes = await fetch(`${baseUrl}/api/settings/company`, {
      method: "PUT", headers: adminHeaders, body: JSON.stringify({ companyName: "Empresa Demo Test" }),
    });
    assert.equal(putPlaceholderRes.status, 400);

    // ── subir logo (con fila ya existente) ──
    const logoRes = await fetch(`${baseUrl}/api/settings/company/logo`, {
      method: "POST",
      headers: { Authorization: adminHeaders.Authorization },
      body: (() => {
        const form = new FormData();
        form.append("logo", new Blob([new Uint8Array([0x89, 0x50, 0x4e, 0x47])], { type: "image/png" }), "logo.png");
        return form;
      })(),
    });
    assert.equal(logoRes.status, 200);
    const logoBody = await logoRes.json();
    assert.ok(logoBody.logoUrl?.startsWith("/api/settings/company/logo/"));

    const getAfterLogoRes = await fetch(`${baseUrl}/api/settings/company`, { headers: adminHeaders });
    const afterLogo = await getAfterLogoRes.json();
    assert.equal(afterLogo.logoUrl, logoBody.logoUrl, "el logo_url persistido debe reflejarse en el GET");
    assert.equal(afterLogo.companyName, "Bitlogic S.R.L. (actualizada)", "subir el logo no debe pisar el resto de los campos");

    // ── readiness: refleja que company_settings ya está configurado ──
    const readinessRes = await fetch(`${baseUrl}/api/settings/readiness`, { headers: adminHeaders });
    assert.equal(readinessRes.status, 200);
    const readiness = await readinessRes.json();
    assert.equal(readiness.checks.companyConfigured, true, "con una fila en company_settings, companyConfigured debe ser true");
    assert.equal(readiness.checks.activePlansExist, false, "sin planes activos creados en este fixture, debe ser false");
    assert.equal(typeof readiness.percentage, "number");

    // ── billing/hosting/payments settings: siguen siendo stubs sin persistencia ──
    const billingRes = await fetch(`${baseUrl}/api/settings/billing`, { headers: adminHeaders });
    assert.equal(billingRes.status, 200);
    assert.equal((await billingRes.json()).currency, "ARS");

    // ── email settings: solo lectura desde config/env ──
    const emailRes = await fetch(`${baseUrl}/api/settings/email`, { headers: adminHeaders });
    assert.equal(emailRes.status, 200);
    assert.ok("smtpConfigured" in (await emailRes.json()));

    // ── auditoría real: editar (x2) queda auditado con actor correcto ──
    const { rows: auditRows } = await pool.query(
      `SELECT action, entity_type, entity_id, user_id FROM audit_logs WHERE entity_type = 'configuracion' AND entity_id = 'empresa'`,
    );
    assert.ok(auditRows.length >= 2, "las 2 ediciones exitosas (creación + actualización) deben quedar auditadas");
    assert.ok(auditRows.every((r) => r.action === "editar"));
    assert.ok(auditRows.every((r) => r.user_id === adminId), "el actor de la auditoría debe ser el usuario real autenticado");

    // ── fallo de auditoría no rompe la acción principal ──
    await pool.query(`DROP TABLE audit_logs`);
    const putAfterAuditDrop = await fetch(`${baseUrl}/api/settings/company`, {
      method: "PUT", headers: adminHeaders, body: JSON.stringify({ companyName: "Bitlogic SRL (sin auditoría)" }),
    });
    assert.equal(putAfterAuditDrop.status, 200, "la acción de negocio debe completarse igual aunque el INSERT de auditoría falle (best-effort)");

    console.log("MARIADB_SETTINGS_FLOW_OK");
  } finally {
    await close();
  }
}

run()
  .then(() => pool.end())
  .then(() => process.exit(0))
  .catch(async (err) => {
    console.error(err);
    await pool.end().catch(() => {});
    process.exit(1);
  });
