// Fixture ejecutado en un proceso hijo separado por domains-mariadb.test.js,
// mismo patrón que fixtures/mariadb-clients-flow.mjs (ver ese archivo para el
// detalle del guard MARIADB_FIXTURE_RUN).
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
  const token = signAccessToken({ sub: adminId, role: "super_admin", clientId: null });
  const authHeaders = { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };

  const clientId = randomUUID();
  await pool.query(`INSERT INTO clients (id, name, email) VALUES (?, 'Cliente Fixture', 'cliente@fixture.test')`, [clientId]);
  const planId = randomUUID();
  await pool.query(`INSERT INTO hosting_plans (id, name, storage_gb, monthly_price) VALUES (?, 'Plan Fixture', 10, 999.00)`, [planId]);
  const serviceId = randomUUID();
  await pool.query(
    `INSERT INTO hosting_services (id, client_id, plan_id, domain, setup_date, next_due_date, storage_total_gb, monthly_price)
     VALUES (?, ?, ?, 'servicio-fixture.test', CURDATE(), CURDATE(), 10, 999.00)`,
    [serviceId, clientId, planId],
  );

  const { baseUrl, close } = await startEphemeralServer(app);

  try {
    // ── 1, 21, 22, 23. crear dominio con cliente+servicio válidos ──
    const createRes = await fetch(`${baseUrl}/api/domains`, {
      method: "POST",
      headers: authHeaders,
      body: JSON.stringify({
        clientId, hostingServiceId: serviceId, domain: "ejemplo-fixture.com",
        registrar: "NIC.ar", registrationDate: "2024-01-01", expirationDate: "2027-01-01",
        annualCost: 500.5, customerPrice: 800.75, autoRenew: true,
      }),
    });
    assert.equal(createRes.status, 201, "alta de dominio debe dar 201");
    const domain1 = await createRes.json();
    assert.match(domain1.id, UUID_V4, "el id debe ser un UUID v4 generado por la app");
    assert.strictEqual(domain1.autoRenew, true, "BOOLEAN: true debe volver como true, no 1");
    assert.strictEqual(domain1.annualCost, 500.5, "DECIMAL exacto: 500.5 sin perder precisión");
    assert.strictEqual(domain1.customerPrice, 800.75);
    assert.equal(domain1.hostingServiceId, serviceId);

    // ── 3. crear dominio SIN hosting_service_id (nullable, permitido) ──
    const createNoServiceRes = await fetch(`${baseUrl}/api/domains`, {
      method: "POST",
      headers: authHeaders,
      body: JSON.stringify({ clientId, domain: "sin-servicio-fixture.com", expirationDate: "2027-01-01" }),
    });
    assert.equal(createNoServiceRes.status, 201, "crear sin hostingServiceId debe estar permitido");
    const domainNoService = await createNoServiceRes.json();
    assert.equal(domainNoService.hostingServiceId, null);
    assert.strictEqual(domainNoService.autoRenew, false, "autoRenew por default debe ser false, no null/undefined");

    // ── 4. client_id inexistente -> FK, sin chequeo de negocio previo -> 500 ──
    const createBadClient = await fetch(`${baseUrl}/api/domains`, {
      method: "POST",
      headers: authHeaders,
      body: JSON.stringify({ clientId: randomUUID(), domain: "no-deberia-existir-1.com", expirationDate: "2027-01-01" }),
    });
    assert.equal(createBadClient.status, 500, "client_id inexistente: la FK lo rechaza (500 genérico, sin manejo especial, igual que en clients/hosting)");

    // ── 5. hosting_service_id inexistente -> FK -> 500 ──
    const createBadService = await fetch(`${baseUrl}/api/domains`, {
      method: "POST",
      headers: authHeaders,
      body: JSON.stringify({ clientId, hostingServiceId: randomUUID(), domain: "no-deberia-existir-2.com", expirationDate: "2027-01-01" }),
    });
    assert.equal(createBadService.status, 500, "hosting_service_id inexistente: la FK lo rechaza (500 genérico)");

    // ── 6. dominio duplicado (mismo case) -> UNIQUE -> 500 ──
    const createDup = await fetch(`${baseUrl}/api/domains`, {
      method: "POST",
      headers: authHeaders,
      body: JSON.stringify({ clientId, domain: "ejemplo-fixture.com", expirationDate: "2027-01-01" }),
    });
    assert.equal(createDup.status, 500, "dominio duplicado (UNIQUE) da 500, sin manejo especial hoy");

    // ── 7. dominio duplicado con distinto case -> bajo MariaDB (collation
    // case-insensitive de la tabla) también colisiona — a diferencia de
    // Postgres real (domain TEXT UNIQUE, case-sensitive por default), donde
    // esto NO colisionaría. Divergencia ya documentada y aceptada desde
    // DB-2.5 para hosting_services.domain, se confirma acá para domains.
    const createDupCase = await fetch(`${baseUrl}/api/domains`, {
      method: "POST",
      headers: authHeaders,
      body: JSON.stringify({ clientId, domain: "EJEMPLO-FIXTURE.COM", expirationDate: "2027-01-01" }),
    });
    assert.equal(createDupCase.status, 500, "bajo MariaDB, un dominio con distinto case colisiona por el collation case-insensitive de la tabla (comportamiento esperado, no un bug de esta fase)");

    // ── 8. obtener por id ──
    const getRes = await fetch(`${baseUrl}/api/domains/${domain1.id}`, { headers: authHeaders });
    assert.equal(getRes.status, 200);

    // servicio inexistente al leer
    const getMissing = await fetch(`${baseUrl}/api/domains/${randomUUID()}`, { headers: authHeaders });
    assert.equal(getMissing.status, 404);

    // ── 9. listar ──
    const listRes = await fetch(`${baseUrl}/api/domains`, { headers: authHeaders });
    const listBody = await listRes.json();
    assert.ok(listBody.data.length >= 2);
    assert.ok(typeof listBody.meta.total === "number" && typeof listBody.meta.pages === "number");

    // ── 10. buscar case-insensitive ──
    const searchRes = await fetch(`${baseUrl}/api/domains?search=EJEMPLO-FIXTURE`, { headers: authHeaders });
    const searchBody = await searchRes.json();
    assert.ok(searchBody.data.some((d) => d.id === domain1.id), "búsqueda LOWER()/LIKE debe encontrar el dominio en mayúsculas buscando en minúsculas y viceversa");

    // ── 11. filtrar por estado ──
    const filterStatusRes = await fetch(`${baseUrl}/api/domains?status=active`, { headers: authHeaders });
    const filterStatusBody = await filterStatusRes.json();
    assert.ok(filterStatusBody.data.every((d) => d.status === "active"));

    // ── 12. filtrar por cliente ──
    const filterClientRes = await fetch(`${baseUrl}/api/domains?clientId=${clientId}`, { headers: authHeaders });
    const filterClientBody = await filterClientRes.json();
    assert.ok(filterClientBody.data.every((d) => d.clientId === clientId));
    assert.ok(filterClientBody.data.length >= 2);

    // ── 13. filtrar próximos a vencer ──
    const soonId = randomUUID();
    const soonExpiry = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    await pool.query(
      `INSERT INTO domains (id, client_id, domain, expiration_date, status) VALUES (?, ?, 'vence-pronto-fixture.com', ?, 'due_soon')`,
      [soonId, clientId, soonExpiry],
    );
    const expiringRes = await fetch(`${baseUrl}/api/domains?expiringInDays=7`, { headers: authHeaders });
    const expiringBody = await expiringRes.json();
    assert.ok(expiringBody.data.some((d) => d.id === soonId), "un dominio que vence en 3 días debe aparecer con expiringInDays=7");
    assert.ok(!expiringBody.data.some((d) => d.id === domain1.id), "un dominio que vence en 2027 NO debe aparecer con expiringInDays=7");

    // ── 25, 26. fechas UTC / DATE sin corrimiento ──
    // Un dominio cuyo expiration_date es EXACTAMENTE hoy (medianoche UTC) no
    // debe correrse un día para ningún lado al guardarse/leerse.
    const todayUTC = new Date().toISOString().slice(0, 10);
    const todayId = randomUUID();
    await pool.query(
      `INSERT INTO domains (id, client_id, domain, expiration_date, status) VALUES (?, ?, 'vence-hoy-fixture.com', ?, 'due_soon')`,
      [todayId, clientId, todayUTC],
    );
    const todayDomain = await (await fetch(`${baseUrl}/api/domains/${todayId}`, { headers: authHeaders })).json();
    const returnedDate = new Date(todayDomain.expirationDate).toISOString().slice(0, 10);
    assert.equal(returnedDate, todayUTC, "expiration_date no debe correrse de día por conversión de timezone (política UTC, pool.js timezone:'Z')");

    // ── 14, 15, 16, 17, 18, 24. editar registrar/status/expirationDate/autoRenew/montos + updated_at ──
    const { rows: beforeRows } = await pool.query(`SELECT updated_at FROM domains WHERE id = ?`, [domain1.id]);
    await new Promise((r) => setTimeout(r, 1100)); // DATETIME sin fracción de segundo
    const updateRes = await fetch(`${baseUrl}/api/domains/${domain1.id}`, {
      method: "PATCH",
      headers: authHeaders,
      body: JSON.stringify({
        registrar: "GoDaddy", status: "due_soon", expirationDate: "2027-06-15",
        autoRenew: false, annualCost: 600.25, customerPrice: 900.1,
      }),
    });
    assert.equal(updateRes.status, 200);
    const updated = await updateRes.json();
    assert.equal(updated.registrar, "GoDaddy");
    assert.equal(updated.status, "due_soon");
    assert.equal(new Date(updated.expirationDate).toISOString().slice(0, 10), "2027-06-15");
    assert.strictEqual(updated.autoRenew, false, "BOOLEAN: false explícito debe volver como false, no 0");
    assert.strictEqual(updated.annualCost, 600.25);
    assert.strictEqual(updated.customerPrice, 900.1);

    const { rows: afterRows } = await pool.query(`SELECT updated_at FROM domains WHERE id = ?`, [domain1.id]);
    assert.ok(new Date(afterRows[0].updated_at) > new Date(beforeRows[0].updated_at), "updated_at debe avanzar tras un UPDATE real");

    // PATCH sin campos -> no debe romper ni cambiar nada
    const updateEmptyRes = await fetch(`${baseUrl}/api/domains/${domain1.id}`, {
      method: "PATCH", headers: authHeaders, body: JSON.stringify({}),
    });
    assert.equal(updateEmptyRes.status, 200);

    // ── renovar (renewDomain: status -> active, nueva fecha) ──
    const renewRes = await fetch(`${baseUrl}/api/domains/${domain1.id}/renew`, {
      method: "POST",
      headers: authHeaders,
      body: JSON.stringify({ newExpirationDate: "2028-01-01", annualCost: 550 }),
    });
    assert.equal(renewRes.status, 200);
    const renewed = await renewRes.json();
    assert.equal(renewed.status, "active", "renovar debe volver el status a active");
    assert.equal(new Date(renewed.expirationDate).toISOString().slice(0, 10), "2028-01-01");
    assert.strictEqual(renewed.annualCost, 550);

    // ── 19. eliminar (soft-delete: status -> cancelled) ──
    const deleteRes = await fetch(`${baseUrl}/api/domains/${domain1.id}`, { method: "DELETE", headers: authHeaders });
    assert.equal(deleteRes.status, 204);
    const afterDelete = await (await fetch(`${baseUrl}/api/domains/${domain1.id}`, { headers: authHeaders })).json();
    assert.equal(afterDelete.status, "cancelled", "soft delete no borra el registro, solo cambia status a cancelled");

    // ── 20. eliminar inexistente ──
    // Hallazgo (bug preexistente, no introducido por esta fase ni específico
    // de ningún motor): domains.controller.js deleteDomain no chequea que
    // getDomainById devuelva null antes de leer domain.domain para la
    // auditoría — con un id inexistente, revienta con TypeError -> 500 en
    // vez del 404 esperado. Se documenta el comportamiento real (igual en
    // Postgres y MariaDB, es un bug de la capa de controller, no de SQL) en
    // vez de "arreglarlo" ampliando el alcance de esta fase.
    const deleteMissing = await fetch(`${baseUrl}/api/domains/${randomUUID()}`, { method: "DELETE", headers: authHeaders });
    assert.equal(deleteMissing.status, 500, "bug preexistente confirmado: falta el chequeo de null antes de domain.domain, da 500 en vez de 404");

    // ── 27. FK con clients/hosting_services (insert crudo) ──
    let fkClientErr;
    try {
      await pool.query(
        `INSERT INTO domains (client_id, domain, expiration_date) VALUES (?, 'raw-fk-client.test', CURDATE())`,
        [randomUUID()],
      );
    } catch (e) { fkClientErr = e; }
    assert.ok(fkClientErr);
    assert.equal(fkClientErr.errno, 1452);

    // ── 28. auditoría real: create + update + delete(cancelar) + renovar ──
    const { rows: auditRows } = await pool.query(
      `SELECT action, entity_type, entity_id, user_id FROM audit_logs WHERE entity_id = ?`,
      [domain1.id],
    );
    // 5, no 4: crear + editar (real) + editar (PATCH vacío, igual audita
    // aunque no ejecute ningún UPDATE real) + renovar + cancelar.
    assert.equal(auditRows.length, 5, "create + 2x editar (incluido el PATCH vacío) + renovar + cancelar deben quedar auditados");
    assert.ok(auditRows.every((r) => r.entity_type === "dominio"));
    assert.ok(auditRows.every((r) => r.user_id === adminId));
    assert.ok(auditRows.some((r) => r.action === "crear"));
    assert.ok(auditRows.some((r) => r.action === "editar"));
    assert.ok(auditRows.some((r) => r.action === "renovar"));
    assert.ok(auditRows.some((r) => r.action === "cancelar"));

    // ── 29. un fallo del INSERT de auditoría no rompe la acción principal ──
    await pool.query(`DROP TABLE audit_logs`);
    const updateAfterAuditDrop = await fetch(`${baseUrl}/api/domains/${domainNoService.id}`, {
      method: "PATCH", headers: authHeaders, body: JSON.stringify({ notes: "sin audit_logs disponible" }),
    });
    assert.equal(updateAfterAuditDrop.status, 200, "la acción de negocio debe completarse igual aunque el INSERT de auditoría falle (best-effort, ver audit.service.js)");

    console.log("MARIADB_DOMAINS_FLOW_OK");
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
