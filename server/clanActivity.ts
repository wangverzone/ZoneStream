import {
  connectDB,
  findUserByUid,
  isDbMongoConnected,
  readFallbackJson,
  writeFallbackJson,
} from './db.ts';
import { ClanModel } from './models/Clan.ts';
import {
  ClanActivityModel,
  type ClanActivityType,
  type IClanActivity,
} from './models/ClanActivity.ts';

interface StoredClanActivity extends Omit<IClanActivity, 'createdAt'> {
  _id: string;
  createdAt: string;
}

export interface SerializedClanActivity {
  _id: string;
  clanId: string;
  actorUid: string;
  actorName: string;
  actorPhoto: string;
  type: ClanActivityType;
  title: string;
  detail: string;
  expGained: number;
  newLevel: number;
  streakDay: number;
  createdAt: string;
}

const FALLBACK_FILE = 'clan-activity-v1.json';
const MAX_PER_CLAN = 100;

function serialize(doc: any): SerializedClanActivity {
  return {
    _id: String(doc._id || ''),
    clanId: String(doc.clanId || ''),
    actorUid: String(doc.actorUid || ''),
    actorName: String(doc.actorName || 'Member'),
    actorPhoto: String(doc.actorPhoto || ''),
    type: (doc.type || 'mission_complete') as ClanActivityType,
    title: String(doc.title || ''),
    detail: String(doc.detail || ''),
    expGained: Number(doc.expGained || 0),
    newLevel: Number(doc.newLevel || 0),
    streakDay: Number(doc.streakDay || 0),
    createdAt: doc.createdAt
      ? new Date(doc.createdAt).toISOString()
      : new Date().toISOString(),
  };
}

async function findClanIdForUser(uid: string): Promise<string | null> {
  if (!uid) return null;
  await connectDB();

  if (isDbMongoConnected()) {
    const clan = await ClanModel.findOne({
      $or: [{ leaderUid: uid }, { members: uid }],
    })
      .select('clanId')
      .lean();
    return clan?.clanId ? String(clan.clanId) : null;
  }

  const clans = readFallbackJson<any[]>('clans-v1.json', []);
  const found = clans.find(
    (c) =>
      c.leaderUid === uid ||
      (Array.isArray(c.members) && c.members.includes(uid))
  );
  return found?.clanId ? String(found.clanId) : null;
}

export interface RecordClanActivityInput {
  clanId?: string;
  actorUid: string;
  actorName?: string;
  actorPhoto?: string;
  type: ClanActivityType;
  title: string;
  detail?: string;
  expGained?: number;
  newLevel?: number;
  streakDay?: number;
}

export async function recordClanActivity(
  input: RecordClanActivityInput
): Promise<SerializedClanActivity | null> {
  try {
    const actorUid = String(input.actorUid || '').trim();
    if (!actorUid) return null;

    const clanId = input.clanId || (await findClanIdForUser(actorUid));
    if (!clanId) return null;

    let actorName = String(input.actorName || '').trim();
    let actorPhoto = String(input.actorPhoto || '').trim();
    if (!actorName) {
      const user = await findUserByUid(actorUid);
      actorName = user?.name || user?.username || `User ${actorUid}`;
      actorPhoto = actorPhoto || user?.photoUrl || '';
    }

    const payload: IClanActivity = {
      clanId,
      actorUid,
      actorName: actorName.slice(0, 80),
      actorPhoto,
      type: input.type,
      title: String(input.title || '').trim().slice(0, 140),
      detail: String(input.detail || '').trim().slice(0, 280),
      expGained: Math.max(0, Number(input.expGained || 0)),
      newLevel: Math.max(0, Number(input.newLevel || 0)),
      streakDay: Math.max(0, Number(input.streakDay || 0)),
    };

    if (!payload.title) return null;

    await connectDB();

    if (isDbMongoConnected()) {
      const created = await ClanActivityModel.create(payload);
      return serialize(created.toObject());
    }

    const all = readFallbackJson<StoredClanActivity[]>(FALLBACK_FILE, []);
    const memDoc: StoredClanActivity = {
      ...payload,
      _id: `ca_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      createdAt: new Date().toISOString(),
    };
    all.unshift(memDoc);

    const counts = new Map<string, number>();
    const bounded = all.filter((item) => {
      const c = (counts.get(item.clanId) || 0) + 1;
      counts.set(item.clanId, c);
      return c <= MAX_PER_CLAN;
    });
    writeFallbackJson(FALLBACK_FILE, bounded);
    return serialize(memDoc);
  } catch (err) {
    console.warn('[Clan Activity Record Notice]', (err as Error).message);
    return null;
  }
}

export async function getClanActivitiesRaw(
  clanId: string,
  limit = 60
): Promise<SerializedClanActivity[]> {
  await connectDB();

  if (isDbMongoConnected()) {
    const docs = await ClanActivityModel.find({ clanId })
      .sort({ createdAt: -1 })
      .limit(limit)
      .lean();
    return docs.map(serialize);
  }

  const all = readFallbackJson<StoredClanActivity[]>(FALLBACK_FILE, []);
  return all
    .filter((item) => item.clanId === clanId)
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, limit)
    .map(serialize);
}
