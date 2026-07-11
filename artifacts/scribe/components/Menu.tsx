import { Feather } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React, { useEffect, useRef } from "react";
import {
  Animated,
  Dimensions,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useNotes } from "@/contexts/NotesContext";
import { usePanels } from "@/contexts/PanelsContext";
import { useTheme } from "@/contexts/ThemeContext";
import { countWords, readingTimeMinutes } from "@/lib/markdown";

export function Menu() {
  const { leftMenuOpen, setLeftMenuOpen, closeAllFloating, floatingWindows } =
    usePanels();
  const { activeTheme, themes, setActiveTheme } = useTheme();
  const { activeNote, vaultName } = useNotes();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const c = activeTheme.colors;
  const screenWidth = Dimensions.get("window").width;
  const menuWidth = Math.min(320, Math.max(260, screenWidth * 0.78));
  const translateX = useRef(new Animated.Value(-menuWidth)).current;

  useEffect(() => {
    Animated.timing(translateX, {
      toValue: leftMenuOpen ? 0 : -menuWidth,
      duration: 240,
      useNativeDriver: true,
    }).start();
  }, [leftMenuOpen, translateX, menuWidth]);

  const wordCount = activeNote ? countWords(activeNote.content) : 0;
  const readMin = activeNote ? readingTimeMinutes(activeNote.content) : 0;

  return (
    <>
      {leftMenuOpen ? (
        <Pressable
          onPress={() => setLeftMenuOpen(false)}
          style={styles.scrim}
        />
      ) : null}
      <Animated.View
        pointerEvents={leftMenuOpen ? "auto" : "none"}
        style={[
          styles.menu,
          {
            width: menuWidth,
            backgroundColor: c.surface,
            borderRightColor: c.border,
            transform: [{ translateX }],
            paddingTop: insets.top + (Platform.OS === "web" ? 8 : 0),
          },
        ]}
      >
        <ScrollView
          contentContainerStyle={{ paddingBottom: 30 }}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.header}>
            <Text style={[styles.brand, { color: c.text }]}>Scribe</Text>
            <Text style={[styles.brandSub, { color: c.mutedText }]}>
              {vaultName}
            </Text>
          </View>

          {activeNote ? (
            <View
              style={[
                styles.statsBlock,
                { backgroundColor: c.background, borderColor: c.border },
              ]}
            >
              <View style={styles.statRow}>
                <Text style={[styles.statLabel, { color: c.mutedText }]}>
                  Words
                </Text>
                <Text style={[styles.statValue, { color: c.text }]}>
                  {wordCount}
                </Text>
              </View>
              <View style={styles.statRow}>
                <Text style={[styles.statLabel, { color: c.mutedText }]}>
                  Characters
                </Text>
                <Text style={[styles.statValue, { color: c.text }]}>
                  {activeNote.content.length}
                </Text>
              </View>
              <View style={styles.statRow}>
                <Text style={[styles.statLabel, { color: c.mutedText }]}>
                  Reading
                </Text>
                <Text style={[styles.statValue, { color: c.text }]}>
                  {readMin} min
                </Text>
              </View>
            </View>
          ) : null}

          <SectionLabel>Quick theme</SectionLabel>
          {themes.map((t) => (
            <Pressable
              key={t.id}
              onPress={() => setActiveTheme(t.id)}
              style={({ pressed }) => [
                styles.row,
                { backgroundColor: pressed ? c.background : "transparent" },
              ]}
            >
              <View
                style={[
                  styles.themeSwatch,
                  {
                    backgroundColor: t.colors.background,
                    borderColor: c.border,
                  },
                ]}
              >
                <View
                  style={[
                    styles.themeSwatchInner,
                    { backgroundColor: t.colors.accent },
                  ]}
                />
              </View>
              <Text
                style={[
                  styles.rowLabel,
                  {
                    color: c.text,
                    fontWeight: activeTheme.id === t.id ? "700" : "400",
                  },
                ]}
                numberOfLines={1}
              >
                {t.name}
              </Text>
              {activeTheme.id === t.id ? (
                <Feather name="check" size={14} color={c.accent} />
              ) : null}
            </Pressable>
          ))}

          <View style={{ height: 8 }} />

          <MenuItem
            icon="settings"
            label="Settings"
            onPress={() => {
              setLeftMenuOpen(false);
              router.push("/settings");
            }}
          />
          <MenuItem
            icon="users"
            label="Characters & Locations"
            onPress={() => {
              setLeftMenuOpen(false);
              router.push("/sheets");
            }}
          />
          {activeNote ? (
            <MenuItem
              icon="clock"
              label="Version history"
              onPress={() => {
                setLeftMenuOpen(false);
                router.push({
                  pathname: "/history",
                  params: { noteId: activeNote.id },
                });
              }}
            />
          ) : null}
          {floatingWindows.length > 0 ? (
            <MenuItem
              icon="layers"
              label={`Close all floating (${floatingWindows.length})`}
              onPress={() => closeAllFloating()}
            />
          ) : null}
          <MenuItem
            icon="info"
            label="About"
            onPress={() => {
              setLeftMenuOpen(false);
              router.push("/about");
            }}
          />
        </ScrollView>
      </Animated.View>
    </>
  );
}

function SectionLabel({ children }: { children: string }) {
  const { activeTheme } = useTheme();
  return (
    <Text
      style={[
        styles.sectionLabel,
        { color: activeTheme.colors.mutedText },
      ]}
    >
      {children}
    </Text>
  );
}

function MenuItem({
  icon,
  label,
  onPress,
  rightLabel,
  disabled = false,
}: {
  icon: React.ComponentProps<typeof Feather>["name"];
  label: string;
  onPress: () => void;
  rightLabel?: string;
  disabled?: boolean;
}) {
  const { activeTheme } = useTheme();
  const c = activeTheme.colors;
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        styles.row,
        {
          backgroundColor: pressed ? c.background : "transparent",
          opacity: disabled ? 0.45 : 1,
        },
      ]}
    >
      <Feather name={icon} size={16} color={c.text} />
      <Text style={[styles.rowLabel, { color: c.text }]} numberOfLines={1}>
        {label}
      </Text>
      {rightLabel ? (
        <Text style={{ color: c.mutedText, fontSize: 12 }}>{rightLabel}</Text>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  scrim: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.25)",
  },
  menu: {
    position: "absolute",
    top: 0,
    bottom: 0,
    left: 0,
    borderRightWidth: StyleSheet.hairlineWidth,
    elevation: 12,
    shadowColor: "#000",
    shadowOpacity: 0.18,
    shadowOffset: { width: 4, height: 0 },
    shadowRadius: 16,
  },
  header: {
    paddingHorizontal: 18,
    paddingTop: 18,
    paddingBottom: 8,
  },
  brand: {
    fontSize: 24,
    fontWeight: "700",
    letterSpacing: 0.4,
  },
  brandSub: {
    fontSize: 12,
    marginTop: 2,
    letterSpacing: 0.3,
  },
  statsBlock: {
    marginHorizontal: 14,
    marginVertical: 12,
    padding: 12,
    borderRadius: 10,
    borderWidth: StyleSheet.hairlineWidth,
    gap: 6,
  },
  statRow: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  statLabel: {
    fontSize: 12,
  },
  statValue: {
    fontSize: 13,
    fontWeight: "600",
  },
  sectionLabel: {
    paddingHorizontal: 18,
    paddingTop: 14,
    paddingBottom: 6,
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 1.2,
    textTransform: "uppercase",
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 18,
    paddingVertical: 12,
  },
  rowLabel: {
    flex: 1,
    fontSize: 14,
  },
  themeSwatch: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  themeSwatchInner: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
});
