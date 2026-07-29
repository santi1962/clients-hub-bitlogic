// Fixture ejecutado en un proceso hijo separado por hosting-mariadb.test.js,
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

  const { baseUrl, close } = await startEphemeralServer(app);

  try {
    // ══════════════════════════════════════════════════════════
    // PLANS (vía /api/hosting/plans -> plans.service.js, ruta viva)
    // ══════════════════════════════════════════════════════════

    // 1. crear plan
    const createPlanRes = await fetch(`${baseUrl}/api/hosting/plans`, {
      method: "POST",
      headers: authHeaders,
      body: JSON.stringify({ name: "Starter", storageGb: 5, websitesLimit: 1, emailsLimit: 5, monthlyPrice: 8.5 }),
    });
    assert.equal(createPlanRes.status, 201, "alta de plan debe dar 201");
    const plan1 = await createPlanRes.json();
    // 10. UUID v4 app-side
    assert.match(plan1.id, UUID_V4, "el id del plan debe ser un UUID v4 generado por la app, no DEFAULT (UUID())");
    assert.equal(plan1.monthlyPrice, 8.5, "DECIMAL exacto: 8.5 no debe perder precisión");

    // 2. duplicado: hosting_plans.name NO tiene UNIQUE (a diferencia de
    // users.email) — se documenta el comportamiento real, no se inventa una
    // restricción nueva como parte de la conversión de motor.
    const createPlanDup = await fetch(`${baseUrl}/api/hosting/plans`, {
      method: "POST",
      headers: authHeaders,
      body: JSON.stringify({ name: "Starter", monthlyPrice: 9.0 }),
    });
    assert.equal(createPlanDup.status, 201, "hosting_plans.name no tiene UNIQUE — un nombre repetido debe seguir dando 201, igual que contra Postgres");
    const planDup = await createPlanDup.json();

    // 3 y 4. editar precio y límites
    const updatePlanRes = await fetch(`${baseUrl}/api/hosting/plans/${plan1.id}`, {
      method: "PATCH",
      headers: authHeaders,
      body: JSON.stringify({ monthlyPrice: 12.75, storageGb: 10, websitesLimit: 2 }),
    });
    assert.equal(updatePlanRes.status, 200);
    const updatedPlan = await updatePlanRes.json();
    assert.equal(updatedPlan.monthlyPrice, 12.75, "DECIMAL exacto tras editar: 12.75");
    assert.equal(updatedPlan.storageGb, 10);
    assert.equal(updatedPlan.websitesLimit, 2);

    // PATCH que no cambia ningún valor (repite el mismo precio) — no debe
    // dar 404 espurio por el rowCount=0 de MariaDB ante un UPDATE sin
    // cambios reales (ver comentario en plans.service.js updatePlan).
    const updatePlanNoChange = await fetch(`${baseUrl}/api/hosting/plans/${plan1.id}`, {
      method: "PATCH",
      headers: authHeaders,
      body: JSON.stringify({ monthlyPrice: 12.75 }),
    });
    assert.equal(updatePlanNoChange.status, 200, "un PATCH que no modifica ningún valor no debe dar 404");

    // 5. listar
    const listPlansRes = await fetch(`${baseUrl}/api/hosting/plans`);
    assert.equal(listPlansRes.status, 200);
    const listedPlans = await listPlansRes.json();
    assert.ok(listedPlans.data.length >= 2, "debe listar al menos los 2 planes creados");

    // 6. obtener por id
    const getPlanRes = await fetch(`${baseUrl}/api/hosting/plans/${plan1.id}`);
    assert.equal(getPlanRes.status, 200);

    // 9. plan inexistente
    const getPlanMissing = await fetch(`${baseUrl}/api/hosting/plans/${randomUUID()}`);
    assert.equal(getPlanMissing.status, 404);

    // ══════════════════════════════════════════════════════════
    // HOSTING SERVICES (vía /api/hosting/services -> hosting.service.js)
    // ══════════════════════════════════════════════════════════

    // 1. crear servicio para cliente y plan válidos
    const createServiceRes = await fetch(`${baseUrl}/api/hosting/services`, {
      method: "POST",
      headers: authHeaders,
      body: JSON.stringify({
        clientId, planId: plan1.id, domain: "fixture-service.test",
        monthlyPrice: 12.75, setupDate: "2026-01-01", nextDueDate: "2026-02-01",
      }),
    });
    assert.equal(createServiceRes.status, 201, "alta de servicio debe dar 201");
    const service1 = await createServiceRes.json();
    // 18. UUID v4 app-side
    assert.match(service1.id, UUID_V4, "el id del servicio debe ser un UUID v4 generado por la app");
    assert.equal(service1.monthlyPrice, 12.75, "DECIMAL exacto heredado del plan al crear");
    assert.equal(service1.storageTotalGb, 10, "storage_total_gb debe tomarse del plan (storage_gb=10)");
    assert.equal(service1.emailsTotal, 5, "emails_total debe tomarse del plan (emailsLimit=5)");

    // 2. rechazar client_id inexistente: no hay chequeo de negocio previo
    // (a diferencia de planId, ver abajo) — cae directo en la FK de la DB.
    // Ninguno de los dos motores tiene un manejo especial para el código de
    // violación de FK en este flujo (confirmado en la auditoría) — se
    // documenta la paridad de comportamiento (500), no se agrega un 4xx
    // más prolijo como parte de esta migración de motor.
    const createServiceBadClient = await fetch(`${baseUrl}/api/hosting/services`, {
      method: "POST",
      headers: authHeaders,
      body: JSON.stringify({
        clientId: randomUUID(), planId: plan1.id, domain: "no-deberia-existir-1.test",
        monthlyPrice: 10, setupDate: "2026-01-01", nextDueDate: "2026-02-01",
      }),
    });
    assert.equal(createServiceBadClient.status, 500, "client_id inexistente: sin chequeo de negocio previo, la FK lo rechaza como 500 en ambos motores");

    // 3. rechazar plan_id inexistente: createService SÍ valida esto como
    // regla de negocio explícita (400) antes de llegar al INSERT/FK.
    const createServiceBadPlan = await fetch(`${baseUrl}/api/hosting/services`, {
      method: "POST",
      headers: authHeaders,
      body: JSON.stringify({
        clientId, planId: randomUUID(), domain: "no-deberia-existir-2.test",
        monthlyPrice: 10, setupDate: "2026-01-01", nextDueDate: "2026-02-01",
      }),
    });
    assert.equal(createServiceBadPlan.status, 400, "plan_id inexistente debe dar 400 (Plan no encontrado), regla de negocio ya existente");

    // 4. dominio duplicado -> UNIQUE(domain), sin manejo especial -> 500 en
    // ambos motores (misma lógica que el punto 2).
    const createServiceDupDomain = await fetch(`${baseUrl}/api/hosting/services`, {
      method: "POST",
      headers: authHeaders,
      body: JSON.stringify({
        clientId, planId: plan1.id, domain: "fixture-service.test",
        monthlyPrice: 10, setupDate: "2026-01-01", nextDueDate: "2026-02-01",
      }),
    });
    assert.equal(createServiceDupDomain.status, 500, "dominio duplicado (UNIQUE) da 500 en ambos motores, sin manejo especial hoy");

    // 5. listar y filtrar
    const listServicesRes = await fetch(`${baseUrl}/api/hosting/services?status=active`, { headers: authHeaders });
    assert.equal(listServicesRes.status, 200);
    const listedServices = await listServicesRes.json();
    assert.ok(listedServices.data.some((s) => s.id === service1.id));

    const searchServicesRes = await fetch(`${baseUrl}/api/hosting/services?search=FIXTURE-SERVICE`, { headers: authHeaders });
    const searchedServices = await searchServicesRes.json();
    assert.equal(searchedServices.data.length, 1, "búsqueda case-insensitive (LOWER()/LIKE) por domain");

    // 6. obtener por id
    const getServiceRes = await fetch(`${baseUrl}/api/hosting/services/${service1.id}`, { headers: authHeaders });
    assert.equal(getServiceRes.status, 200);

    // 13. servicio inexistente
    const getServiceMissing = await fetch(`${baseUrl}/api/hosting/services/${randomUUID()}`, { headers: authHeaders });
    assert.equal(getServiceMissing.status, 404);

    // 7. editar
    const updateServiceRes = await fetch(`${baseUrl}/api/hosting/services/${service1.id}`, {
      method: "PATCH",
      headers: authHeaders,
      body: JSON.stringify({ storageUsedGb: 3.25, emailsUsed: 2 }),
    });
    assert.equal(updateServiceRes.status, 200);
    const updatedService = await updateServiceRes.json();
    assert.equal(updatedService.storageUsedGb, 3.25, "DECIMAL exacto (10,2)");

    // PATCH sin cambios reales de valor -> no debe dar 404 espurio.
    const updateServiceNoChange = await fetch(`${baseUrl}/api/hosting/services/${service1.id}`, {
      method: "PATCH",
      headers: authHeaders,
      body: JSON.stringify({ storageUsedGb: 3.25 }),
    });
    assert.equal(updateServiceNoChange.status, 200, "un PATCH que no modifica ningún valor no debe dar 404");

    // 17. updated_at cambia tras la edición
    const { rows: beforeRows } = await pool.query(`SELECT updated_at FROM hosting_services WHERE id = ?`, [service1.id]);
    await new Promise((r) => setTimeout(r, 1100)); // DATETIME sin fracción de segundo
    await fetch(`${baseUrl}/api/hosting/services/${service1.id}`, {
      method: "PATCH",
      headers: authHeaders,
      body: JSON.stringify({ internalNotes: "nota actualizada" }),
    });
    const { rows: afterRows } = await pool.query(`SELECT updated_at FROM hosting_services WHERE id = ?`, [service1.id]);
    assert.ok(new Date(afterRows[0].updated_at) > new Date(beforeRows[0].updated_at), "updated_at debe avanzar tras un UPDATE real");

    // 10. suspender
    const suspendRes = await fetch(`${baseUrl}/api/hosting/services/${service1.id}/suspend`, {
      method: "POST",
      headers: authHeaders,
    });
    assert.equal(suspendRes.status, 200);
    const suspended = await suspendRes.json();
    assert.equal(suspended.status, "suspended");

    // suspender de nuevo un servicio ya suspendido: acá SÍ es correcto que
    // rowCount decida el 404 (el WHERE excluye status='suspended' a
    // propósito, ver comentario en hosting.service.js suspendService).
    const suspendAgain = await fetch(`${baseUrl}/api/hosting/services/${service1.id}/suspend`, {
      method: "POST",
      headers: authHeaders,
    });
    assert.equal(suspendAgain.status, 404, "suspender un servicio ya suspendido debe dar 404 (comportamiento existente, no un bug de la migración)");

    // 11. reactivar
    const reactivateRes = await fetch(`${baseUrl}/api/hosting/services/${service1.id}/reactivate`, {
      method: "POST",
      headers: authHeaders,
    });
    assert.equal(reactivateRes.status, 200);
    assert.equal((await reactivateRes.json()).status, "active");

    // 8 y 9. cambiar plan + confirmar actualización de precio/storage/emails
    const changePlanRes = await fetch(`${baseUrl}/api/hosting/services/${service1.id}/change-plan`, {
      method: "POST",
      headers: authHeaders,
      body: JSON.stringify({ planId: planDup.id }),
    });
    assert.equal(changePlanRes.status, 200);
    const afterChangePlan = await changePlanRes.json();
    assert.equal(afterChangePlan.planId, planDup.id);
    assert.equal(afterChangePlan.monthlyPrice, 9.0, "monthly_price debe actualizarse al precio del nuevo plan");

    // reasignar el MISMO plan que ya tenía: no cambia ningún valor -> no
    // debe dar 404 espurio (ver comentario en changeServicePlan).
    const changePlanSame = await fetch(`${baseUrl}/api/hosting/services/${service1.id}/change-plan`, {
      method: "POST",
      headers: authHeaders,
      body: JSON.stringify({ planId: planDup.id }),
    });
    assert.equal(changePlanSame.status, 200, "reasignar el mismo plan (sin cambios reales) no debe dar 404");

    // cambiar a un plan inexistente -> 404 (getPlanById dentro de changeServicePlan)
    const changePlanMissing = await fetch(`${baseUrl}/api/hosting/services/${service1.id}/change-plan`, {
      method: "POST",
      headers: authHeaders,
      body: JSON.stringify({ planId: randomUUID() }),
    });
    assert.equal(changePlanMissing.status, 404);

    // ── FKs (raw SQL, sin pasar por la capa de negocio de la app) ──
    // 14. FK con clients
    let fkClientErr;
    try {
      await pool.query(
        `INSERT INTO hosting_services (id, client_id, plan_id, domain, setup_date, next_due_date, storage_total_gb, monthly_price)
         VALUES (?, ?, ?, 'raw-fk-client.test', CURDATE(), CURDATE(), 10, 10)`,
        [randomUUID(), randomUUID(), plan1.id],
      );
    } catch (e) {
      fkClientErr = e;
    }
    assert.ok(fkClientErr, "FK hosting_services.client_id -> clients.id debe rechazar un client_id inexistente");
    assert.equal(fkClientErr.errno, 1452);

    // 15. FK con hosting_plans
    let fkPlanErr;
    try {
      await pool.query(
        `INSERT INTO hosting_services (id, client_id, plan_id, domain, setup_date, next_due_date, storage_total_gb, monthly_price)
         VALUES (?, ?, ?, 'raw-fk-plan.test', CURDATE(), CURDATE(), 10, 10)`,
        [randomUUID(), clientId, randomUUID()],
      );
    } catch (e) {
      fkPlanErr = e;
    }
    assert.ok(fkPlanErr, "FK hosting_services.plan_id -> hosting_plans.id debe rechazar un plan_id inexistente");
    assert.equal(fkPlanErr.errno, 1452);

    // 12. eliminar servicio (hard delete, según lógica actual)
    const deleteServiceRes = await fetch(`${baseUrl}/api/hosting/services/${service1.id}`, {
      method: "DELETE",
      headers: authHeaders,
    });
    assert.equal(deleteServiceRes.status, 204);
    const getAfterDelete = await fetch(`${baseUrl}/api/hosting/services/${service1.id}`, { headers: authHeaders });
    assert.equal(getAfterDelete.status, 404, "hard delete: el servicio ya no existe, ni siquiera con status inactive");

    // eliminar de nuevo -> 404
    const deleteServiceAgain = await fetch(`${baseUrl}/api/hosting/services/${service1.id}`, {
      method: "DELETE",
      headers: authHeaders,
    });
    assert.equal(deleteServiceAgain.status, 404);

    // 7. eliminar plan SIN servicios asociados (plan1 ya no tiene servicios
    // tras el DELETE de arriba... pero el servicio se movió a planDup con
    // change-plan, así que plan1 quedó sin servicios desde ese momento)
    const deletePlanRes = await fetch(`${baseUrl}/api/hosting/plans/${plan1.id}`, {
      method: "DELETE",
      headers: authHeaders,
    });
    assert.equal(deletePlanRes.status, 204, "eliminar un plan sin servicios asociados debe dar 204");

    // 8. intentar eliminar plan CON servicios asociados (crear un servicio
    // nuevo contra planDup primero, ya que el servicio original se borró)
    const service2Res = await fetch(`${baseUrl}/api/hosting/services`, {
      method: "POST",
      headers: authHeaders,
      body: JSON.stringify({
        clientId, planId: planDup.id, domain: "fixture-service-2.test",
        monthlyPrice: 9.0, setupDate: "2026-01-01", nextDueDate: "2026-02-01",
      }),
    });
    assert.equal(service2Res.status, 201);
    const deletePlanWithServices = await fetch(`${baseUrl}/api/hosting/plans/${planDup.id}`, {
      method: "DELETE",
      headers: authHeaders,
    });
    assert.equal(deletePlanWithServices.status, 500, "eliminar un plan con servicios asociados debe rechazarse por la FK (500 genérico, sin manejo especial hoy, igual en ambos motores)");

    // 9. plan inexistente al eliminar
    const deletePlanMissing = await fetch(`${baseUrl}/api/hosting/plans/${randomUUID()}`, {
      method: "DELETE",
      headers: authHeaders,
    });
    assert.equal(deletePlanMissing.status, 404);

    console.log("MARIADB_HOSTING_FLOW_OK");
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
