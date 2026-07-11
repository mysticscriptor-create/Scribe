import { Feather } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useEffect, useState } from "react";
import {
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  Pressable,
  View,
} from "react-native";

import { useNotes } from "@/contexts/NotesContext";
import { useTheme } from "@/contexts/ThemeContext";
import { getSnapshots, type Snapshot } from "@/lib/history";
import { countWords } from "@/lib/markdown";

function formatWhen(ts: number): string {
  const d = new Date(ts);
  const now = Date.now();
  const diffMin = Math.round((now - ts) / 60000);
  if (diffMin < 1) return "Just now";
  if (diffMin < 60) return `${diffMin} min ago`;
  const diffH = Math.round(diffMin / 60);
  if (diffH < 24) return `${diffH} h ago`;
  return d.toLocaleDateString() + " " + d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

export default function HistoryScreen() {
  const { activeTheme } = useTheme();
  const c = activeTheme.colors;
  const { activeNoteId, activeNote, updateNoteContent } = useNotes();
  const router = useRouter();
  const params = useLocalSearchParams<{ noteId?: string }>();
  const noteId = params.noteId ?? activeNoteId ?? "";
  const [snapshots, setSnapshots] = useState<Snapshot[]>([]);
  const [preview, setPreview] = useState<Snapshot | null>(null);

  useEffect(() => {
    if (!noteId) return;
    getSnapshots(noteId).then((s) => setSnapshots(s.slice().reverse()));
  }, [noteId]);

  const restore = (snap: Snapshot) => {
    Alert.alert(
      "Restore this version?",
      "Your current text will be replaced. This can't be undone.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Restore",
          style: "destructive",
          onPress: () => {
            if (!noteId) return;
            updateNoteContent(noteId, snap.content);
            router.back();
          },
        },
      ],
    );
  };

  if (preview) {
    return (
      <View style={[styles.root, { backgroundColor: c.background }]}>
        <View style={[styles.previewHeader, { borderColor: c.border }]}>
          <Pressable onPress={() => setPreview(null)} hitSlop={8}>
            <Feather name="arrow-left" size={20} color={c.text} />
          </Pressable>
          <Text style={[styles.previewTitle, { color: c.text }]}>
            {formatWhen(preview.savedAt)}
          </Text>
          <Pressable onPress={() => restore(preview)} hitSlop={8}>
            <Feather name="rotate-ccw" size={18} color={c.accent} />
          </Pressable>
        </View>
        <ScrollView contentContainerStyle={{ padding: 16 }}>
          <Text style={{ color: c.text, fontSize: 14, lineHeight: 21 }}>
            {preview.content}
          </Text>
        </ScrollView>
      </View>
    );
  }

  return (
    <View style={[styles.root, { backgroundColor: c.background }]}>
      {snapshots.length === 0 ? (
        <View style={styles.empty}>
          <Feather name="clock" size={30} color={c.mutedText} />
          <Text style={[styles.emptyText, { color: c.mutedText }]}>
            No saved versions yet for "{activeNote?.name ?? "this note"}".
            Scribe automatically checkpoints your writing every few minutes as
            you edit.
          </Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={{ padding: 14, gap: 10 }}>
          {snapshots.map((s, i) => (
            <Pressable
              key={s.savedAt}
              onPress={() => setPreview(s)}
              style={[
                styles.card,
                { backgroundColor: c.surface, borderColor: c.border },
              ]}
            >
              <View style={styles.cardRow}>
                <Text style={[styles.cardWhen, { color: c.text }]}>
                  {formatWhen(s.savedAt)}
                </Text>
                {i === 0 ? (
                  <Text style={[styles.badge, { color: c.accent }]}>
                    Latest
                  </Text>
                ) : null}
              </View>
              <Text
                style={[styles.cardWords, { color: c.mutedText }]}
              >
                {countWords(s.content)} words
              </Text>
              <Text
                style={[styles.cardSnippet, { color: c.mutedText }]}
                numberOfLines={2}
              >
                {s.content.slice(0, 140)}
              </Text>
            </Pressable>
          ))}
          <View style={{ height: 30 }} />
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  empty: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    padding: 30,
  },
  emptyText: {
    fontSize: 13,
    textAlign: "center",
    lineHeight: 19,
  },
  card: {
    padding: 14,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    gap: 4,
  },
  cardRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  cardWhen: {
    fontSize: 14,
    fontWeight: "600",
  },
  badge: {
    fontSize: 10,
    fontWeight: "700",
    textTransform: "uppercase",
  },
  cardWords: {
    fontSize: 11,
  },
  cardSnippet: {
    fontSize: 12,
    lineHeight: 16,
    marginTop: 2,
  },
  previewHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  previewTitle: {
    fontSize: 14,
    fontWeight: "600",
  },
});
