// Fixture ejecutado en un proceso hijo separado por clients-mariadb.test.js,
// mismo patrón que fixtures/mariadb-auth-flow.mjs (ver ese archivo para el
// detalle del guard MARIADB_FIXTURE_RUN, obligatorio para que `node --test`
// no lo descubra y ejecute suelto).
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

  const { baseUrl, close } = await startEphemeralServer(app);

  try {
    // ── alta ───────────────────────────────────────────────
    const createRes = await fetch(`${baseUrl}/api/clients`, {
      method: "POST",
      headers: authHeaders,
      body: JSON.stringify({ name: "Cliente Uno", company: "ACME SRL", email: "Cliente.Uno@Fixture.Test" }),
    });
    assert.equal(createRes.status, 201, "alta de cliente debe dar 201");
    const client1 = await createRes.json();
    assert.match(client1.id, UUID_V4, "el id debe ser un UUID v4 generado por la app, no DEFAULT (UUID()) de la columna");
    assert.equal(client1.email, "cliente.uno@fixture.test", "el email se normaliza a minúsculas antes de guardar");
    assert.equal(client1.status, "active");
    assert.equal(client1.servicesCount, 0);

    // nombre/email faltante -> 400
    const createMissing = await fetch(`${baseUrl}/api/clients`, {
      method: "POST",
      headers: authHeaders,
      body: JSON.stringify({ company: "Sin nombre ni email" }),
    });
    assert.equal(createMissing.status, 400);

    // ── email duplicado: NO hay UNIQUE en `clients` (a diferencia de
    // `users.email`) — se documenta el comportamiento real, no se inventa una
    // regla de negocio nueva como parte de la conversión de motor. Debe
    // comportarse igual en ambos motores: sin error.
    const createDupEmail = await fetch(`${baseUrl}/api/clients`, {
      method: "POST",
      headers: authHeaders,
      body: JSON.stringify({ name: "Cliente Dos", email: "cliente.uno@fixture.test" }),
    });
    assert.equal(createDupEmail.status, 201, "clients.email no tiene UNIQUE — un alta con email repetido debe seguir dando 201, igual que contra Postgres");
    const client2 = await createDupEmail.json();

    // ── obtener por id ─────────────────────────────────────
    const getRes = await fetch(`${baseUrl}/api/clients/${client1.id}`, { headers: authHeaders });
    assert.equal(getRes.status, 200);
    const fetched = await getRes.json();
    assert.equal(fetched.name, "Cliente Uno");

    const getMissing = await fetch(`${baseUrl}/api/clients/${randomUUID()}`, { headers: authHeaders });
    assert.equal(getMissing.status, 404);

    // ── búsqueda (LOWER()/LIKE en vez de ILIKE) ─────────────
    const searchRes = await fetch(`${baseUrl}/api/clients?search=ACME`, { headers: authHeaders });
    assert.equal(searchRes.status, 200);
    const searchBody = await searchRes.json();
    assert.equal(searchBody.data.length, 1, "búsqueda case-insensitive por company debe encontrar 'ACME SRL' buscando 'ACME'");
    assert.equal(searchBody.data[0].id, client1.id);

    const searchLower = await fetch(`${baseUrl}/api/clients?search=acme%20srl`, { headers: authHeaders });
    const searchLowerBody = await searchLower.json();
    assert.equal(searchLowerBody.data.length, 1, "la búsqueda debe ser case-insensitive también en minúsculas");

    // ── edición ──────────────────────────────────────────────
    const updateRes = await fetch(`${baseUrl}/api/clients/${client1.id}`, {
      method: "PATCH",
      headers: authHeaders,
      body: JSON.stringify({ company: "ACME Actualizada" }),
    });
    assert.equal(updateRes.status, 200);
    const updated = await updateRes.json();
    assert.equal(updated.company, "ACME Actualizada");
    assert.equal(updated.name, "Cliente Uno", "campos no enviados en el PATCH deben preservarse (COALESCE)");

    // PATCH que no cambia ningún valor (repite el status actual) — no debe
    // dar 404 espurio por el rowCount=0 de MariaDB ante un UPDATE sin cambios
    // reales (ver comentario en clients.service.js updateClient).
    const updateNoChange = await fetch(`${baseUrl}/api/clients/${client1.id}`, {
      method: "PATCH",
      headers: authHeaders,
      body: JSON.stringify({ status: "active" }),
    });
    assert.equal(updateNoChange.status, 200, "un PATCH que no modifica ningún valor no debe dar 404");

    const updateMissing = await fetch(`${baseUrl}/api/clients/${randomUUID()}`, {
      method: "PATCH",
      headers: authHeaders,
      body: JSON.stringify({ name: "No existe" }),
    });
    assert.equal(updateMissing.status, 404);

    // ── baja (soft delete) + idempotencia ───────────────────
    const deleteRes = await fetch(`${baseUrl}/api/clients/${client1.id}`, { method: "DELETE", headers: authHeaders });
    assert.equal(deleteRes.status, 204);

    const afterDelete = await fetch(`${baseUrl}/api/clients/${client1.id}`, { headers: authHeaders });
    const afterDeleteBody = await afterDelete.json();
    assert.equal(afterDeleteBody.status, "inactive", "soft delete no borra el registro, solo cambia status");

    // repetir la baja sobre un cliente ya inactive no debe dar 404 (el UPDATE
    // no cambia ningún valor -> rowCount=0 en MariaDB -> el service NO debe
    // usar ese rowCount para decidir 404)
    const deleteAgain = await fetch(`${baseUrl}/api/clients/${client1.id}`, { method: "DELETE", headers: authHeaders });
    assert.equal(deleteAgain.status, 204, "la baja debe ser idempotente incluso cuando MariaDB reporta 0 filas afectadas");

    const deleteMissing = await fetch(`${baseUrl}/api/clients/${randomUUID()}`, { method: "DELETE", headers: authHeaders });
    assert.equal(deleteMissing.status, 404, "borrar un cliente que nunca existió sí debe dar 404");

    // ── filtro por status=inactive ──────────────────────────
    const inactiveList = await fetch(`${baseUrl}/api/clients?status=inactive`, { headers: authHeaders });
    const inactiveBody = await inactiveList.json();
    assert.ok(inactiveBody.data.some((c) => c.id === client1.id), "el cliente dado de baja debe aparecer en el filtro status=inactive");
    assert.ok(!inactiveBody.data.some((c) => c.id === client2.id), "el cliente activo no debe aparecer en el filtro status=inactive");

    // ── FK: hosting_services.client_id -> clients.id ────────
    const planId = randomUUID();
    await pool.query(
      `INSERT INTO hosting_plans (id, name, storage_gb, monthly_price) VALUES (?, 'Plan Fixture', 10, 999.00)`,
      [planId],
    );
    let fkErr;
    try {
      await pool.query(
        `INSERT INTO hosting_services (client_id, plan_id, domain, setup_date, next_due_date, storage_total_gb, monthly_price)
         VALUES (?, ?, 'no-deberia-crearse.test', CURDATE(), CURDATE(), 10, 999.00)`,
        [randomUUID(), planId], // client_id inexistente
      );
    } catch (e) {
      fkErr = e;
    }
    assert.ok(fkErr, "insertar un hosting_service con client_id inexistente debe violar la FK");
    assert.equal(fkErr.errno, 1452, "el error debe ser específicamente de violación de FK (ER_NO_REFERENCED_ROW), no otra causa");

    await pool.query(
      `INSERT INTO hosting_services (client_id, plan_id, domain, setup_date, next_due_date, storage_total_gb, monthly_price)
       VALUES (?, ?, 'si-deberia-crearse.test', CURDATE(), CURDATE(), 10, 999.00)`,
      [client2.id, planId], // client_id real
    );
    const listAfterFk = await fetch(`${baseUrl}/api/clients/${client2.id}`, { headers: authHeaders });
    const clientAfterFk = await listAfterFk.json();
    assert.equal(clientAfterFk.servicesCount, 1, "el servicio recién creado debe contar en services_count del cliente (COUNT con CASE WHEN, ex-FILTER)");

    console.log("MARIADB_CLIENTS_FLOW_OK");
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
