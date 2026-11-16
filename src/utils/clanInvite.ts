export const PENDING_CLAN_INVITE_KEY = 'zonestream_pending_clan_invite_v1';
export const CLAN_INVITE_RESOLVED_EVENT = 'zonestream:clan-invite-resolved';

export interface ClanInvitePreview {
  clanId: string;
  name: string;
  tag: string;
  description?: string;
  avatarUrl?: string;
  leaderUid: string;
  leaderName: string;
  leaderPhoto?: string;
  level: number;
  charisma: number;
  membersCount: number;
  maxMembers: number;
  status: string;
  inviteCode: string;
}

export interface ClanInviteResolveResult {
  ok: boolean;
  alreadyMember?: boolean;
  inviteCode?: string;
  clan?: Partial<ClanInvitePreview>;
  message?: string;
  error?: string;
}

export function normalizeClanInviteCode(raw: string): string {
  return String(raw || '')
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '')
    .slice(0, 16);
}

/**
 * Extracts an invite code from either a raw code ("K9M4XP7Q")
 * or a full recruit link ("https://.../clan/join/K9M4XP7Q" or "?invite=K9M4XP7Q").
 */
export function extractClanInviteCodeFromInput(raw: string): string {
  const trimmed = String(raw || '').trim();
  if (!trimmed) return '';

  try {
    if (trimmed.includes('://') || trimmed.startsWith('/')) {
      const parsed = new URL(trimmed, 'https://zonestream.local');
      const queryInvite = parsed.searchParams.get('invite');
      if (queryInvite) return normalizeClanInviteCode(queryInvite);
      const joinMatch = parsed.pathname.match(/\/clan\/join\/([^/?#]+)/i);
      if (joinMatch?.[1]) return normalizeClanInviteCode(joinMatch[1]);
    }
  } catch {
    // Fallback to raw code extraction
  }

  const queryRegex = /[?&]invite=([a-zA-Z0-9_-]+)/i.exec(trimmed);
  if (queryRegex?.[1]) return normalizeClanInviteCode(queryRegex[1]);

  const pathRegex = /\/clan\/join\/([a-zA-Z0-9_-]+)/i.exec(trimmed);
  if (pathRegex?.[1]) return normalizeClanInviteCode(pathRegex[1]);

  return normalizeClanInviteCode(trimmed);
}

export function setPendingClanInvite(code: string): void {
  const clean = normalizeClanInviteCode(code);
  if (!clean) return;
  try {
    localStorage.setItem(PENDING_CLAN_INVITE_KEY, clean);
  } catch {
    // Ignore storage quota issues
  }
}

export function getPendingClanInvite(): string {
  try {
    return normalizeClanInviteCode(localStorage.getItem(PENDING_CLAN_INVITE_KEY) || '');
  } catch {
    return '';
  }
}

export function clearPendingClanInvite(): void {
  try {
    localStorage.removeItem(PENDING_CLAN_INVITE_KEY);
  } catch {
    // Ignore storage issues
  }
}

export function buildClanInviteUrl(inviteCode: string): string {
  const clean = normalizeClanInviteCode(inviteCode);
  if (typeof window === 'undefined') return `/clan/join/${clean}`;
  return `${window.location.origin}/clan/join/${encodeURIComponent(clean)}`;
}

export async function fetchClanInvitePreview(inviteCode: string): Promise<{
  ok: boolean;
  clan?: ClanInvitePreview;
  error?: string;
}> {
  const clean = normalizeClanInviteCode(inviteCode);
  if (!clean) return { ok: false, error: 'Kode rekrutmen tidak valid.' };
  try {
    const res = await fetch(`/api/social/clans/invite/${encodeURIComponent(clean)}`);
    const json = await res.json();
    if (!res.ok || !json.ok || !json.clan) {
      return { ok: false, error: json.error || 'Undangan klan tidak ditemukan.' };
    }
    return { ok: true, clan: json.clan as ClanInvitePreview };
  } catch {
    return { ok: false, error: 'Gagal memuat detail undangan klan.' };
  }
}

export async function acceptClanInvite(
  inviteCode: string,
  token: string
): Promise<ClanInviteResolveResult> {
  const clean = normalizeClanInviteCode(inviteCode);
  if (!clean) {
    return { ok: false, error: 'Kode rekrutmen tidak valid.' };
  }
  if (!token) {
    return { ok: false, error: 'Silakan login terlebih dahulu.' };
  }
  try {
    const res = await fetch('/api/social/clans/join-invite', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ inviteCode: clean }),
    });
    const json = await res.json();
    if (!res.ok || !json.ok) {
      return {
        ok: false,
        inviteCode: clean,
        error: json.error || 'Gagal bergabung melalui kode undangan.',
      };
    }
    return {
      ok: true,
      inviteCode: clean,
      alreadyMember: Boolean(json.alreadyMember),
      clan: json.clan,
      message: json.message || 'Berhasil bergabung ke klan!',
    };
  } catch {
    return {
      ok: false,
      inviteCode: clean,
      error: 'Terjadi kesalahan jaringan saat memproses undangan klan.',
    };
  }
}
