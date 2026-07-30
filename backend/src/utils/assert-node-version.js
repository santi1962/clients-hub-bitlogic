// Chequeo de versión de Node en runtime, no solo en instalación. `engines` +
// `engine-strict=true` (.npmrc) ya rechazan un `npm install`/`npm ci` con un
// Node viejo, pero no protegen contra un `node_modules` copiado a un server
// con un Node del sistema desactualizado (ej. PM2 arrancando con el binario
// global). Sintaxis deliberadamente simple (sin optional chaining ni nada
// que un Node muy viejo no pueda al menos parsear) para que el mensaje de
// error sea legible en vez de un SyntaxError críptico.
export var REQUIRED_MAJOR = 22;
export var REQUIRED_MINOR = 12;

export function parseNodeVersion(versionString) {
  var parts = versionString.split(".");
  return { major: parseInt(parts[0], 10), minor: parseInt(parts[1], 10) };
}

export function meetsMinimumNodeVersion(versionString) {
  var current = parseNodeVersion(versionString);
  return (
    current.major > REQUIRED_MAJOR ||
    (current.major === REQUIRED_MAJOR && current.minor >= REQUIRED_MINOR)
  );
}

function assertNodeVersion() {
  if (!meetsMinimumNodeVersion(process.versions.node)) {
    console.error(
      "[assert-node-version] FATAL: Node " + process.versions.node + " detectado. " +
      "Este proyecto requiere Node >=" + REQUIRED_MAJOR + "." + REQUIRED_MINOR + ".0 " +
      "(lo exige @tanstack/react-start en el frontend; el backend sigue la misma política). " +
      "Actualizá la versión de Node antes de continuar.",
    );
    process.exit(1);
  }
}

assertNodeVersion();
