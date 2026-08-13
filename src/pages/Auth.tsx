import React, { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { Store } from "lucide-react";
import { auth, db } from "../lib/firebase";
import { 
  signInWithEmailAndPassword, 
  onAuthStateChanged
} from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";

export default function Auth() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const navigate = useNavigate();

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (user) => {
      if (user) {
        // If it is the superadmin, redirect directly to /superadmin
        if (user.email === "dexgamer277@gmail.com") {
          navigate("/superadmin");
          return;
        }
        // Check if user has a restaurant setup
        const docRef = doc(db, "restaurants", user.uid);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          navigate("/admin");
        } else {
          // Check if this is a registered waiter
          const waiterRef = doc(db, "waiters", user.uid);
          const waiterSnap = await getDoc(waiterRef);
          if (waiterSnap.exists() && waiterSnap.data()?.isActive !== false) {
            navigate("/admin");
          } else {
            navigate("/onboarding");
          }
        }
      }
    });
    return unsub;
  }, [navigate]);

  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setLoading(true);
      setError("");
      await signInWithEmailAndPassword(auth, email, password);
      // navigation handled by onAuthStateChanged
    } catch (err: any) {
      setError(err.message || "Erro na autenticação");
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen bg-neutral-50 font-sans">
      <div className="flex flex-1 flex-col justify-center px-4 py-12 sm:px-6 lg:flex-none lg:px-20 xl:px-24">
        <div className="mx-auto w-full max-w-sm lg:w-96">
          <div className="flex items-center gap-2 mb-8">
            <Link to="/" className="flex items-center justify-center rounded-lg bg-orange-600 w-10 h-10 text-white hover:bg-orange-700 transition">
              <Store size={24} />
            </Link>
            <span className="text-2xl font-bold tracking-tight text-neutral-900">MenuFlow</span>
          </div>

          <h2 className="mt-8 text-2xl font-bold leading-9 tracking-tight text-neutral-900">
            Acesse seu painel
          </h2>
          <p className="mt-2 text-sm leading-6 text-neutral-500">
            Não tem uma conta?{" "}
            <a 
              href="https://wa.me/55859921493128?text=Olá!%20Gostaria%20de%20adquirir%20o%20MenuFlow%20e%20solicitar%20meu%20acesso%20ao%20sistema." 
              target="_blank"
              rel="noopener noreferrer"
              className="font-semibold text-orange-600 hover:text-orange-500"
            >
              Solicitar acesso pelo WhatsApp
            </a>
          </p>

          <div className="mt-10">
            <form onSubmit={handleEmailAuth} className="space-y-6">
              {error && (
                <div className="rounded-lg bg-red-50 p-4 text-sm text-red-700 border border-red-200">
                  {error}
                </div>
              )}
              
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium leading-6 text-neutral-900">Email</label>
                  <div className="mt-2">
                    <input
                      type="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="block w-full rounded-lg border-0 bg-white py-2.5 sm:py-3 px-4 text-neutral-900 shadow-sm ring-1 ring-inset ring-neutral-300 placeholder:text-neutral-400 focus:ring-2 focus:ring-inset focus:ring-orange-600 sm:text-sm sm:leading-6 outline-none"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium leading-6 text-neutral-900">Senha</label>
                  <div className="mt-2">
                    <input
                      type="password"
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="block w-full rounded-lg border-0 bg-white py-2.5 sm:py-3 px-4 text-neutral-900 shadow-sm ring-1 ring-inset ring-neutral-300 placeholder:text-neutral-400 focus:ring-2 focus:ring-inset focus:ring-orange-600 sm:text-sm sm:leading-6 outline-none"
                    />
                  </div>
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="flex w-full justify-center rounded-lg bg-orange-600 px-3 py-2.5 sm:py-3 text-sm font-semibold leading-6 text-white shadow-sm hover:bg-orange-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-orange-600 transition disabled:opacity-50"
              >
                {loading ? "Carregando..." : "Entrar"}
              </button>
            </form>
          </div>
        </div>
      </div>
      <div className="relative hidden w-0 flex-1 lg:block">
        <img
          className="absolute inset-0 h-full w-full object-cover"
          src="https://images.unsplash.com/photo-1555396273-367ea4eb4db5?q=80&w=1400&auto=format&fit=crop"
          alt="Restaurant environment"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent flex items-end">
          <div className="p-16 max-w-2xl">
            <h2 className="text-4xl justify-center font-bold text-white mb-6">Simplifique o atendimento e foque no que importa.</h2>
            <p className="text-lg text-neutral-300">Milhares de restaurantes confiam no MenuFlow para receber seus pedidos diariamente.</p>
          </div>
        </div>
      </div>
    </div>
  );
}
