import React, { useState } from "react";
import {
  Image,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Link, useRouter } from "expo-router";
import { colors, radius, spacing, text } from "@/src/lib/theme";
import { resolveImageUrl } from "@/src/api/client";
import { flagFor } from "@/src/lib/countries";
import {
  countdownLabel,
  daysUntil,
  durationDays,
  durationLabel,
  formatDateRange,
} from "@/src/lib/format";
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

const DESCRIPTION_PREVIEW_LINES = 3;

/**
 * Compact event card with a left-side mini thumbnail (96×96), gold accent
 * left border, distinct shadow + ember-tinted footer to clearly separate
 * each event from the next.
 *
 * Description preview is truncated to 3 lines; tapping the description box
 * opens a modal with the full text (without navigating to the detail page).
 */
export function EventCard({ event }: { event: VikingEvent }) {
  const { t, lang } = useSettings();
  const router = useRouter();
  const img = resolveImageUrl(event.image_url);
  const cd = daysUntil(event.start_date, event.end_date);
  const dur = durationDays(event.start_date, event.end_date);
  const [imgFailed, setImgFailed] = useState(false);
  const [descOpen, setDescOpen] = useState(false);
  const cat = t(`category.${event.category}`).toUpperCase();
  const catIcon = CAT_ICON[event.category] || "sparkles-outline";
  const title =
    localized(event as unknown as Record<string, unknown>, "title", lang) ||
    event.title_fi;
  const desc =
    localized(event as unknown as Record<string, unknown>, "description", lang) ||
    event.description_fi ||
    "";

  return (
    <View
      testID={`event-card-${event.id}`}
      style={styles.card}
    >
      {/* Gold accent bar on the left edge */}
      <View style={styles.accent} />

      {/* Header / meta row — tapping anywhere outside the description box
          opens the event detail screen. */}
      <Link
        href={{ pathname: "/event/[id]", params: { id: event.id } }}
        asChild
      >
        <Pressable
          style={({ pressed }) => [styles.headerArea, pressed && styles.pressed]}
        >
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

              {/* Audience / fight style badges (web parity) */}
              {(event.audience || event.fight_style) ? (
                <View style={styles.badgeRow}>
                  {event.audience ? (
                    <View style={styles.badgeAudience}>
                      <Text style={styles.badgeAudienceText}>
                        {event.audience}
                      </Text>
                    </View>
                  ) : null}
                  {event.fight_style ? (
                    <View style={styles.badgeStyle}>
                      <Text style={styles.badgeStyleText}>{event.fight_style}</Text>
                    </View>
                  ) : null}
                </View>
              ) : null}
            </View>
          </View>
        </Pressable>
      </Link>

      {/* Description preview — tap to open modal with full text. Stays
          inside the card so the user can read a snippet at a glance, but
          long copy doesn't blow up the card height. */}
      {desc ? (
        <Pressable
          testID={`event-card-desc-${event.id}`}
          onPress={() => setDescOpen(true)}
          style={({ pressed }) => [
            styles.descBox,
            pressed && styles.pressed,
          ]}
        >
          <Text style={styles.descText} numberOfLines={DESCRIPTION_PREVIEW_LINES}>
            {desc}
          </Text>
          <Text style={styles.descMore}>
            {t("home.description_more")} →
          </Text>
        </Pressable>
      ) : null}

      {/* Countdown + duration footer strip */}
      {(cd !== null || (dur !== null && dur > 1)) ? (
        <Link
          href={{ pathname: "/event/[id]", params: { id: event.id } }}
          asChild
        >
          <Pressable
            style={({ pressed }) => [
              styles.footer,
              pressed && styles.pressed,
            ]}
          >
            {cd !== null ? (
              <>
                <Ionicons name="hourglass-outline" size={11} color={colors.ember} />
                <Text style={styles.footerLabel}>{t("home.countdown_label")}</Text>
                <Text style={styles.footerVal}>{countdownLabel(cd, t)}</Text>
              </>
            ) : null}
            {dur !== null && dur > 1 ? (
              <View style={styles.durBlock}>
                <Ionicons name="time-outline" size={11} color={colors.gold} />
                <Text style={styles.footerLabel}>{t("home.duration_label")}</Text>
                <Text style={styles.footerValGold}>{durationLabel(dur, t)}</Text>
              </View>
            ) : null}
          </Pressable>
        </Link>
      ) : null}

      {/* Full description modal */}
      <Modal
        visible={descOpen}
        animationType="fade"
        transparent
        onRequestClose={() => setDescOpen(false)}
      >
        <Pressable
          style={styles.modalBackdrop}
          onPress={() => setDescOpen(false)}
        >
          <Pressable
            style={styles.modalSheet}
            onPress={(e) => e.stopPropagation()}
          >
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle} numberOfLines={2}>
                {title}
              </Text>
              <Pressable
                onPress={() => setDescOpen(false)}
                style={styles.modalCloseBtn}
                hitSlop={12}
                testID="modal-close"
              >
                <Ionicons name="close" size={22} color={colors.bone} />
              </Pressable>
            </View>
            <ScrollView
              style={styles.modalScroll}
              contentContainerStyle={{ paddingBottom: spacing.lg }}
            >
              <Text style={styles.modalBody}>{desc}</Text>
            </ScrollView>
            <Pressable
              onPress={() => {
                setDescOpen(false);
                router.push(`/event/${event.id}`);
              }}
              style={styles.modalGoBtn}
              testID="modal-open-event"
            >
              <Text style={styles.modalGoText}>{t("event.share")} →</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
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
  pressed: { opacity: 0.85 },
  headerArea: {},
  accent: {
    position: "absolute",
    left: 0,
    top: 0,
    bottom: 0,
    width: 3,
    backgroundColor: colors.gold,
    zIndex: 1,
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
  badgeRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
    marginTop: 6,
  },
  badgeAudience: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: "rgba(201,161,74,0.45)",
    backgroundColor: "rgba(201,161,74,0.08)",
  },
  badgeAudienceText: {
    color: colors.gold,
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 0.4,
  },
  badgeStyle: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: "rgba(200,73,44,0.45)",
    backgroundColor: "rgba(200,73,44,0.08)",
  },
  badgeStyleText: {
    color: colors.ember,
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 0.4,
  },
  descBox: {
    marginHorizontal: spacing.md,
    marginBottom: spacing.sm,
    padding: spacing.sm,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: "rgba(201,161,74,0.18)",
    backgroundColor: "rgba(0,0,0,0.25)",
  },
  descText: {
    color: colors.bone,
    fontSize: 13,
    lineHeight: 19,
    opacity: 0.92,
  },
  descMore: {
    marginTop: 6,
    color: colors.gold,
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 0.6,
    textTransform: "uppercase",
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
  },
  footerValGold: {
    color: colors.gold,
    fontSize: 11,
    letterSpacing: 0.8,
    fontWeight: "700",
  },
  durBlock: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginLeft: "auto",
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.78)",
    justifyContent: "center",
    paddingHorizontal: spacing.md,
  },
  modalSheet: {
    backgroundColor: "#0F0B08",
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: "rgba(201,161,74,0.4)",
    maxHeight: "82%",
    padding: spacing.md,
  },
  modalHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: spacing.sm,
    marginBottom: spacing.sm,
    paddingBottom: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(201,161,74,0.2)",
  },
  modalTitle: {
    ...text.h2,
    fontSize: 18,
    lineHeight: 22,
    flex: 1,
    color: colors.bone,
  },
  modalCloseBtn: {
    width: 30,
    height: 30,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radius.sm,
    backgroundColor: "rgba(255,255,255,0.06)",
  },
  modalScroll: { maxHeight: "78%" },
  modalBody: {
    color: colors.bone,
    fontSize: 14,
    lineHeight: 22,
  },
  modalGoBtn: {
    marginTop: spacing.md,
    paddingVertical: 12,
    borderRadius: radius.sm,
    backgroundColor: colors.gold,
    alignItems: "center",
  },
  modalGoText: {
    color: "#0F0B08",
    fontWeight: "700",
    fontSize: 14,
    letterSpacing: 0.6,
  },
});
