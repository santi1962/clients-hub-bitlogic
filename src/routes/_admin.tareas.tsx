import { createFileRoute, Outlet } from "@tanstack/react-router";

export const Route = createFileRoute("/_admin/tareas")({
  component: TareasLayout,
});

function TareasLayout() {
  return <Outlet />;
}
