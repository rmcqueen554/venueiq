export type VenueType =
  | 'stadium'
  | 'arena'
  | 'amphitheater'
  | 'civic_center'
  | 'racetrack'
  | 'fairground'
  | 'convention_center';

export type SubscriptionTier = 'starter' | 'professional' | 'enterprise';

export type UserRole =
  | 'platform_super_admin'
  | 'venue_owner'
  | 'general_manager'
  | 'coo'
  | 'cfo'
  | 'operations_director'
  | 'concessions_director'
  | 'merchandise_director'
  | 'ticketing_director'
  | 'sponsorship_director'
  | 'security_director'
  | 'facilities_manager'
  | 'event_manager'
  | 'marketing_director'
  | 'parking_director'
  | 'premium_hospitality_director';

export interface WhiteLabelConfig {
  logo_url: string | null;
  primary_color: string;
  app_name: string;
  favicon_url: string | null;
}

export interface Tenant {
  id: string;
  name: string;
  slug: string;
  type: VenueType;
  capacity: number | null;
  timezone: string;
  tier: SubscriptionTier;
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
  white_label_config: WhiteLabelConfig | null;
  onboarding_completed_at: Date | null;
  created_at: Date;
  updated_at: Date;
}

export interface Venue {
  id: string;
  tenant_id: string;
  name: string;
  address: string | null;
  city: string | null;
  state: string | null;
  country: string;
  lat: number | null;
  lng: number | null;
  layout_config: VenueLayoutConfig | null;
  created_at: Date;
}

export interface VenueLayoutConfig {
  width: number;
  height: number;
  sections: VenueSection[];
  gates: VenueGate[];
  concession_stands: VenuePoint[];
  merch_locations: VenuePoint[];
  parking_lots: VenueParkingLot[];
}

export interface VenueSection {
  id: string;
  name: string;
  x: number;
  y: number;
  width: number;
  height: number;
  capacity: number;
}

export interface VenueGate {
  id: string;
  name: string;
  x: number;
  y: number;
}

export interface VenuePoint {
  id: string;
  name: string;
  x: number;
  y: number;
}

export interface VenueParkingLot {
  id: string;
  name: string;
  x: number;
  y: number;
  capacity: number;
}

export type EventType = 'game' | 'concert' | 'convention' | 'private' | 'rehearsal';
export type EventStatus = 'scheduled' | 'live' | 'completed' | 'cancelled';

export interface Event {
  id: string;
  tenant_id: string;
  venue_id: string;
  name: string;
  type: EventType;
  sport_or_genre: string | null;
  opponent_or_artist: string | null;
  scheduled_at: Date;
  gates_open_at: Date | null;
  expected_attendance: number | null;
  status: EventStatus;
  weather_forecast: WeatherForecast | null;
  created_at: Date;
}

export interface WeatherForecast {
  temperature_f: number;
  feels_like_f: number;
  precipitation_probability: number;
  condition: string;
  wind_mph: number;
  is_outdoor_risk: boolean;
}

export type DataSourceType =
  | 'toast' | 'square' | 'clover' | 'lightspeed' | 'appetize' | 'bypass'
  | 'ticketmaster' | 'axs' | 'seatgeek' | 'paciolan' | 'provenue'
  | 'salesforce' | 'hubspot' | 'dynamics365'
  | 'parkhub' | 'spothero' | 'paybyphone'
  | 'genetec' | 'lenel' | 'software_house'
  | 'ibm_maximo' | 'fiix' | 'upkeep'
  | 'adp' | 'ukg' | 'when_i_work'
  | 'quickbooks' | 'netsuite' | 'sap'
  | 'tomorrow_io'
  | 'aws_iot'
  | 'meta_graph' | 'x_api'
  | 'generic_webhook' | 'csv_upload';

export type DataSourceStatus = 'connected' | 'disconnected' | 'error' | 'pending';

export interface TenantDataSource {
  id: string;
  tenant_id: string;
  source_type: DataSourceType;
  status: DataSourceStatus;
  last_sync_at: Date | null;
  error_message: string | null;
  created_at: Date;
}

export interface TenantUser {
  id: string;
  tenant_id: string;
  user_id: string;
  role: UserRole;
  permissions: Record<string, boolean>;
  invited_at: Date;
  activated_at: Date | null;
}
