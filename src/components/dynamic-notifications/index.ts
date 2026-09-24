import { Content } from "./parts/content";
import { Gooey } from "./parts/gooey";
import { Overlay } from "./parts/overlay";
import { Root } from "./parts/root";
import { NotificationBody } from "./ui/notification-body";

const DynamicNotifications = Object.assign(Root, {
  Overlay,
  Gooey,
  Content,
  Body: NotificationBody,
});

export { DynamicNotifications };
export { useDynamicNotifications } from "./hooks/use-dynamic-notifications";
export type { IDynamicNotification } from "./interfaces/dynamic-notification.interface";
