import { requireUser } from "@/lib/auth/session";
import { MenuScreen } from "./menu-screen";
import pkg from "@/package.json";

export default async function MenuPage() {
  const user = await requireUser();
  return <MenuScreen userFullName={user.fullName} currentEmail={user.email} appVersion={pkg.version} />;
}
