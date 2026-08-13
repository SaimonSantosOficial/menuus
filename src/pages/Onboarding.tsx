import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { auth, db } from "../lib/firebase";
import { doc, setDoc, serverTimestamp } from "firebase/firestore";
import { Store, MapPin, Truck, Store as StoreIcon, Plus, Trash2 } from "lucide-react";
import { signOut } from "firebase/auth";

type DeliveryZone = { neighborhood: string; fee: number };

export default function Onboarding() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState(1);
  const [error, setError] = useState("");

  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [hours, setHours] = useState("");
  
  const [services, setServices] = useState({
    delivery: false,
    pickup: false,
    dineIn: false,
  });

  const [zones, setZones] = useState<DeliveryZone[]>([]);
  const [newZoneName, setNewZoneName] = useState("");
  const [newZoneFee, setNewZoneFee] = useState("");

  const handleAddZone = () => {
    if (newZoneName.trim() && newZoneFee) {
      setZones([...zones, { neighborhood: newZoneName, fee: parseFloat(newZoneFee) }]);
      setNewZoneName("");
      setNewZoneFee("");
    }
  };

  const handleRemoveZone = (index: number) => {
    setZones(zones.filter((_, i) => i !== index));
  };

  const toggleService = (key: keyof typeof services) => {
    setServices((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const handleComplete = async () => {
    if (!auth.currentUser) return;
    try {
      setLoading(true);
      setError("");

      const slug = name.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)+/g, '');

      const restaurantData = {
        ownerId: auth.currentUser.uid,
        name,
        slug,
        phone,
        hours,
        services,
        deliveryZones: zones,
        logoUrl: "https://images.unsplash.com/photo-1590947132387-155cc02f3212?q=80&w=200&auto=format&fit=crop",
        bannerUrl: "https://images.unsplash.com/photo-1513104890138-7c749659a591?q=80&w=1200&auto=format&fit=crop",
        primaryColor: "#ea580c",
        plan: "Premium",
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      };

      // Set user profile as well
      await setDoc(doc(db, "users", auth.currentUser.uid), {
        email: auth.currentUser.email,
        name: auth.currentUser.displayName || name,
        createdAt: serverTimestamp()
      }, { merge: true });

      // Create restaurant profile
      await setDoc(doc(db, "restaurants", auth.currentUser.uid), restaurantData);

      navigate("/admin");
    } catch (err: any) {
      setError(err.message || "Erro ao salvar informações");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-neutral-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8 font-sans">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-orange-600">
          <Store className="h-6 w-6 text-white" />
        </div>
        <h2 className="mt-6 text-center text-2xl font-bold leading-9 tracking-tight text-neutral-900">
          Configure seu Restaurante
        </h2>
        <p className="mt-2 text-center text-sm text-neutral-600">
          Vamos preparar o seu cardápio em poucos passos.
        </p>
      </div>

      <div className="mt-10 sm:mx-auto sm:w-full sm:max-w-xl">
        <div className="bg-white px-6 py-10 shadow-sm ring-1 ring-neutral-200 sm:rounded-2xl sm:px-12">
          
          {error && (
            <div className="mb-6 rounded-lg bg-red-50 p-4 text-sm text-red-700 border border-red-200">
              {error}
            </div>
          )}

          {step === 1 && (
            <div className="space-y-6">
              <div>
                <label className="block text-sm font-medium leading-6 text-neutral-900">
                  Nome do Restaurante
                </label>
                <div className="mt-2">
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Ex: Pizzaria do Pedro"
                    className="block w-full rounded-lg border-0 bg-white py-3 px-4 text-neutral-900 shadow-sm ring-1 ring-inset ring-neutral-300 placeholder:text-neutral-400 focus:ring-2 focus:ring-inset focus:ring-orange-600 sm:text-sm sm:leading-6 outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium leading-6 text-neutral-900">
                  WhatsApp (DDD + Número)
                </label>
                <div className="mt-2">
                  <input
                    type="text"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="Ex: 11 99999-9999"
                    className="block w-full rounded-lg border-0 bg-white py-3 px-4 text-neutral-900 shadow-sm ring-1 ring-inset ring-neutral-300 placeholder:text-neutral-400 focus:ring-2 focus:ring-inset focus:ring-orange-600 sm:text-sm sm:leading-6 outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium leading-6 text-neutral-900">
                  Horário de Atendimento
                </label>
                <div className="mt-2">
                  <input
                    type="text"
                    value={hours}
                    onChange={(e) => setHours(e.target.value)}
                    placeholder="Ex: Terça a Domingo, das 18h às 23h"
                    className="block w-full rounded-lg border-0 bg-white py-3 px-4 text-neutral-900 shadow-sm ring-1 ring-inset ring-neutral-300 placeholder:text-neutral-400 focus:ring-2 focus:ring-inset focus:ring-orange-600 sm:text-sm sm:leading-6 outline-none"
                  />
                </div>
              </div>

              <div className="pt-4">
                <button
                  onClick={() => {
                    if (name.trim() && phone.trim()) setStep(2);
                  }}
                  disabled={!name.trim() || !phone.trim()}
                  className="flex w-full items-center justify-center rounded-lg bg-orange-600 px-3 py-3 text-sm font-semibold text-white shadow-sm hover:bg-orange-700 disabled:opacity-50 transition"
                >
                  Próximo passo
                </button>
                <button 
                  onClick={() => signOut(auth)}
                  className="mt-4 flex w-full justify-center text-sm font-medium text-neutral-500 hover:text-neutral-900"
                >
                  Sair da conta
                </button>
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-6">
              <h3 className="text-base font-semibold text-neutral-900 mb-4">Como você atende seus clientes?</h3>
              <div className="grid grid-cols-1 gap-4">
                <label className={`flex cursor-pointer items-start gap-4 rounded-xl border p-4 transition ${services.delivery ? 'border-orange-600 bg-orange-50 ring-1 ring-orange-600' : 'border-neutral-200 hover:border-neutral-300'}`}>
                  <div className="flex h-6 items-center">
                    <input
                      type="checkbox"
                      checked={services.delivery}
                      onChange={() => toggleService('delivery')}
                      className="h-4 w-4 rounded border-neutral-300 text-orange-600 focus:ring-orange-600"
                    />
                  </div>
                  <div>
                    <h4 className={`font-medium ${services.delivery ? 'text-orange-900' : 'text-neutral-900'}`}>Delivery</h4>
                    <p className={`text-sm ${services.delivery ? 'text-orange-700' : 'text-neutral-500'}`}>Entregamos o pedido na casa do cliente</p>
                  </div>
                  <Truck className={`ml-auto h-6 w-6 ${services.delivery ? 'text-orange-600' : 'text-neutral-400'}`} />
                </label>

                <label className={`flex cursor-pointer items-start gap-4 rounded-xl border p-4 transition ${services.pickup ? 'border-orange-600 bg-orange-50 ring-1 ring-orange-600' : 'border-neutral-200 hover:border-neutral-300'}`}>
                  <div className="flex h-6 items-center">
                    <input
                      type="checkbox"
                      checked={services.pickup}
                      onChange={() => toggleService('pickup')}
                      className="h-4 w-4 rounded border-neutral-300 text-orange-600 focus:ring-orange-600"
                    />
                  </div>
                  <div>
                    <h4 className={`font-medium ${services.pickup ? 'text-orange-900' : 'text-neutral-900'}`}>Retirada no Local</h4>
                    <p className={`text-sm ${services.pickup ? 'text-orange-700' : 'text-neutral-500'}`}>Cliente busca o pedido na loja</p>
                  </div>
                  <MapPin className={`ml-auto h-6 w-6 ${services.pickup ? 'text-orange-600' : 'text-neutral-400'}`} />
                </label>

                <label className={`flex cursor-pointer items-start gap-4 rounded-xl border p-4 transition ${services.dineIn ? 'border-orange-600 bg-orange-50 ring-1 ring-orange-600' : 'border-neutral-200 hover:border-neutral-300'}`}>
                  <div className="flex h-6 items-center">
                    <input
                      type="checkbox"
                      checked={services.dineIn}
                      onChange={() => toggleService('dineIn')}
                      className="h-4 w-4 rounded border-neutral-300 text-orange-600 focus:ring-orange-600"
                    />
                  </div>
                  <div>
                    <h4 className={`font-medium ${services.dineIn ? 'text-orange-900' : 'text-neutral-900'}`}>Consumo Local</h4>
                    <p className={`text-sm ${services.dineIn ? 'text-orange-700' : 'text-neutral-500'}`}>Atendimento em mesas / salão</p>
                  </div>
                  <StoreIcon className={`ml-auto h-6 w-6 ${services.dineIn ? 'text-orange-600' : 'text-neutral-400'}`} />
                </label>
              </div>

              <div className="pt-4 flex gap-4">
                <button
                  onClick={() => setStep(1)}
                  className="w-1/3 flex items-center justify-center rounded-lg bg-white px-3 py-3 text-sm font-semibold text-neutral-700 shadow-sm ring-1 ring-inset ring-neutral-300 hover:bg-neutral-50 transition"
                >
                  Voltar
                </button>
                <button
                  onClick={() => {
                    if (services.delivery || services.pickup || services.dineIn) {
                      if (services.delivery) setStep(3);
                      else handleComplete();
                    }
                  }}
                  disabled={!services.delivery && !services.pickup && !services.dineIn}
                  className="w-2/3 flex items-center justify-center rounded-lg bg-orange-600 px-3 py-3 text-sm font-semibold text-white shadow-sm hover:bg-orange-700 disabled:opacity-50 transition"
                >
                  {services.delivery ? "Avançar" : "Concluir Configuração"}
                </button>
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-6">
               <div>
                  <h3 className="text-base font-semibold text-neutral-900">Taxas de Entrega</h3>
                  <p className="mt-1 text-sm text-neutral-500">Adicione os bairros e as taxas de entrega correspondentes.</p>
               </div>

              <div className="rounded-xl border border-neutral-200 bg-neutral-50 p-4">
                <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 mb-4">
                  <div className="sm:col-span-6">
                    <input
                      type="text"
                      placeholder="Nome do Bairro"
                      value={newZoneName}
                      onChange={(e) => setNewZoneName(e.target.value)}
                      className="block w-full rounded-lg border-0 bg-white py-2 px-3 text-neutral-900 shadow-sm ring-1 ring-inset ring-neutral-300 sm:text-sm outline-none focus:ring-2 focus:ring-orange-600"
                    />
                  </div>
                  <div className="sm:col-span-4">
                    <input
                      type="number"
                      placeholder="Taxa (R$)"
                      value={newZoneFee}
                      onChange={(e) => setNewZoneFee(e.target.value)}
                      className="block w-full rounded-lg border-0 bg-white py-2 px-3 text-neutral-900 shadow-sm ring-1 ring-inset ring-neutral-300 sm:text-sm outline-none focus:ring-2 focus:ring-orange-600"
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <button
                      onClick={handleAddZone}
                      disabled={!newZoneName || !newZoneFee}
                      className="flex w-full h-full items-center justify-center rounded-lg bg-neutral-900 text-white hover:bg-neutral-800 disabled:opacity-50 transition"
                    >
                      <Plus size={20} />
                    </button>
                  </div>
                </div>

                {zones.length > 0 && (
                  <ul className="divide-y divide-neutral-200 bg-white rounded-lg border border-neutral-200">
                    {zones.map((zone, idx) => (
                      <li key={idx} className="flex items-center justify-between p-3">
                        <span className="text-sm font-medium text-neutral-900">{zone.neighborhood}</span>
                        <div className="flex items-center gap-4">
                          <span className="text-sm text-neutral-600">R$ {zone.fee.toFixed(2)}</span>
                          <button onClick={() => handleRemoveZone(idx)} className="text-neutral-400 hover:text-red-600 transition">
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              <div className="pt-4 flex gap-4">
                <button
                  onClick={() => setStep(2)}
                  className="w-1/3 flex items-center justify-center rounded-lg bg-white px-3 py-3 text-sm font-semibold text-neutral-700 shadow-sm ring-1 ring-inset ring-neutral-300 hover:bg-neutral-50 transition"
                >
                  Voltar
                </button>
                <button
                  onClick={handleComplete}
                  disabled={loading}
                  className="w-2/3 flex items-center justify-center rounded-lg bg-orange-600 px-3 py-3 text-sm font-semibold text-white shadow-sm hover:bg-orange-700 disabled:opacity-50 transition"
                >
                  {loading ? "Salvando..." : "Concluir Configuração"}
                </button>
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}
