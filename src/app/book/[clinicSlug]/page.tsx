import { notFound } from "next/navigation";
import { publicCatalog } from "@/features/public-booking/data";
import { BookingWidget } from "@/features/public-booking/booking-widget";
export default async function ClinicBooking({params,searchParams}:{params:Promise<{clinicSlug:string}>;searchParams:Promise<{service?:string;doctor?:string}>}) { const {clinicSlug}=await params; const query=await searchParams; const catalog=await publicCatalog(clinicSlug); if(!catalog)notFound(); return <BookingWidget catalog={catalog} preselectedService={query.service} preselectedDoctor={query.doctor}/>; }
