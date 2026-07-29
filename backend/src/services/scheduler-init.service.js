/**
 * Scheduler Init Service
 *
 * Cablea los jobs ya existentes (hestia-sync, delinquency-detection,
 * payment-reminders) al scheduler en memoria y, si está habilitado, los
 * programa con node-cron. No agrega reglas de negocio nuevas: los jobs
 * hacen exactamente lo mismo que hacían antes, disparados manualmente.
 *
 * Los jobs se REGISTRAN siempre (aunque el cron esté deshabilitado), porque
 * eso es lo que permite que la ejecución manual desde el panel funcione —
 * antes de esta fase, registerJob() nunca se llamaba y toda ejecución
 * manual fallaba con 404 "Job not found".
 */
import cron from "node-cron";
import config from "../config/index.js";
import { schedulerService } from "./scheduler.service.js";
import { createLogger } from "../utils/logger.js";
import { hestiaSyncDaily } from "../jobs/hestia-sync.job.js";
import { delinquencyDetectionDaily } from "../jobs/delinquency-detection.job.js";
import { paymentRemindersDaily } from "../jobs/payment-reminders.job.js";

const log = createLogger("scheduler-init");

const JOB_DEFINITIONS = [
  {
    name: "hestia-sync",
    description: "Detecta uso de almacenamiento y usuarios de HestiaCP (solo lectura, no sincroniza nada todavía)",
    fn: hestiaSyncDaily,
    scheduleKey: "hestiaSync",
  },
  {
    name: "delinquency-detection",
    description: "Detecta avisos y servicios en mora (solo lectura — no suspende ni modifica servicios)",
    fn: delinquencyDetectionDaily,
    scheduleKey: "delinquencyDetection",
  },
  {
    name: "payment-reminders",
    description: "Envía recordatorios de pago por email/WhatsApp según automation_settings",
    fn: paymentRemindersDaily,
    scheduleKey: "paymentReminders",
  },
];

// null = todavía no se inicializó; array (posiblemente vacío) = ya se inicializó.
let scheduledTasks = null;

/**
 * Ejecuta un job con trigger "scheduled" sin dejar que un lock ocupado (u
 * otro error inesperado) se escape como excepción no manejada del callback
 * de cron — un job programado nunca debe tirar abajo el proceso.
 */
async function runScheduled(jobName) {
  try {
    await schedulerService.executeJob(jobName, null, "scheduled");
  } catch (err) {
    if (err.code === "ALREADY_RUNNING") {
      log.warn(`Ejecución programada de "${jobName}" omitida: ya había una corriendo (manual o programada)`, {
        jobName,
        trigger: "scheduled",
      });
      return;
    }
    // Cualquier otro error acá es excepcional (ej. no se pudo ni escribir el
    // log en scheduler_logs). No debe afectar al proceso ni a otros jobs.
    log.error(`Ejecución programada de "${jobName}" terminó con un error no manejado`, { jobName, err });
  }
}

/**
 * Registra los tres jobs y, si config.scheduler.enabled, los programa con
 * node-cron en la timezone configurada. Llamar más de una vez es no-op
 * (devuelve las tareas ya creadas la primera vez).
 */
export function initScheduler() {
  if (scheduledTasks !== null) {
    log.warn("initScheduler() llamado más de una vez — se ignora, el scheduler ya estaba inicializado");
    return scheduledTasks;
  }

  for (const { name, description, fn } of JOB_DEFINITIONS) {
    schedulerService.registerJob(name, description, fn);
  }

  scheduledTasks = [];

  if (!config.scheduler.enabled) {
    log.info(
      "Scheduler automático deshabilitado (SCHEDULER_ENABLED=false) — los jobs quedan registrados solo para ejecución manual",
    );
    return scheduledTasks;
  }

  for (const { name, scheduleKey } of JOB_DEFINITIONS) {
    const expression = config.scheduler.schedules[scheduleKey];

    if (!cron.validate(expression)) {
      log.error(
        `Expresión cron inválida para "${name}": "${expression}" — no se programa (sigue disponible para ejecución manual)`,
      );
      continue;
    }

    const task = cron.schedule(expression, () => runScheduled(name), {
      timezone: config.scheduler.timezone,
      noOverlap: true,
    });

    scheduledTasks.push({ jobName: name, expression, task });
    log.info(`Job programado: ${name}`, {
      jobName: name,
      cron: expression,
      timezone: config.scheduler.timezone,
    });
  }

  log.info(`Scheduler automático activo: ${scheduledTasks.length} job(s) programado(s)`, {
    timezone: config.scheduler.timezone,
  });

  return scheduledTasks;
}

/**
 * Detiene todas las tareas cron (no arrancan más ejecuciones nuevas). No
 * espera a que terminen jobs en curso — eso lo hace waitForRunningJobs().
 */
export function stopScheduler() {
  if (!scheduledTasks || scheduledTasks.length === 0) {
    return;
  }
  for (const { jobName, task } of scheduledTasks) {
    task.stop();
    log.info(`Cron detenido: ${jobName}`);
  }
}

/**
 * Espera (con timeout acotado) a que los jobs actualmente en ejecución
 * terminen, para no cerrar el pool de PostgreSQL mientras uno todavía lo
 * está usando. No cancela nada — solo da tiempo a que executeJob() llegue
 * a su `finally` y libere el lock.
 */
export async function waitForRunningJobs(timeoutMs) {
  const deadline = Date.now() + timeoutMs;
  const names = JOB_DEFINITIONS.map((j) => j.name);

  const runningNow = () => names.filter((name) => schedulerService.isRunning(name));

  let stillRunning = runningNow();
  while (stillRunning.length > 0 && Date.now() < deadline) {
    await new Promise((resolve) => setTimeout(resolve, 200));
    stillRunning = runningNow();
  }

  return { settled: stillRunning.length === 0, stillRunning };
}
