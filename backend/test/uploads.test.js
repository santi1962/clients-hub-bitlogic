import { test } from "node:test";
import assert from "node:assert/strict";
import express from "express";
import fs from "node:fs";
import path from "node:path";
import { ticketAttachmentUpload, ticketUploadsDir } from "../src/middlewares/ticketUpload.js";
import { errorHandler, notFoundHandler } from "../src/middlewares/errorHandler.js";
import { startEphemeralServer } from "./helpers/server.js";

// App mínima aislada — no depende de auth ni de la base real, solo ejercita
// la política de uploads (tipo, tamaño, nombre de archivo).
const testApp = express();
testApp.post("/upload", ticketAttachmentUpload, (req, res) => {
  res.json({
    storedFilename: req.file?.filename ?? null,
    originalName: req.file?.originalname ?? null,
  });
});
testApp.use(notFoundHandler);
testApp.use(errorHandler);

/**
 * Registra el borrado del archivo ANTES de correr cualquier assert — así, si
 * una aserción posterior falla, el archivo se limpia igual (t.after corre
 * incluso si el test termina en falla). No dejar residuos es más importante
 * que la prolijidad del orden del código.
 */
function scheduleCleanup(t, filename) {
  if (!filename) return;
  t.after(() => fs.rmSync(path.join(ticketUploadsDir, filename), { force: true }));
}

function buildForm(bytes, filename, mimeType) {
  const form = new FormData();
  form.append("file", new Blob([bytes], { type: mimeType }), filename);
  return form;
}

test("uploads: tipo válido (imagen png) es aceptado", async (t) => {
  const { baseUrl, close } = await startEphemeralServer(testApp);
  t.after(close);

  const pngBytes = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const res = await fetch(`${baseUrl}/upload`, {
    method: "POST",
    body: buildForm(pngBytes, "foto.png", "image/png"),
  });
  const body = await res.json();
  scheduleCleanup(t, body.storedFilename);

  assert.equal(res.status, 200);
  assert.ok(body.storedFilename, "debería haber guardado el archivo");
});

test("uploads: tipo no permitido (.exe) es rechazado con 400", async (t) => {
  const { baseUrl, close } = await startEphemeralServer(testApp);
  t.after(close);

  const res = await fetch(`${baseUrl}/upload`, {
    method: "POST",
    body: buildForm(new Uint8Array([1, 2, 3]), "malware.exe", "application/x-msdownload"),
  });
  const body = await res.json();

  assert.equal(res.status, 400);
  assert.match(body.error.message, /no permitido/i);
});

test("uploads: archivo más grande que el límite (20MB) es rechazado con 400", async (t) => {
  const { baseUrl, close } = await startEphemeralServer(testApp);
  t.after(close);

  const tooBig = new Uint8Array(20 * 1024 * 1024 + 1);
  const res = await fetch(`${baseUrl}/upload`, {
    method: "POST",
    body: buildForm(tooBig, "grande.png", "image/png"),
  });

  assert.equal(res.status, 400);
});

test("uploads: un nombre original malicioso (path traversal) nunca se usa como ruta almacenada", async (t) => {
  const { baseUrl, close } = await startEphemeralServer(testApp);
  t.after(close);

  // fetch()/FormData normalizan el filename del lado del cliente (recortan
  // el path) antes de mandarlo — igual que hace un browser real con
  // <input type=file>. Para probar de verdad qué hace el SERVIDOR con un
  // Content-Disposition manipulado a mano, armamos el cuerpo multipart
  // manualmente en vez de usar FormData.
  const maliciousName = "../../../../etc/passwd.png";
  const boundary = "----test-boundary-12345";
  const pngBytes = Buffer.from([0x89, 0x50, 0x4e, 0x47]);
  const body = Buffer.concat([
    Buffer.from(
      `--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="${maliciousName}"\r\nContent-Type: image/png\r\n\r\n`,
    ),
    pngBytes,
    Buffer.from(`\r\n--${boundary}--\r\n`),
  ]);

  const res = await fetch(`${baseUrl}/upload`, {
    method: "POST",
    headers: { "Content-Type": `multipart/form-data; boundary=${boundary}` },
    body,
  });
  const json = await res.json();
  scheduleCleanup(t, json.storedFilename);

  assert.equal(res.status, 200);
  // busboy ya normaliza el filename del header a su basename antes de que
  // multer lo vea (defensa adicional, no la que nos interesa acá). Lo que
  // importa de verdad es que el nombre EN DISCO nunca sale del input del
  // cliente bajo ninguna forma, sin importar qué tan "limpio" llegue.
  assert.ok(!json.originalName.includes(".."), "sanity check: ni siquiera el nombre original conserva el path");
  assert.doesNotMatch(json.storedFilename, /\.\.|\/|\\/, "el nombre en disco no debe contener el path del cliente");
  assert.match(json.storedFilename, /^\d+-[a-z0-9]+\.png$/, "el nombre en disco siempre es el generado por el servidor");
  assert.notEqual(json.storedFilename, maliciousName);
  assert.notEqual(json.storedFilename, json.originalName);
});
