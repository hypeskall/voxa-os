import { T } from "@/components/locale-provider";
import Link from "next/link";
export default function PortalLayout({children}:{children:React.ReactNode}){return <div className="patient-portal"><header className="portal-header"><Link href="/portal"><span className="public-mark"><T>{"V"}</T></span><strong><T>{"Voxa "}</T><b><T>{"Pacient"}</T></b></strong></Link><span><T>{"Acces medical securizat"}</T></span></header>{children}<footer className="portal-footer"><T>{"Datele medicale sunt disponibile numai în sesiunea autentificată."}</T></footer></div>}
