---
name: EdgeSwipeArea / drawer gesture architecture
description: Why edge-swipe-to-open uses react-native-gesture-handler, scoped narrow, and disabled while a drawer is open; why drawer close-swipe uses a plain PanResponder safely.
---

**Never use a raw PanResponder-backed sibling View as a full-height/wide "edge swipe" overlay stacked on top of unrelated UI.**

**Why:** RN's responder negotiation only walks back up the *original* hit-tested view's own ancestors — never sideways to a sibling. A PanResponder View sitting visually on top of buttons/ScrollViews as a sibling (not their ancestor) silently eats every touch under it, even ones it never ends up claiming (e.g. a tap, or a vertical scroll gesture it declines). A previous EdgeSwipeArea spanning full screen height and ~35% of width this way caused: drawer close button/scrim unreachable, shortcut bar horizontal scroll broken, top-bar/file-explorer buttons dead, and vertical editor scroll dead near the edges.

**How to apply:** For edge-swipe-to-open gestures, use `react-native-gesture-handler`'s `Gesture.Pan()` + `GestureDetector` instead — its native recognizers coexist with sibling touchables rather than pre-empting them. Keep the hit zone a small fixed pixel width (~28-32px), scoped inside the container it should affect (not the screen root) so it can't span into unrelated chrome, and unmount/disable it while the thing it would open is already open.

For a drawer's own swipe-to-close gesture, a plain `PanResponder` wrapping the drawer's *own* content is safe (this is the opposite case: ancestor, not sibling) — `onMoveShouldSetPanResponder` only fires on real movement past a direction-locked threshold, so plain taps and the drawer's internal vertical ScrollView are unaffected as long as you gate it on horizontal-dominant drag distance.

Also: a PanResponder created once via `useRef` closes over stale state from its initial render. Keep a ref (`fooOpenRef.current = fooOpen` on every render) and read the ref inside the responder's callbacks instead of the state variable directly.
