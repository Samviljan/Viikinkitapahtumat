import React, { useState } from "react";
import {
  ActivityIndicator,
  Image,
  Linking,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { resolveImageUrl } from "@/src/api/client";
import { useEvent } from "@/src/hooks/useEvents";
import { useFavorites } from "@/src/hooks/useFavorites";
import { AttendBlock } from "@/src/components/AttendBlock";
import EventStatsBlock from "@/src/components/EventStatsBlock";
import EventMerchantsBlock from "@/src/components/EventMerchantsBlock";
import EventOrganizersBlock from "@/src/components/EventOrganizersBlock";
import OrganizerRequestCTA from "@/src/components/OrganizerRequestCTA";
import { flagFor } from "@/src/lib/countries";
import {
  countdownLabel,
  daysUntil,
  durationDays,
  durationLabel,
  formatDateRange,
} from "@/src/lib/format";
import { colors, radius, spacing, text } from "@/src/lib/theme";
import { localized, useSettings } from "@/src/lib/i18n";

const DESCRIPTION_PREVIEW_LINES = 5;

export default function EventDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { event, loading, error } = useEvent(id || "");
  const { t, lang } = useSettings();
  const { isFavorite, toggle } = useFavorites();
  // IMPORTANT: All hooks must run unconditionally on every render. Don't
  // move this useState below the early returns — it would violate the
  // Rules of Hooks and crash the screen.
  const [descOpen, setDescOpen] = useState(false);

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.gold} />
      </View>
    );
  }
  if (error || !event) {
    return (
      <SafeAreaView style={styles.center}>
        <Text style={styles.error}>{error || "Tapahtumaa ei löydy"}</Text>
      </SafeAreaView>
    );
  }

  const fav = isFavorite(event.id);
  const ev = event;
  const img = resolveImageUrl(ev.image_url);
  const cd = daysUntil(ev.start_date, ev.end_date);
  const dur = durationDays(ev.start_date, ev.end_date);
  const gallery = (ev.gallery || []).map(resolveImageUrl).filter(Boolean) as string[];

  const titleText =
    localized(ev as unknown as Record<string, unknown>, "title", lang) || ev.title_fi;
  const descText =
    localized(ev as unknown as Record<string, unknown>, "description", lang) ||
    ev.description_fi ||
    "";

  function openMap() {
    const q = encodeURIComponent(ev.location);
    const url = Platform.select({
      ios: `http://maps.apple.com/?q=${q}`,
      android: `geo:0,0?q=${q}`,
      default: `https://www.google.com/maps/search/?api=1&query=${q}`,
    });
    if (url) Linking.openURL(url).catch(() => {});
  }

  function openLink() {
    if (ev.link) Linking.openURL(ev.link).catch(() => {});
  }

  function openRegistration() {
    if (ev.registration_url) Linking.openURL(ev.registration_url).catch(() => {});
  }

  return (
    <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
      {img ? (
        <View style={styles.heroWrap}>
          <Image source={{ uri: img }} style={styles.hero} />
          <View style={styles.heroFade} />
        </View>
      ) : (
        <View style={[styles.heroWrap, { backgroundColor: colors.surface }]} />
      )}

      <View style={styles.body}>
        <View style={styles.metaRow}>
          <Text style={styles.flag}>{flagFor(ev.country)}</Text>
        </View>
        <Text style={styles.title}>{titleText}</Text>

        {/* Category / audience / fight style / duration badges — gives the
            same classification surface as the web event detail page. */}
        <View style={styles.badgeRow}>
          <View style={styles.badgeCategory}>
            <Text style={styles.badgeCategoryText}>
              {t(`category.${ev.category}`).toUpperCase()}
            </Text>
          </View>
          {ev.audience ? (
            <View style={styles.badgeAudience}>
              <Ionicons name="people-outline" size={11} color={colors.gold} />
              <Text style={styles.badgeAudienceText}>{ev.audience}</Text>
            </View>
          ) : null}
          {ev.fight_style ? (
            <View style={styles.badgeStyle}>
              <Ionicons name="flash-outline" size={11} color={colors.ember} />
              <Text style={styles.badgeStyleText}>{ev.fight_style}</Text>
            </View>
          ) : null}
          {dur !== null && dur > 1 ? (
            <View style={styles.badgeDuration}>
              <Ionicons name="time-outline" size={11} color={colors.stone} />
              <Text style={styles.badgeDurationText}>
                {durationLabel(dur, t)}
              </Text>
            </View>
          ) : null}
        </View>

        {cd !== null ? (
          <View style={styles.cdBadge}>
            <Ionicons name="hourglass-outline" size={13} color={colors.ember} />
            <Text style={styles.cdLabel}>{t("home.countdown_label")}</Text>
            <Text style={styles.cdValue}>{countdownLabel(cd, t)}</Text>
          </View>
        ) : null}

        <View style={styles.factRow}>
          <Ionicons name="calendar" size={16} color={colors.gold} />
          <Text style={styles.fact}>
            {formatDateRange(ev.start_date, ev.end_date)}
          </Text>
        </View>
        <View style={styles.factRow}>
          <Ionicons name="location" size={16} color={colors.gold} />
          <Text style={styles.fact}>{ev.location}</Text>
        </View>
        <View style={styles.factRow}>
          <Ionicons name="person" size={16} color={colors.gold} />
          <Text style={styles.fact}>{ev.organizer}</Text>
        </View>

        {/* Description preview — truncated to N lines, tap to open the
            full text in a scrollable modal. */}
        {descText ? (
          <Pressable
            testID="desc-preview"
            onPress={() => setDescOpen(true)}
            style={({ pressed }) => [
              styles.descPreview,
              pressed && { opacity: 0.85 },
            ]}
          >
            <Text
              style={styles.descPreviewText}
              numberOfLines={DESCRIPTION_PREVIEW_LINES}
            >
              {descText}
            </Text>
            <Text style={styles.descPreviewMore}>
              {t("home.description_more")} →
            </Text>
          </Pressable>
        ) : null}

        <View style={styles.actions}>
          <Pressable
            testID="action-fav"
            style={[styles.actionBtn, fav ? styles.actionBtnActive : null]}
            onPress={() => toggle(ev.id)}
          >
            <Ionicons
              name={fav ? "star" : "star-outline"}
              size={16}
              color={fav ? colors.gold : colors.bone}
            />
            <Text style={[styles.actionText, fav ? { color: colors.gold } : null]}>
              {fav ? t("event.unfavorite") : t("event.favorite")}
            </Text>
          </Pressable>
          <Pressable testID="action-map" style={styles.actionBtn} onPress={openMap}>
            <Ionicons name="map-outline" size={16} color={colors.bone} />
            <Text style={styles.actionText}>{t("event.open_in_maps")}</Text>
          </Pressable>
          {ev.link ? (
            <Pressable
              testID="action-link"
              style={styles.actionBtnPrimary}
              onPress={openLink}
            >
              <Ionicons name="open-outline" size={16} color={colors.bone} />
              <Text style={[styles.actionText, { color: colors.bone }]}>
                {t("info.open_web")}
              </Text>
            </Pressable>
          ) : null}
          {ev.registration_url ? (
            <Pressable
              testID="action-registration"
              style={styles.actionBtnGold}
              onPress={openRegistration}
            >
              <Ionicons name="clipboard-outline" size={16} color={colors.bg} />
              <Text style={[styles.actionText, { color: colors.bg, fontWeight: "700" }]}>
                {t("event.registration_form")}
              </Text>
            </Pressable>
          ) : null}
        </View>

        <AttendBlock eventId={ev.id} />

        <EventStatsBlock eventId={ev.id} />

        <OrganizerRequestCTA
          eventId={ev.id}
          organizerIds={(ev as unknown as { organizer_user_ids?: string[] }).organizer_user_ids || []}
        />

        <EventOrganizersBlock eventId={ev.id} />

        <EventMerchantsBlock eventId={ev.id} />

        {gallery.length > 0 ? (
          <View style={styles.gallerySection}>
            <Text style={text.overline}>Kuvagalleria</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              {gallery.map((url, idx) => (
                <Image
                  key={`${url}-${idx}`}
                  source={{ uri: url }}
                  style={styles.galleryImg}
                />
              ))}
            </ScrollView>
          </View>
        ) : null}
      </View>

      {/* Description modal — full text rendered with scroll, dismiss on
          backdrop tap or × button. */}
      <Modal
        visible={descOpen}
        animationType="fade"
        transparent
        onRequestClose={() => setDescOpen(false)}
      >
        <Pressable
          style={modalStyles.backdrop}
          onPress={() => setDescOpen(false)}
        >
          <Pressable
            style={modalStyles.sheet}
            onPress={(e) => e.stopPropagation()}
          >
            <View style={modalStyles.header}>
              <Text style={modalStyles.title} numberOfLines={2}>
                {titleText}
              </Text>
              <Pressable
                onPress={() => setDescOpen(false)}
                style={modalStyles.closeBtn}
                hitSlop={12}
                testID="desc-modal-close"
              >
                <Ionicons name="close" size={22} color={colors.bone} />
              </Pressable>
            </View>
            <ScrollView
              style={modalStyles.scroll}
              contentContainerStyle={{ paddingBottom: spacing.lg }}
            >
              <Text style={modalStyles.body}>{descText}</Text>
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1, backgroundColor: colors.bg },
  scrollContent: { paddingBottom: spacing.xxl },
  center: {
    flex: 1,
    backgroundColor: colors.bg,
    alignItems: "center",
    justifyContent: "center",
  },
  error: { color: colors.ember, fontSize: 14 },
  heroWrap: { width: "100%", height: 300, position: "relative" },
  hero: { width: "100%", height: "100%" },
  heroFade: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    height: "60%",
    backgroundColor: "rgba(14,11,9,0.7)",
  },
  body: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    marginTop: -40,
  },
  metaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  flag: { fontSize: 18 },
  title: {
    ...text.h1,
    fontSize: 28,
    lineHeight: 34,
    marginBottom: spacing.lg,
  },
  cdBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    alignSelf: "flex-start",
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: "rgba(200,73,44,0.1)",
    borderColor: "rgba(200,73,44,0.5)",
    borderWidth: 1,
    borderRadius: radius.sm,
    marginBottom: spacing.lg,
  },
  cdLabel: { color: colors.stone, fontSize: 10, letterSpacing: 1.5, fontWeight: "600" },
  cdValue: { color: colors.ember, fontSize: 11, fontWeight: "700", letterSpacing: 1 },
  factRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 8,
  },
  fact: { ...text.body, fontSize: 14, flex: 1 },
  actions: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
    marginTop: spacing.lg,
    marginBottom: spacing.xl,
  },
  actionBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.edge,
    backgroundColor: colors.surface,
  },
  actionBtnActive: { borderColor: colors.gold, backgroundColor: "rgba(201,161,74,0.1)" },
  actionBtnPrimary: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: radius.sm,
    backgroundColor: colors.ember,
  },
  actionBtnGold: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: radius.sm,
    backgroundColor: colors.gold,
    shadowColor: colors.gold,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.4,
    shadowRadius: 6,
    elevation: 3,
  },
  actionText: { color: colors.bone, fontSize: 12, fontWeight: "600", letterSpacing: 0.5 },
  description: {
    ...text.body,
    fontSize: 16,
    lineHeight: 26,
    marginBottom: spacing.xl,
  },
  badgeRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: spacing.lg,
  },
  badgeCategory: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: "rgba(200,73,44,0.55)",
    backgroundColor: "rgba(200,73,44,0.12)",
  },
  badgeCategoryText: {
    color: colors.ember,
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 1.2,
  },
  badgeAudience: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: "rgba(201,161,74,0.5)",
    backgroundColor: "rgba(201,161,74,0.1)",
  },
  badgeAudienceText: {
    color: colors.gold,
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 0.5,
  },
  badgeStyle: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: "rgba(200,73,44,0.4)",
    backgroundColor: "rgba(200,73,44,0.08)",
  },
  badgeStyleText: {
    color: colors.ember,
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 0.5,
  },
  badgeDuration: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.edge,
    backgroundColor: colors.surface,
  },
  badgeDurationText: {
    color: colors.stone,
    fontSize: 11,
    fontWeight: "600",
    letterSpacing: 0.5,
  },
  descPreview: {
    marginBottom: spacing.xl,
    padding: spacing.md,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: "rgba(201,161,74,0.22)",
    backgroundColor: "rgba(0,0,0,0.22)",
  },
  descPreviewText: {
    color: colors.bone,
    fontSize: 15,
    lineHeight: 23,
  },
  descPreviewMore: {
    marginTop: 8,
    color: colors.gold,
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 0.8,
    textTransform: "uppercase",
  },
  gallerySection: { marginTop: spacing.lg, gap: spacing.md },
  galleryImg: {
    width: 200,
    height: 140,
    borderRadius: radius.sm,
    marginRight: spacing.sm,
    borderWidth: 1,
    borderColor: colors.edge,
  },
});

const modalStyles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.78)",
    justifyContent: "center",
    paddingHorizontal: spacing.md,
  },
  sheet: {
    backgroundColor: "#0F0B08",
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: "rgba(201,161,74,0.4)",
    maxHeight: "82%",
    padding: spacing.md,
  },
  header: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: spacing.sm,
    marginBottom: spacing.sm,
    paddingBottom: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(201,161,74,0.2)",
  },
  title: {
    ...text.h2,
    fontSize: 18,
    lineHeight: 22,
    flex: 1,
    color: colors.bone,
  },
  closeBtn: {
    width: 30,
    height: 30,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radius.sm,
    backgroundColor: "rgba(255,255,255,0.06)",
  },
  scroll: { maxHeight: "78%" },
  body: {
    color: colors.bone,
    fontSize: 15,
    lineHeight: 24,
  },
});
