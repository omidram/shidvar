import { RequestList } from "@/components/domain/workspaces";

export default function Page() {
  return <RequestList hrefPrefix="/supplier/requests" marketplace />;
}
