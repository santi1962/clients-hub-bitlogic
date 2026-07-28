import { test, after } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import pool from "../src/db/pool.js";
import { schedulerService } from "../src/services/scheduler.service.js";
import { mockPoolQueries } from "./helpers/pool-mock.js";

after(() => pool.end());

// executeJob() escribe cada resultado en scheduler_logs (tabla real). Estos
// tests no deben tocar la base real, así que mockeamos pool.query para que
// cada INSERT devuelva un id falso sin llegar a Postgres.
function mockSaveLog(t, times = 1) {
  mockPoolQueries(
    t,
    Array.from({ length: times }, () => ({ rows: [{ id: "fake-log-id" }] })),
  );
}

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FIXTURE = path.join(__dirname, "fixtures", "scheduler-init.mjs");

function runFixture(schedulerEnabled) {
  const result = spawnSync(process.execPath, [FIXTURE], {
    env: { ...process.env, SCHEDULER_ENABLED: String(schedulerEnabled) },
    encoding: "utf8",
    timeout: 10_000,
  });
  assert.equal(result.status, 0, `fixture falló: ${result.stderr}`);
  // El fixture también emite logs estructurados por stdout antes del
  // resultado final — el resultado siempre es la última línea no vacía.
  const lines = result.stdout.trim().split("\n");
  return JSON.parse(lines[lines.length - 1]);
}

test("scheduler: deshabilitado no programa ningún cron, pero registra los jobs para uso manual", () => {
  const { scheduledCount, registeredJobs } = runFixture(false);
  assert.equal(scheduledCount, 0);
  assert.deepEqual(registeredJobs, ["delinquency-detection", "hestia-sync", "payment-reminders"]);
});

test("scheduler: habilitado programa exactamente los tres jobs esperados", () => {
  const { scheduledCount, registeredJobs } = runFixture(true);
  assert.equal(scheduledCount, 3);
  assert.deepEqual(registeredJobs, ["delinquency-detection", "hestia-sync", "payment-reminders"]);
});

test("scheduler: el lock evita que la misma ejecución arranque dos veces en paralelo", async (t) => {
  mockSaveLog(t, 1); // solo la ejecución que gana el lock llega a guardar log
  let started = 0;
  let finished = 0;
  schedulerService.registerJob("test-lock-job", "job de prueba", async () => {
    started++;
    await new Promise((resolve) => setTimeout(resolve, 200));
    finished++;
    return { ok: true };
  });

  const [a, b] = await Promise.allSettled([
    schedulerService.executeJob("test-lock-job", null, "manual"),
    schedulerService.executeJob("test-lock-job", null, "scheduled"),
  ]);

  assert.equal(started, 1, "el job solo debería haber arrancado una vez");
  assert.equal(finished, 1);
  assert.equal(a.status, "fulfilled");
  assert.equal(b.status, "rejected");
  assert.equal(b.reason.status, 409);
  assert.equal(b.reason.code, "ALREADY_RUNNING");
});

test("scheduler: un job que falla no lanza (queda registrado como failed) y no afecta al proceso", async (t) => {
  mockSaveLog(t, 1);
  schedulerService.registerJob("test-failing-job", "job que siempre falla", async () => {
    throw new Error("fallo simulado a propósito");
  });

  const log = await schedulerService.executeJob("test-failing-job", null, "scheduled");

  assert.equal(log.status, "failed");
  assert.match(log.errorMessage, /fallo simulado/);
  // Si executeJob hubiera relanzado, este assert nunca se alcanzaría —
  // confirma que el error de UN job no puede tirar abajo el proceso.
  assert.ok(true, "el proceso siguió vivo después del fallo del job");
});

test("scheduler: el error de un job no impide ejecutar otro job distinto a continuación", async (t) => {
  mockSaveLog(t, 2); // el intento fallido + el ok
  schedulerService.registerJob("test-ok-job", "job que funciona", async () => ({ ok: true }));

  await schedulerService.executeJob("test-failing-job", null, "scheduled").catch(() => {});
  const log = await schedulerService.executeJob("test-ok-job", null, "scheduled");

  assert.equal(log.status, "success");
});
