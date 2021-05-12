import { EventEmitter } from "events";
import { WorldCoord, NotificationManagerEvent } from "../_types/GlobalTypes";
import { makeAutoObservable } from "mobx";
import { v4 } from "uuid";
import { createStrictEventEmitterClass } from "../Backend/Utils/Utils";
import { SoundManager, SoundType } from "../Renderer/manager/SoundManager";
import { Service } from "../Renderer/game";

export enum NotificationType {
  Info,
  Warning,
  Critical,
}

export interface Notification {
  id: string;
  text: string;
  onAction?: () => void;
  type: NotificationType;
  stale: boolean;
  time: number;
}

export class NotificationState {
  notifications: Notification[] = [];

  constructor() {
    makeAutoObservable(this);
  }

  addNotification(notification: Notification) {
    this.notifications = [notification, ...this.notifications];
  }

  removeNotification(id: string) {
    this.notifications = this.notifications.filter((n) => n.id !== id);
  }

  setNotificationStale(id: string) {
    this.notifications = this.notifications.map((n) => {
      if (n.id === id) {
        return { ...n, stale: true };
      }
      return n;
    });
  }
}

export interface NotificationManagerEvents {
  [NotificationManagerEvent.JumpToCoord]: (coord: WorldCoord) => void;
}

export class NotificationManager extends createStrictEventEmitterClass<NotificationManagerEvents>() implements Service {
  state: NotificationState;

  constructor() {
    super();
    this.state = new NotificationState();
  }

  bootService(_: Phaser.Scene) { }

  destroyService() { }

  public notify(text: string, tileCoord?: WorldCoord, type: NotificationType = NotificationType.Info) {
    const id = v4();
    const onAction =
      tileCoord != null
        ? () => {
          this.emit(NotificationManagerEvent.JumpToCoord, tileCoord);
        }
        : undefined;
    this.state.addNotification({ text, onAction, id, type, stale: false, time: Date.now() });

    SoundManager.register(SoundType.NOTIFICATION);
  }
}
