import React from "react";
import { View } from "react-native";

const MapView = React.forwardRef(function MapViewShim(props, ref) {
  return <View ref={ref} {...props} />;
});

export default MapView;
export { MapView };
export const Marker = View;
export const Callout = View;
export const Circle = View;
export const Polyline = View;
export const Polygon = View;
export const PROVIDER_GOOGLE = "google";
