import { auth } from "@/auth";
import { AppError } from "@/lib/errors";
import type { SessionUser } from "@/lib/rbac";

export async function requireSessionUser(): Promise<SessionUser> {
  const session = await auth();
  if (!session?.user?.id || !session.user.role) {
    throw new AppError("Unauthorized", 401, "unauthorized");
  }
  return {
    id: session.user.id,
    email: session.user.email,
    name: session.user.name,
    role: session.user.role,
    schoolId: session.user.schoolId,
  };
}
