import { marketingMetadata } from "@/features/marketing/seo";
import { ResourcePage } from "@/features/marketing/resource-page";
export const generateMetadata = () => marketingMetadata("migrare");
export default function Page() {
  return <ResourcePage page="migrare" />;
}
