import { ReceptionWorkspace } from "@/features/reception/workspace";
export default async function Page({params,searchParams}:{params:Promise<{clinicId:string}>;searchParams:Promise<{all?:string}>}) {const {clinicId}=await params;return <ReceptionWorkspace cid={clinicId} kind="TASK" all={(await searchParams).all==="1"}/>;}
