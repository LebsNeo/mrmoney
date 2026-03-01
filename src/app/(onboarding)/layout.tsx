export default function OnboardingLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-slate-100 flex flex-col">
      {/* Header */}
      <header className="w-full bg-white/80 backdrop-blur-sm border-b border-slate-200/70 px-6 py-4 flex items-center justify-center sticky top-0 z-10">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-teal-500 to-teal-700 flex items-center justify-center shadow-sm shadow-teal-700/20">
            <span className="text-sm font-black text-white tracking-tight">M$</span>
          </div>
          <div>
            <span className="text-base font-bold text-slate-900 leading-none block">MrMoney</span>
            <span className="text-[10px] text-teal-600/70 font-medium uppercase tracking-widest leading-none">Financial OS</span>
          </div>
        </div>
      </header>

      {/* Content */}
      <main className="flex-1 flex flex-col items-center justify-start py-8 px-4 sm:py-10">
        {children}
      </main>
    </div>
  );
}
