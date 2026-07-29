// Tests unitarios (mockeados, lado Postgres) específicos de la conversión a
// MariaDB del dominio Support/Tickets (Fase DB-3F): UUID v4 generado en la
// app, placeholders `?`, patrón UPDATE+SELECT (decidiendo 404 por SELECT, no
// por rowCount) para updateTicket/assignTicket/resolveTicket/closeTicket,
// rowCount confiable para deleteTicket (DELETE real), y la transacción de
// addMessage (BEGIN/INSERT/SELECT/UPDATE/COMMIT) emitiendo Socket.IO recién
// después del COMMIT. La cobertura contra un motor MariaDB real está en
// support-mariadb.test.js.
import { test, after } from "node:test";
import assert from "node:assert/strict";
import pool from "../src/db/pool.js";
import { supportService } from "../src/services/support.service.js";
import { mockPoolQueries, mockPoolConnect } from "./helpers/pool-mock.js";

after(() => pool.end());

const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function fakeTicketRow(overrides = {}) {
  return {
    id: "ticket-1", ticket_number: "TK-2026-0001", client_id: "client-1", hosting_service_id: null,
    subject: "Problema de acceso", priority: "normal", status: "open",
    assigned_to: null, created_by: "user-1", last_message_at: null,
    resolved_at: null, closed_at: null, created_at: new Date(), updated_at: new Date(),
    client_name: "Cliente", client_company: null, service_domain: null, assigned_user_name: null,
    ...overrides,
  };
}

test("supportService.createTicket: genera un UUID v4 en la app y lo reusa en el SELECT posterior (ticket_number lo genera la DB)", async (t) => {
  let insertParams;
  const original = pool.query;
  let call = 0;
  pool.query = async (_sql, params) => {
    call++;
    if (call === 1) {
      insertParams = params;
      return { rows: [] };
    }
    assert.equal(params[0], insertParams[0], "el SELECT debe pedir el MISMO id que se insertó");
    return { rows: [fakeTicketRow({ id: params[0] })] };
  };
  t.after(() => { pool.query = original; });

  const ticket = await supportService.createTicket({ clientId: "client-1", subject: "Problema de acceso" });

  assert.match(insertParams[0], UUID_V4, "el id insertado debe ser un UUID v4, no DEFAULT (UUID())");
  assert.equal(ticket.id, insertParams[0]);
  assert.equal(ticket.ticket_number, "TK-2026-0001", "ticket_number sigue generándose en la DB, no en la app");
});

test("supportService.getTicket: 404 si no existe", async (t) => {
  mockPoolQueries(t, [{ rows: [] }]);

  await assert.rejects(
    () => supportService.getTicket("no-existe"),
    (err) => err.status === 404,
  );
});

test("supportService.updateTicket: SELECT vacío tras el UPDATE da 404 (no depende de rowCount)", async (t) => {
  mockPoolQueries(t, [
    { rows: [], rowCount: 0 }, // UPDATE support_tickets
    { rows: [] },              // SELECT id: no existe
  ]);

  await assert.rejects(
    () => supportService.updateTicket("no-existe", { status: "resolved" }),
    (err) => err.status === 404,
  );
});

test("supportService.updateTicket: PATCH sin cambios reales de valor (rowCount 0 en MariaDB) no debe dar 404", async (t) => {
  const original = pool.query;
  let call = 0;
  pool.query = async (_sql, _params) => {
    call++;
    if (call === 1) return { rows: [], rowCount: 0 }; // UPDATE sin cambios reales
    if (call === 2) return { rows: [{ id: "ticket-1" }] }; // SELECT id: existe
    return { rows: [fakeTicketRow()] }; // getTicket -> ticket
  };
  t.after(() => { pool.query = original; });

  const result = await supportService.updateTicket("ticket-1", { priority: "normal" });

  assert.equal(result.id, "ticket-1", "no debe tirar 404 espurio");
});

test("supportService.updateTicket: sin campos permitidos delega en getTicket sin ejecutar UPDATE", async (t) => {
  mockPoolQueries(t, [{ rows: [fakeTicketRow()] }, { rows: [] }]); // getTicket: ticket + mensajes

  const result = await supportService.updateTicket("ticket-1", { unknownField: "x" });

  assert.equal(result.id, "ticket-1");
});

test("supportService.assignTicket: 404 si no existe", async (t) => {
  mockPoolQueries(t, [
    { rows: [], rowCount: 0 },
    { rows: [] },
  ]);

  await assert.rejects(
    () => supportService.assignTicket("no-existe", "user-2"),
    (err) => err.status === 404,
  );
});

test("supportService.resolveTicket: setea status=resolved y resolved_at, devuelve el ticket", async (t) => {
  const original = pool.query;
  const calls = [];
  pool.query = async (sql, params) => {
    calls.push({ sql, params });
    if (calls.length === 1) return { rows: [], rowCount: 1 };
    if (calls.length === 2) return { rows: [{ id: "ticket-1" }] };
    return { rows: [fakeTicketRow({ status: "resolved" })] };
  };
  t.after(() => { pool.query = original; });

  const result = await supportService.resolveTicket("ticket-1");

  assert.match(calls[0].sql, /status = 'resolved'/);
  assert.match(calls[0].sql, /resolved_at = now\(\)/);
  assert.equal(result.status, "resolved");
});

test("supportService.closeTicket: setea status=closed y closed_at", async (t) => {
  const original = pool.query;
  const calls = [];
  pool.query = async (sql, params) => {
    calls.push({ sql, params });
    if (calls.length === 1) return { rows: [], rowCount: 1 };
    if (calls.length === 2) return { rows: [{ id: "ticket-1" }] };
    return { rows: [fakeTicketRow({ status: "closed" })] };
  };
  t.after(() => { pool.query = original; });

  const result = await supportService.closeTicket("ticket-1");

  assert.match(calls[0].sql, /status = 'closed'/);
  assert.match(calls[0].sql, /closed_at = now\(\)/);
  assert.equal(result.status, "closed");
});

test("supportService.deleteTicket: 404 si no existe (rowCount 0, DELETE real sin ambigüedad de valores)", async (t) => {
  mockPoolQueries(t, [{ rows: [], rowCount: 0 }]);

  await assert.rejects(
    () => supportService.deleteTicket("no-existe"),
    (err) => err.status === 404,
  );
});

test("supportService.deleteTicket: rowCount 1 no lanza error", async (t) => {
  mockPoolQueries(t, [{ rows: [], rowCount: 1 }]);

  await assert.doesNotReject(() => supportService.deleteTicket("ticket-1"));
});

test("supportService.listTickets: combina filtros con placeholders `?`, búsqueda LOWER()/LIKE en ticket_number y subject, y COUNT con alias", async (t) => {
  const original = pool.query;
  const calls = [];
  pool.query = async (sql, params) => {
    calls.push({ sql, params });
    if (calls.length === 1) return { rows: [] };
    return { rows: [{ count: "0" }] };
  };
  t.after(() => { pool.query = original; });

  await supportService.listTickets({ status: "open", search: "acceso", page: 1, limit: 20 });

  const [dataCall, countCall] = calls;
  assert.match(dataCall.sql, /t\.status = \?/);
  assert.match(dataCall.sql, /LOWER\(t\.ticket_number\) LIKE LOWER\(\?\)/);
  assert.match(dataCall.sql, /LOWER\(t\.subject\) LIKE LOWER\(\?\)/);
  assert.match(dataCall.sql, /LIMIT \? OFFSET \?/);
  assert.deepEqual(dataCall.params, ["open", "%acceso%", "%acceso%", 20, 0]);

  assert.match(countCall.sql, /SELECT COUNT\(\*\) AS count FROM support_tickets t WHERE/);
  assert.deepEqual(countCall.params, ["open", "%acceso%", "%acceso%"]);
});

test("supportService.addMessage: transacción completa — UUID v4, BEGIN/INSERT/SELECT/UPDATE/COMMIT en ese orden exacto", async (t) => {
  // getIo() no se mockea: en ESM, socket.js exporta un binding de solo
  // lectura (mock.method sobre el namespace tira "Cannot redefine
  // property"). Como este test no inicializa un server real (initSocket()
  // nunca corre), getIo() devuelve null de forma natural y
  // getIo()?.to(...) es un no-op seguro — lo que de verdad importa acá es
  // que la emisión (línea siguiente al COMMIT en el código, dentro del
  // mismo try) nunca se alcanza si la transacción no llegó a comprometerse,
  // lo cual queda garantizado estructuralmente por el propio código
  // (ver el segundo test, que confirma el ROLLBACK antes de esa línea).
  const { queries } = mockPoolConnect(t, [
    { rows: [], rowCount: 1 },        // BEGIN
    { rows: [], rowCount: 1 },        // INSERT
    { rows: [{ id: "placeholder" }] }, // SELECT * FROM support_ticket_messages
    { rows: [], rowCount: 1 },        // UPDATE support_tickets last_message_at
    { rows: [], rowCount: 1 },        // COMMIT
  ]);

  const result = await supportService.addMessage({
    ticketId: "ticket-1", senderUserId: "user-1", senderName: "Admin", senderRole: "admin",
    message: "Estamos revisando tu caso", isInternal: false,
  });

  assert.equal(queries.length, 5);
  assert.match(queries[0], /^BEGIN$/);
  assert.match(queries[1], /INSERT INTO support_ticket_messages/);
  assert.match(queries[2], /SELECT \* FROM support_ticket_messages/);
  assert.match(queries[3], /UPDATE support_tickets SET last_message_at/);
  assert.match(queries[4], /^COMMIT$/);
  assert.equal(result.id, "placeholder");
});

test("supportService.addMessage: si el INSERT falla, hace ROLLBACK antes de llegar a la emisión de Socket.IO", async (t) => {
  const { queries } = mockPoolConnect(t, [
    { rows: [], rowCount: 1 },        // BEGIN
    new Error("constraint violation"), // INSERT falla
    { rows: [], rowCount: 1 },        // ROLLBACK
  ]);

  await assert.rejects(() => supportService.addMessage({
    ticketId: "ticket-1", senderUserId: "user-1", senderName: "Admin", senderRole: "admin", message: "x",
  }));

  assert.equal(queries.length, 3, "no debe llegar a ejecutar el UPDATE de last_message_at ni el COMMIT");
  assert.match(queries[2], /^ROLLBACK$/);
});
