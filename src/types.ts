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
  statusEmoji?: string;
  countryCode?: string;
  lastWatchDate?: string;
  watchStreak?: number;
  dailyEpisodesWatched?: number;
  totalEpisodesWatched?: number;
  watchHistory: WatchHistoryItem[];
  bookmarks: BookmarkItem[];
  episodeBookmarks: EpisodeBookmarkItem[];
}

export interface WatchHistoryReward {
  expGained: number;
  dailyBonusGained: number;
  streak: number;
  levelUp: boolean;
  newLevel: number;
  isDoubleExp?: boolean;
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
  activeBadge: string;
  activeBorder: string;
  profileTheme: string;
  statusEmoji: string;
  countryCode?: string;
  watchStreak: number;
  totalEpisodesWatched: number;
  bookmarksCount: number;
  lastActiveAt: string;
  isOnline: boolean;
  relationship?: RelationshipStatus;
}

export interface PublicProfileDetail extends PublicCommunityUser {
  friendsCount: number;
  bookmarks: BookmarkItem[];
  recentHistory: WatchHistoryItem[];
}

export interface ChatMessageItem {
  _id: string;
  conversationId?: string;
  groupId?: string;
  senderUid: string;
  recipientUid?: string;
  senderName?: string;
  senderPhoto?: string;
  text: string;
  mediaUrl?: string;
  mediaType?: 'image' | 'video' | 'audio' | '';
  sticker?: string;
  replyToId?: string;
  replySenderName?: string;
  replyText?: string;
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
    sticker?: string;
    readAt?: string | null;
    createdAt: string;
  } | null;
}

