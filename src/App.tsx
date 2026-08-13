/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useEffect, useState } from "react";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import LandingPage from "./pages/LandingPage";
import PublicMenu from "./pages/PublicMenu";
import Dashboard from "./pages/Dashboard";
import SuperAdmin from "./pages/SuperAdmin";
import Auth from "./pages/Auth";
import Onboarding from "./pages/Onboarding";
import { AlertCircle, CheckCircle2, XCircle, Info } from "lucide-react";

function GlobalAlertPopout() {
  const [alertState, setAlertState] = useState<{ message: string } | null>(null);

  useEffect(() => {
    const handleAlert = (e: Event) => {
      const customEvent = e as CustomEvent<{ message: string }>;
      setAlertState({ message: customEvent.detail.message });
    };

    // Override the native browser alert globally
    window.alert = (message: string) => {
      const event = new CustomEvent("show-custom-alert", { detail: { message } });
      window.dispatchEvent(event);
    };

    window.addEventListener("show-custom-alert", handleAlert);
    return () => {
      window.removeEventListener("show-custom-alert", handleAlert);
    };
  }, []);

  if (!alertState) return null;

  const msgLower = alertState.message.toLowerCase();
  
  // Categorize for custom titles and icons
  const isSuccess = msgLower.includes("sucesso") || msgLower.includes("conectada") || msgLower.includes("conectado");
  const isError = msgLower.includes("erro") || msgLower.includes("falha") || msgLower.includes("limite") || msgLower.includes("inválido") || msgLower.includes("inativa") || msgLower.includes("não encontrada") || msgLower.includes("não possui") || msgLower.includes("vazio");

  let title = "Aviso";
  let icon = <AlertCircle size={28} className="stroke-[2.5]" />;
  let headerColor = "bg-orange-500";
  let iconBg = "bg-orange-50 text-orange-600";
  let buttonColor = "bg-orange-600 hover:bg-orange-700 shadow-orange-600/15";

  if (isSuccess) {
    title = "Sucesso!";
    icon = <CheckCircle2 size={28} className="stroke-[2.5]" />;
    headerColor = "bg-emerald-500";
    iconBg = "bg-emerald-50 text-emerald-600";
    buttonColor = "bg-emerald-600 hover:bg-emerald-700 shadow-emerald-600/15";
  } else if (isError) {
    title = "Atenção";
    icon = <XCircle size={28} className="stroke-[2.5]" />;
    headerColor = "bg-rose-500";
    iconBg = "bg-rose-50 text-rose-600";
    buttonColor = "bg-rose-600 hover:bg-rose-700 shadow-rose-600/15";
  }

  return (
    <div className="fixed inset-0 z-[99999] flex items-center justify-center p-4 bg-neutral-950/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="w-full max-w-sm bg-white rounded-3xl shadow-2xl overflow-hidden border border-neutral-100 animate-in zoom-in-95 duration-200">
        <div className={`h-1.5 ${headerColor} w-full`} />
        <div className="p-6 flex flex-col items-center text-center">
          <div className={`p-3.5 ${iconBg} rounded-full mb-4`}>
            {icon}
          </div>
          <h3 className="text-base font-black text-neutral-900 tracking-tight">{title}</h3>
          <p className="mt-2.5 text-xs text-neutral-600 font-semibold leading-relaxed whitespace-pre-line">
            {alertState.message}
          </p>
          <button
            type="button"
            onClick={() => setAlertState(null)}
            className={`mt-6 w-full py-3 px-4 text-xs font-extrabold text-white ${buttonColor} active:scale-[0.98] rounded-2xl transition duration-150 cursor-pointer shadow-md`}
          >
            Ok, entendi
          </button>
        </div>
      </div>
    </div>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <GlobalAlertPopout />
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/auth" element={<Auth />} />
        <Route path="/onboarding" element={<Onboarding />} />
        <Route path="/admin" element={<Dashboard />} />
        <Route path="/superadmin" element={<SuperAdmin />} />
        <Route path="/:storeId" element={<PublicMenu />} />
      </Routes>
    </BrowserRouter>
  );
}

