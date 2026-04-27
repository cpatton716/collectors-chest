import { redirect } from "next/navigation";

import { auth } from "@clerk/nextjs/server";

import { NotificationsInbox } from "@/components/notifications/NotificationsInbox";

export const metadata = {
  title: "Notifications · Collectors Chest",
  description: "All your notifications in one place.",
};

export default async function NotificationsPage() {
  const { userId } = await auth();
  if (!userId) {
    redirect("/sign-in?redirect=/notifications");
  }

  return (
    <main className="max-w-3xl mx-auto px-4 py-6 sm:py-10">
      <h1 className="text-2xl sm:text-3xl font-comic font-black text-pop-black mb-4">
        Notifications
      </h1>
      <NotificationsInbox />
    </main>
  );
}
