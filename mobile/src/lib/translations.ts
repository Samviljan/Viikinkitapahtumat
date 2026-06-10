/**
 * Translation strings for the mobile app.
 *
 * Convention: dotted keys (`tab.home`, `home.near_me`) accessed via t().
 * Languages we ship native dictionaries for: FI (default), EN, SV.
 * DA, DE, ET, PL users see English via the fallback chain in i18n.tsx.
 */

export const SUPPORTED_LANGS = ["fi", "en", "sv", "da", "de", "et", "pl"] as const;
export type Lang = (typeof SUPPORTED_LANGS)[number];

// DA / DE / ET / PL native translations live in translations.extra.ts to
// keep this file under ~1000 lines. They're spread into `translations` at
// the bottom of this module.
import { extraTranslations } from "./translations.extra";

interface Dict {
  brand: { title: string; tagline: string };
  tab: { home: string; favorites: string; myevents: string; calendar: string; shops: string; settings: string };
  home: {
    title: string;
    near_me: string;
    near_me_radius: string;
    countries: string;
    date_any: string;
    date_this_week: string;
    date_this_month: string;
    date_next_3_months: string;
    search_placeholder: string;
    no_events: string;
    show_past: string;
    hide_past: string;
    loading: string;
    error_load: string;
    retry: string;
    showing_count: string;
    pull_to_refresh: string;
    countdown_label: string;
    duration_label: string;
    audience_label: string;
    style_label: string;
    description_more: string;
    description_close: string;
  };
  duration: {
    one: string;
    n: string;
  };
  countdown: {
    today: string;
    tomorrow: string;
    days: string;
    weeks: string;
    months: string;
    past: string;
  };
  category: {
    market: string;
    training_camp: string;
    course: string;
    festival: string;
    meetup: string;
    other: string;
  };
  event: { back: string; favorite: string; unfavorite: string; share: string; open_in_maps: string; registration_form: string };
  favorites: { title: string; empty: string; browse: string };
  myevents: {
    eyebrow: string;
    title: string;
    attending_section: string;
    favourites_section: string;
    merchants_section: string;
    merchants_no_events: string;
    merchants_open_website: string;
    empty: string;
    filter_favorites: string;
    filter_attending: string;
    filter_both: string;
    filter_empty: string;
  };
  calendar: { title: string };
  shops: { title: string; empty: string };
  settings: {
    title: string;
    sub: string;
    section_language: string;
    section_filters: string;
    section_near_me: string;
    section_about: string;
    section_profile: string;
    section_privacy: string;
    location_enabled: string;
    location_enabled_help: string;
    location_disabled_note: string;
    nav_profile: string;
    nav_search: string;
    nav_about: string;
    nav_attending: string;
    language_auto: string;
    save_defaults: string;
    saved_toast: string;
    reset: string;
    reset_confirm: string;
    near_me_radius_label: string;
    near_me_radius_help: string;
    default_date_range: string;
    default_countries: string;
    default_near_me: string;
    open_about: string;
  };
  auth: {
    signed_out_title: string;
    signed_out_sub: string;
    sign_in: string;
    sign_up: string;
    sign_out: string;
    google_sign_in: string;
    or: string;
    email: string;
    password: string;
    password_min: string;
    nickname: string;
    user_types_label: string;
    user_types_help: string;
    type_reenactor: string;
    type_fighter: string;
    type_merchant: string;
    type_organizer: string;
    have_account: string;
    no_account: string;
    error_invalid: string;
    error_duplicate: string;
    error_generic: string;
    profile_title: string;
    profile_save: string;
    profile_saved: string;
    confirm_sign_out: string;
    forgot: string;
    forgot_title: string;
    forgot_sub: string;
    forgot_send: string;
    forgot_sent: string;
    back_to_signin: string;
    merchant_name_label: string;
    merchant_name_help: string;
    organizer_name_label: string;
    organizer_name_help: string;
    country_label: string;
    country_optional: string;
    country_none: string;
    association_label: string;
    association_help: string;
    profile_image_label: string;
    profile_image_change: string;
    profile_image_remove: string;
    profile_image_upload_error: string;
    profile_image_too_large: string;
    documents_section: string;
    documents_help: string;
    fighter_card_label: string;
    fighter_card_help: string;
    equipment_passport_label: string;
    equipment_passport_help: string;
    doc_pick_pdf: string;
    doc_view: string;
    doc_remove: string;
    doc_upload_error: string;
    doc_too_large: string;
  };
  attend: {
    mark_attending: string;
    attending: string;
    sign_in_to_attend: string;
    notify_title: string;
    notify_help: string;
    notify_email: string;
    notify_push: string;
  };
  attending: {
    title: string;
    help: string;
    empty: string;
  };
  saved_search: {
    title: string;
    help: string;
    radius: string;
    categories: string;
    countries: string;
    any: string;
    save: string;
    saved: string;
  };
  messaging: {
    feature: string;
    title: string;
    blocked_title: string;
    blocked_help: string;
    consent_help: string;
    pick_event: string;
    channel: string;
    ch_both: string;
    ch_push: string;
    ch_email: string;
    targets: string;
    targets_help_all: string;
    targets_help_some: string;
    no_push_tokens: string;
    subject: string;
    body: string;
    body_hint: string;
    send_btn: string;
    sent_toast: string;
    result: string;
    result_text: string;
    nav_label: string;
    cta_send: string;
    quota_used: string;
    quota_reached_title: string;
  };
  messages: {
    feature: string;
    title: string;
    tab_inbox: string;
    tab_sent: string;
    tab_compose: string;
    loading: string;
    inbox_empty: string;
    sent_empty: string;
    from: string;
    to_recipients: string;
    recipients_unit: string;
    batches_unit: string;
    total_unit: string;
    no_subject: string;
    delete: string;
    delete_confirm: string;
    deleted_toast: string;
    close: string;
    detail_a11y: string;
  };
  info: {
    title: string;
    sub: string;
    version: string;
    build: string;
    runtime: string;
    platform: string;
    open_web: string;
    contact_title: string;
    contact_help: string;
    contact_subject_label: string;
    contact_message_label: string;
    contact_subject_default: string;
    contact_send: string;
    share_app: string;
    share_app_sub: string;
    share_message: string;
  };
  common: { cancel: string; ok: string; save: string; close: string; back: string };
  langs: {
    fi: string;
    en: string;
    sv: string;
    da: string;
    de: string;
    et: string;
    pl: string;
  };
  units: { km: string };
}

// Built-in dictionaries (FI / EN / SV). DA / DE / ET / PL are merged in at
// the very bottom of the file from `translations.extra.ts`.
const baseTranslations: Partial<Record<Lang, Dict>> = {
  fi: {
    brand: {
      title: "VIIKINKITAPAHTUMAT",
      tagline: "Pohjoisen viikinki- ja rauta-aikaharrastajien kalenteri",
    },
    tab: {
      home: "Etusivu",
      favorites: "Suosikit",
      myevents: "Tapahtumani",
      calendar: "Kalenteri",
      shops: "Kaupat",
      settings: "Asetukset",
    },
    home: {
      title: "Tapahtumat",
      near_me: "Lähellä minua",
      near_me_radius: "{km} km säde",
      countries: "Maat",
      date_any: "Milloin tahansa",
      date_this_week: "Tällä viikolla",
      date_this_month: "Tässä kuussa",
      date_next_3_months: "Seuraavat 3 kk",
      search_placeholder: "Hae tapahtumaa…",
      no_events: "Ei tapahtumia tällä haulla.",
      show_past: "Näytä menneet",
      hide_past: "Piilota menneet",
      loading: "Ladataan…",
      error_load: "Tapahtumien lataus epäonnistui.",
      retry: "Yritä uudelleen",
      showing_count: "{n} tapahtumaa",
      pull_to_refresh: "Vedä päivittääksesi",
      countdown_label: "TAPAHTUMAAN",
      duration_label: "KESTO",
      audience_label: "Yleisö",
      style_label: "Tyyli",
      description_more: "Lue lisää",
      description_close: "Sulje",
    },
    duration: { one: "1 päivä", n: "{n} päivää" },
    countdown: {
      today: "Tänään",
      tomorrow: "Huomenna",
      days: "{n} pv",
      weeks: "{n} vk",
      months: "{n} kk",
      past: "Ohi",
    },
    category: {
      market: "Markkinat",
      training_camp: "Harjoitusleiri",
      course: "Kurssi",
      festival: "Festivaali",
      meetup: "Kokoontuminen",
      other: "Muu",
    },
    event: {
      back: "Takaisin",
      favorite: "Lisää suosikkeihin",
      unfavorite: "Poista suosikeista",
      share: "Jaa",
      open_in_maps: "Avaa kartalla",
      registration_form: "Ilmoittautumislomake",
    },
    favorites: {
      title: "Suosikit",
      empty: "Et ole vielä lisännyt tapahtumia suosikkeihin.",
      browse: "Selaa tapahtumia",
    },
    myevents: {
      eyebrow: "Omat",
      title: "Tapahtumani",
      attending_section: "Olen ilmoittautunut",
      favourites_section: "Suosikit",
      merchants_section: "Suosikkikauppiaani",
      merchants_no_events: "Ei tulevia tapahtumia",
      merchants_open_website: "Avaa kotisivut",
      empty:
        "Et ole vielä ilmoittautunut tai lisännyt suosikkeihin yhtään tapahtumaa.",
      filter_favorites: "Suosikit",
      filter_attending: "Osallistun",
      filter_both: "Molemmat",
      filter_empty: "Ei tapahtumia tällä suodattimella.",
    },
    calendar: { title: "Kalenteri" },
    shops: { title: "Kauppiaat ja sepät", empty: "Ei kauppiaita listattuna." },
    settings: {
      title: "Asetukset",
      sub: "Säädä kieli ja oletushakufiltterit.",
      section_language: "Kieli",
      section_filters: "Oletushakufiltterit",
      section_near_me: "Lähellä minua",
      section_about: "Sovelluksesta",
      section_profile: "Profiili",
      nav_profile: "Profiili",
      nav_search: "Hakuasetukset",
      nav_about: "Tietoa sovelluksesta",
      nav_attending: "Osallistun-tapahtumat",
      language_auto: "Tunnista automaattisesti",
      save_defaults: "Tallenna oletukseksi",
      saved_toast: "Tallennettu",
      reset: "Palauta oletukset",
      reset_confirm: "Palautetaanko kaikki asetukset oletusarvoihin?",
      near_me_radius_label: "Säde",
      near_me_radius_help:
        "Lähellä minua -hakua varten. Vain tämän säteen sisällä olevat tapahtumat näytetään.",
      default_date_range: "Oletus aikaväli",
      default_countries: "Oletus maat",
      default_near_me: "Lähellä minua oletuksena päällä",
      section_privacy: "Yksityisyys",
      location_enabled: "Salli paikannus",
      location_enabled_help:
        "Kun paikannus on käytössä, voit suodattaa tapahtumia sijaintisi mukaan. Sammuttamalla estät sovellusta pyytämästä GPS-lupaa ja Lähellä minua -suodatin piilotetaan.",
      location_disabled_note:
        "Paikannus on pois päältä. Salli se yllä ottaaksesi Lähellä minua -suodattimen käyttöön.",
      open_about: "Tietoa sovelluksesta",
    },
    auth: {
      signed_out_title: "Kirjaudu sisään",
      signed_out_sub:
        "Kirjautuminen on vapaaehtoista. Sen avulla voit tallentaa profiilisi ja saada jatkossa lisätoimintoja.",
      sign_in: "Kirjaudu",
      sign_up: "Luo tili",
      sign_out: "Kirjaudu ulos",
      google_sign_in: "Jatka Googlella",
      or: "tai",
      email: "Sähköposti",
      password: "Salasana",
      password_min: "Vähintään 8 merkkiä",
      nickname: "Nimimerkki",
      user_types_label: "Olen…",
      user_types_help: "Voit valita yhden tai useamman.",
      type_reenactor: "Elävöittäjä",
      type_fighter: "Taistelija",
      type_merchant: "Kauppias",
      type_organizer: "Tapahtumajärjestäjä",
      have_account: "Onko jo tili? Kirjaudu",
      no_account: "Ei tiliä? Luo tili",
      error_invalid: "Virheellinen sähköposti tai salasana.",
      error_duplicate: "Sähköposti on jo käytössä.",
      error_generic: "Toiminto epäonnistui. Yritä uudelleen.",
      profile_title: "Profiili",
      profile_save: "Tallenna",
      profile_saved: "Profiili tallennettu",
      confirm_sign_out: "Kirjaudutaanko ulos?",
      forgot: "Unohtuiko salasana?",
      forgot_title: "Salasanan palautus",
      forgot_sub:
        "Anna sähköpostisi. Lähetämme linkin uuden salasanan asettamiseen. Linkki vanhenee 60 minuutissa.",
      forgot_send: "Lähetä palautuslinkki",
      forgot_sent:
        "Jos antamasi sähköpostiosoite on rekisteröity, lähetimme sinulle salasanan palautuslinkin.",
      back_to_signin: "Takaisin kirjautumiseen",
      merchant_name_label: "Kaupan nimi",
      merchant_name_help: "Pakollinen kun valittuna 'Kauppias'.",
      organizer_name_label: "Tapahtuman tai järjestäjän nimi",
      organizer_name_help: "Pakollinen kun valittuna 'Tapahtumajärjestäjä'.",
      country_label: "Maa",
      country_optional: "Valinnainen",
      country_none: "Ei valittu",
      association_label: "Yhdistys (valinnainen)",
      association_help:
        "Jos olet jonkin yhdistyksen jäsen, voit liittää nimen tähän — näkyy vain sinulle.",
      profile_image_label: "Profiilikuva",
      profile_image_change: "Vaihda kuva",
      profile_image_remove: "Poista kuva",
      profile_image_upload_error: "Kuvan lataus epäonnistui",
      profile_image_too_large: "Kuva on liian suuri (max 3 MB)",
      documents_section: "Asiakirjat",
      documents_help:
        "SVTL Taistelijakortti ja Varustepassi (PDF). Vain sinä ja ylläpito voivat avata.",
      fighter_card_label: "SVTL Taistelijakortti",
      fighter_card_help: "PDF, max 8 MB.",
      equipment_passport_label: "Varustepassi",
      equipment_passport_help: "PDF, max 8 MB.",
      doc_pick_pdf: "Valitse PDF",
      doc_view: "Avaa",
      doc_remove: "Poista",
      doc_upload_error: "Tiedoston lataus epäonnistui",
      doc_too_large: "Tiedosto on liian suuri (max 8 MB)",
    },
    attend: {
      mark_attending: "Merkitse osallistuvaksi",
      attending: "Osallistut — peruuta",
      sign_in_to_attend: "Kirjaudu osallistuaksesi",
      notify_title: "Muistutukset tapahtumasta",
      notify_help:
        "Saat muistutuksia ennen tapahtumaa valitsemallasi tavalla. Voit vaihtaa näitä asetuksia milloin tahansa.",
      notify_email: "Muistuta sähköpostilla",
      notify_push: "Muistuta push-viestillä",
    },
    attending: {
      title: "Osallistun-tapahtumat",
      help: "Tapahtumat, joihin olet merkinnyt osallistuvasi.",
      empty: "Et ole vielä merkinnyt osallistuvasi yhteenkään tapahtumaan.",
    },
    saved_search: {
      title: "Hakuoletukset",
      help: "Tallenna oletukset jotka esitäytetään listanäkymään.",
      radius: "Etäisyys",
      categories: "Kategoriat",
      countries: "Maat",
      any: "Kaikki",
      save: "Tallenna",
      saved: "Oletukset tallennettu",
    },
    messaging: {
      feature: "Lisämaksullinen ominaisuus",
      title: "Lähetä viesti osallistujille",
      blocked_title: "Ominaisuus ei ole käytössä tilillesi",
      blocked_help:
        "Viestien lähettäminen tapahtumien osallistujille on lisämaksullinen ominaisuus. Ota yhteyttä ylläpitoon aktivoidaksesi sen.",
      consent_help:
        "Viesti lähetetään vain niille käyttäjille jotka ovat 1) merkinneet osallistuvansa tapahtumaan JA 2) antaneet luvan vastaanottaa viestejä rooliasi vastaavasta lähteestä. Yhteystietoja ei näytetä.",
      pick_event: "Valitse tapahtuma",
      channel: "Kanava",
      ch_both: "Push + sähköposti",
      ch_push: "Vain push",
      ch_email: "Vain sähköposti",
      targets: "Kohderyhmä",
      targets_help_all: "Tyhjä = viesti kaikille suostumuksen antaneille osallistujille.",
      targets_help_some: "Viesti rajataan vain valittuihin kategorioihin.",
      no_push_tokens: "Push-vastaanottajia: 0. Yksikään valitsemistasi vastaanottajista ei ole vielä ottanut käyttöön mobiilisovelluksen push-notifikaatioita. Sähköpostit menevät silti perille jos kanavana on 'Sähköposti' tai 'Push + Sähköposti'.",
      subject: "Otsikko",
      body: "Viesti",
      body_hint: "Push-viesteissä näkyy vain ensimmäiset ~160 merkkiä.",
      send_btn: "Lähetä",
      sent_toast: "Viesti lähetetty",
      result: "Tulos",
      result_text:
        "Push: {push}, sähköposti: {email}, vastaanottajia: {recipients}",
      nav_label: "Lähetä viesti",
      cta_send: "Viesti",
      quota_used: "Käytetty {used}/{limit} viestiä",
      quota_reached_title: "Viestiraja täyttyi",
    },
    messages: {
      feature: "Viestintä",
      title: "Viestit",
      tab_inbox: "Saapuneet",
      tab_sent: "Lähetetyt",
      tab_compose: "Lähetä uusi",
      loading: "Ladataan…",
      inbox_empty: "Ei vielä saapuneita viestejä.",
      sent_empty: "Et ole lähettänyt vielä viestejä.",
      from: "Lähettäjä",
      to_recipients: "Vastaanottajat",
      recipients_unit: "vastaanottajaa",
      batches_unit: "lähetystä",
      total_unit: "yhteensä",
      no_subject: "(ei otsikkoa)",
      delete: "Poista",
      delete_confirm: "Haluatko varmasti poistaa tämän viestin?",
      deleted_toast: "Viesti poistettu",
      close: "Sulje",
      detail_a11y: "Viestin sisältö ja toimintopainikkeet",
    },
    info: {
      title: "Tietoa sovelluksesta",
      sub: "Versio, yhteydenotto ja lisätietoja.",
      version: "Versio",
      build: "Build",
      runtime: "Runtime",
      platform: "Alusta",
      open_web: "Avaa verkkosivu",
      contact_title: "Yhteydenotto",
      contact_help:
        "Lähetä viesti suoraan kehittäjälle (avaa sähköpostisovelluksesi).",
      contact_subject_label: "Aihe",
      contact_message_label: "Viesti",
      contact_subject_default: "Palaute Viikinkitapahtumat-sovelluksesta",
      contact_send: "Lähetä",
      share_app: "Jaa sovellus",
      share_app_sub: "Kutsu kaverit löytämään tapahtumat",
      share_message:
        "Pohjoisen viikinki- ja rauta-aikatapahtumat yhdessä paikassa. Selaa kalenteri ja tallenna suosikit:",
    },
    common: { cancel: "Peruuta", ok: "OK", save: "Tallenna", close: "Sulje", back: "Takaisin" },
    langs: {
      fi: "Suomi",
      en: "English",
      sv: "Svenska",
      da: "Dansk",
      de: "Deutsch",
      et: "Eesti",
      pl: "Polski",
    },
    units: { km: "km" },
  },

  en: {
    brand: {
      title: "VIKING EVENTS",
      tagline: "Nordic viking-age and iron-age reenactment calendar",
    },
    tab: {
      home: "Home",
      favorites: "Favorites",
      myevents: "My events",
      calendar: "Calendar",
      shops: "Merchants",
      settings: "Settings",
    },
    home: {
      title: "Events",
      near_me: "Near me",
      near_me_radius: "{km} km radius",
      countries: "Countries",
      date_any: "Any time",
      date_this_week: "This week",
      date_this_month: "This month",
      date_next_3_months: "Next 3 months",
      search_placeholder: "Search events…",
      no_events: "No events match this filter.",
      show_past: "Show past",
      hide_past: "Hide past",
      loading: "Loading…",
      error_load: "Failed to load events.",
      retry: "Retry",
      showing_count: "{n} events",
      pull_to_refresh: "Pull to refresh",
      countdown_label: "STARTS IN",
      duration_label: "DURATION",
      audience_label: "Audience",
      style_label: "Style",
      description_more: "Read more",
      description_close: "Close",
    },
    duration: { one: "1 day", n: "{n} days" },
    countdown: {
      today: "Today",
      tomorrow: "Tomorrow",
      days: "{n} d",
      weeks: "{n} w",
      months: "{n} mo",
      past: "Past",
    },
    category: {
      market: "Market",
      training_camp: "Training camp",
      course: "Course",
      festival: "Festival",
      meetup: "Meetup",
      other: "Other",
    },
    event: { back: "Back", favorite: "Add to favorites", unfavorite: "Remove from favorites", share: "Share", open_in_maps: "Open in Maps", registration_form: "Registration form" },
    favorites: {
      title: "Favorites",
      empty: "You haven't favorited any events yet.",
      browse: "Browse events",
    },
    myevents: {
      eyebrow: "Mine",
      title: "My events",
      attending_section: "I'm attending",
      favourites_section: "Favourites",
      merchants_section: "My favourite merchants",
      merchants_no_events: "No upcoming events",
      merchants_open_website: "Open website",
      empty:
        "You haven't attended or favourited any events yet.",
      filter_favorites: "Favorites",
      filter_attending: "Attending",
      filter_both: "Both",
      filter_empty: "No events under this filter.",
    },
    calendar: { title: "Calendar" },
    shops: { title: "Merchants & smiths", empty: "No merchants listed." },
    settings: {
      title: "Settings",
      sub: "Adjust language and default search filters.",
      section_language: "Language",
      section_filters: "Default search filters",
      section_near_me: "Near me",
      section_about: "About",
      section_profile: "Profile",
      nav_profile: "Profile",
      nav_search: "Search settings",
      nav_about: "About the app",
      nav_attending: "My attending events",
      language_auto: "Auto-detect",
      save_defaults: "Save as default",
      saved_toast: "Saved",
      reset: "Reset to defaults",
      reset_confirm: "Reset all settings to defaults?",
      near_me_radius_label: "Radius",
      near_me_radius_help:
        "For the Near me filter. Only events within this distance will be shown.",
      default_date_range: "Default date range",
      default_countries: "Default countries",
      default_near_me: "Near me on by default",
      section_privacy: "Privacy",
      location_enabled: "Allow location",
      location_enabled_help:
        "When enabled, you can filter events by your location. Turning this off prevents the app from asking for the GPS permission and hides the Near me filter.",
      location_disabled_note:
        "Location is turned off. Enable it above to use the Near me filter.",
      open_about: "About the app",
    },
    auth: {
      signed_out_title: "Sign in",
      signed_out_sub:
        "Sign-in is optional. It lets you save your profile and unlock more features later.",
      sign_in: "Sign in",
      sign_up: "Create account",
      sign_out: "Sign out",
      google_sign_in: "Continue with Google",
      or: "or",
      email: "Email",
      password: "Password",
      password_min: "At least 8 characters",
      nickname: "Nickname",
      user_types_label: "I am a…",
      user_types_help: "Pick one or more.",
      type_reenactor: "Reenactor",
      type_fighter: "Fighter",
      type_merchant: "Merchant",
      type_organizer: "Event organizer",
      have_account: "Have an account? Sign in",
      no_account: "No account? Create one",
      error_invalid: "Invalid email or password.",
      error_duplicate: "Email is already registered.",
      error_generic: "Something went wrong. Try again.",
      profile_title: "Profile",
      profile_save: "Save",
      profile_saved: "Profile saved",
      confirm_sign_out: "Sign out?",
      forgot: "Forgot password?",
      forgot_title: "Reset password",
      forgot_sub:
        "Enter your email. We'll send you a link to set a new password. The link expires in 60 minutes.",
      forgot_send: "Send reset link",
      forgot_sent:
        "If that email address is registered, we've sent you a password reset link.",
      back_to_signin: "Back to sign in",
      merchant_name_label: "Shop name",
      merchant_name_help: "Required when 'Merchant' is selected.",
      organizer_name_label: "Event or organization name",
      organizer_name_help: "Required when 'Event organizer' is selected.",
      country_label: "Country",
      country_optional: "Optional",
      country_none: "Not selected",
      association_label: "Association (optional)",
      association_help:
        "If you belong to an association, you can add the name here — visible only to you.",
      profile_image_label: "Profile picture",
      profile_image_change: "Change picture",
      profile_image_remove: "Remove picture",
      profile_image_upload_error: "Failed to upload picture",
      profile_image_too_large: "Image too large (max 3 MB)",
      documents_section: "Documents",
      documents_help:
        "SVTL Fighter Card and Equipment Passport (PDF). Only you and the admins can open them.",
      fighter_card_label: "SVTL Fighter Card",
      fighter_card_help: "PDF, max 8 MB.",
      equipment_passport_label: "Equipment Passport",
      equipment_passport_help: "PDF, max 8 MB.",
      doc_pick_pdf: "Pick PDF",
      doc_view: "Open",
      doc_remove: "Remove",
      doc_upload_error: "File upload failed",
      doc_too_large: "File too large (max 8 MB)",
    },
    attend: {
      mark_attending: "Mark as attending",
      attending: "Attending — cancel",
      sign_in_to_attend: "Sign in to attend",
      notify_title: "Reminders about this event",
      notify_help:
        "You'll receive reminders before the event using the channels you choose. You can change these any time.",
      notify_email: "Remind me by email",
      notify_push: "Remind me by push",
    },
    attending: {
      title: "My attending events",
      help: "Events you've marked as attending.",
      empty: "You haven't marked attendance to any event yet.",
    },
    saved_search: {
      title: "Default search filters",
      help: "Save default filters that pre-fill the events list.",
      radius: "Distance",
      categories: "Categories",
      countries: "Countries",
      any: "Any",
      save: "Save",
      saved: "Defaults saved",
    },
    messaging: {
      feature: "Paid feature",
      title: "Send a message to attendees",
      blocked_title: "This feature is not enabled for your account",
      blocked_help:
        "Sending messages to attendees is a paid feature. Contact support to activate it.",
      consent_help:
        "Recipients are filtered to users who 1) have marked attendance for the event AND 2) have given consent matching your role. Contact details are never shown.",
      pick_event: "Choose event",
      channel: "Channel",
      ch_both: "Push + email",
      ch_push: "Push only",
      ch_email: "Email only",
      targets: "Target audience",
      targets_help_all: "Empty = message goes to all consenting attendees.",
      targets_help_some: "Message limited to attendees in the selected categories.",
      no_push_tokens: "Push recipients: 0. None of the matching attendees have enabled push notifications via the mobile app yet. Email still works if you used 'Email' or 'Push + Email' as the channel.",
      subject: "Subject",
      body: "Message",
      body_hint: "Push notifications only show the first ~160 characters.",
      send_btn: "Send",
      sent_toast: "Message sent",
      result: "Result",
      result_text:
        "Push: {push}, email: {email}, recipients: {recipients}",
      nav_label: "Send message",
      cta_send: "Message",
      quota_used: "Used {used}/{limit} messages",
      quota_reached_title: "Message limit reached",
    },
    messages: {
      feature: "Messaging",
      title: "Messages",
      tab_inbox: "Inbox",
      tab_sent: "Sent",
      tab_compose: "New message",
      loading: "Loading…",
      inbox_empty: "No messages yet.",
      sent_empty: "You haven't sent any messages yet.",
      from: "From",
      to_recipients: "Recipients",
      recipients_unit: "recipients",
      batches_unit: "sends",
      total_unit: "total",
      no_subject: "(no subject)",
      delete: "Delete",
      delete_confirm: "Are you sure you want to delete this message?",
      deleted_toast: "Message deleted",
      close: "Close",
      detail_a11y: "Message content and action buttons",
    },
    info: {
      title: "About the app",
      sub: "Version, contact and more info.",
      version: "Version",
      build: "Build",
      runtime: "Runtime",
      platform: "Platform",
      open_web: "Open website",
      contact_title: "Contact",
      contact_help: "Send a message directly to the developer (opens your email app).",
      contact_subject_label: "Subject",
      contact_message_label: "Message",
      contact_subject_default: "Feedback on Viking Events app",
      contact_send: "Send",
      share_app: "Share app",
      share_app_sub: "Invite friends to discover events",
      share_message:
        "Nordic viking-age and iron-age events in one place. Browse the calendar and save favorites:",
    },
    common: { cancel: "Cancel", ok: "OK", save: "Save", close: "Close", back: "Back" },
    langs: {
      fi: "Suomi",
      en: "English",
      sv: "Svenska",
      da: "Dansk",
      de: "Deutsch",
      et: "Eesti",
      pl: "Polski",
    },
    units: { km: "km" },
  },

  sv: {
    brand: {
      title: "VIKINGAEVENT",
      tagline: "Nordens vikinga- och järnålders-kalender",
    },
    tab: {
      home: "Hem",
      favorites: "Favoriter",
      myevents: "Mina evenemang",
      calendar: "Kalender",
      shops: "Handlare",
      settings: "Inställningar",
    },
    home: {
      title: "Evenemang",
      near_me: "Nära mig",
      near_me_radius: "{km} km radie",
      countries: "Länder",
      date_any: "När som helst",
      date_this_week: "Denna vecka",
      date_this_month: "Denna månad",
      date_next_3_months: "Nästa 3 månader",
      search_placeholder: "Sök evenemang…",
      no_events: "Inga evenemang matchar.",
      show_past: "Visa äldre",
      hide_past: "Dölj äldre",
      loading: "Laddar…",
      error_load: "Kunde inte ladda evenemang.",
      retry: "Försök igen",
      showing_count: "{n} evenemang",
      pull_to_refresh: "Dra för att uppdatera",
      countdown_label: "BÖRJAR OM",
      duration_label: "LÄNGD",
      audience_label: "Publik",
      style_label: "Stil",
      description_more: "Läs mer",
      description_close: "Stäng",
    },
    duration: { one: "1 dag", n: "{n} dagar" },
    countdown: {
      today: "Idag",
      tomorrow: "Imorgon",
      days: "{n} d",
      weeks: "{n} v",
      months: "{n} mån",
      past: "Förbi",
    },
    category: {
      market: "Marknad",
      training_camp: "Träningsläger",
      course: "Kurs",
      festival: "Festival",
      meetup: "Träff",
      other: "Övrigt",
    },
    event: { back: "Tillbaka", favorite: "Lägg till favorit", unfavorite: "Ta bort favorit", share: "Dela", open_in_maps: "Öppna i Kartor", registration_form: "Anmälningsformulär" },
    favorites: {
      title: "Favoriter",
      empty: "Du har inte sparat några favoriter ännu.",
      browse: "Bläddra i evenemang",
    },
    myevents: {
      eyebrow: "Mina",
      title: "Mina evenemang",
      attending_section: "Jag deltar",
      favourites_section: "Favoriter",
      merchants_section: "Mina favorithandlare",
      merchants_no_events: "Inga kommande evenemang",
      merchants_open_website: "Öppna webbplats",
      empty:
        "Du har inte anmält dig eller favoriserat några evenemang än.",
      filter_favorites: "Favoriter",
      filter_attending: "Jag deltar",
      filter_both: "Båda",
      filter_empty: "Inga evenemang under detta filter.",
    },
    calendar: { title: "Kalender" },
    shops: { title: "Handlare & smeder", empty: "Inga handlare listade." },
    settings: {
      title: "Inställningar",
      sub: "Anpassa språk och förvalda sökfilter.",
      section_language: "Språk",
      section_filters: "Förvalda sökfilter",
      section_near_me: "Nära mig",
      section_about: "Om",
      section_profile: "Profil",
      nav_profile: "Profil",
      nav_search: "Sökinställningar",
      nav_about: "Om appen",
      nav_attending: "Mina deltagande",
      language_auto: "Autoidentifiera",
      save_defaults: "Spara som förval",
      saved_toast: "Sparat",
      reset: "Återställ förval",
      reset_confirm: "Återställ alla inställningar?",
      near_me_radius_label: "Radie",
      near_me_radius_help:
        "För Nära mig-filtret. Endast evenemang inom denna radie visas.",
      default_date_range: "Förvalt datumintervall",
      default_countries: "Förvalda länder",
      default_near_me: "Nära mig som förval",
      section_privacy: "Integritet",
      location_enabled: "Tillåt platsdata",
      location_enabled_help:
        "När platsdata är på kan du filtrera evenemang efter din plats. Stäng av för att hindra appen från att begära GPS-behörighet och dölja Nära mig-filtret.",
      location_disabled_note:
        "Platsdata är avstängt. Aktivera ovan för att använda Nära mig-filtret.",
      open_about: "Om appen",
    },
    auth: {
      signed_out_title: "Logga in",
      signed_out_sub:
        "Inloggning är valfri. Den låter dig spara din profil och få fler funktioner senare.",
      sign_in: "Logga in",
      sign_up: "Skapa konto",
      sign_out: "Logga ut",
      google_sign_in: "Fortsätt med Google",
      or: "eller",
      email: "E-post",
      password: "Lösenord",
      password_min: "Minst 8 tecken",
      nickname: "Smeknamn",
      user_types_label: "Jag är…",
      user_types_help: "Välj en eller flera.",
      type_reenactor: "Återskapare",
      type_fighter: "Krigare",
      type_merchant: "Handlare",
      type_organizer: "Evenemangsarrangör",
      have_account: "Har du konto? Logga in",
      no_account: "Inget konto? Skapa ett",
      error_invalid: "Ogiltig e-post eller lösenord.",
      error_duplicate: "E-posten är redan registrerad.",
      error_generic: "Något gick fel. Försök igen.",
      profile_title: "Profil",
      profile_save: "Spara",
      profile_saved: "Profil sparad",
      confirm_sign_out: "Logga ut?",
      forgot: "Glömt lösenord?",
      forgot_title: "Återställ lösenord",
      forgot_sub:
        "Ange din e-postadress. Vi skickar en länk för att ange ett nytt lösenord. Länken är giltig i 60 minuter.",
      forgot_send: "Skicka återställningslänk",
      forgot_sent:
        "Om e-postadressen är registrerad har vi skickat en återställningslänk.",
      back_to_signin: "Tillbaka till inloggning",
      merchant_name_label: "Butikens namn",
      merchant_name_help: "Krävs när 'Handelsman' är valt.",
      organizer_name_label: "Evenemangets eller organisationens namn",
      organizer_name_help: "Krävs när 'Evenemangsarrangör' är valt.",
      country_label: "Land",
      country_optional: "Frivilligt",
      country_none: "Ej valt",
      association_label: "Förening (frivilligt)",
      association_help:
        "Om du är medlem i en förening kan du lägga till namnet här — syns bara för dig.",
      profile_image_label: "Profilbild",
      profile_image_change: "Byt bild",
      profile_image_remove: "Ta bort bild",
      profile_image_upload_error: "Kunde inte ladda upp bilden",
      profile_image_too_large: "Bilden är för stor (max 3 MB)",
      documents_section: "Dokument",
      documents_help:
        "SVTL Fightarkort och Utrustningspass (PDF). Endast du och administratörerna kan öppna dem.",
      fighter_card_label: "SVTL Fightarkort",
      fighter_card_help: "PDF, max 8 MB.",
      equipment_passport_label: "Utrustningspass",
      equipment_passport_help: "PDF, max 8 MB.",
      doc_pick_pdf: "Välj PDF",
      doc_view: "Öppna",
      doc_remove: "Ta bort",
      doc_upload_error: "Filuppladdning misslyckades",
      doc_too_large: "Filen är för stor (max 8 MB)",
    },
    attend: {
      mark_attending: "Markera deltagande",
      attending: "Deltar — avbryt",
      sign_in_to_attend: "Logga in för att delta",
      notify_title: "Påminnelser om evenemanget",
      notify_help:
        "Du får påminnelser före evenemanget på de sätt du valt. Du kan ändra inställningarna när som helst.",
      notify_email: "Påminn via e-post",
      notify_push: "Påminn via push",
    },
    attending: {
      title: "Mina deltagande",
      help: "Evenemang du markerat att du deltar i.",
      empty: "Du har ännu inte markerat deltagande för något evenemang.",
    },
    saved_search: {
      title: "Standardfilter",
      help: "Spara filter som förhandsfylls i evenemangslistan.",
      radius: "Avstånd",
      categories: "Kategorier",
      countries: "Länder",
      any: "Alla",
      save: "Spara",
      saved: "Standardvärden sparade",
    },
    messaging: {
      feature: "Premiumfunktion",
      title: "Skicka meddelande till deltagare",
      blocked_title: "Denna funktion är inte aktiverad",
      blocked_help: "Att skicka meddelanden är en premiumfunktion.",
      consent_help: "Mottagarna filtreras enligt deltagande och samtycke.",
      pick_event: "Välj evenemang",
      channel: "Kanal",
      ch_both: "Push + e-post",
      ch_push: "Endast push",
      ch_email: "Endast e-post",
      targets: "Målgrupp",
      targets_help_all: "Tomt = meddelande till alla samtyckande deltagare.",
      targets_help_some: "Meddelandet begränsas till valda kategorier.",
      no_push_tokens: "Push-mottagare: 0. Ingen av deltagarna har aktiverat push-notiser i mobilappen ännu. E-post fungerar fortfarande om du valt 'E-post' eller 'Push + E-post'.",
      subject: "Ämne",
      body: "Meddelande",
      body_hint: "Push-meddelanden visar bara ~160 tecken.",
      send_btn: "Skicka",
      sent_toast: "Meddelande skickat",
      result: "Resultat",
      result_text: "Push: {push}, e-post: {email}, mottagare: {recipients}",
      nav_label: "Skicka meddelande",
      cta_send: "Meddelande",
      quota_used: "Använt {used}/{limit} meddelanden",
      quota_reached_title: "Meddelandekvoten uppnådd",
    },
    messages: {
      feature: "Meddelanden",
      title: "Meddelanden",
      tab_inbox: "Inkorg",
      tab_sent: "Skickat",
      tab_compose: "Nytt meddelande",
      loading: "Laddar…",
      inbox_empty: "Inga meddelanden ännu.",
      sent_empty: "Du har inte skickat några meddelanden.",
      from: "Från",
      to_recipients: "Mottagare",
      recipients_unit: "mottagare",
      batches_unit: "utskick",
      total_unit: "totalt",
      no_subject: "(inget ämne)",
      delete: "Radera",
      delete_confirm: "Vill du radera detta meddelande?",
      deleted_toast: "Meddelande raderat",
      close: "Stäng",
      detail_a11y: "Meddelandeinnehåll och knappar",
    },
    info: {
      title: "Om appen",
      sub: "Version, kontakt och mer info.",
      version: "Version",
      build: "Build",
      runtime: "Runtime",
      platform: "Plattform",
      open_web: "Öppna webbplats",
      contact_title: "Kontakt",
      contact_help: "Skicka ett meddelande direkt till utvecklaren (öppnar din e-postapp).",
      contact_subject_label: "Ämne",
      contact_message_label: "Meddelande",
      contact_subject_default: "Feedback på Vikingaevent-appen",
      contact_send: "Skicka",
      share_app: "Dela appen",
      share_app_sub: "Bjud in vänner att upptäcka evenemang",
      share_message:
        "Nordens vikinga- och järnålders-evenemang på ett ställe. Bläddra i kalendern och spara favoriter:",
    },
    common: { cancel: "Avbryt", ok: "OK", save: "Spara", close: "Stäng", back: "Tillbaka" },
    langs: {
      fi: "Suomi",
      en: "English",
      sv: "Svenska",
      da: "Dansk",
      de: "Deutsch",
      et: "Eesti",
      pl: "Polski",
    },
    units: { km: "km" },
  },
};

/**
 * Public translations object — FI / EN / SV (full native, defined above)
 * + DA / DE / ET / PL (full native, defined in translations.extra.ts).
 *
 * The `extraTranslations` cast intentionally lets us spread structurally
 * compatible dictionaries (the extra file uses `AnyDict` to avoid pulling
 * the full Dict shape into a second file). If a key drifts, it surfaces at
 * the call-site as a missing key rather than a compile error.
 */
export const translations: Partial<Record<Lang, Dict>> = {
  ...baseTranslations,
  ...(extraTranslations as Partial<Record<Lang, Dict>>),
};

