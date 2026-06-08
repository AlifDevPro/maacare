import { unwrapProfileEmbed } from "@/lib/community/profile-embed";

export type MappedCommunityComment = {
  id: string;
  body: string;
  createdAt: string;
  parentCommentId: string | null;
  authorId: string;
  authorDisplayName: string;
  authorRole: string;
  authorAvatarUrl: string | null;
  authorProfession: string | null;
  authorVerifiedProfessional: boolean;
};

export function mapCommunityCommentRow(row: Record<string, unknown>): MappedCommunityComment {
  const profile = unwrapProfileEmbed(row.profiles);
  return {
    id: row.id as string,
    body: row.body as string,
    createdAt: row.created_at as string,
    parentCommentId: (row.parent_comment_id as string | null) ?? null,
    authorId: row.author_id as string,
    authorDisplayName: profile?.display_name ?? "Member",
    authorRole: profile?.role ?? "user",
    authorAvatarUrl: profile?.avatar_url ?? null,
    authorProfession: profile?.profession ?? null,
    authorVerifiedProfessional: profile?.verified_professional === true,
  };
}

export const COMMUNITY_COMMENT_SELECT = `
  id,
  body,
  created_at,
  parent_comment_id,
  author_id,
  moderation_status,
  profiles!author_id (
    display_name,
    role,
    avatar_url,
    profession,
    verified_professional
  )
`;
