export type EventCategory =
  | "market"
  | "training_camp"
  | "course"
  | "festival"
  | "meetup"
  | "other";

export type CountryCode =
  | "FI" | "SE" | "EE" | "NO" | "DK" | "PL" | "DE" | "IS" | "LV" | "LT"
  | "SI" | "HR" | "UA" | "NL" | "GB" | "IE" | "BE" | "FR" | "ES" | "PT" | "IT";

export interface VikingEvent {
  id: string;
  title_fi: string;
  title_en: string;
  title_sv: string;
  description_fi: string;
  description_en: string;
  description_sv: string;
  category: EventCategory;
  country?: CountryCode;
  location: string;
  start_date: string;
  end_date?: string | null;
  organizer: string;
  organizer_email?: string | null;
  link: string;
  registration_url?: string;
  image_url: string;
  gallery?: string[];
  status: "approved" | "pending" | "rejected";
  created_at: string;
  audience?: string;
  fight_style?: string;
  program_pdf_url?: string;
}

export interface Guild {
  id: string;
  name: string;
  region: string;
  url: string;
  category: string;
  order_index: number;
}

export interface Merchant {
  id: string;
  name: string;
  description: string;
  url: string;
  category: string;
  order_index: number;
  // Extended fields populated for user-card merchants
  image_url?: string | null;
  phone?: string | null;
  email?: string | null;
  featured?: boolean;
  is_user_card?: boolean;
  user_id?: string | null;
}
