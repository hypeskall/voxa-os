import dashboard from "../../../public/marketing/dashboard.png";
import calendar from "../../../public/marketing/calendar.png";
import appointment from "../../../public/marketing/appointment.png";
import appointmentDetail from "../../../public/marketing/appointment-detail.png";
import patientProfile from "../../../public/marketing/patient-profile.png";
import doctors from "../../../public/marketing/doctors.png";
import services from "../../../public/marketing/services.png";
import team from "../../../public/marketing/team.png";

// Static imports give every captured screen a content-hashed URL and intrinsic dimensions.
// Refreshed product captures therefore cannot reuse stale image-optimizer variants.
export const productMedia = {
  dashboard,
  calendar,
  appointment,
  "appointment-detail": appointmentDetail,
  "patient-profile": patientProfile,
  doctors,
  services,
  team,
};
export type ProductMediaKey = keyof typeof productMedia;
