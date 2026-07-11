import { Feather } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React, { useEffect, useRef, useState } from "react";
import {
  Alert,
  Animated,
  Dimensions,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { ExportSheet } from "@/components/ExportSheet";
import { FileTree } from "@/components/FileTree";
import { IconButton } from "@/components/IconButton";
import { MarkdownView } from "@/components/MarkdownView";
import { ProjectsView } from "@/components/ProjectsView";
import { useNotes, type NoteFile } from "@/contexts/NotesContext";
import {
  usePanels,
  type FileViewMode,
  type PinnedSlot,
} from "@/contexts/PanelsContext";
import { useTheme } from "@/contexts/ThemeContext";

type SidePanelTab = "files" | "pinned" | "projects";

export function SidePanel() {
  const { rightPanelOpen, setRightPanelOpen, setSearchOpen } = usePanels();
  const { setActiveNote } = useNotes();
  const { activeTheme } = useTheme();
  const insets = useSafeAreaInsets();
  const c = activeTheme.colors;
  const screenWidth = Dimensions.get("window").width;
  const panelWidth = Math.min(360, Math.max(280, screenWidth * 0.82));
  const translateX = useRef(new Animated.Value(panelWidth)).current;
  const [tab, setTab] = useState<SidePanelTab>("files");
  const [actionNoteId, setActionNoteId] = useState<string | null>(null);

  useEffect(() => {
    Animated.timing(translateX, {
      toValue: rightPanelOpen ? 0 : panelWidth,
      duration: 240,
      useNativeDriver: true,
    }).start();
  }, [rightPanelOpen, translateX, panelWidth]);

  return (
    <>
      {rightPanelOpen ? (
        <Pressable
          onPress={() => setRightPanelOpen(false)}
          style={styles.scrim}
        />
      ) : null}
      <Animated.View
        pointerEvents={rightPanelOpen ? "auto" : "none"}
        style={[
          styles.panel,
          {
            width: panelWidth,
            backgroundColor: c.surface,
            borderLeftColor: c.border,
            transform: [{ translateX }],
            paddingTop: insets.top + (Platform.OS === "web" ? 8 : 0),
          },
        ]}
      >
        <View style={[styles.tabs, { borderBottomColor: c.border }]}>
          <PanelTab
            label="Files"
            icon="folder"
            active={tab === "files"}
            onPress={() => setTab("files")}
          />
          <PanelTab
            label="Pinned"
            icon="bookmark"
            active={tab === "pinned"}
            onPress={() => setTab("pinned")}
          />
          <PanelTab
            label="Projects"
            icon="book"
            active={tab === "projects"}
            onPress={() => setTab("projects")}
          />
          <View style={{ flex: 1 }} />
          <IconButton
            icon="search"
            size={32}
            onPress={() => {
              setSearchOpen(true);
              setRightPanelOpen(false);
            }}
            accessibilityLabel="Search"
          />
          <IconButton
            icon="x"
            size={32}
            onPress={() => setRightPanelOpen(false)}
          />
        </View>

        {tab === "files" ? (
          <FilesTab onLongPress={(id) => setActionNoteId(id)} />
        ) : tab === "pinned" ? (
          <PinnedTab />
        ) : (
          <ProjectsView
            onOpenNote={(id) => {
              setActiveNote(id);
              setRightPanelOpen(false);
            }}
            onClose={() => setRightPanelOpen(false)}
          />
        )}
      </Animated.View>

      <NoteActionSheet
        noteId={actionNoteId}
        onClose={() => setActionNoteId(null)}
      />
    </>
  );
}

function PanelTab({
  label,
  icon,
  active,
  onPress,
}: {
  label: string;
  icon: React.ComponentProps<typeof Feather>["name"];
  active: boolean;
  onPress: () => void;
}) {
  const { activeTheme } = useTheme();
  const c = activeTheme.colors;
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.tab,
        {
          borderBottomColor: active ? c.accent : "transparent",
          opacity: pressed ? 0.6 : 1,
        },
      ]}
    >
      <Feather
        name={icon}
        size={14}
        color={active ? c.accent : c.mutedText}
      />
      <Text
        style={{
          color: active ? c.accent : c.mutedText,
          fontSize: 13,
          fontWeight: "600",
          letterSpacing: 0.4,
          textTransform: "uppercase",
        }}
      >
        {label}
      </Text>
    </Pressable>
  );
}

function FilesTab({ onLongPress }: { onLongPress: (id: string) => void }) {
  const {
    activeNoteId,
    setActiveNote,
    createNote,
    createFolder,
    vaultName,
    externalRoot,
    externalLoading,
    isSafSupported,
    connectExternalFolder,
    disconnectExternalFolder,
    refreshExternalFolder,
  } = useNotes();
  const { setRightPanelOpen, viewMode, setViewMode } = usePanels();
  const { activeTheme } = useTheme();
  const c = activeTheme.colors;
  const [folderInput, setFolderInput] = useState("");
  const [showFolderInput, setShowFolderInput] = useState(false);

  const handleOpen = (id: string) => {
    setActiveNote(id);
    setRightPanelOpen(false);
  };

  const handleDisconnect = () => {
    Alert.alert(
      "Disconnect folder",
      `Stop using "${externalRoot?.name}"? Your phone files stay where they are; Scribe just goes back to its built-in vault.`,
      [
        { text: "Cancel", style: "cancel" },
        { text: "Disconnect", onPress: disconnectExternalFolder },
      ],
    );
  };

  return (
    <View style={{ flex: 1 }}>
      {/* Folder source bar */}
      <View
        style={[
          styles.sourceBar,
          { backgroundColor: c.background, borderBottomColor: c.border },
        ]}
      >
        <Feather
          name={externalRoot ? "smartphone" : "hard-drive"}
          size={13}
          color={c.accent}
        />
        <View style={{ flex: 1 }}>
          <Text
            style={{ color: c.text, fontSize: 13, fontWeight: "600" }}
            numberOfLines={1}
          >
            {externalRoot ? externalRoot.name : vaultName}
          </Text>
          <Text style={{ color: c.mutedText, fontSize: 10, marginTop: 1 }}>
            {externalRoot ? "Phone folder · live" : "Built-in vault"}
          </Text>
        </View>
        {externalRoot ? (
          <>
            <IconButton
              icon="refresh-ccw"
              size={28}
              onPress={refreshExternalFolder}
              accessibilityLabel="Refresh"
            />
            <IconButton
              icon="log-out"
              size={28}
              onPress={handleDisconnect}
              accessibilityLabel="Disconnect"
            />
          </>
        ) : (
          <IconButton
            icon="folder"
            label="Connect"
            variant="solid"
            onPress={async () => {
              if (!isSafSupported) {
                Alert.alert(
                  "Android only",
                  "Picking a phone folder works in the installed Android app. The web preview uses the in-app vault.",
                );
                return;
              }
              await connectExternalFolder();
            }}
          />
        )}
      </View>

      {externalLoading ? (
        <View
          style={[styles.loadingBar, { borderBottomColor: c.border }]}
        >
          <Feather name="loader" size={12} color={c.mutedText} />
          <Text style={{ color: c.mutedText, fontSize: 12 }}>
            Reading folder…
          </Text>
        </View>
      ) : null}

      <View style={[styles.actionsRow, { borderBottomColor: c.border }]}>
        <IconButton
          icon="file-plus"
          label="New note"
          onPress={async () => {
            await createNote("/", "Untitled");
            setRightPanelOpen(false);
          }}
        />
        <IconButton
          icon="folder-plus"
          onPress={() => setShowFolderInput((v) => !v)}
          accessibilityLabel="New folder"
        />
        <View style={{ flex: 1 }} />
        <ViewModeToggle value={viewMode} onChange={setViewMode} />
      </View>
      {showFolderInput ? (
        <View style={[styles.folderInputRow, { borderBottomColor: c.border }]}>
          <TextInput
            value={folderInput}
            onChangeText={setFolderInput}
            placeholder="Folder name"
            placeholderTextColor={c.mutedText}
            style={[
              styles.folderInput,
              { color: c.text, borderColor: c.border },
            ]}
            onSubmitEditing={async () => {
              if (folderInput.trim()) {
                await createFolder(`/${folderInput.trim()}`);
                setFolderInput("");
                setShowFolderInput(false);
              }
            }}
            returnKeyType="done"
          />
          <IconButton
            icon="check"
            onPress={async () => {
              if (folderInput.trim()) {
                await createFolder(`/${folderInput.trim()}`);
                setFolderInput("");
                setShowFolderInput(false);
              }
            }}
          />
        </View>
      ) : null}
      <FileTree
        activeNoteId={activeNoteId}
        onOpenNote={handleOpen}
        onLongPressNote={onLongPress}
      />
      <View style={[styles.hintBox, { borderTopColor: c.border }]}>
        <Feather name="info" size={12} color={c.mutedText} />
        <Text style={[styles.hintText, { color: c.mutedText }]}>
          {externalRoot
            ? "Edits save back to your phone. Long-press a file for actions."
            : "Tap Connect to pick a folder on your phone (Documents, Downloads, etc.) and read your real .md and .txt files."}
        </Text>
      </View>
    </View>
  );
}

function PinnedTab() {
  const { pinned, setPinned } = usePanels();
  const { notes, setActiveNote } = useNotes();
  const { activeTheme } = useTheme();
  const c = activeTheme.colors;

  const top = pinned.find((p) => p.slot === "top");
  const bottom = pinned.find((p) => p.slot === "bottom");
  const topNote = top ? notes.find((n) => n.id === top.noteId) : null;
  const bottomNote = bottom
    ? notes.find((n) => n.id === bottom.noteId)
    : null;

  return (
    <View style={{ flex: 1 }}>
      <PinnedSlotView
        slot="top"
        note={topNote ?? null}
        onUnpin={() => setPinned("top", null)}
        onOpenInEditor={(id) => setActiveNote(id)}
      />
      <View style={{ height: 1, backgroundColor: c.border }} />
      <PinnedSlotView
        slot="bottom"
        note={bottomNote ?? null}
        onUnpin={() => setPinned("bottom", null)}
        onOpenInEditor={(id) => setActiveNote(id)}
      />
    </View>
  );
}

function PinnedSlotView({
  slot,
  note,
  onUnpin,
  onOpenInEditor,
}: {
  slot: PinnedSlot;
  note: NoteFile | null;
  onUnpin: () => void;
  onOpenInEditor: (id: string) => void;
}) {
  const { activeTheme } = useTheme();
  const c = activeTheme.colors;

  if (!note) {
    return (
      <View style={[styles.emptySlot, { backgroundColor: c.background }]}>
        <Feather name="bookmark" size={20} color={c.mutedText} />
        <Text style={[styles.emptySlotText, { color: c.mutedText }]}>
          No note pinned to {slot}.{"\n"}Long-press a file to pin.
        </Text>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: c.background }}>
      <View style={[styles.pinnedHeader, { borderBottomColor: c.border }]}>
        <View style={{ flex: 1, flexDirection: "row", alignItems: "center", gap: 6 }}>
          <Feather name="bookmark" size={12} color={c.accent} />
          <Text
            style={{ color: c.text, fontSize: 13, fontWeight: "600" }}
            numberOfLines={1}
          >
            {note.name}
          </Text>
        </View>
        <Pressable onPress={() => onOpenInEditor(note.id)} hitSlop={8}>
          <Feather name="edit-2" size={14} color={c.mutedText} />
        </Pressable>
        <Pressable onPress={onUnpin} hitSlop={8}>
          <Feather name="x" size={14} color={c.mutedText} />
        </Pressable>
      </View>
      <MarkdownView source={note.content} theme={{
        ...activeTheme,
        fontSize: Math.max(13, activeTheme.fontSize - 3),
        paddingHorizontal: 14,
        paddingVertical: 12,
      }} />
    </View>
  );
}

function NoteActionSheet({
  noteId,
  onClose,
}: {
  noteId: string | null;
  onClose: () => void;
}) {
  const { notes, setActiveNote, deleteNote } = useNotes();
  const { setPinned, openFloating, setRightPanelOpen } = usePanels();
  const { activeTheme } = useTheme();
  const router = useRouter();
  const c = activeTheme.colors;
  const note = noteId ? notes.find((n) => n.id === noteId) : null;
  const visible = !!note;
  const [exportNote, setExportNote] = useState<NoteFile | null>(null);

  return (
    <>
      <Modal
        visible={visible}
        transparent
        animationType="fade"
        onRequestClose={onClose}
      >
        <Pressable style={styles.actionBackdrop} onPress={onClose}>
          <Pressable
            style={[
              styles.actionSheet,
              {
                backgroundColor: c.surface,
                borderColor: c.border,
              },
            ]}
          >
            <Text style={[styles.actionTitle, { color: c.text }]}>
              {note?.name}
            </Text>
            <ActionRow
              icon="edit-3"
              label="Open in editor"
              onPress={() => {
                if (!note) return;
                setActiveNote(note.id);
                setRightPanelOpen(false);
                onClose();
              }}
            />
            <ActionRow
              icon="copy"
              label="Open in floating window"
              onPress={() => {
                if (!note) return;
                openFloating(note.id);
                onClose();
              }}
            />
            <ActionRow
              icon="clock"
              label="Version history"
              onPress={() => {
                if (!note) return;
                setActiveNote(note.id);
                setRightPanelOpen(false);
                onClose();
                router.push("/history");
              }}
            />
            <ActionRow
              icon="share"
              label="Export file"
              onPress={() => {
                if (!note) return;
                onClose();
                setExportNote(note);
              }}
            />
            <ActionRow
              icon="bookmark"
              label="Pin to top of right side"
              onPress={() => {
                if (!note) return;
                setPinned("top", note.id);
                onClose();
              }}
            />
            <ActionRow
              icon="bookmark"
              label="Pin to bottom of right side"
              onPress={() => {
                if (!note) return;
                setPinned("bottom", note.id);
                onClose();
              }}
            />
            <ActionRow
              icon="trash-2"
              label="Delete"
              destructive
              onPress={() => {
                if (!note) return;
                deleteNote(note.id);
                onClose();
              }}
            />
          </Pressable>
        </Pressable>
      </Modal>

      <ExportSheet
        visible={exportNote !== null}
        note={exportNote}
        onClose={() => setExportNote(null)}
      />
    </>
  );
}

function ViewModeToggle({
  value,
  onChange,
}: {
  value: FileViewMode;
  onChange: (v: FileViewMode) => void;
}) {
  const { activeTheme } = useTheme();
  const c = activeTheme.colors;
  const opts: { v: FileViewMode; icon: React.ComponentProps<typeof Feather>["name"] }[] = [
    { v: "tree", icon: "git-branch" },
    { v: "list", icon: "list" },
    { v: "folders", icon: "grid" },
  ];
  return (
    <View
      style={{
        flexDirection: "row",
        borderWidth: StyleSheet.hairlineWidth,
        borderColor: c.border,
        borderRadius: 8,
        overflow: "hidden",
      }}
    >
      {opts.map((o) => (
        <Pressable
          key={o.v}
          onPress={() => onChange(o.v)}
          style={({ pressed }) => ({
            paddingHorizontal: 8,
            paddingVertical: 6,
            backgroundColor:
              value === o.v ? c.accent + "22" : pressed ? c.background : "transparent",
          })}
          accessibilityLabel={`View ${o.v}`}
        >
          <Feather
            name={o.icon}
            size={14}
            color={value === o.v ? c.accent : c.mutedText}
          />
        </Pressable>
      ))}
    </View>
  );
}

function ActionRow({
  icon,
  label,
  onPress,
  destructive = false,
}: {
  icon: React.ComponentProps<typeof Feather>["name"];
  label: string;
  onPress: () => void;
  destructive?: boolean;
}) {
  const { activeTheme } = useTheme();
  const c = activeTheme.colors;
  const color = destructive ? "#cc6b5d" : c.text;
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.actionRow,
        { backgroundColor: pressed ? c.background : "transparent" },
      ]}
    >
      <Feather name={icon} size={16} color={color} />
      <Text style={{ color, fontSize: 15, flex: 1 }}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  scrim: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.25)",
  },
  panel: {
    position: "absolute",
    top: 0,
    bottom: 0,
    right: 0,
    borderLeftWidth: StyleSheet.hairlineWidth,
    elevation: 12,
    shadowColor: "#000",
    shadowOpacity: 0.18,
    shadowOffset: { width: -4, height: 0 },
    shadowRadius: 16,
  },
  tabs: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 8,
    paddingTop: 6,
    paddingBottom: 0,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  tab: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderBottomWidth: 2,
  },
  actionsRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  sourceBar: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  loadingBar: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  folderInputRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  folderInput: {
    flex: 1,
    height: 36,
    paddingHorizontal: 10,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 8,
    fontSize: 14,
  },
  hintBox: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  hintText: {
    fontSize: 11,
    lineHeight: 15,
    flex: 1,
  },
  emptySlot: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    padding: 20,
  },
  emptySlotText: {
    fontSize: 12,
    textAlign: "center",
    lineHeight: 18,
  },
  pinnedHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  actionBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.35)",
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  },
  actionSheet: {
    width: "100%",
    maxWidth: 360,
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    paddingVertical: 6,
  },
  actionTitle: {
    fontSize: 13,
    fontWeight: "600",
    paddingHorizontal: 16,
    paddingVertical: 12,
    opacity: 0.7,
  },
  actionRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
});
