import { defaultHours, type OnboardingDraft } from "../../src/features/onboarding/model";
export function setupDraft(cid="40000000-0000-4000-8000-000000000001"):OnboardingDraft {
 const sid="50000000-0000-4000-8000-000000000001",did="60000000-0000-4000-8000-000000000001";
 return {clinic:{name:"Clinica Test",legal_name:"Clinica Test SRL",cui:"",phone:"",email:"contact@clinica-test.ro",website:"",specialty:"ORL"},locations:[{id:cid,name:"Oradea",address:"Strada Test 1",city:"Oradea",county:"Bihor",phone:"",email:"",hours:defaultHours()}],services:[{id:sid,location_id:cid,name:"Consultație",description:"",price:"200.00",duration_minutes:30}],doctors:[{id:did,first_name:"Ana",last_name:"Popescu",specialty:"ORL",professional_code:"",phone:"",email:"",color:"#397766",location_ids:[cid],service_ids:[sid]}],rooms:[],team:[]};
}
