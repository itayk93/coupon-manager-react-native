import React from "react";
import { View } from "react-native";

const passthrough = React.forwardRef(function ScreenShim(props, ref) {
  return <View ref={ref} {...props} />;
});

export const Screen = passthrough;
export const ScreenContainer = passthrough;
export const ScreenStack = passthrough;
export const ScreenStackItem = passthrough;
export const ScreenContentWrapper = passthrough;
export const ScreenFooter = passthrough;
export const FullWindowOverlay = passthrough;
export const ScreenStackHeaderConfig = passthrough;
export const ScreenStackHeaderSubview = passthrough;
export const ScreenStackHeaderLeftView = passthrough;
export const ScreenStackHeaderCenterView = passthrough;
export const ScreenStackHeaderRightView = passthrough;
export const ScreenStackHeaderBackButtonImage = passthrough;
export const ScreenStackHeaderSearchBarView = passthrough;
export const SearchBar = passthrough;
export const InnerScreen = Screen;
export const ScreenContext = React.createContext(null);
export const enableScreens = () => undefined;
export const enableFreeze = () => undefined;
export const screensEnabled = () => false;
export const freezeEnabled = () => false;
export const isSearchBarAvailableForCurrentPlatform = false;
export const executeNativeBackPress = () => false;
export const useTransitionProgress = () => ({ progress: null, closing: null });
export const featureFlags = {
  experiment: {
    synchronousScreenUpdatesEnabled: false,
    synchronousHeaderConfigUpdatesEnabled: false,
    synchronousHeaderSubviewUpdatesEnabled: false,
    iosPreventReattachmentOfDismissedScreens: false,
  },
};
export const compatibilityFlags = {};
