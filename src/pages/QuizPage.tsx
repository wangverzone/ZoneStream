import React, { useState } from 'react';
import { Sparkles, Trophy, CheckCircle2, XCircle, RefreshCw, ArrowLeft, Award } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { Layout } from '../components/Layout';
import { useAuth } from '../context/AuthContext';

interface QuizQuestion {
  id: number;
  question: string;
  options: string[];
  correctIndex: number;
  explanation: string;
}

const TRIVIA_QUESTIONS: QuizQuestion[] = [
  {
    id: 1,
    question: 'Siapakah nama tokoh utama dalam donghua legendaris "Renegade Immortal" (Xian Ni)?',
    options: ['Han Li', 'Wang Lin', 'Bai Xiaochun', 'Meng Hao'],
    correctIndex: 1,
    explanation: 'Wang Lin adalah protagonis utama yang gigih menempuh jalan kultivasi menentang langit di Renegade Immortal.',
  },
  {
    id: 2,
    question: 'Apa nama teknik pedang atau aliran kultivasi utama yang membuat One Piece mendunia?',
    options: ['Haki & Buah Iblis', 'Qi Kultivasi', 'Ninjutsu', 'Alkimia Barat'],
    correctIndex: 0,
    explanation: 'One Piece terkenal dengan kekuatan Buah Iblis dan sistem Haki (Armament, Observation, Conqueror).',
  },
  {
    id: 3,
    question: 'Dalam donghua "Tales of Herding Gods", siapakah Qin Mu dibesarkan?',
    options: ['Keluarga Kerajaan', 'Desa Penghuni Surga / Desa Orang Tua', 'Sekte Pedang Langit', 'Klan Naga'],
    correctIndex: 1,
    explanation: 'Qin Mu dibesarkan oleh para tetua sakti di Desa Besar (Great Ruins / Village of Disabled Elders).',
  },
  {
    id: 4,
    question: 'Apa hadiah utama yang didapatkan pengguna VIP di ZoneStream & Wibuku?',
    options: ['Bebas Iklan 100% & 2x EXP', 'Koin Emas Palsu', 'Wallpaper HD', 'Tiket Bioskop'],
    correctIndex: 0,
    explanation: 'User VIP mendapatkan akses bebas iklan 100%, 2x EXP Nonton, Lencana Verified VIP, Stiker & Tema Eksklusif.',
  },
];

export function QuizPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [currentIndex, setCurrentIndex] = useState(0);
  const [selectedOption, setSelectedOption] = useState<number | null>(null);
  const [score, setScore] = useState(0);
  const [showResult, setShowResult] = useState(false);
  const [answered, setAnswered] = useState(false);

  const currentQ = TRIVIA_QUESTIONS[currentIndex];

  const handleSelectOption = (idx: number) => {
    if (answered) return;
    setSelectedOption(idx);
    setAnswered(true);
    if (idx === currentQ.correctIndex) {
      setScore((prev) => prev + 1);
    }
  };

  const handleNext = () => {
    if (currentIndex < TRIVIA_QUESTIONS.length - 1) {
      setCurrentIndex((prev) => prev + 1);
      setSelectedOption(null);
      setAnswered(false);
    } else {
      setShowResult(true);
    }
  };

  const restartQuiz = () => {
    setCurrentIndex(0);
    setSelectedOption(null);
    setScore(0);
    setShowResult(false);
    setAnswered(false);
  };

  return (
    <Layout>
      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-6">
        <div className="flex items-center justify-between mb-6">
          <button
            type="button"
            onClick={() => navigate('/')}
            className="px-3.5 py-2 rounded-xl bg-white dark:bg-[#14161D] border border-slate-200 dark:border-white/5 text-xs font-bold text-slate-900 dark:text-white flex items-center gap-2 shadow-sm"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Kembali ke Beranda</span>
          </button>
          <div className="flex items-center gap-2 px-3.5 py-1.5 rounded-xl bg-[#E84A18]/15 text-[#E84A18] text-xs font-extrabold">
            <Trophy className="w-4 h-4" />
            <span>Arena Kuis Wibu (+EXP)</span>
          </div>
        </div>

        {!showResult ? (
          <div className="rounded-3xl bg-white dark:bg-[#14161D] border border-slate-200 dark:border-white/10 p-6 sm:p-8 shadow-xl">
            <div className="flex items-center justify-between mb-6">
              <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                Pertanyaan {currentIndex + 1} dari {TRIVIA_QUESTIONS.length}
              </span>
              <span className="px-2.5 py-1 rounded-lg bg-amber-500/15 text-amber-600 dark:text-amber-300 text-xs font-extrabold">
                Skor: {score * 50} EXP
              </span>
            </div>

            <h2 className="text-base sm:text-lg font-extrabold text-slate-900 dark:text-white mb-6 leading-snug">
              {currentQ.question}
            </h2>

            <div className="space-y-3 mb-6">
              {currentQ.options.map((opt, idx) => {
                let btnStyle = 'bg-slate-50 dark:bg-[#1B1E2B] border-slate-200 dark:border-white/5 text-slate-800 dark:text-gray-200 hover:border-[#E84A18]';
                if (answered) {
                  if (idx === currentQ.correctIndex) {
                    btnStyle = 'bg-emerald-500/20 border-emerald-500 text-emerald-700 dark:text-emerald-300 font-bold';
                  } else if (idx === selectedOption) {
                    btnStyle = 'bg-rose-500/20 border-rose-500 text-rose-700 dark:text-rose-300';
                  }
                }

                return (
                  <button
                    key={opt}
                    type="button"
                    disabled={answered}
                    onClick={() => handleSelectOption(idx)}
                    className={`w-full p-4 rounded-2xl border text-left text-xs sm:text-sm font-semibold flex items-center justify-between transition-all ${btnStyle}`}
                  >
                    <span>{opt}</span>
                    {answered && idx === currentQ.correctIndex && (
                      <CheckCircle2 className="w-5 h-5 text-emerald-500 shrink-0" />
                    )}
                    {answered && idx === selectedOption && idx !== currentQ.correctIndex && (
                      <XCircle className="w-5 h-5 text-rose-500 shrink-0" />
                    )}
                  </button>
                );
              })}
            </div>

            {answered && (
              <div className="p-4 rounded-2xl bg-slate-100 dark:bg-[#1A1D28] border border-slate-200 dark:border-white/5 mb-6 text-xs text-slate-700 dark:text-gray-300">
                <p className="font-bold text-slate-900 dark:text-white mb-1">Penjelasan:</p>
                {currentQ.explanation}
              </div>
            )}

            {answered && (
              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={handleNext}
                  className="px-6 py-3 rounded-xl bg-[#E84A18] hover:bg-[#F35B2B] text-white text-xs font-bold shadow-lg shadow-[#E84A18]/25 transition-all"
                >
                  {currentIndex < TRIVIA_QUESTIONS.length - 1 ? 'Pertanyaan Selanjutnya →' : 'Lihat Hasil Kuis'}
                </button>
              </div>
            )}
          </div>
        ) : (
          <div className="rounded-3xl bg-white dark:bg-[#14161D] border border-slate-200 dark:border-white/10 p-8 text-center shadow-xl">
            <span className="w-16 h-16 rounded-3xl bg-gradient-to-br from-amber-500 to-[#E84A18] text-white flex items-center justify-center mx-auto mb-4 shadow-xl">
              <Award className="w-8 h-8" />
            </span>
            <h2 className="text-xl font-extrabold text-slate-900 dark:text-white mb-2">
              Kuis Selesai, Wibu Sejati!
            </h2>
            <p className="text-xs text-slate-500 dark:text-[#9CA3AF] mb-6">
              Kamu berhasil menjawab benar {score} dari {TRIVIA_QUESTIONS.length} pertanyaan. Total EXP yang kamu dapatkan: <strong className="text-[#E84A18]">+{score * 50} EXP</strong>.
            </p>

            <div className="flex items-center justify-center gap-3">
              <button
                type="button"
                onClick={restartQuiz}
                className="px-5 py-3 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-[#1C202C] text-slate-900 dark:text-white text-xs font-bold inline-flex items-center gap-2"
              >
                <RefreshCw className="w-4 h-4 text-[#E84A18]" />
                <span>Ulangi Kuis</span>
              </button>
              <Link
                to="/"
                className="px-6 py-3 rounded-xl bg-[#E84A18] hover:bg-[#F35B2B] text-white text-xs font-bold"
              >
                Kembali Nonton Anime
              </Link>
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
};
