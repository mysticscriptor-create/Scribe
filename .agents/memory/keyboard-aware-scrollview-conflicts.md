---
name: KeyboardAwareScrollView vs manual scroll conflicts (Scribe editor)
description: react-native-keyboard-controller's KeyboardAwareScrollView has its own selection-driven auto-scroll that can fight a custom scroll system (e.g. typewriter mode), and its bottomOffset must reflect real chrome between content and keyboard.
---

`KeyboardAwareScrollView` (react-native-keyboard-controller) auto-scrolls to keep the focused input's caret visible on every selection change that moves to a new line — this is independent of and runs alongside any custom scroll-follow logic you build (e.g. a typewriter-mode centered-line scroll). Running both at once means two systems scroll to two different targets on the same event (Enter, and auto-paired quotes/brackets both trigger a line-change selection event), producing visible jitter/jumps.

**Why:** confirmed by reading the library's source — its internal `onSelectionChange` worklet calls `scrollFromCurrentPosition()` unconditionally whenever the caret's line changes, with no way to opt out short of the top-level `enabled` prop.

**How to apply:** when you have a custom scroll authority for some mode (e.g. typewriter mode), set `enabled={!yourCustomModeFlag}` on `KeyboardAwareScrollView` while that mode is active, and reserve enough static `paddingBottom` yourself so the keyboard doesn't cover content in that mode (the library's own dynamic keyboard padding stops applying when disabled).

Also: `bottomOffset` is "distance between keyboard and caret when shown" — it must include any real chrome that sits between the scroll view and the keyboard (e.g. a sticky toolbar/shortcut bar), not just a guessed constant. Measure that chrome's actual height via `onLayout` and pass it in, rather than hardcoding a number that drifts from the real layout and causes the caret to end up mis-scrolled.
