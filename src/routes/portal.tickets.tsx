import { createFileRoute, Outlet } from "@tanstack/react-router";

export const Route = createFileRoute("/portal/tickets")({
  component: () => <Outlet />,
});
