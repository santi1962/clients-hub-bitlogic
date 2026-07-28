import { test, after } from "node:test";
import assert from "node:assert/strict";
import pool from "../src/db/pool.js";
import app from "../src/app.js";
import { mockPoolQueries } from "./helpers/pool-mock.js";
import { buildAccessToken } from "./helpers/jwt.js";
import { startEphemeralServer } from "./helpers/server.js";

after(() => pool.end());

const CLIENT_A = "client-aaaa";
const CLIENT_B = "client-bbbb";

function fakeTicketRow(clientId) {
  return {
    id: "ticket-1",
    ticket_number: "TK-0001",
    client_id: clientId,
    hosting_service_id: null,
    subject: "test",
    priority: "normal",
    status: "open",
    assigned_to: null,
    created_by: null,
    last_message_at: null,
    resolved_at: null,
    closed_at: null,
    created_at: new Date(),
    updated_at: new Date(),
    client_name: "Cliente",
    client_company: null,
    service_domain: null,
    assigned_user_name: null,
  };
}

// authRequired reconsulta el usuario en cada request — mockeamos esa query
// (la primera) y después la(s) que haga la ruta bajo prueba.
function mockAuthThen(t, userRow, ...rest) {
  mockPoolQueries(t, [{ rows: [userRow] }, ...rest]);
}

test("portal: un cliente puede ver un ticket propio", async (t) => {
  const token = buildAccessToken({ sub: "user-a", role: "cliente", clientId: CLIENT_A });
  mockAuthThen(
    t,
    { id: "user-a", name: "Cliente A", role: "cliente", status: "active", client_id: CLIENT_A },
    { rows: [fakeTicketRow(CLIENT_A)] }, // ticket
    { rows: [] }, // mensajes
  );

  const { baseUrl, close } = await startEphemeralServer(app);
  t.after(close);

  const res = await fetch(`${baseUrl}/api/portal/tickets/ticket-1`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  assert.equal(res.status, 200);
});

test("portal: un cliente NO puede ver un ticket de otro client_id", async (t) => {
  const token = buildAccessToken({ sub: "user-a", role: "cliente", clientId: CLIENT_A });
  mockAuthThen(
    t,
    { id: "user-a", name: "Cliente A", role: "cliente", status: "active", client_id: CLIENT_A },
    { rows: [fakeTicketRow(CLIENT_B)] }, // el ticket es de OTRO cliente
    { rows: [] },
  );

  const { baseUrl, close } = await startEphemeralServer(app);
  t.after(close);

  const res = await fetch(`${baseUrl}/api/portal/tickets/ticket-1`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  assert.equal(res.status, 403);
});

test("portal: un cliente sin clientId asociado no puede usar el portal", async (t) => {
  const token = buildAccessToken({ sub: "user-x", role: "cliente", clientId: null });
  mockAuthThen(t, { id: "user-x", name: "Sin cliente", role: "cliente", status: "active", client_id: null });

  const { baseUrl, close } = await startEphemeralServer(app);
  t.after(close);

  const res = await fetch(`${baseUrl}/api/portal/me`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  assert.equal(res.status, 403);
});

test("portal (vía panel admin): staff con rol admin accede a la ruta de detalle de ticket sin filtro de client_id", async (t) => {
  const token = buildAccessToken({ sub: "staff-1", role: "super_admin", clientId: null });
  mockAuthThen(
    t,
    { id: "staff-1", name: "Staff", role: "super_admin", status: "active", client_id: null },
    { rows: [fakeTicketRow(CLIENT_B)] },
    { rows: [] },
  );

  const { baseUrl, close } = await startEphemeralServer(app);
  t.after(close);

  const res = await fetch(`${baseUrl}/api/support/ticket-1`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  assert.equal(res.status, 200);
});
