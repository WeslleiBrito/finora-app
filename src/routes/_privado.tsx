import { createFileRoute, Outlet, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { AppShell } from "@/components/app/app-shell";
import { useAuth } from "@/lib/auth";

export const Route = createFileRoute("/_privado")({
  component: PrivateLayout,
});

function PrivateLayout() {
  const { user, ready } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (ready && !user) void navigate({ to: "/login" });
  }, [ready, user, navigate]);

  return (
    <AppShell>
      <Outlet />
    </AppShell>
  );
}
