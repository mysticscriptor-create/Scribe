import { Feather } from "@expo/vector-icons";
import { useFocusEffect } from "expo-router";
import React, { useCallback, useRef, useState } from "react";
import {
  LayoutChangeEvent,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import { KeyboardStickyView } from "react-native-keyboard-controller";
import { runOnJS } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Editor, type EditorHandle } from "@/components/Editor";
import { EdgeSwipeArea } from "@/components/EdgeSwipeArea";
import { ExportSheet } from "@/components/ExportSheet";
import { FloatingWindowsLayer } from "@/components/FloatingWindow";
import { IconButton } from "@/components/IconButton";
import { Menu } from "@/components/Menu";
import { SearchOverlay } from "@/components/SearchOverlay";
import { ShortcutBar } from "@/components/ShortcutBar";
import { SidePanel } from "@/components/SidePanel";
import { useNotes } from "@/contexts/NotesContext";
import { usePanels } from "@/contexts/PanelsContext";
import { useTheme } from "@/contexts/ThemeContext";

export default function HomeScreen() {
  const { activeTheme } = useTheme();
  const { activeNote, renameNote, createNote, hydrated } = useNotes();
  const { toggleLeftMenu, toggleRightPanel, setSearchOpen } = usePanels();
  const insets = useSafeAreaInsets();
  const c = activeTheme.colors;

  const editorRef = useRef<EditorHandle | null>(null);
  const [editorFocused, setEditorFocused] = useState(false);
  const [titleEditing, setTitleEditing] = useState(false);
  const [titleDraft, setTitleDraft] = useState("");
  const [container, setContainer] = useState({ width: 0, height: 0 });
  const [zenMode, setZenMode] = useState(false);
  const [undoState, setUndoState] = useState({ canUndo: false, canRedo: false });
  const [exportOpen, setExportOpen] = useState(false);

  const toggleZen = useCallback(() => setZenMode((z) => !z), []);
  const doubleTapGesture = Gesture.Tap()
    .numberOfTaps(2)
    .maxDelay(300)
    .onEnd((_e, success) => {
      if (success) runOnJS(toggleZen)();
    });

  useFocusEffect(
    useCallback(() => {
      if (hydrated && !activeNote) {
        createNote("/", "Untitled");
      }
    }, [hydrated, activeNote, createNote]),
  );

  const onContainerLayout = (e: LayoutChangeEvent) => {
    setContainer({
      width: e.nativeEvent.layout.width,
      height: e.nativeEvent.layout.height,
    });
  };

  const startTitleEdit = () => {
    if (!activeNote) return;
    setTitleDraft(activeNote.name);
    setTitleEditing(true);
  };

  const commitTitleEdit = () => {
    if (activeNote && titleDraft.trim()) {
      renameNote(activeNote.id, titleDraft.trim());
    }
    setTitleEditing(false);
  };

  return (
    <View
      style={[styles.root, { backgroundColor: c.background }]}
      onLayout={onContainerLayout}
    >
      {/* Top bar */}
      {!zenMode ? (
        <View
          style={[
            styles.topBar,
            {
              paddingTop: insets.top + 6,
              backgroundColor: c.toolbar,
              borderBottomColor: c.border,
            },
          ]}
        >
          <IconButton icon="menu" onPress={toggleLeftMenu} accessibilityLabel="Open menu" />
          <Pressable
            style={styles.titleWrap}
            onPress={startTitleEdit}
            disabled={!activeNote}
          >
            {titleEditing ? (
              <TextInput
                value={titleDraft}
                onChangeText={setTitleDraft}
                onBlur={commitTitleEdit}
                onSubmitEditing={commitTitleEdit}
                autoFocus
                returnKeyType="done"
                selectTextOnFocus
                style={[
                  styles.titleInput,
                  { color: c.toolbarText, borderColor: c.border },
                ]}
              />
            ) : (
              <View style={{ alignItems: "center" }}>
                <Text
                  style={[styles.title, { color: c.toolbarText }]}
                  numberOfLines={1}
                >
                  {activeNote?.name ?? "Scribe"}
                </Text>
                <Text style={[styles.subtitle, { color: c.mutedText }]}>
                  {activeNote
                    ? `${activeNote.folderPath === "/" ? "" : activeNote.folderPath + "/"}${activeNote.name}.${activeNote.ext}`
                    : "no note open"}
                </Text>
              </View>
            )}
          </Pressable>
          <IconButton
            icon="search"
            onPress={() => setSearchOpen(true)}
            accessibilityLabel="Search"
          />
          <IconButton
            icon="edit-2"
            onPress={() => editorRef.current?.toggleFindReplace()}
            accessibilityLabel="Find and replace in note"
          />
          <IconButton
            icon="share"
            onPress={() => setExportOpen(true)}
            accessibilityLabel="Export"
            disabled={!activeNote}
          />
          <IconButton
            icon="eye"
            onPress={() => setZenMode(true)}
            accessibilityLabel="Zen mode"
          />
          <IconButton
            icon="folder"
            onPress={toggleRightPanel}
            accessibilityLabel="Files"
          />
        </View>
      ) : (
        <View style={{ height: insets.top }} />
      )}

      {zenMode ? (
        <Pressable
          onPress={() => setZenMode(false)}
          style={[
            styles.zenExit,
            { top: insets.top + 8, backgroundColor: c.surface, borderColor: c.border },
          ]}
        >
          <Feather name="eye-off" size={14} color={c.text} />
        </Pressable>
      ) : null}

      {/* Editor area */}
      <GestureDetector gesture={doubleTapGesture}>
        <View style={{ flex: 1 }}>
          {activeNote ? (
            <Editor
              key={activeNote.id}
              noteId={activeNote.id}
              initialContent={activeNote.content}
              registerHandle={(h) => {
                editorRef.current = h;
              }}
              onSelectionChange={() => {
                if (!editorFocused) setEditorFocused(true);
              }}
              onUndoRedoChange={setUndoState}
            />
          ) : (
            <View style={styles.emptyState}>
              <Feather name="edit-3" size={32} color={c.mutedText} />
              <Text style={[styles.emptyText, { color: c.mutedText }]}>
                No note selected. Use the files panel to pick or create one.
              </Text>
            </View>
          )}
        </View>
      </GestureDetector>

      {/* Shortcut bar above keyboard */}
      <KeyboardStickyView offset={{ closed: 0, opened: 0 }}>
        <ShortcutBar
          visible={!zenMode}
          onApply={(s) => editorRef.current?.applyShortcut(s)}
          onUndo={() => editorRef.current?.undo()}
          onRedo={() => editorRef.current?.redo()}
          canUndo={undoState.canUndo}
          canRedo={undoState.canRedo}
        />
      </KeyboardStickyView>

      {/* Edge swipe handles (over content, transparent) */}
      <EdgeSwipeArea edge="right" />
      <EdgeSwipeArea edge="left" />

      {/* Floating windows layer */}
      <FloatingWindowsLayer
        containerWidth={container.width}
        containerHeight={container.height}
      />

      {/* Drawers */}
      <Menu />
      <SidePanel />

      {/* Search overlay */}
      <SearchOverlay />

      <ExportSheet
        visible={exportOpen}
        note={activeNote}
        onClose={() => setExportOpen(false)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 8,
    paddingBottom: 6,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  titleWrap: {
    flex: 1,
    paddingHorizontal: 4,
  },
  title: {
    fontSize: 16,
    fontWeight: "600",
  },
  subtitle: {
    fontSize: 11,
    marginTop: 1,
  },
  titleInput: {
    fontSize: 16,
    fontWeight: "600",
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: Platform.OS === "ios" ? 6 : 4,
    textAlign: "center",
  },
  emptyState: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
    padding: 30,
  },
  emptyText: {
    fontSize: 14,
    textAlign: "center",
    maxWidth: 280,
    lineHeight: 20,
  },
  zenExit: {
    position: "absolute",
    right: 12,
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: StyleSheet.hairlineWidth,
    zIndex: 20,
    elevation: 8,
  },
});
