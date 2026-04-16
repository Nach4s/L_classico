export default function Loading() {
  return (
    <div className="min-h-[70vh] w-full flex items-center justify-center">
      <div className="flex flex-col items-center gap-4">
        <div className="w-12 h-12 border-4 border-emerald-500/20 border-t-emerald-500 rounded-full animate-spin"></div>
        <p className="text-slate-500 font-medium text-sm animate-pulse">Загрузка данных...</p>
      </div>
    </div>
  );
}
