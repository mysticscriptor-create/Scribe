import { Feather } from "@expo/vector-icons";
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  Animated,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  type TextInputSelectionChangeEventData,
  View,
  type NativeSyntheticEvent,
} from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";

import { FONT_FAMILY_MAP } from "@/constants/defaultThemes";
import { useNotes } from "@/contexts/NotesContext";
import { LINE_SPACING_MAP, usePanels } from "@/contexts/PanelsContext";
import type { Shortcut } from "@/contexts/ShortcutsContext";
import { useTheme } from "@/contexts/ThemeContext";
import { countWords, readingTimeMinutes } from "@/lib/markdown";
import { MarkdownPreview } from "@/components/MarkdownPreview";
import { useWritingStats } from "@/contexts/WritingStatsContext";
import {
  clearRecoveryBuffer,
  getRecoveryBuffer,
  saveRecoveryBuffer,
} from "@/lib/recovery";
import { maybeSnapshot } from "@/lib/history";
import { FindReplaceBar, type FindMatch } from "@/components/FindReplaceBar";

const PAIR_OPEN_TO_CLOSE: Record<string, string> = {
  '"': '"',
  "'": "'",
  "(": ")",
  "[": "]",
  "{": "}",
  "`": "`",
  "\u201c": "\u201d",
  "\u2018": "\u2019",
  "«": "»",
};

const CLOSE_CHARS = new Set(Object.values(PAIR_OPEN_TO_CLOSE));

const HISTORY_LIMIT = 200;
const HISTORY_GROUP_MS = 700;

type Selection = { start: number; end: number };

export type EditorHandle = {
  applyShortcut: (s: Shortcut) => void;
  focus: () => void;
  insertText: (text: string) => void;
  undo: () => void;
  redo: () => void;
  flush: () => void;
  canUndo: () => boolean;
  canRedo: () => boolean;
  toggleFindReplace: () => void;
};

type EditorProps = {
  noteId: string;
  initialContent: string;
  autoFocus?: boolean;
  onChangeContent?: (content: string) => void;
  onSelectionChange?: (sel: Selection) => void;
  onUndoRedoChange?: (state: { canUndo: boolean; canRedo: boolean }) => void;
  registerHandle?: (h: EditorHandle | null) => void;
};

export function Editor({
  noteId,
  initialContent,
  autoFocus = false,
  onChangeContent,
  onSelectionChange,
  onUndoRedoChange,
  registerHandle,
}: EditorProps) {
  const { activeTheme } = useTheme();
  const { updateNoteContent } = useNotes();
  const { showWordCount, typewriterMode, lineSpacing, editorFontSize } =
    usePanels();
  const { dailyGoal, todayWords, goalReached, recordWordDelta } =
    useWritingStats();
  const c = activeTheme.colors;

  const [content, setContent] = useState(initialContent);
  const [savedTick, setSavedTick] = useState(0);
  const [collapsedCount, setCollapsedCount] = useState(false);
  const [previewMode, setPreviewMode] = useState(false);
  const [findReplaceOpen, setFindReplaceOpen] = useState(false);
  const [recoveryOffer, setRecoveryOffer] = useState<string | null>(null);
  const scrollRef = useRef<any>(null);
  const scrollViewHeightRef = useRef(0);
  const lastWordCountRef = useRef(countWords(initialContent));
  const goalCelebratedRef = useRef(false);
  const goalPulse = useRef(new Animated.Value(0)).current;
  const cursorRef = useRef<Selection>({
    start: initialContent.length,
    end: initialContent.length,
  });
  const [forcedSelection, setForcedSelection] = useState<Selection | undefined>(
    undefined,
  );
  const inputRef = useRef<TextInput>(null);
  const lastSavedRef = useRef<string>(initialContent);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Undo / redo history
  const historyRef = useRef<{
    past: string[];
    future: string[];
    lastChangeAt: number;
  }>({
    past: [],
    future: [],
    lastChangeAt: 0,
  });

  const notifyUndoRedo = useCallback(() => {
    onUndoRedoChange?.({
      canUndo: historyRef.current.past.length > 0,
      canRedo: historyRef.current.future.length > 0,
    });
  }, [onUndoRedoChange]);

  // Reset content when note changes
  useEffect(() => {
    setContent(initialContent);
    cursorRef.current = {
      start: initialContent.length,
      end: initialContent.length,
    };
    historyRef.current = { past: [], future: [], lastChangeAt: 0 };
    lastSavedRef.current = initialContent;
    lastWordCountRef.current = countWords(initialContent);
    notifyUndoRedo();
    setFindReplaceOpen(false);
    setRecoveryOffer(null);

    getRecoveryBuffer(noteId).then((buf) => {
      if (buf && buf.content !== initialContent && buf.content.trim().length > 0) {
        setRecoveryOffer(buf.content);
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [noteId, initialContent, notifyUndoRedo]);

  // Continuously persist a crash-recovery buffer as the user types
  useEffect(() => {
    const t = setTimeout(() => {
      saveRecoveryBuffer(noteId, content).catch(() => {});
    }, 800);
    return () => clearTimeout(t);
  }, [noteId, content]);

  // Track net word-count delta against the writing-stats tracker (goal + streak)
  const applyWordDelta = useCallback(
    (savedContent: string) => {
      const newCount = countWords(savedContent);
      const delta = newCount - lastWordCountRef.current;
      lastWordCountRef.current = newCount;
      recordWordDelta(delta);
    },
    [recordWordDelta],
  );

  // Force-save helper
  const flushSave = useCallback(() => {
    if (saveTimerRef.current) {
      clearTimeout(saveTimerRef.current);
      saveTimerRef.current = null;
    }
    if (lastSavedRef.current !== content) {
      lastSavedRef.current = content;
      updateNoteContent(noteId, content);
      onChangeContent?.(content);
      setSavedTick((t) => t + 1);
      applyWordDelta(content);
      maybeSnapshot(noteId, content).catch(() => {});
    }
  }, [content, noteId, updateNoteContent, onChangeContent, applyWordDelta]);

  // Schedule debounced save on every content change (100ms)
  useEffect(() => {
    if (lastSavedRef.current === content) return;
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => {
      lastSavedRef.current = content;
      updateNoteContent(noteId, content);
      onChangeContent?.(content);
      setSavedTick((t) => t + 1);
      applyWordDelta(content);
      maybeSnapshot(noteId, content).catch(() => {});
    }, 120);
    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    };
  }, [content, noteId, updateNoteContent, onChangeContent, applyWordDelta]);

  // Save when component unmounts or note id changes
  useEffect(() => {
    return () => {
      if (lastSavedRef.current !== content) {
        updateNoteContent(noteId, content);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [noteId]);

  // Clear forced selection after one render cycle
  useEffect(() => {
    if (!forcedSelection) return;
    const t = setTimeout(() => setForcedSelection(undefined), 30);
    return () => clearTimeout(t);
  }, [forcedSelection]);

  const handleSelectionChange = useCallback(
    (e: NativeSyntheticEvent<TextInputSelectionChangeEventData>) => {
      cursorRef.current = e.nativeEvent.selection;
      onSelectionChange?.(e.nativeEvent.selection);

      if (typewriterMode && scrollRef.current) {
        const pos = e.nativeEvent.selection.start;
        const lineIndex = content.slice(0, pos).split("\n").length - 1;
        const lineHeightPx = activeTheme.fontSize * activeTheme.lineHeight;
        const lineY = lineIndex * lineHeightPx + activeTheme.paddingVertical;
        const targetY = Math.max(
          0,
          lineY - scrollViewHeightRef.current / 2 + lineHeightPx / 2,
        );
        scrollRef.current.scrollTo({ y: targetY, animated: true });
      }
    },
    [onSelectionChange, typewriterMode, content, activeTheme],
  );

  const setCursor = useCallback((position: number) => {
    cursorRef.current = { start: position, end: position };
    setForcedSelection({ start: position, end: position });
  }, []);

  const pushHistory = useCallback(
    (prev: string) => {
      const now = Date.now();
      const h = historyRef.current;
      const grouped =
        h.past.length > 0 && now - h.lastChangeAt < HISTORY_GROUP_MS;
      if (!grouped) {
        h.past.push(prev);
        if (h.past.length > HISTORY_LIMIT) h.past.shift();
      }
      h.future = [];
      h.lastChangeAt = now;
      notifyUndoRedo();
    },
    [notifyUndoRedo],
  );

  const handleChangeText = useCallback(
    (newText: string) => {
      const oldText = content;
      const lenDiff = newText.length - oldText.length;

      // Single-char insertion: smart pair / smart enter / skip-over
      if (lenDiff === 1) {
        let diffPos = 0;
        const minLen = Math.min(oldText.length, newText.length);
        while (
          diffPos < minLen &&
          oldText.charCodeAt(diffPos) === newText.charCodeAt(diffPos)
        ) {
          diffPos++;
        }
        const insertedChar = newText[diffPos] ?? "";
        const charAfterCursor = oldText[diffPos] ?? "";

        // Smart enter
        if (insertedChar === "\n" && CLOSE_CHARS.has(charAfterCursor)) {
          setContent(oldText);
          setCursor(diffPos + 1);
          return;
        }
        // Auto-pair
        if (PAIR_OPEN_TO_CLOSE[insertedChar]) {
          const closeChar = PAIR_OPEN_TO_CLOSE[insertedChar];
          if (charAfterCursor !== closeChar) {
            pushHistory(oldText);
            const updated =
              newText.slice(0, diffPos + 1) +
              closeChar +
              newText.slice(diffPos + 1);
            setContent(updated);
            setCursor(diffPos + 1);
            return;
          }
        }
        // Skip-over
        if (CLOSE_CHARS.has(insertedChar) && charAfterCursor === insertedChar) {
          setContent(oldText);
          setCursor(diffPos + 1);
          return;
        }
      }

      pushHistory(oldText);
      setContent(newText);
    },
    [content, setCursor, pushHistory],
  );

  const applyShortcut = useCallback(
    (s: Shortcut) => {
      const start = cursorRef.current.start;
      const end = cursorRef.current.end;
      const before = content.slice(0, start);
      const middle = content.slice(start, end);
      const after = content.slice(end);

      pushHistory(content);

      if (s.kind === "insert") {
        const updated = before + s.payload + after;
        setContent(updated);
        setCursor(start + s.payload.length);
        return;
      }
      if (s.kind === "wrap" || s.kind === "pair") {
        const open = s.payload;
        const close = s.closing ?? s.payload;
        if (middle.length > 0) {
          const updated = before + open + middle + close + after;
          setContent(updated);
          setCursor(end + open.length + close.length);
        } else {
          const updated = before + open + close + after;
          setContent(updated);
          setCursor(start + open.length);
        }
      }
    },
    [content, setCursor, pushHistory],
  );

  const focus = useCallback(() => {
    inputRef.current?.focus();
  }, []);

  const insertText = useCallback(
    (text: string) => {
      const start = cursorRef.current.start;
      const end = cursorRef.current.end;
      pushHistory(content);
      const updated = content.slice(0, start) + text + content.slice(end);
      setContent(updated);
      setCursor(start + text.length);
    },
    [content, setCursor, pushHistory],
  );

  const undo = useCallback(() => {
    const h = historyRef.current;
    if (h.past.length === 0) return;
    const prev = h.past.pop()!;
    h.future.push(content);
    if (h.future.length > HISTORY_LIMIT) h.future.shift();
    setContent(prev);
    setCursor(prev.length);
    notifyUndoRedo();
  }, [content, setCursor, notifyUndoRedo]);

  const redo = useCallback(() => {
    const h = historyRef.current;
    if (h.future.length === 0) return;
    const next = h.future.pop()!;
    h.past.push(content);
    if (h.past.length > HISTORY_LIMIT) h.past.shift();
    setContent(next);
    setCursor(next.length);
    notifyUndoRedo();
  }, [content, setCursor, notifyUndoRedo]);

  const toggleFindReplace = useCallback(() => {
    setFindReplaceOpen((v) => !v);
  }, []);

  // Expose handle to parent
  useEffect(() => {
    registerHandle?.({
      applyShortcut,
      focus,
      insertText,
      undo,
      redo,
      flush: flushSave,
      canUndo: () => historyRef.current.past.length > 0,
      canRedo: () => historyRef.current.future.length > 0,
      toggleFindReplace,
    });
    return () => registerHandle?.(null);
  }, [
    registerHandle,
    applyShortcut,
    focus,
    insertText,
    undo,
    redo,
    flushSave,
    toggleFindReplace,
  ]);

  const handleFindJump = useCallback((match: FindMatch) => {
    cursorRef.current = { start: match.start, end: match.end };
    setForcedSelection({ start: match.start, end: match.end });
  }, []);

  const handleReplaceOne = useCallback(
    (match: FindMatch, replacement: string) => {
      pushHistory(content);
      const updated =
        content.slice(0, match.start) + replacement + content.slice(match.end);
      setContent(updated);
      const pos = match.start + replacement.length;
      setCursor(pos);
    },
    [content, pushHistory, setCursor],
  );

  const handleReplaceAll = useCallback(
    (query: string, replacement: string, caseSensitive: boolean): number => {
      if (!query) return 0;
      const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const re = new RegExp(escapeRe(query), "g" + (caseSensitive ? "" : "i"));
      const matches = content.match(re);
      if (!matches || matches.length === 0) return 0;
      pushHistory(content);
      const updated = content.replace(re, replacement);
      setContent(updated);
      return matches.length;
    },
    [content, pushHistory],
  );

  const acceptRecovery = useCallback(() => {
    if (recoveryOffer === null) return;
    pushHistory(content);
    setContent(recoveryOffer);
    setCursor(recoveryOffer.length);
    setRecoveryOffer(null);
    clearRecoveryBuffer(noteId).catch(() => {});
  }, [recoveryOffer, content, pushHistory, setCursor, noteId]);

  const dismissRecovery = useCallback(() => {
    setRecoveryOffer(null);
    clearRecoveryBuffer(noteId).catch(() => {});
  }, [noteId]);

  const fontFamily = FONT_FAMILY_MAP[activeTheme.fontFamily];
  const effectiveFontSize =
    editorFontSize > 0 ? editorFontSize : activeTheme.fontSize;
  const effectiveLineHeightRatio = LINE_SPACING_MAP[lineSpacing];
  const lineHeightPx = effectiveFontSize * effectiveLineHeightRatio;

  const stats = useMemo(
    () => ({
      words: countWords(content),
      chars: content.length,
      mins: readingTimeMinutes(content),
    }),
    [content],
  );

  const goalProgress = dailyGoal > 0 ? Math.min(1, todayWords / dailyGoal) : 0;

  useEffect(() => {
    if (goalReached && !goalCelebratedRef.current) {
      goalCelebratedRef.current = true;
      Animated.sequence([
        Animated.timing(goalPulse, {
          toValue: 1,
          duration: 220,
          useNativeDriver: false,
        }),
        Animated.timing(goalPulse, {
          toValue: 0,
          duration: 420,
          useNativeDriver: false,
        }),
      ]).start();
    }
    if (!goalReached) goalCelebratedRef.current = false;
  }, [goalReached, goalPulse]);

  const goalBarHeight = goalPulse.interpolate({
    inputRange: [0, 1],
    outputRange: [3, 6],
  });

  return (
    <View style={{ flex: 1, backgroundColor: c.background }}>
      <View style={[styles.goalTrack, { backgroundColor: c.border }]}>
        <Animated.View
          style={[
            styles.goalFill,
            {
              width: `${goalProgress * 100}%`,
              height: goalBarHeight,
              backgroundColor: goalReached ? "#22c55e" : c.accent,
            },
          ]}
        />
      </View>
      {findReplaceOpen ? (
        <FindReplaceBar
          content={content}
          onClose={() => setFindReplaceOpen(false)}
          onJump={handleFindJump}
          onReplaceOne={handleReplaceOne}
          onReplaceAll={handleReplaceAll}
        />
      ) : null}

      {recoveryOffer !== null ? (
        <View
          style={[
            styles.recoveryBanner,
            { backgroundColor: c.surface, borderColor: c.accent },
          ]}
        >
          <Feather name="alert-triangle" size={14} color={c.accent} />
          <Text style={[styles.recoveryText, { color: c.text }]} numberOfLines={2}>
            We found unsaved changes from before. Restore them?
          </Text>
          <Pressable onPress={acceptRecovery} hitSlop={6}>
            <Text style={[styles.recoveryAction, { color: c.accent }]}>
              Restore
            </Text>
          </Pressable>
          <Pressable onPress={dismissRecovery} hitSlop={6}>
            <Feather name="x" size={16} color={c.mutedText} />
          </Pressable>
        </View>
      ) : null}

      <KeyboardAwareScrollView
        ref={scrollRef}
        style={styles.scroll}
        contentContainerStyle={[
          styles.scrollContent,
          {
            paddingHorizontal: activeTheme.paddingHorizontal,
            paddingVertical: activeTheme.paddingVertical,
            paddingBottom: typewriterMode ? 300 : 80,
          },
        ]}
        onLayout={(e) => {
          scrollViewHeightRef.current = e.nativeEvent.layout.height;
        }}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="interactive"
        showsVerticalScrollIndicator={false}
        bottomOffset={120}
      >
        <View
          style={{
            width: "100%",
            maxWidth: activeTheme.maxWidth,
            alignSelf: "center",
          }}
        >
          {previewMode ? (
            <Pressable onPress={() => setPreviewMode(false)}>
              <MarkdownPreview
                content={content}
                textColor={c.text}
                mutedColor={c.mutedText}
                accentColor={c.accent}
                fontFamily={fontFamily}
                fontSize={activeTheme.fontSize}
                lineHeight={activeTheme.lineHeight}
                letterSpacing={activeTheme.letterSpacing}
              />
            </Pressable>
          ) : (
            <TextInput
              ref={inputRef}
              value={content}
              onChangeText={handleChangeText}
              onSelectionChange={handleSelectionChange}
              selection={forcedSelection}
              autoFocus={autoFocus}
              multiline
              textAlignVertical="top"
              autoCorrect
              autoCapitalize="sentences"
              spellCheck
              placeholder="Begin writing…"
              placeholderTextColor={c.mutedText}
              selectionColor={c.selection}
              underlineColorAndroid="transparent"
              scrollEnabled={false}
              style={[
                styles.input,
                {
                  color: c.text,
                  fontFamily,
                  fontSize: effectiveFontSize,
                  lineHeight: lineHeightPx,
                  letterSpacing: activeTheme.letterSpacing,
                  minHeight: 400,
                  ...(Platform.OS === "web"
                    ? ({
                        outlineWidth: 0,
                        outlineStyle: "none",
                      } as object)
                    : {}),
                },
              ]}
            />
          )}
        </View>
      </KeyboardAwareScrollView>

      {/* Write / Read mode toggle */}
      <Pressable
        onPress={() => setPreviewMode((p) => !p)}
        style={[
          styles.previewToggle,
          { backgroundColor: c.surface, borderColor: c.border },
        ]}
        accessibilityLabel={previewMode ? "Switch to write mode" : "Switch to preview mode"}
      >
        <Feather
          name={previewMode ? "edit-3" : "eye"}
          size={14}
          color={c.text}
        />
      </Pressable>

      {/* Floating word count */}
      {showWordCount && !collapsedCount ? (
        <Pressable
          onPress={() => setCollapsedCount(true)}
          style={[
            styles.wordCount,
            {
              backgroundColor: c.surface,
              borderColor: c.border,
            },
          ]}
        >
          <Feather name="edit-2" size={10} color={c.mutedText} />
          <Text style={[styles.wordCountText, { color: c.text }]}>
            {stats.words.toLocaleString()} words
          </Text>
          <Text style={[styles.wordCountMuted, { color: c.mutedText }]}>
            · {stats.chars.toLocaleString()} ch · {stats.mins} min
          </Text>
          {savedTick > 0 ? (
            <View
              style={[styles.savedDot, { backgroundColor: c.accent }]}
            />
          ) : null}
        </Pressable>
      ) : showWordCount && collapsedCount ? (
        <Pressable
          onPress={() => setCollapsedCount(false)}
          style={[
            styles.wordCountTiny,
            { backgroundColor: c.surface, borderColor: c.border },
          ]}
        >
          <Text style={[styles.wordCountText, { color: c.mutedText }]}>
            {stats.words}
          </Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  goalTrack: {
    width: "100%",
    height: 3,
    overflow: "visible",
  },
  goalFill: {
    borderRadius: 3,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingBottom: 80,
  },
  input: {
    width: "100%",
    padding: 0,
    margin: 0,
    borderWidth: 0,
  },
  previewToggle: {
    position: "absolute",
    top: 10,
    right: 12,
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: StyleSheet.hairlineWidth,
    elevation: 3,
    shadowColor: "#000",
    shadowOpacity: 0.12,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 4,
  },
  wordCount: {
    position: "absolute",
    bottom: 12,
    right: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    elevation: 3,
    shadowColor: "#000",
    shadowOpacity: 0.12,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 4,
  },
  wordCountTiny: {
    position: "absolute",
    bottom: 12,
    right: 12,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    opacity: 0.7,
  },
  wordCountText: {
    fontSize: 11,
    fontWeight: "600",
  },
  wordCountMuted: {
    fontSize: 10,
  },
  savedDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginLeft: 2,
  },
  recoveryBanner: {
    position: "absolute",
    top: 10,
    left: 12,
    right: 50,
    zIndex: 20,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
    elevation: 4,
    shadowColor: "#000",
    shadowOpacity: 0.15,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 4,
  },
  recoveryText: {
    flex: 1,
    fontSize: 11,
    lineHeight: 14,
  },
  recoveryAction: {
    fontSize: 12,
    fontWeight: "700",
  },
});
