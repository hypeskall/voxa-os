import { notFound } from "next/navigation";
import { publicCatalog } from "@/features/public-booking/data";
import { BookingWidget } from "@/features/public-booking/booking-widget";
export const metadata = { title: "Programare online", robots: { index: false, follow: false } };
export default async function EmbeddedBooking({params,searchParams}:{params:Promise<{clinicSlug:string}>;searchParams:Promise<{service?:string;doctor?:string}>}) { const {clinicSlug}=await params; const query=await searchParams; const catalog=await publicCatalog(clinicSlug); if(!catalog)notFound(); return <div className="public-booking-page embedded"><BookingWidget compact catalog={catalog} preselectedService={query.service} preselectedDoctor={query.doctor}/></div>; }
