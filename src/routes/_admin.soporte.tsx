import { createFileRoute, Outlet } from "@tanstack/react-router";

export const Route = createFileRoute("/_admin/soporte")({
  component: SoporteLayout,
});

function SoporteLayout() {
  return <Outlet />;
}
