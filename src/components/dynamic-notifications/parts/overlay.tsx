import { useDynamicNotifications } from "../hooks/use-dynamic-notifications";
import type { INotificationOverlay } from "../interfaces/notification-overlay.interface";
import { memo } from "react";
import { StyleSheet, View } from "react-native";
import { Content } from "./content";
import { Gooey } from "./gooey";

const Overlay: React.FC<INotificationOverlay> &
  React.FunctionComponent<INotificationOverlay> = memo<INotificationOverlay>(
  ({
    style,
  }: INotificationOverlay):
    | (React.ReactNode & React.ReactElement & React.JSX.Element)
    | null => {
    const { layout, notification } = useDynamicNotifications();

    // Local change: upstream keeps the canvas mounted and paints its pill over
    // the real island at all times. A screenshot does not capture the hardware
    // island, so that pill showed up in every screenshot of the app. It is
    // only needed while a notification is on screen.
    if (!notification) {
      return null;
    }

    return (
      <View
        pointerEvents="box-none"
        style={[styles.overlay, { height: layout.canvasHeight }, style]}
      >
        <Gooey />
        <Content />
      </View>
    );
  },
);

const styles = StyleSheet.create({
  overlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
  },
});

export { Overlay };
