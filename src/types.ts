export interface WatchHistoryItem {
  id: string;
  type: 'anime' | 'donghua';
  title: string;
  poster: string;
  episodeId: string;
  episodeTitle: string;
  episodeNumber: string;
  progress: number;
  updatedAt: string;
}

export interface BookmarkItem {
  id: string;
  type: 'anime' | 'donghua';
  title: string;
  poster: string;
  rating: string;
  status: string;
  addedAt: string;
}

export interface EpisodeBookmarkItem {
  id: string;
  type: 'anime' | 'donghua';
  title: string;
  poster: string;
  episodeId: string;
  episodeTitle: string;
  episodeNumber: string;
  addedAt: string;
}

export interface UserProfile {
  uid: string;
  username: string;
  email: string;
  name: string;
  bio?: string;
  role: 'member' | 'founder';
  photoUrl: string;
  bannerUrl: string;
  level: number;
  exp: number;
  isPremium: boolean;
  isVerified: boolean;
  premiumPlan?: string;
  premiumExpiryDate?: string | null;
  activeBadge: string;
  activeBorder: string;
  profileTheme?: string;
  profileBgColor?: string;
  statusEmoji?: string;
  countryCode?: string;
  lastWatchDate?: string;
  watchStreak?: number;
  longestStreak?: number;
  streakDates?: string[];
  unlockedStreakFrames?: string[];
  dailyEpisodesWatched?: number;
  totalEpisodesWatched?: number;
  totalWatchMinutes?: number;
  totalCommentsCount?: number;
  coins?: number;
  totalCoinsEarned?: number;
  totalCoinsSpent?: number;
  totalGiftsSent?: number;
  totalGiftsReceived?: number;
  lastCheckInAt?: string;
  checkInStreak?: number;
  longestCheckInStreak?: number;
  totalCheckIns?: number;
  checkInDates?: string[];
  charisma?: number;
  isBanned?: boolean;
  banReason?: string;
  isOnline?: boolean;
  lastActiveAt?: string;
  lastLoginAt?: string;
  dbSyncedAt?: string;
  watchHistory: WatchHistoryItem[];
  bookmarks: BookmarkItem[];
  episodeBookmarks: EpisodeBookmarkItem[];
}

export interface FounderMonitorUser {
  uid: string;
  username: string;
  email: string;
  name: string;
  photoUrl: string;
  role: 'member' | 'founder';
  isPremium: boolean;
  isVerified: boolean;
  activeBadge: string;
  activeBorder: string;
  level: number;
  exp?: number;
  coins?: number;
  totalCoinsEarned?: number;
  totalCoinsSpent?: number;
  totalGiftsSent?: number;
  totalGiftsReceived?: number;
  premiumPlan?: string;
  premiumExpiryDate?: string | null;
  countryCode: string;
  watchStreak: number;
  isBanned: boolean;
  bannedAt: string;
  banReason: string;
  lastActiveAt: string;
  lastLoginAt: string;
  createdAt: string;
  isOnline: boolean;
  isRecentlyLoggedIn: boolean;
}

export interface WatchHistoryReward {
  expGained: number;
  dailyBonusGained: number;
  streak: number;
  longestStreak?: number;
  levelUp: boolean;
  newLevel: number;
  coinsGained?: number;
  newCoins?: number;
  isDoubleExp?: boolean;
  newlyUnlockedFrame?: { id: string; name: string; minStreak: number } | null;
}

export interface CoinPremiumPackage {
  id: string;
  name: string;
  coinCost: number;
  durationDays: number;
  bonusExp: number;
  badgeTag?: string;
  description: string;
}

export interface CoinLedgerEntry {
  txId: string;
  uid: string;
  type:
    | 'daily_checkin'
    | 'level_up'
    | 'milestone_bonus'
    | 'gift_sent'
    | 'gift_received'
    | 'self_redeem'
    | 'refund'
    | 'founder_adjust';
  amount: number;
  balanceAfter: number;
  peerUid?: string;
  peerName?: string;
  peerUsername?: string;
  packageId?: string;
  durationDays?: number;
  note: string;
  createdAt: string;
}

export interface FounderGlobalPaymentItem {
  orderId: string;
  uid: string;
  userName: string;
  username?: string;
  userEmail?: string;
  planId: string;
  planName: string;
  durationDays: number;
  amount: number;
  totalPayment: number;
  paymentMethod: string;
  status: 'pending' | 'paid' | 'expired' | 'failed';
  verificationStage?: string;
  paidAt?: string | null;
  createdAt: string;
}

export interface FounderGlobalCoinTxItem {
  txId: string;
  uid: string;
  userName: string;
  username?: string;
  type: CoinLedgerEntry['type'];
  amount: number;
  balanceAfter: number;
  peerUid?: string;
  peerName?: string;
  peerUsername?: string;
  packageId?: string;
  durationDays?: number;
  note: string;
  createdAt: string;
}

export interface FounderGlobalTransactionsSummary {
  totalPayments: number;
  paidPayments: number;
  pendingPayments: number;
  totalRevenueIdr: number;
  totalCoinTransactions: number;
  totalCoinsIssued: number;
  totalCoinsSpent: number;
}

export interface PremiumPackage {
  id: string;
  name: string;
  amount: number;
  durationDays: number;
  bonusExp: number;
  tagline: string;
  popular?: boolean;
}

export interface PaymentTransaction {
  orderId: string;
  txnId?: string;
  uid: string;
  userEmail?: string;
  userName?: string;
  planId: string;
  planName: string;
  durationDays: number;
  bonusExp: number;
  amount: number;
  fee: number;
  totalPayment: number;
  paymentMethod: string;
  paymentNumber: string;
  paymentUrl: string;
  status: 'pending' | 'paid' | 'expired' | 'failed';
  verificationStage?: 'awaiting_payment' | 'verifying_proof' | 'verified' | 'rejected';
  verificationMethod?: 'pakasir_webhook' | 'pakasir_polling' | 'transfer_proof_auto';
  proofImageUrl?: string;
  proofStoragePath?: string;
  proofSenderRef?: string;
  proofSubmittedAt?: string;
  expiredAt?: string;
  paidAt?: string | null;
}

export interface CommentItem {
  _id: string;
  mediaKey: string;
  mediaTitle: string;
  episodeTitle?: string;
  parentId?: string;
  uid: string;
  authorName: string;
  authorPhoto: string;
  authorBanner?: string;
  authorRole: 'member' | 'founder';
  authorIsPremium: boolean;
  authorBadge: string;
  authorBorder: string;
  authorTheme?: string;
  authorStatusEmoji?: string;
  authorCountry?: string;
  authorLevel: number;
  text: string;
  sticker?: string;
  likes: string[];
  pinned: boolean;
  createdAt: string;
}

export interface HeroSlide {
  id: string;
  episodeId?: string;
  type: 'anime' | 'donghua';
  title: string;
  episodeLabel?: string;
  poster: string;
  backdrop: string;
  hasWideBanner?: boolean;
  rating: string;
  status: string;
  description: string;
  genres: string[];
}

export interface MediaCardItem {
  id: string;
  episodeId?: string;
  type: 'anime' | 'donghua';
  title: string;
  episodeLabel?: string;
  poster: string;
  status: string;
  rating: string;
  isNew?: boolean;
  releaseDate?: string;
  genres?: string[];
}

export interface ScheduleDay {
  day: string;
  items: MediaCardItem[];
}

export interface EpisodeItem {
  episodeId: string;
  title: string;
  episodeNumber: string;
  releaseDate?: string;
}

export interface MediaDetail {
  id: string;
  type: 'anime' | 'donghua';
  title: string;
  altTitle?: string;
  poster: string;
  backdrop: string;
  hasWideBanner?: boolean;
  rating: string;
  status: string;
  studio: string;
  duration: string;
  released: string;
  synopsis: string;
  genres: string[];
  episodes: EpisodeItem[];
  seasons?: MediaCardItem[];
}

export interface StreamServer {
  name: string;
  url?: string;
  serverId?: string;
  quality?: string;
  streamType?: 'mp4' | 'hls' | 'embed';
}

export interface EpisodeStreamData {
  episodeId: string;
  seriesId: string;
  seriesTitle: string;
  poster: string;
  type: 'anime' | 'donghua';
  title: string;
  episodeNumber: string;
  defaultStreamingUrl: string;
  servers: StreamServer[];
  prevEpisode: { episodeId: string; title: string } | null;
  nextEpisode: { episodeId: string; title: string } | null;
  episodesList: EpisodeItem[];
}

export type RelationshipStatus =
  | 'self'
  | 'friend'
  | 'pending_sent'
  | 'pending_received'
  | 'none';

export interface PublicCommunityUser {
  uid: string;
  username: string;
  name: string;
  bio: string;
  role: 'member' | 'founder';
  photoUrl: string;
  bannerUrl: string;
  level: number;
  exp: number;
  isPremium: boolean;
  isVerified: boolean;
  premiumPlan?: string;
  premiumExpiryDate?: string | null;
  activeBadge: string;
  activeBorder: string;
  profileTheme: string;
  profileBgColor?: string;
  statusEmoji: string;
  countryCode?: string;
  watchStreak: number;
  totalEpisodesWatched: number;
  totalWatchMinutes?: number;
  totalCommentsCount?: number;
  bookmarksCount: number;
  charisma?: number;
  clan?: string;
  clanName?: string;
  clanRank?: number;
  isClanLeader?: boolean;
  topRank?: number | null;
  topCategory?: 'charisma' | 'watchtime' | 'level' | null;
  charismaRank?: number;
  watchRank?: number;
  levelRank?: number;
  lastActiveAt: string;
  isOnline: boolean;
  relationship?: RelationshipStatus;
}

export interface PublicProfileDetail extends PublicCommunityUser {
  friendsCount: number;
  hasLiked?: boolean;
  canViewVipExpiry?: boolean;
  bookmarks: BookmarkItem[];
  recentHistory: WatchHistoryItem[];
}

export interface ChatMessageItem {
  _id: string;
  channel?: string;
  conversationId?: string;
  groupId?: string;
  senderUid: string;
  recipientUid?: string;
  senderName?: string;
  senderUsername?: string;
  senderPhoto?: string;
  senderRole?: 'member' | 'founder';
  senderIsPremium?: boolean;
  senderBadge?: string;
  senderBorder?: string;
  senderStatusEmoji?: string;
  senderLevel?: number;
  senderCharisma?: number;
  senderClan?: {
    tag: string;
    name: string;
    level?: number;
    isLeader?: boolean;
    clanRank?: number;
  } | null;
  senderTopRank?: number | null;
  senderTopCategory?: 'charisma' | 'watchtime' | 'level' | null;
  text: string;
  mediaUrl?: string;
  mediaType?: 'image' | 'video' | 'audio' | '';
  sticker?: string;
  replyToId?: string;
  replySenderUid?: string;
  replySenderName?: string;
  replySenderIsVerified?: boolean;
  replyText?: string;
  reactions?: Record<string, string[]>;
  editedAt?: string | null;
  readAt?: string | null;
  createdAt: string;
}

export interface ChatConversationSummary {
  peer: PublicCommunityUser;
  unreadCount: number;
  lastMessage: {
    _id: string;
    senderUid: string;
    text: string;
    mediaType?: string;
    sticker?: string;
    readAt?: string | null;
    createdAt: string;
  } | null;
}

export type UserNotificationType =
  | 'favorite_episode'
  | 'comment_reply'
  | 'comment_like'
  | 'friend_request'
  | 'friend_accept'
  | 'clan_review'
  | 'system';

export interface UserNotificationItem {
  _id: string;
  uid: string;
  type: UserNotificationType;
  title: string;
  message: string;
  link: string;
  poster?: string;
  actorUid?: string;
  actorName?: string;
  actorPhoto?: string;
  isRead: boolean;
  createdAt: string;
}


