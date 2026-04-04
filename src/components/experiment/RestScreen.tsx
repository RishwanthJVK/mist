const RestScreen = () => {
  return (
    <div className="fixed inset-0 flex flex-col items-center justify-center bg-[#0B0F1A] space-y-4 overflow-hidden font-sans">
      <h1 className="text-7xl font-black text-primary tracking-tighter uppercase italic drop-shadow-sm">
        Rest State
      </h1>
      <div className="flex flex-col items-center gap-6">
        <p className="text-xl font-bold text-slate-300 tracking-tight uppercase tracking-[0.15em] opacity-80">
          waiting for admin action
        </p>
        <div className="flex gap-2.5">
          <div className="w-3 h-3 rounded-full bg-primary animate-bounce [animation-delay:-0.3s] shadow-[0_0_12px_rgba(59,130,246,0.3)]" />
          <div className="w-3 h-3 rounded-full bg-primary animate-bounce [animation-delay:-0.15s] shadow-[0_0_12px_rgba(59,130,246,0.3)]" />
          <div className="w-3 h-3 rounded-full bg-primary animate-bounce shadow-[0_0_12px_rgba(59,130,246,0.3)]" />
        </div>
      </div>
    </div>
  );
};

export default RestScreen;
