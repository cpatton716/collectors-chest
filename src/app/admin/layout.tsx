import { redirect } from "next/navigation";

import { getAdminProfile } from "@/lib/adminAuth";

import AdminNav from "./AdminNav";

// Server-side admin gate (M-AD2): enforce `is_admin` on every /admin page,
// independent of (and as defense-in-depth with) the client UI and middleware.
// Non-admins (including unauthenticated users) are redirected away before any
// admin chrome or child page renders.
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const adminProfile = await getAdminProfile();

  if (!adminProfile) {
    redirect("/collection");
  }

  return (
    <div>
      <AdminNav />
      {children}
    </div>
  );
}
