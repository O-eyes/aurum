export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-br from-gold-400 to-gold-600 mb-4 shadow-md ring-2 ring-gold-200">
            <span className="text-white font-bold text-lg font-serif">Au</span>
          </div>
          <h1 className="text-2xl font-bold text-gray-900">Aurum</h1>
          <p className="text-sm text-gray-500 mt-1">
            Gold-backed digital tokens
          </p>
        </div>
        {children}
      </div>
    </div>
  );
}
