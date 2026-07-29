// Fixture ejecutado en un proceso hijo separado por scheduler.test.js.
// initScheduler() solo se puede llamar una vez de forma significativa por
// proceso (llamadas repetidas son no-op), así que cada escenario
// (habilitado/deshabilitado) necesita su propio proceso limpio.
const { initScheduler } = await import("../../src/services/scheduler-init.service.js");
const { schedulerService } = await import("../../src/services/scheduler.service.js");

const tasks = initScheduler();

process.stdout.write(
  JSON.stringify({
    scheduledCount: tasks.length,
    registeredJobs: schedulerService.getJobs().map((j) => j.name).sort(),
  }),
);
process.exit(0);
