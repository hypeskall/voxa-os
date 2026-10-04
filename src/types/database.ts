// Schema contract for the versioned migrations. Regenerate with Supabase CLI
// after schema changes into a separate file for comparison:
// supabase gen types typescript --local > supabase/database.generated.ts.
import type { Role } from "@/lib/permissions";
import type { Subscription } from "@/features/subscriptions/model";
export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];
type Timestamps = { created_at: string; updated_at: string };
type Organization = { id: string; name: string; legal_name: string; cui: string; email: string; phone: string; website: string; logo_path: string | null; specialty: string; timezone: string; currency: string; country: string; onboarding_completed: boolean; plan: string; subscription_status: string; trial_started_at: string; trial_ends_at: string } & Timestamps;
type Clinic = {
  id: string;
  organization_id: string;
  name: string;
  address: string;
  city: string;
  county: string;
  postal_code: string;
  phone: string;
  phone_secondary: string;
  email: string;
  timezone: string;
  public_booking_enabled: boolean;
  booking_slug: string | null;
  scheduling_increment_minutes: number;
  calendar_visible_start: string;
  calendar_visible_end: string;
  whatsapp_reminder_template: string;
  archived_at: string | null;
} & Timestamps;
type Profile = { id: string; full_name: string } & Timestamps;
type Membership = {
  id: string;
  user_id: string;
  organization_id: string;
  clinic_id: string;
  role: Role;
  active: boolean;
} & Timestamps;
type Preferences = {
  user_id: string;
  default_clinic_id: string | null;
  density: "compact" | "comfortable";
  locale: "ro";
  calendar_view: "day" | "week" | "month" | "agenda";
  calendar_filters: Json;
  visible_columns: Json;
  dashboard_modules: string[];
  updated_at: string;
};
type Audit = {
  id: string;
  organization_id: string;
  clinic_id: string;
  actor_id: string | null;
  action: string;
  entity: string;
  entity_id: string;
  metadata: Json;
  created_at: string;
};
type Appointment = {
  id: string;
  organization_id: string;
  clinic_id: string;
  patient_id: string;
  service_id: string;
  doctor_location_id: string | null;
  start_at: string;
  end_at: string;
  occupied_start_at: string;
  occupied_end_at: string;
  duration_minutes: number;
  buffer_before: number;
  buffer_after: number;
  status: AppointmentStatus;
  source: AppointmentSource;
  notes: string;
  cancellation_reason: string;
  created_by: string | null;
  cancelled_at: string | null;
  created_at: string;
  updated_at: string;
};
type AppointmentStatus = "PENDING" | "CONFIRMED" | "ARRIVED" | "IN_PROGRESS" | "COMPLETED" | "CANCELLED" | "NO_SHOW";
type AppointmentSource = "RECEPTION" | "WEBSITE" | "PATIENT_PORTAL" | "API" | "VOICE_AGENT";
type NotificationStatus = "QUEUED" | "SENDING" | "SENT" | "DELIVERED" | "FAILED";
type NotificationChannel = "SMS" | "EMAIL";
type NotificationEvent = "APPOINTMENT_CREATED" | "CONFIRMATION_REQUESTED" | "APPOINTMENT_CONFIRMED" | "APPOINTMENT_CHANGED" | "APPOINTMENT_CANCELLED" | "APPOINTMENT_REMINDER" | "RESULT_AVAILABLE";
type MedicalResultStatus = "DRAFT" | "VALIDATED" | "RELEASED";
type Relation = {
  foreignKeyName: string;
  columns: string[];
  isOneToOne: boolean;
  referencedRelation: string;
  referencedColumns: string[];
};
type Table<
  Row,
  Insert = Partial<Row>,
  Update = Partial<Row>,
  Relationships extends Relation[] = [],
> = { Row: Row; Insert: Insert; Update: Update; Relationships: Relationships };
export type Database = {
  public: {
    Tables: {
      organization_subscriptions: Table<Subscription, never, never>;
      license_keys: Table<{ id: string; organization_id: string | null; code_hash: string; code_hint: string; status: "available" | "assigned" | "active" | "expired" | "revoked"; plan: string; duration_months: number; redeem_by: string; expires_at: string | null; activated_at: string | null; created_by: string | null } & Timestamps, never, never>;
      subscription_events: Table<{ id: string; organization_id: string; subscription_id: string; event_type: string; metadata: Json; created_at: string }, never, never>;
      organization_members: Table<{ id: string; organization_id: string; user_id: string; role: Role; status: "active" | "suspended" } & Timestamps, never, never>;
      onboarding_drafts: Table<{ organization_id: string; step: number; payload: Json; revision: number; updated_at: string }, never, never>;
      organization_invites: Table<{ id: string; organization_id: string; clinic_id: string; email: string; role: Role; expires_at: string; accepted_at: string | null; revoked_at: string | null; invited_by: string; created_at: string }, never, never>;
      organization_settings: Table<{ organization_id: string; appointment_settings: Json; notification_settings: Json; branding_settings: Json; calendar_settings: Json; privacy_settings: Json; updated_at: string }>;
      patient_notes: Table<{ id: string; organization_id: string; clinic_id: string; patient_id: string; author_id: string; content: string } & Timestamps, never, never>;
      privacy_requests: Table<{ id: string; organization_id: string; clinic_id: string; patient_id: string; requested_by: string; request_type: "anonymization" | "erasure"; status: "pending_review" | "approved" | "rejected" | "completed"; reason: string; review_note: string; reviewed_by: string | null } & Timestamps, never, never>;
      organizations: Table<
        Organization,
        Pick<Organization, "name"> & Partial<Organization>,
        Pick<Organization, "name">
      >;
      clinics: Table<
        Clinic,
        Pick<Clinic, "organization_id" | "name"> & Partial<Clinic>,
        Partial<Pick<Clinic, "name" | "address" | "city" | "county" | "postal_code" | "phone" | "phone_secondary" | "email" | "timezone" | "public_booking_enabled" | "booking_slug" | "scheduling_increment_minutes" | "calendar_visible_start" | "calendar_visible_end" | "whatsapp_reminder_template">>
      >;
      profiles: Table<
        Profile,
        Pick<Profile, "id"> & Partial<Profile>,
        Partial<Pick<Profile, "full_name">>
      >;
      clinic_memberships: Table<
        Membership,
        never,
        never,
        [
          {
            foreignKeyName: "clinic_memberships_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ]
      >;
      user_preferences: Table<
        Preferences,
        Pick<Preferences, "user_id"> & Partial<Preferences>,
        Partial<Pick<Preferences, "default_clinic_id" | "density" | "calendar_view" | "calendar_filters" | "visible_columns" | "dashboard_modules">>
      >;
      audit_logs: Table<
        Audit,
        never,
        never,
        [
          {
            foreignKeyName: "audit_logs_actor_id_fkey";
            columns: ["actor_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ]
      >;
      permissions: Table<{ key: string; description: string }, never, never>;
      role_permissions: Table<{ role: Role; permission: string }, never, never>;
      appointments: Table<Appointment, never, never>;
      patients: Table<{ id:string; organization_id:string; clinic_id:string; name:string; internal_id:string; cnp:string|null; birth_date:string|null; sex:"female"|"male"|"other"|"unspecified"; phone:string; email:string; address:string; city:string; postal_code:string; country:string; administrative_notes:string; active:boolean; archived_at:string|null; created_by:string|null } & Timestamps,never,never>;
      clinic_notification_settings: Table<{ clinic_id: string; organization_id: string; sms_enabled: boolean; email_enabled: boolean; reminder_offsets_minutes: number[]; confirmation_expiry_hours: number; cancellation_min_notice_hours: number; updated_at: string }, never, never>;
      communication_templates: Table<{ id: string; organization_id: string; clinic_id: string; event: NotificationEvent; channel: NotificationChannel; subject: string; body: string; active: boolean; created_at: string; updated_at: string }, never, never>;
      notification_jobs: Table<{ id: string; organization_id: string; clinic_id: string; event: NotificationEvent; channel: NotificationChannel; status: NotificationStatus; appointment_id: string | null; patient_id: string | null; confirmation_id: string | null; recipient: string; scheduled_for: string; idempotency_key: string; attempts: number; max_attempts: number; locked_at: string | null; sent_at: string | null; provider_message_id: string | null; last_error: string; created_by: string | null; created_at: string; updated_at: string }, never, never>;
      communication_logs: Table<{ id: string; organization_id: string; clinic_id: string; job_id: string; event: NotificationEvent; channel: NotificationChannel; status: NotificationStatus; appointment_id: string | null; patient_id: string | null; recipient_masked: string; attempts: number; provider_message_id: string | null; last_error: string; sent_at: string | null; created_at: string; updated_at: string }, never, never>;
      manual_patient_communications: Table<{ id:string; organization_id:string; clinic_id:string; patient_id:string; actor_id:string|null; channel:"PHONE"|"WHATSAPP"|"EMAIL"|"SMS"|"IN_PERSON"|"OTHER"; direction:"OUTBOUND"|"INBOUND"; summary:string; occurred_at:string; created_at:string },never,never>;
      appointment_confirmations: Table<{ id: string; organization_id: string; clinic_id: string; appointment_id: string; public_id: string; token_hash: string; expires_at: string; revoked_at: string | null; used_at: string | null; created_by: string | null; created_at: string }, never, never>;
      document_types: Table<{ id: string; organization_id: string; clinic_id: string; name: string; code: string; active: boolean; created_at: string; updated_at: string }, never, never>;
      patient_documents: Table<{ id: string; organization_id: string; clinic_id: string; patient_id: string; appointment_id: string | null; document_type_id: string; title: string; object_path: string; file_name: string; mime_type: string; file_size: number; visible_to_patient: boolean; created_by: string | null; uploaded_by: string | null; archived_at: string | null; created_at: string; updated_at: string }, never, never>;
      medical_results: Table<{ id: string; organization_id: string; clinic_id: string; patient_id: string; appointment_id: string; service_id: string; doctor_location_id: string; title: string; content: string; status: MedicalResultStatus; version: number; pdf_object_path: string | null; created_by: string; validated_by: string | null; released_by: string | null; validated_at: string | null; released_at: string | null; created_at: string; updated_at: string }, never, never>;
      medical_result_versions: Table<{ id: string; organization_id: string; clinic_id: string; result_id: string; version: number; status: MedicalResultStatus; title: string; content: string; changed_by: string; change_reason: string; created_at: string }, never, never>;
      patient_identities: Table<{ id: string; user_id: string; organization_id: string; clinic_id: string; patient_id: string; verified_at: string; revoked_at: string | null; created_by: string | null; created_at: string }, never, never>;
      appointment_resources: Table<{
        id: string; organization_id: string; clinic_id: string; appointment_id: string;
        resource_kind: "room" | "equipment"; room_id: string | null; equipment_id: string | null;
        capacity_units: number; requirement_group: string | null; created_at: string;
      }, never, never>;
      appointment_history: Table<{
        id: string; organization_id: string; clinic_id: string; appointment_id: string; event: string;
        actor_id: string | null; old_values: Json; new_values: Json; reason: string; created_at: string;
      }, never, never>;
    };
    Views: Record<string, never>;
    Functions: {
      claim_transactional_email: { Args: { digest: string }; Returns: string };
      finish_transactional_email: { Args: { digest: string; outcome: "accepted" | "uncertain" }; Returns: undefined };
      organization_access: { Args: { oid: string }; Returns: boolean };
      activate_license: { Args: { oid: string; digest: string }; Returns: boolean };
      issue_license: { Args: { digest: string; hint: string; assigned_org?: string | null; months?: number; redeem_deadline?: string }; Returns: string };
      revoke_license: { Args: { lid: string }; Returns: undefined };
      expire_subscriptions: { Args: Record<string, never>; Returns: number };
      queue_storage_cleanup: { Args: { bucket: string; path: string }; Returns: string };
      storage_cleanup_unreferenced: { Args: { job_id: string }; Returns: boolean };
      save_onboarding: { Args: { oid: string; draft: Json; next_step: number; expected_revision: number }; Returns: number };
      save_organization_identity: { Args: { oid: string; payload: Json }; Returns: undefined };
      doctor_calendar_colors: { Args: { cid: string }; Returns: Json };
      finish_onboarding: { Args: { oid: string; expected_revision: number; invite_digests?: Json }; Returns: string };
      set_organization_logo: { Args: { oid: string; path: string }; Returns: undefined };
      create_staff_invite: { Args: { cid: string; target_email: string; target_role: Role; digest: string }; Returns: string };
      accept_staff_invite: { Args: { digest: string }; Returns: string };
      revoke_staff_invite: { Args: { iid: string }; Returns: undefined };
      add_patient_note: { Args: { cid: string; pid: string; note_content: string }; Returns: string };
      read_workflow_patient: { Args: { cid: string; pid: string }; Returns: Json };
      request_patient_privacy: { Args: { cid: string; pid: string; kind: string; reason_value: string }; Returns: string };
      review_privacy_request: { Args: { cid: string; rid: string; decision: string; review: string }; Returns: undefined };
      export_patient: { Args: { cid: string; pid: string }; Returns: Json };
      my_doctor_schedule: { Args: { cid: string; day_from: string; day_to: string }; Returns: Json };
      list_core: {
        Args: {
          cid: string;
          module: string;
          query?: string;
          state?: string;
          sort_key?: string;
          descending?: boolean;
          page_number?: number;
          filter_id?: string | null;
        };
        Returns: Json;
      };
      save_clinic_weekly_schedule: {
        Args: { cid: string; payload: Json };
        Returns: undefined;
      };
      read_core: {
        Args: { cid: string; module: string; entity_id: string };
        Returns: Json;
      };
      core_options: {
        Args: {
          cid: string;
          module: string;
          query?: string;
          selected?: string[];
        };
        Returns: Json;
      };
      save_core: {
        Args: {
          cid: string;
          module: string;
          entity_id: string | null;
          payload: Json;
          expected_updated_at?: string | null;
        };
        Returns: string;
      };
      save_doctor: {
        Args: {
          cid: string;
          entity_id: string | null;
          payload: Json;
          expected_updated_at?: string | null;
        };
        Returns: string;
      };
      archive_core: {
        Args: {
          cid: string;
          module: string;
          entity_id: string;
          restore?: boolean;
        };
        Returns: undefined;
      };
      attach_doctor: {
        Args: {
          source_clinic: string;
          source_id: string;
          target_clinic: string;
        };
        Returns: string;
      };
      patient_history: { Args: { cid: string; pid: string }; Returns: Json };
      create_organization: {
        Args: { org_name: string; clinic_name: string };
        Returns: string;
      };
      create_clinic: {
        Args: {
          oid: string;
          clinic_name: string;
          clinic_address: string;
          clinic_timezone: string;
        };
        Returns: string;
      };
      create_location: { Args: { oid: string; payload: Json }; Returns: string };
      set_membership: {
        Args: {
          cid: string;
          target_email: string;
          target_role: Role;
          is_active: boolean;
        };
        Returns: undefined;
      };
      my_permissions: { Args: { cid: string }; Returns: string[] };
      record_login: { Args: Record<string, never>; Returns: undefined };
      get_required_resources: { Args: { cid: string; sid: string }; Returns: Json };
      find_available_resources: { Args: { cid: string; sid: string; starts: string; doctor_id?: string | null; room_id?: string | null; equipment_ids?: string[]; excluded_appointment?: string | null }; Returns: Json };
      validate_appointment: { Args: { cid: string; payload: Json; excluded_appointment?: string | null }; Returns: Json };
      find_conflicts: { Args: { cid: string; payload: Json; excluded_appointment?: string | null }; Returns: Json };
      create_appointment: { Args: { cid: string; payload: Json }; Returns: Json };
      reschedule_appointment: { Args: { cid: string; aid: string; payload: Json; expected_updated_at: string }; Returns: Json };
      cancel_appointment: { Args: { cid: string; aid: string; reason: string; expected_updated_at: string }; Returns: Json };
      set_appointment_status: { Args: { cid: string; aid: string; next_status: AppointmentStatus; expected_updated_at: string }; Returns: Json };
      get_available_slots: { Args: { cid: string; sid: string; window_start: string; window_end: string; doctor_id?: string | null; step_minutes?: number }; Returns: Json };
      list_calendar_appointments: { Args: { cid: string; range_start: string; range_end: string; filters?: Json }; Returns: Json };
      read_appointment: { Args: { cid: string; aid: string }; Returns: Json };
      update_appointment_notes: { Args: { cid: string; aid: string; new_notes: string; expected_updated_at: string }; Returns: Json };
      list_public_booking_clinics: { Args: Record<string, never>; Returns: Json };
      get_reschedule_slots: { Args: { cid: string; aid: string; window_start: string; window_end: string; doctor_id?: string | null; step_minutes?: number }; Returns: Json };
      resize_appointment: { Args: { cid: string; aid: string; new_duration_minutes: number; expected_updated_at: string }; Returns: Json };
      public_booking_catalog: { Args: { slug: string }; Returns: Json };
      public_available_slots: { Args: { slug: string; sid: string; day: string; doctor_id?: string | null; request_key?: string }; Returns: Json };
      create_public_booking: { Args: { slug: string; payload: Json; request_key: string }; Returns: Json };
      issue_appointment_confirmation: { Args: { cid: string; aid: string; token_digest: string; token_public_id: string; expires: string }; Returns: string };
      issue_system_confirmation: { Args: { cid: string; aid: string; token_digest: string; token_public_id: string; expires: string }; Returns: string };
      result_appointment_options: { Args: { cid: string }; Returns: Json };
      lookup_patient_auth_user: { Args: { cid: string; pid: string }; Returns: string | null };
      public_confirmation_details: { Args: { token_digest: string; request_key: string }; Returns: Json };
      public_confirmation_action: { Args: { token_digest: string; action_value: string; request_key: string }; Returns: Json };
      save_notification_settings: { Args: { cid: string; payload: Json }; Returns: undefined };
      save_communication_template: { Args: { cid: string; template_id: string; template_subject: string; template_body: string; is_active: boolean }; Returns: undefined };
      enqueue_due_reminders: { Args: { reference_time?: string }; Returns: number };
      claim_notification_jobs: { Args: { batch_size?: number }; Returns: Json };
      notification_job_context: { Args: { job_id: string }; Returns: Json };
      finish_notification_job: { Args: { job_id: string; final_status: NotificationStatus; provider_id: string; error_text?: string }; Returns: undefined };
      link_patient_identity: { Args: { cid: string; pid: string; uid: string }; Returns: string };
      list_patient_documents: { Args: { cid: string; pid: string }; Returns: Json };
      save_patient_document: { Args: { cid: string; pid: string; aid: string | null; type_id: string; document_title: string; path: string; file_label: string; mime: string; bytes: number; patient_visible: boolean }; Returns: string };
      authorize_document_download: { Args: { cid: string; document_id: string }; Returns: Json };
      list_medical_results: { Args: { cid: string; pid?: string | null }; Returns: Json };
      read_medical_result: { Args: { cid: string; result_id: string }; Returns: Json };
      save_medical_result: { Args: { cid: string; result_id: string | null; aid: string; did: string; result_title: string; result_content: string; expected_version?: number | null; change_reason?: string }; Returns: string };
      transition_medical_result: { Args: { cid: string; result_id: string; next_status: MedicalResultStatus; pdf_path?: string | null }; Returns: Json };
      authorize_result_download: { Args: { cid: string; result_id: string }; Returns: Json };
      set_doctor_credentials: { Args: { cid: string; did: string; staff_uid: string | null; signature_path: string | null; signature_type: string | null; stamp_path: string | null; stamp_type: string | null }; Returns: undefined };
      read_doctor_credentials: { Args: { cid: string; did: string }; Returns: Json };
      patient_portal_home: { Args: Record<string, never>; Returns: Json };
      patient_portal_appointment_action: { Args: { aid: string; action_value: string }; Returns: Json };
      operational_dashboard: { Args: { cid: string; local_day?: string | null }; Returns: Json };
      tomorrow_whatsapp_reminders: { Args: { cid: string; local_day?: string | null }; Returns: Json };
      open_whatsapp_reminder: { Args: { cid: string; aid: string }; Returns: string };
      record_patient_communication: { Args: { cid:string; pid:string; channel_value:string; direction_value:string; summary_value:string; occurred?:string|null }; Returns:string };
      reports_summary: { Args: { cid: string; date_from: string; date_to: string; doctor_filter?: string | null; service_filter?: string | null }; Returns: Json };
      global_search: { Args: { cid: string; search_query: string; result_limit?: number }; Returns: Json };
      record_report_export: { Args: { cid: string; date_from: string; date_to: string }; Returns: undefined };
    };
    Enums: { clinic_role: Role; appointment_status: AppointmentStatus; appointment_source: AppointmentSource; notification_status: NotificationStatus; notification_channel: NotificationChannel; notification_event: NotificationEvent; medical_result_status: MedicalResultStatus };
    CompositeTypes: Record<string, never>;
  };
};
