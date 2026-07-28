import { test, after } from "node:test";
import assert from "node:assert/strict";
import app from "../src/app.js";
import pool from "../src/db/pool.js";
import { startEphemeralServer } from "./helpers/server.js";

// Sin esto, el pool queda con conexiones idle abiertas hasta su
// idleTimeoutMillis (30s), retrasando la salida del proceso de test.
after(() => pool.end());

test("health: /api/health/live responde 200 sin tocar la base", async (t) => {
  const { baseUrl, close } = await startEphemeralServer(app);
  t.after(close);

  const res = await fetch(`${baseUrl}/api/health/live`);
  const body = await res.json();

  assert.equal(res.status, 200);
  assert.equal(body.status, "ok");
  assert.equal(typeof body.uptime, "number");
});

test("health: /api/health/ready responde 200 cuando la DB está disponible", async (t) => {
  const { baseUrl, close } = await startEphemeralServer(app);
  t.after(close);

  const res = await fetch(`${baseUrl}/api/health/ready`);
  const body = await res.json();

  assert.equal(res.status, 200);
  assert.equal(body.status, "ok");
  assert.equal(body.database, "connected");
});

test("health: /api/health/ready responde 503 cuando la DB no está disponible", async (t) => {
  const original = pool.query;
  pool.query = async () => {
    throw new Error("simulated DB outage");
  };
  t.after(() => {
    pool.query = original;
  });

  const { baseUrl, close } = await startEphemeralServer(app);
  t.after(close);

  const res = await fetch(`${baseUrl}/api/health/ready`);
  const body = await res.json();

  assert.equal(res.status, 503);
  assert.equal(body.status, "degraded");
  assert.equal(body.database, "disconnected");
});

test("health: /api/health (alias histórico) se comporta igual que /ready", async (t) => {
  const { baseUrl, close } = await startEphemeralServer(app);
  t.after(close);

  const res = await fetch(`${baseUrl}/api/health`);
  assert.equal(res.status, 200);
});
