import { Feather } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useMemo, useState } from "react";
import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

import {
  type Sheet,
  type SheetType,
  useCharacters,
} from "@/contexts/CharactersContext";
import { useTheme } from "@/contexts/ThemeContext";

export default function SheetsScreen() {
  const { activeTheme } = useTheme();
  const c = activeTheme.colors;
  const { sheets, createSheet, updateSheet, deleteSheet } = useCharacters();
  const params = useLocalSearchParams<{ open?: string }>();
  const router = useRouter();

  const [tab, setTab] = useState<SheetType>("character");
  const [openId, setOpenId] = useState<string | null>(params.open ?? null);

  const filtered = useMemo(
    () =>
      sheets
        .filter((s) => s.type === tab)
        .sort((a, b) => b.updatedAt - a.updatedAt),
    [sheets, tab],
  );

  const openSheet = openId ? sheets.find((s) => s.id === openId) : null;

  if (openSheet) {
    return (
      <SheetDetail
        sheet={openSheet}
        onBack={() => setOpenId(null)}
        onUpdate={(partial) => updateSheet(openSheet.id, partial)}
        onDelete={() => {
          deleteSheet(openSheet.id);
          setOpenId(null);
        }}
      />
    );
  }

  return (
    <View style={[styles.root, { backgroundColor: c.background }]}>
      <View style={styles.tabs}>
        {(["character", "location"] as SheetType[]).map((t) => (
          <Pressable
            key={t}
            onPress={() => setTab(t)}
            style={[
              styles.tab,
              {
                borderColor: c.border,
                backgroundColor: tab === t ? c.accent : "transparent",
              },
            ]}
          >
            <Text
              style={{
                color: tab === t ? c.toolbar : c.text,
                fontWeight: "600",
                fontSize: 13,
              }}
            >
              {t === "character" ? "Characters" : "Locations"}
            </Text>
          </Pressable>
        ))}
      </View>

      <ScrollView contentContainerStyle={{ padding: 14, gap: 10 }}>
        {filtered.length === 0 ? (
          <View style={styles.empty}>
            <Feather
              name={tab === "character" ? "user" : "map-pin"}
              size={30}
              color={c.mutedText}
            />
            <Text style={[styles.emptyText, { color: c.mutedText }]}>
              No {tab === "character" ? "characters" : "locations"} yet. Tap +
              to add one.
            </Text>
          </View>
        ) : (
          filtered.map((s) => (
            <Pressable
              key={s.id}
              onPress={() => setOpenId(s.id)}
              style={[
                styles.card,
                { backgroundColor: c.surface, borderColor: c.border },
              ]}
            >
              <Text style={[styles.cardName, { color: c.text }]}>
                {s.name}
              </Text>
              {s.summary ? (
                <Text
                  style={[styles.cardSummary, { color: c.mutedText }]}
                  numberOfLines={2}
                >
                  {s.summary}
                </Text>
              ) : null}
            </Pressable>
          ))
        )}
        <View style={{ height: 60 }} />
      </ScrollView>

      <Pressable
        onPress={() => {
          const s = createSheet(tab, "");
          setOpenId(s.id);
        }}
        style={[styles.fab, { backgroundColor: c.accent }]}
      >
        <Feather name="plus" size={22} color={c.toolbar} />
      </Pressable>
    </View>
  );
}

function SheetDetail({
  sheet,
  onBack,
  onUpdate,
  onDelete,
}: {
  sheet: Sheet;
  onBack: () => void;
  onUpdate: (partial: Partial<Sheet>) => void;
  onDelete: () => void;
}) {
  const { activeTheme } = useTheme();
  const c = activeTheme.colors;
  const [name, setName] = useState(sheet.name);
  const [summary, setSummary] = useState(sheet.summary);
  const [fields, setFields] = useState(sheet.fields);

  const commit = () => {
    onUpdate({ name: name.trim() || sheet.name, summary, fields });
  };

  return (
    <View style={[styles.root, { backgroundColor: c.background }]}>
      <View style={[styles.detailHeader, { borderColor: c.border }]}>
        <Pressable onPress={() => { commit(); onBack(); }} hitSlop={8}>
          <Feather name="arrow-left" size={20} color={c.text} />
        </Pressable>
        <Text style={[styles.detailTitle, { color: c.text }]}>
          {sheet.type === "character" ? "Character" : "Location"}
        </Text>
        <Pressable
          onPress={() =>
            Alert.alert("Delete", `Delete "${sheet.name}"?`, [
              { text: "Cancel", style: "cancel" },
              { text: "Delete", style: "destructive", onPress: onDelete },
            ])
          }
          hitSlop={8}
        >
          <Feather name="trash-2" size={18} color={c.text} />
        </Pressable>
      </View>
      <ScrollView contentContainerStyle={{ padding: 16, gap: 14 }}>
        <View>
          <Text style={[styles.label, { color: c.mutedText }]}>Name</Text>
          <TextInput
            value={name}
            onChangeText={setName}
            onBlur={commit}
            style={[styles.input, { color: c.text, borderColor: c.border }]}
          />
        </View>
        <View>
          <Text style={[styles.label, { color: c.mutedText }]}>Summary</Text>
          <TextInput
            value={summary}
            onChangeText={setSummary}
            onBlur={commit}
            multiline
            style={[
              styles.input,
              styles.multiline,
              { color: c.text, borderColor: c.border },
            ]}
          />
        </View>
        {fields.map((f, i) => (
          <View key={f.label}>
            <Text style={[styles.label, { color: c.mutedText }]}>
              {f.label}
            </Text>
            <TextInput
              value={f.value}
              onChangeText={(v) =>
                setFields((prev) =>
                  prev.map((pf, idx) => (idx === i ? { ...pf, value: v } : pf)),
                )
              }
              onBlur={commit}
              multiline
              style={[
                styles.input,
                styles.multiline,
                { color: c.text, borderColor: c.border },
              ]}
            />
          </View>
        ))}
        <View style={{ height: 30 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  tabs: {
    flexDirection: "row",
    gap: 8,
    padding: 12,
  },
  tab: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
  },
  empty: {
    alignItems: "center",
    paddingTop: 60,
    gap: 10,
  },
  emptyText: {
    fontSize: 13,
    textAlign: "center",
    maxWidth: 260,
  },
  card: {
    padding: 14,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    gap: 4,
  },
  cardName: {
    fontSize: 15,
    fontWeight: "600",
  },
  cardSummary: {
    fontSize: 12,
    lineHeight: 16,
  },
  fab: {
    position: "absolute",
    right: 20,
    bottom: 24,
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: "center",
    justifyContent: "center",
    elevation: 6,
    shadowColor: "#000",
    shadowOpacity: 0.25,
    shadowOffset: { width: 0, height: 3 },
    shadowRadius: 6,
  },
  detailHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  detailTitle: {
    fontSize: 15,
    fontWeight: "600",
  },
  label: {
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 0.6,
    textTransform: "uppercase",
    marginBottom: 6,
  },
  input: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
  },
  multiline: {
    minHeight: 60,
    textAlignVertical: "top",
  },
});
