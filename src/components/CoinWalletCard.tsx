import { useState } from 'react';
import {
  Coins,
  Crown,
  Gift,
  History,
} from 'lucide-react';
import type { UserProfile } from '../types';
import { CoinTransactionHistoryModal } from './CoinTransactionHistoryModal';

interface CoinWalletCardProps {
  user: UserProfile;
  cardClass?: string;
  onOpenGiftModal: (mode: 'gift' | 'self') => void;
  onOpenHistoryModal?: () => void;
}

const TIER_PREVIEW = [
  { days: 1, cost: 1000, label: '1 Hari Prem' },
  { days: 3, cost: 3000, label: '3 Hari Prem' },
  { days: 7, cost: 6500, label: '7 Hari Prem' },
  { days: 30, cost: 25000, label: '30 Hari Prem' },
];

export function CoinWalletCard({
  user,
  cardClass = 'bg-white dark:bg-[#13151C] border-slate-200 dark:border-white/[0.07]',
  onOpenGiftModal,
  onOpenHistoryModal,
}: CoinWalletCardProps) {
  const [internalHistoryOpen, setInternalHistoryOpen] = useState(false);

  const coins = Math.max(0, Math.floor(Number(user.coins ?? 0)));
  const totalEarned = Math.max(coins, Math.floor(Number(user.totalCoinsEarned ?? coins)));
  const totalGiftsSent = Math.max(0, Math.floor(Number(user.totalGiftsSent ?? 0)));
  const isFounder = user.role === 'founder';

  const handleOpenHistory = () => {
    if (onOpenHistoryModal) {
      onOpenHistoryModal();
    } else {
      setInternalHistoryOpen(true);
    }
  };

  return (
    <>
      <div className={`rounded-2xl border p-4 sm:p-5 shadow-sm dark:shadow-none ${cardClass}`}>
        {/* Header */}
        <div className="flex flex-wrap items-center justify-between gap-3 pb-3.5 border-b border-slate-100 dark:border-white/[0.06]">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-9 h-9 rounded-xl bg-amber-500/15 border border-amber-500/30 text-amber-500 flex items-center justify-center shrink-0">
              <Coins className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <h3 className="text-sm sm:text-base font-extrabold text-slate-900 dark:text-white">
                Dompet Koin &amp; Bagi Prem
              </h3>
              <p className="text-[11px] text-slate-500 dark:text-[#9CA3AF]">
                Naik level &amp; misi harian dapat Koin · Tukar atau bagikan Premium ke teman
              </p>
            </div>
          </div>

          <div className="text-right">
            <p className="text-lg sm:text-xl font-extrabold text-amber-600 dark:text-amber-400 font-mono tabular-nums leading-none">
              {coins.toLocaleString('id-ID')} Koin
            </p>
            <p className="text-[10px] text-slate-500 dark:text-gray-400 mt-1 font-mono tabular-nums">
              Total didapat: {totalEarned.toLocaleString('id-ID')} · Gift terkirim: {totalGiftsSent}
            </p>
          </div>
        </div>

        {/* Tier Affordability Matrix */}
        <div className="py-3.5 grid grid-cols-2 sm:grid-cols-4 gap-2">
          {TIER_PREVIEW.map((tier) => {
            const ready = coins >= tier.cost;
            return (
              <button
                key={tier.days}
                type="button"
                onClick={() => onOpenGiftModal('gift')}
                className={`rounded-xl border p-2.5 text-left transition-colors ${
                  ready
                    ? 'bg-amber-500/[0.07] border-amber-500/30 hover:border-amber-500/60'
                    : 'bg-slate-50 dark:bg-white/[0.02] border-slate-200 dark:border-white/[0.06] opacity-75 hover:opacity-100'
                }`}
              >
                <p className="text-xs font-extrabold text-slate-900 dark:text-white font-mono tabular-nums">
                  {tier.cost.toLocaleString('id-ID')} Koin
                </p>
                <p className="text-[11px] font-bold text-[#E84A18] mt-0.5">{tier.label}</p>
                <p className="text-[10px] text-slate-500 dark:text-gray-400 mt-0.5">
                  {ready ? 'Siap dibagikan' : `Kurang ${(tier.cost - coins).toLocaleString('id-ID')}`}
                </p>
              </button>
            );
          })}
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap items-center justify-between gap-2.5 pt-1">
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => onOpenGiftModal('gift')}
              className="min-h-[40px] px-4 rounded-xl bg-[#E84A18] hover:bg-[#F35B2B] text-white text-xs font-extrabold inline-flex items-center gap-1.5 shadow-sm transition-colors whitespace-nowrap"
            >
              <Gift className="w-3.5 h-3.5" />
              <span>Bagi Prem ke Member</span>
            </button>

            {!isFounder && (
              <button
                type="button"
                onClick={() => onOpenGiftModal('self')}
                className="min-h-[40px] px-3.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-white/[0.07] dark:hover:bg-white/[0.12] text-slate-800 dark:text-gray-100 text-xs font-bold inline-flex items-center gap-1.5 transition-colors whitespace-nowrap"
              >
                <Crown className="w-3.5 h-3.5 text-amber-500" />
                <span>Tukar untuk Diri Sendiri</span>
              </button>
            )}
          </div>

          <button
            type="button"
            onClick={handleOpenHistory}
            className="min-h-[40px] px-3.5 rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 hover:bg-slate-100 dark:bg-white/[0.04] dark:hover:bg-white/[0.08] text-xs font-bold text-slate-700 dark:text-gray-200 inline-flex items-center gap-1.5 transition-colors whitespace-nowrap"
          >
            <History className="w-3.5 h-3.5 text-amber-500" />
            <span>Coin Transaction History</span>
          </button>
        </div>
      </div>

      {!onOpenHistoryModal && (
        <CoinTransactionHistoryModal
          open={internalHistoryOpen}
          onClose={() => setInternalHistoryOpen(false)}
          user={user}
          onOpenGiftModal={onOpenGiftModal}
        />
      )}
    </>
  );
}
