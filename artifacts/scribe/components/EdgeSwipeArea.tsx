import React, { useRef } from "react";
import {
  Dimensions,
  PanResponder,
  StyleSheet,
  View,
  type ViewProps,
} from "react-native";

import { usePanels } from "@/contexts/PanelsContext";

type Edge = "left" | "right";

type EdgeSwipeAreaProps = ViewProps & {
  edge: Edge;
  edgeWidth?: number;
  threshold?: number;
};

export function EdgeSwipeArea({
  edge,
  edgeWidth = 24,
  threshold = 60,
  ...rest
}: EdgeSwipeAreaProps) {
  const { setRightPanelOpen, setLeftMenuOpen } = usePanels();

  const responder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (evt, g) => {
        if (Math.abs(g.dx) <= Math.abs(g.dy)) return false;
        const screenW = Dimensions.get("window").width;
        if (edge === "right" && evt.nativeEvent.pageX < screenW - edgeWidth) {
          return false;
        }
        if (edge === "left" && evt.nativeEvent.pageX > edgeWidth) {
          return false;
        }
        return Math.abs(g.dx) > 8;
      },
      onPanResponderRelease: (_, g) => {
        if (edge === "right" && g.dx < -threshold) {
          setRightPanelOpen(true);
        }
        if (edge === "left" && g.dx > threshold) {
          setLeftMenuOpen(true);
        }
      },
    }),
  ).current;

  return (
    <View
      {...rest}
      {...responder.panHandlers}
      style={[
        styles.area,
        edge === "right" ? { right: 0 } : { left: 0 },
        { width: edgeWidth },
        rest.style,
      ]}
    />
  );
}

const styles = StyleSheet.create({
  area: {
    position: "absolute",
    top: 0,
    bottom: 0,
    backgroundColor: "transparent",
    zIndex: 5,
  },
});
