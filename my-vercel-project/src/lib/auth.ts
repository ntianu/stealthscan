import { auth, currentUser } from "@clerk/nextjs/server";
import { db } from "@/lib/db";

/**
 * Returns the current Clerk user's database User record.
 * Creates the record if it doesn't exist yet (first sign-in).
 */
export async function getCurrentUser() {
  const { userId } = await auth();
  if (!userId) return null;

  const clerkUser = await currentUser();
  if (!clerkUser) return null;

  const email =
    clerkUser.emailAddresses[0]?.emailAddress ?? "";
  const name = `${clerkUser.firstName ?? ""} ${clerkUser.lastName ?? ""}`.trim();

  const user = await db.user.upsert({
    where: { clerkId: userId },
    create: {
      clerkId: userId,
      email,
      name: name || null,
    },
    update: {
      email,
      name: name || null,
    },
    include: { userProfile: true },
  });

  return user;
}

/**
 * Like getCurrentUser but throws if not authenticated.
 */
export async function requireUser() {
  const user = await getCurrentUser();
  if (!user) throw new Error("Unauthorized");
  return user;
}
