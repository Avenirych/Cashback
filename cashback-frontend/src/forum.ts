export const FORUM_API_URL = "http://localhost:3001";

export interface ForumUserData {
  id: number;
  user_id: number;
  username: string;
  avatar_url: string | null;
  created_at: string;
  agreed_to_rules: boolean;
  agreed_to_rules_at: string | null;
  updated_at: string;
  banned: boolean;
}

export interface ForumAuthor {
  id: number | null;
  username: string;
  avatar_url: string | null;
  created_at: string | null;
}

export function forumAvatarUrl(path?: string | null): string | undefined {
  if (!path) return undefined;
  try {
    const url = new URL(path, `${FORUM_API_URL}/`);
    if (url.origin !== new URL(FORUM_API_URL).origin || url.username || url.password) return undefined;
    return url.href;
  } catch {
    return undefined;
  }
}

export function validateForumAvatar(file?: File): boolean {
  return !file || (file.size > 0 && file.size <= 500 * 1024 && ["image/jpeg", "image/png", "image/webp"].includes(file.type));
}
