import React, { useState } from "react";
import { Image, Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Link } from "expo-router";
import { colors, radius, spacing, text } from "@/src/lib/theme";
import { resolveImageUrl } from "@/src/api/client";
import { flagFor } from "@/src/lib/countries";
import { countdownLabel, daysUntil, formatDateRange } from "@/src/lib/format";
import { localized, useSettings } from "@/src/lib/i18n";
import type { VikingEvent } from "@/src/types";

const CAT_ICON: Record<string, React.ComponentProps<typeof Ionicons>["name"]> = {
  market: "storefront-outline",
  training_camp: "shield-outline",
  course: "book-outline",
  festival: "flame-outline",
  meetup: "people-outline",
  other: "sparkles-outline",
};

/**
 * Compact event card with a left-side mini thumbnail (96×96), gold accent
 * left border, distinct shadow + ember-tinted footer to clearly separate
 * each event from the next.
 */
export function EventCard({ event }: { event: VikingEvent }) {
  const { t, lang } = useSettings();
  const img = resolveImageUrl(event.image_url);
  const cd = daysUntil(event.start_date, event.end_date);
  const [imgFailed, setImgFailed] = useState(false);
  const cat = t(`category.${event.category}`).toUpperCase();
  const catIcon = CAT_ICON[event.category] || "sparkles-outline";
  const title = localized(event as unknown as Record<string, unknown>, "title", lang) || event.title_fi;

  return (
    <Link
      href={{ pathname: "/event/[id]", params: { id: event.id } }}
      asChild
    >
      <Pressable
        testID={`event-card-${event.id}`}
        style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}
      >
        {/* Gold accent bar on the left edge */}
        <View style={styles.accent} />

        <View style={styles.row}>
          {/* Mini thumbnail (left) */}
          <View style={styles.thumb}>
            {img && !imgFailed ? (
              <Image
                source={{ uri: img }}
                style={styles.thumbImg}
                resizeMode="cover"
                onError={() => setImgFailed(true)}
              />
            ) : (
              <View style={styles.thumbPlaceholder}>
                <Ionicons name={catIcon} size={28} color={colors.gold} />
              </View>
            )}
            <View style={styles.flagBadge}>
              <Text style={styles.flagText}>{flagFor(event.country)}</Text>
            </View>
          </View>

          {/* Content (right) */}
          <View style={styles.body}>
            <View style={styles.catRow}>
              <Ionicons name={catIcon} size={11} color={colors.ember} />
              <Text style={styles.catText}>{cat}</Text>
            </View>

            <Text style={styles.title} numberOfLines={2}>
              {title}
            </Text>

            <View style={styles.metaRow}>
              <Ionicons name="calendar-outline" size={12} color={colors.gold} />
              <Text style={styles.meta} numberOfLines={1}>
                {formatDateRange(event.start_date, event.end_date)}
              </Text>
            </View>
            <View style={styles.metaRow}>
              <Ionicons name="location-outline" size={12} color={colors.gold} />
              <Text style={styles.meta} numberOfLines={1}>
                {event.location}
              </Text>
            </View>
          </View>
        </View>

        {/* Countdown footer strip */}
        {cd !== null ? (
          <View style={styles.footer}>
            <Ionicons name="hourglass-outline" size={11} color={colors.ember} />
            <Text style={styles.footerLabel}>{t("home.countdown_label")}</Text>
            <Text style={styles.footerVal}>{countdownLabel(cd, t)}</Text>
          </View>
        ) : null}
      </Pressable>
    </Link>
  );
}

const THUMB = 96;

const styles = StyleSheet.create({
  card: {
    // Solid darker tone (was rgba(26,20,17,0.92)) for stronger contrast against
    // the subtly-textured AppBackground — fixes "title hard to read on home".
    backgroundColor: "#0F0B08",
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.edge,
    marginBottom: spacing.md,
    overflow: "hidden",
    // Pronounced shadow so each event reads as its own physical "card"
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.55,
    shadowRadius: 5,
    elevation: 4,
    position: "relative",
  },
  cardPressed: { opacity: 0.85, transform: [{ scale: 0.995 }] },
  accent: {
    position: "absolute",
    left: 0,
    top: 0,
    bottom: 0,
    width: 3,
    backgroundColor: colors.gold,
  },
  row: {
    flexDirection: "row",
    gap: spacing.md,
    padding: spacing.md,
    paddingLeft: spacing.md + 3, // compensate for accent bar
  },
  thumb: {
    width: THUMB,
    height: THUMB,
    borderRadius: radius.sm,
    overflow: "hidden",
    backgroundColor: colors.surface2,
    borderWidth: 1,
    borderColor: colors.edge,
    position: "relative",
  },
  thumbImg: { width: "100%", height: "100%" },
  thumbPlaceholder: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(201,161,74,0.08)",
  },
  flagBadge: {
    position: "absolute",
    bottom: 4,
    left: 4,
    backgroundColor: "rgba(14,11,9,0.8)",
    borderRadius: radius.sm,
    paddingHorizontal: 4,
    paddingVertical: 2,
  },
  flagText: { fontSize: 12, lineHeight: 14 },
  body: { flex: 1, gap: 4, paddingRight: 24 },
  catRow: { flexDirection: "row", alignItems: "center", gap: 5 },
  catText: {
    color: colors.ember,
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 1.4,
  },
  title: {
    ...text.h2,
    fontSize: 16,
    lineHeight: 20,
    marginTop: 1,
    marginBottom: 2,
  },
  metaRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  meta: { ...text.meta, fontSize: 12, flexShrink: 1 },
  favBtn: {
    position: "absolute",
    top: spacing.sm,
    right: spacing.sm,
    width: 28,
    height: 28,
    borderRadius: radius.sm,
    backgroundColor: "rgba(14,11,9,0.5)",
    alignItems: "center",
    justifyContent: "center",
  },
  footer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: spacing.md,
    paddingVertical: 8,
    backgroundColor: "rgba(200,73,44,0.10)",
    borderTopWidth: 1,
    borderTopColor: "rgba(200,73,44,0.25)",
  },
  footerLabel: {
    color: colors.stone,
    fontSize: 10,
    letterSpacing: 1.6,
    fontWeight: "600",
  },
  footerVal: {
    color: colors.ember,
    fontSize: 11,
    letterSpacing: 0.8,
    fontWeight: "700",
    marginLeft: "auto",
  },
});
