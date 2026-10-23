import { useEffect, useState } from "react";

export function PWAInstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [showPrompt, setShowPrompt] = useState(false);

  useEffect(() => {
    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setShowPrompt(true);
    };

    window.addEventListener('beforeinstallprompt', handler);

    return () => {
      window.removeEventListener('beforeinstallprompt', handler);
    };
  }, []);

  const handleInstall = async () => {
    if (!deferredPrompt) return;

    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    
    if (outcome === 'accepted') {
      console.log('User accepted the install prompt');
    } else {
      console.log('User dismissed the install prompt');
    }
    
    setDeferredPrompt(null);
    setShowPrompt(false);
  };

  const handleDismiss = () => {
    setShowPrompt(false);
  };

  if (!showPrompt) return null;

  return (
    <div className="fixed bottom-4 left-4 right-4 md:left-auto md:right-4 md:w-96 bg-gradient-to-r from-green-600 to-emerald-700 text-white rounded-xl shadow-2xl p-4 z-50 animate-in slide-in-from-bottom-4 duration-300">
      <div className="flex items-start gap-3">
        <div className="flex-1">
          <h3 className="font-semibold text-lg">Instala RAMA Multi-services</h3>
          <p className="text-sm text-green-100 mt-1">
            Instala la app en tu celular para acceso rápido y mejor experiencia.
          </p>
        </div>
        <button
          onClick={handleDismiss}
          className="text-green-200 hover:text-white transition-colors"
          aria-label="Cerrar"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
      <div className="flex gap-2 mt-3">
        <button
          onClick={handleInstall}
          className="flex-1 bg-white text-green-700 font-semibold py-2 px-4 rounded-lg hover:bg-green-50 transition-colors"
        >
          Instalar
        </button>
        <button
          onClick={handleDismiss}
          className="flex-1 bg-green-700 text-white font-semibold py-2 px-4 rounded-lg hover:bg-green-800 transition-colors"
        >
          Ahora no
        </button>
      </div>
    </div>
  );
}