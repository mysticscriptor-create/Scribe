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

// Default hit area is a fraction of the screen width (with a sane floor),
// not a fixed 24px sliver — a 24px zone was too thin to reliably catch a
// real thumb swipe starting a little way in from the edge.
const DEFAULT_EDGE_FRACTION = 0.35;
const MIN_EDGE_WIDTH = 60;

export function EdgeSwipeArea({
  edge,
  edgeWidth,
  threshold = 60,
  ...rest
}: EdgeSwipeAreaProps) {
  const { setRightPanelOpen, setLeftMenuOpen } = usePanels();
  const resolvedEdgeWidth =
    edgeWidth ??
    Math.max(MIN_EDGE_WIDTH, Dimensions.get("window").width * DEFAULT_EDGE_FRACTION);

  const responder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (evt, g) => {
        if (Math.abs(g.dx) <= Math.abs(g.dy)) return false;
        const screenW = Dimensions.get("window").width;
        if (
          edge === "right" &&
          evt.nativeEvent.pageX < screenW - resolvedEdgeWidth
        ) {
          return false;
        }
        if (edge === "left" && evt.nativeEvent.pageX > resolvedEdgeWidth) {
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
        { width: resolvedEdgeWidth },
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
