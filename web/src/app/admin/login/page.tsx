import { redirect } from "next/navigation";

/**
 * /admin/login no longer exists as its own page — login is unified at
 * /login for every role, and the server decides where each account lands
 * after authenticating. This stub just catches anyone with an old
 * bookmark or link and forwards them, rather than a bare 404.
 */
export default function LegacyAdminLoginRedirect() {
  redirect("/login");
}
