"use client";

import { useAlerts } from "@/lib/priceAlerts";

export default function AlertsQuickCount() {
  const { alerts, mounted } = useAlerts();
  if (!mounted) return <span>—</span>;
  const active = alerts.filter((a) => !a.triggeredAt).length;
  if (active === 0) return <span>No active alerts</span>;
  return (
    <span>
      {active} active alert{active === 1 ? "" : "s"}
    </span>
  );
}
