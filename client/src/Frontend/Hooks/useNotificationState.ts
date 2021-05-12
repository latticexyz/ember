import { useMemo } from "react";
import { NotificationManager, NotificationState } from "../NotificationManager";
import { UIManager } from "../UIManager";

export function useNotificationState(): NotificationState {
  return useMemo(() => UIManager.getInstance().services.notificationManager.state, []);
}
