import React, { useState } from 'react';
import { Send, X, Radio } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

interface WatchPartySidebarProps {
  episodeId: string;
  seriesTitle: string;
  isOpen: boolean;
  onClose: () => void;
}

export const WatchPartySidebar: React.FC<WatchPartySidebarProps> = ({
  seriesTitle,
  isOpen,
  onClose,
}) => {
  const { user } = useAuth();
  const [messages, setMessages] = useState<Array<{ id: string; sender: string; text: string; time: string }>>([
    { id: '1', sender: 'VerzonFounder', text: 'Halo semuanya! Selamat menikmati Watch Party episode ini bersama-sama.', time: 'Baru saja' },
  ]);
  const [inputText, setInputText] = useState('');

  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim()) return;
    setMessages((prev) => [
      ...prev,
      {
        id: String(Date.now()),
        sender: user?.name || 'Anda',
        text: inputText.trim(),
        time: 'Baru saja',
      },
    ]);
    setInputText('');
  };

  if (!isOpen) return null;

  return (
    <div className="w-full lg:w-80 h-[500px] lg:h-auto rounded-2xl bg-white dark:bg-[#14161F] border border-slate-200 dark:border-white/10 flex flex-col shadow-2xl overflow-hidden shrink-0">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 bg-slate-50 dark:bg-[#1A1D28] border-b border-slate-200 dark:border-white/5">
        <div className="flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
          <div>
            <h4 className="text-xs font-extrabold text-slate-900 dark:text-white flex items-center gap-1">
              <Radio className="w-3.5 h-3.5 text-[#E84A18]" /> Watch Party (Nobar)
            </h4>
            <p className="text-[10px] text-slate-500 dark:text-gray-400 truncate max-w-[180px]">
              {seriesTitle}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <span className="px-2 py-0.5 rounded-md bg-[#E84A18]/20 text-[#E84A18] text-[10px] font-bold">
            3 Online
          </span>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-900 dark:hover:text-white"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 p-3 space-y-2.5 overflow-y-auto">
        {messages.map((m) => (
          <div key={m.id} className="p-2.5 rounded-xl bg-slate-50 dark:bg-[#1A1D26] border border-slate-100 dark:border-white/5">
            <div className="flex items-center justify-between mb-1">
              <span className="text-[11px] font-bold text-[#E84A18] truncate">{m.sender}</span>
              <span className="text-[9px] text-slate-400 font-mono">{m.time}</span>
            </div>
            <p className="text-xs text-slate-800 dark:text-gray-200 break-words">{m.text}</p>
          </div>
        ))}
      </div>

      {/* Input */}
      <form onSubmit={handleSendMessage} className="p-3 border-t border-slate-200 dark:border-white/5 flex gap-2">
        <input
          type="text"
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          placeholder="Kirim pesan Watch Party..."
          className="flex-1 h-9 px-3 rounded-xl bg-slate-100 dark:bg-[#1C202C] border border-slate-200 dark:border-white/10 text-xs text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:border-[#E84A18]"
        />
        <button
          type="submit"
          className="w-9 h-9 rounded-xl bg-[#E84A18] hover:bg-[#F35B2B] text-white flex items-center justify-center transition-colors shrink-0"
        >
          <Send className="w-4 h-4" />
        </button>
      </form>
    </div>
  );
};
