import { redirect } from "next/navigation";
import { actorFromCookies } from "@/server/auth/session";
import { homePath } from "@/lib/portal";

export default async function Page() {
  const actor = await actorFromCookies();
  if (!actor) redirect("/login");
  redirect(homePath(actor));
}
