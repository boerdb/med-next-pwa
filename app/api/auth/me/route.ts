import { getSessionFromCookies } from '@/lib/auth/session';
import { jsonOk } from '@/lib/api/http';

export async function GET() {
  const session = await getSessionFromCookies();
  if (!session) {
    return jsonOk({ user: null });
  }
  return jsonOk({
    user: { id: session.userId, email: session.email },
  });
}
