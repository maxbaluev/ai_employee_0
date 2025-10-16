import { HomeDashboard } from "@/components/workspace/home";
import { getHomeDashboardData } from "@/lib/data/home-dashboard";

export default async function WorkspaceHomePage() {
  const data = await getHomeDashboardData();

  return <HomeDashboard data={data} />;
}
