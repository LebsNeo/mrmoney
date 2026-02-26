export default function OnboardingLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      {/* Header */}
      <header className="w-full bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-center">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-teal-700 flex items-center justify-center">
            <span className="text-sm font-bold text-white">M</span>
          </div>
          <span className="text-lg font-bold text-slate-900">MrMoney</span>
        </div>
      </header>

      {/* Content */}
      <main className="flex-1 flex flex-col items-center justify-start py-10 px-4">
        {children}
      </main>
    </div>
  );
}
