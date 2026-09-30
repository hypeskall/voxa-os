import type { Metadata } from "next";
export const metadata: Metadata = { title: "Programare online", description: "Programare online la clinică", robots: { index: true, follow: true } };
export default function BookingLayout({ children }: { children: React.ReactNode }) { return <div className="public-booking-page">{children}</div>; }
