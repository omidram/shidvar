import { ProfitLossPanel } from "@/components/domain/profit-loss-panel";
import { ReportsView } from "@/components/domain/reports-view";

export default function Page() {
  return (
    <div className="grid gap-6">
      <ProfitLossPanel />
      <ReportsView />
    </div>
  );
}
