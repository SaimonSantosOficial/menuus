import { formatTableName } from "../lib/tableUtils";
import { Minus, Plus, Search, ShoppingBag, ArrowLeft, MessageSquare, CheckCircle2, Copy, Check, Truck, Store, Clock, Coins, QrCode as QrCodeIcon, CreditCard, Hash, Instagram, Facebook, Megaphone, AlertCircle, ReceiptText, Download, User, Pencil, X, Gift, Sparkles } from "lucide-react";
import { useState, useEffect, useMemo } from "react";
import QRCode from "react-qr-code";
import { Link, useParams } from "react-router-dom";
import { db } from "../lib/firebase";
import { getSegmentConfig, getProductSegmentConfig } from "../lib/segmentHelper";
import { collection, query, where, getDocs, addDoc, onSnapshot, doc, getDoc, updateDoc } from "firebase/firestore";

type Product = { 
  id: string; 
  name: string; 
  description: string; 
  price: number; 
  category: string; 
  imageUrl: string; 
  flavors?: { name: string }[];
  maxFlavors?: number | null;
  addons?: { name: string; price: number }[];
  maxAddons?: number | null;
  complements?: { name: string }[];
  maxComplements?: number | null;
  sauces?: { name: string }[];
  maxSauces?: number | null;
  availableDays?: string[];
  isOutOfStock?: boolean;
  stock?: number | null;
  createdAt?: number | string | any;
};

function isNewProduct(product: any): boolean {
  if (!product || !product.createdAt) return false;
  let createdTime = 0;
  if (typeof product.createdAt === 'number') {
    createdTime = product.createdAt;
  } else if (typeof product.createdAt === 'string') {
    createdTime = new Date(product.createdAt).getTime();
  } else if (product.createdAt && typeof product.createdAt.seconds === 'number') {
    createdTime = product.createdAt.seconds * 1000;
  } else if (product.createdAt && typeof product.createdAt.toDate === 'function') {
    createdTime = product.createdAt.toDate().getTime();
  }
  if (!createdTime || isNaN(createdTime)) return false;
  const twoDaysInMs = 2 * 24 * 60 * 60 * 1000; // 48 horas
  const now = Date.now();
  return (now - createdTime) <= twoDaysInMs && now >= createdTime;
}

type CartItemState = {
  key: string; // unique key combination (productId + comma-separated selections)
  productId: string;
  qty: number;
  selectedFlavors: { name: string }[];
  selectedAddons: { name: string; price: number }[];
  selectedComplements: { name: string }[];
  selectedSauces: { name: string }[];
  obs?: string;
};

export default function PublicMenu() {
  const { storeId } = useParams();
  
  // Firebase Data
  const [restaurant, setRestaurant] = useState<any>(null);
  const [frames, setFrames] = useState<any[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [announcements, setAnnouncements] = useState<any[]>([]);
  const [promotions, setPromotions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const [activeOrder, setActiveOrder] = useState<any>(null);
  const [activeOrderId, setActiveOrderId] = useState<string | null>(null);

  useEffect(() => {
    if (!restaurant || !restaurant.id) return;
    const ownerId = restaurant.ownerId || restaurant.id;
    const storedOrderId = localStorage.getItem(`last_order_id_${ownerId}`);
    if (storedOrderId && !activeOrderId) {
      setActiveOrderId(storedOrderId);
    }
  }, [restaurant]);

  useEffect(() => {
    if (!activeOrderId) return;
    
    // Check if the restaurant is loaded to get the proper ownerId in case we need to clear local storage
    let ownerId = "";
    if (restaurant && restaurant.id) {
       ownerId = restaurant.ownerId || restaurant.id;
    }

    const unsub = onSnapshot(doc(db, "orders", activeOrderId), (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        if (data.status === "Finalizado" || data.status === "Cancelado" || data.status === "Rejeitado" || data.status === "Historico" || data.status === "Entregue") {
           setActiveOrder(null);
           setActiveOrderId(null);
           if (ownerId) localStorage.removeItem(`last_order_id_${ownerId}`);
        } else {
           setActiveOrder({ id: docSnap.id, ...data });
        }
      } else {
        setActiveOrder(null);
        setActiveOrderId(null);
        if (ownerId) localStorage.removeItem(`last_order_id_${ownerId}`);
      }
    });
    return () => unsub();
  }, [activeOrderId, restaurant]);

  // Update Favicon and Title dynamically based on restaurant
  useEffect(() => {
    if (restaurant?.name) {
      document.title = restaurant.name;
    }
    if (restaurant?.logoUrl) {
      let iconLink = document.querySelector("link[rel~='icon']") as HTMLLinkElement;
      if (!iconLink) {
        iconLink = document.createElement('link');
        iconLink.rel = 'icon';
        document.head.appendChild(iconLink);
      }
      iconLink.href = restaurant.logoUrl;
      
      let appleIconLink = document.querySelector("link[rel='apple-touch-icon']") as HTMLLinkElement;
      if (!appleIconLink) {
        appleIconLink = document.createElement('link');
        appleIconLink.rel = 'apple-touch-icon';
        document.head.appendChild(appleIconLink);
      }
      appleIconLink.href = restaurant.logoUrl;
    }
  }, [restaurant]);


  // Interaction State
  const [search, setSearch] = useState("");
  const [cart, setCart] = useState<CartItemState[]>([]);
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [customerName, setCustomerName] = useState(() => localStorage.getItem("customer_name") || "");
  const [customerAddress, setCustomerAddress] = useState(() => localStorage.getItem("customer_address") || "");
  const [addressComplement, setAddressComplement] = useState(() => localStorage.getItem("customer_address_complement") || "");
  const [checkoutType, setCheckoutType] = useState<"entrega" | "retirada" | "balcao">("entrega");
  const [selectedNeighborhood, setSelectedNeighborhood] = useState(() => localStorage.getItem("customer_neighborhood") || "");
  const [paymentMethod, setPaymentMethod] = useState<"dinheiro" | "pix" | "cartao">("dinheiro");
  const [contactPhone, setContactPhone] = useState(() => localStorage.getItem("customer_phone") || "");
  const [tableNumber, setTableNumber] = useState(() => localStorage.getItem("customer_table_number") || "");
  const [tables, setTables] = useState<any[]>([]);
  const [changeFor, setChangeFor] = useState("");
  const [copiedPix, setCopiedPix] = useState(false);
  const [orderSuccess, setOrderSuccess] = useState(false);
  const [currentTime, setCurrentTime] = useState(Date.now());

  // Modal de Identificação Inicial
  const [showIdentifyModal, setShowIdentifyModal] = useState(false);
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [tempName, setTempName] = useState(() => localStorage.getItem("customer_name") || "");
  const [tempPhone, setTempPhone] = useState(() => localStorage.getItem("customer_phone") || "");
  const [tempAddress, setTempAddress] = useState(() => localStorage.getItem("customer_address") || "");
  const [tempNeighborhood, setTempNeighborhood] = useState(() => localStorage.getItem("customer_neighborhood") || "");
  const [tempTable, setTempTable] = useState(() => localStorage.getItem("customer_table_number") || "");

  const [isTableQrMode, setIsTableQrMode] = useState(false);
  const [tableOrderSuccessModal, setTableOrderSuccessModal] = useState(false);
  const [lastTableOrderDetails, setLastTableOrderDetails] = useState<any>(null);

  // Detect Table QR code parameter from URL query string (e.g. ?mesa=01 or ?table=01)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const qMesa = params.get("mesa") || params.get("table") || params.get("mesaId");
    if (qMesa && qMesa.trim()) {
      const cleanMesa = qMesa.trim();
      setTableNumber(cleanMesa);
      setTempTable(cleanMesa);
      setCheckoutType("balcao");
      setIsTableQrMode(true);
      localStorage.setItem("customer_table_number", cleanMesa);
    }
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const qMesa = params.get("mesa") || params.get("table") || params.get("mesaId");
    if (qMesa && qMesa.trim() && restaurant) {
      const cleanMesa = qMesa.trim();
      const targetOwnerId = restaurant.ownerId || restaurant.id;
      if (targetOwnerId) {
        const sessionKey = `table_scanned_${cleanMesa}`;
        if (!sessionStorage.getItem(sessionKey)) {
          sessionStorage.setItem(sessionKey, 'true');
          (async () => {
            try {
              const q = query(
                collection(db, "tables"),
                where("restaurantId", "==", targetOwnerId),
                where("name", "==", cleanMesa)
              );
              const snap = await getDocs(q);
              const now = Date.now();
              if (!snap.empty) {
                const docSnap = snap.docs[0];
                await updateDoc(doc(db, "tables", docSnap.id), {
                  status: "Ocupada",
                  lastOccupiedAt: now,
                  updatedAt: now
                });
              } else {
                await addDoc(collection(db, "tables"), {
                  restaurantId: targetOwnerId,
                  name: cleanMesa,
                  status: "Ocupada",
                  items: [],
                  total: 0,
                  customerName: customerName.trim() || formatTableName(cleanMesa),
                  lastOccupiedAt: now,
                  createdAt: now
                });
              }
            } catch (err) {
              console.error("Erro ao ocupar mesa via QR Code:", err);
            }
          })();
        }
      }
    }
  }, [restaurant]);

  useEffect(() => {
    const savedName = localStorage.getItem("customer_name") || "";
    const savedPhone = localStorage.getItem("customer_phone") || "";
    const savedAddress = localStorage.getItem("customer_address") || "";
    const savedNeighborhood = localStorage.getItem("customer_neighborhood") || "";
    const savedTable = localStorage.getItem("customer_table_number") || "";

    // Abre o modal de identificação se algum dos dados fundamentais estiver vazio
    const params = new URLSearchParams(window.location.search);
    const qMesa = params.get("mesa") || params.get("table") || params.get("mesaId");
    
    if (!savedName.trim() || (!qMesa && (!savedPhone.trim() || !savedAddress.trim()))) {
      setTempName(savedName);
      setTempPhone(savedPhone);
      setTempAddress(savedAddress);
      setTempNeighborhood(savedNeighborhood);
      setTempTable(qMesa?.trim() || savedTable);
      setShowIdentifyModal(true);
    }
  }, []);

  useEffect(() => {
    localStorage.setItem("customer_name", customerName);
  }, [customerName]);

  useEffect(() => {
    localStorage.setItem("customer_phone", contactPhone);
  }, [contactPhone]);

  useEffect(() => {
    localStorage.setItem("customer_address", customerAddress);
  }, [customerAddress]);

  useEffect(() => {
    localStorage.setItem("customer_address_complement", addressComplement);
  }, [addressComplement]);

  useEffect(() => {
    localStorage.setItem("customer_neighborhood", selectedNeighborhood);
  }, [selectedNeighborhood]);

  useEffect(() => {
    localStorage.setItem("customer_table_number", tableNumber);
  }, [tableNumber]);

  // Encontra comandas ativas no PDV correspondentes a esta mesa ou número de telefone desse cliente
  const activeTableOrders = useMemo(() => {
    if (!tables || tables.length === 0) return [];
    
    // Normaliza números de telefone removendo ddds, parenteses e traços para comparação confiável
    const cleanPhone = (p: string) => p.replace(/\D/g, "");
    const userPhoneClean = cleanPhone(contactPhone);
    const userTableNormalized = tableNumber ? tableNumber.trim().toLowerCase() : "";

    return tables.filter(t => {
      // Ocupada significa que tem consumo pendente ou está ativada no PDV
      if (t.status !== "Ocupada") return false;

      const hasItems = t.items && t.items.length > 0;
      if (!hasItems) return false;

      // Compara telefone
      const tablePhoneClean = cleanPhone(t.customerPhone || "");
      const matchesPhone = userPhoneClean && tablePhoneClean && (
        tablePhoneClean.includes(userPhoneClean) || userPhoneClean.includes(tablePhoneClean)
      );

      // Compara número de mesa
      const tableNumClean = t.name ? t.name.trim().toLowerCase() : "";
      const matchesTable = userTableNormalized && (
        tableNumClean === userTableNormalized || 
        tableNumClean.replace(/\D/g, "") === userTableNormalized.replace(/\D/g, "")
      );

      return matchesPhone || matchesTable;
    });
  }, [tables, contactPhone, tableNumber]);

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentTime(Date.now());
    }, 5000); // tick every 5 seconds to update real-time expirations
    return () => clearInterval(interval);
  }, []);

  // Sync commemorative and specific frame ornaments from Firebase
  useEffect(() => {
    const unsubFrames = onSnapshot(collection(db, "frames"), (snap) => {
      setFrames(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    }, (err) => {
      console.error("Erro ao escutar molduras:", err);
    });
    return () => unsubFrames();
  }, []);

  // Segment configuration
  const segmentConfig = useMemo(() => {
    const rawGenre = restaurant?.restaurantType || restaurant?.genre || restaurant?.segment || "";
    return getSegmentConfig(rawGenre);
  }, [restaurant]);

  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [modalItemQty, setModalItemQty] = useState<number>(1);

  // Addon Modal States
  const [selectedProductForAddons, setSelectedProductForAddons] = useState<Product | null>(null);
  const [selectedFlavorsForProduct, setSelectedFlavorsForProduct] = useState<{ name: string }[]>([]);
  const [selectedAddonsForProduct, setSelectedAddonsForProduct] = useState<{ name: string; price: number }[]>([]);
  const [selectedComplementsForProduct, setSelectedComplementsForProduct] = useState<{ name: string }[]>([]);
  const [selectedSaucesForProduct, setSelectedSaucesForProduct] = useState<{ name: string }[]>([]);
  const [itemObservationForProduct, setItemObservationForProduct] = useState("");
  const [selectionNotice, setSelectionNotice] = useState<string | null>(null);
  const [orderObservation, setOrderObservation] = useState("");

  const [showWeeklyHours, setShowWeeklyHours] = useState(false);

  useEffect(() => {
    if (!storeId) return;
    const targetSlug = storeId.toLowerCase();
    const qStore = query(collection(db, "restaurants"), where("slug", "==", targetSlug));
    
    let unsubProd: (() => void) | undefined;
    let unsubCat: (() => void) | undefined;
    let unsubAnnouncements: (() => void) | undefined;
    let unsubTables: (() => void) | undefined;
    let unsubPromotions: (() => void) | undefined;

    const unsubStore = onSnapshot(qStore, (storeSnap) => {
      if (storeSnap.empty) {
        setRestaurant(null);
        setLoading(false);
        return;
      }
      
      const storeData = { id: storeSnap.docs[0].id, ...storeSnap.docs[0].data() } as any;
      setRestaurant(storeData);
      setLoading(false);

      const targetOwnerId = storeData.ownerId || storeData.id;

      // Registrar visualização real de cardápio se não registrada nesta sessão
      const sessionViewKey = `viewed_${targetOwnerId}`;
      if (!sessionStorage.getItem(sessionViewKey)) {
        sessionStorage.setItem(sessionViewKey, "true");
        addDoc(collection(db, "menu_views"), {
          restaurantId: targetOwnerId,
          timestamp: Date.now()
        }).catch(err => console.error("Erro ao registrar visualização:", err));
      }

      // Live Products
      if (unsubProd) unsubProd();
      const qProd = query(collection(db, "products"), where("restaurantId", "==", targetOwnerId));
      unsubProd = onSnapshot(qProd, (prodSnap) => {
        setProducts(prodSnap.docs.map(d => ({ id: d.id, ...d.data() } as Product)));
      }, (err) => console.error("Erro ao escutar produtos:", err));

      // Live Categories
      if (unsubCat) unsubCat();
      const qCat = query(collection(db, "categories"), where("restaurantId", "==", targetOwnerId));
      unsubCat = onSnapshot(qCat, (catSnap) => {
        const resolvedCats = catSnap.docs.map(d => ({ id: d.id, ...d.data() }));
        resolvedCats.sort((a: any, b: any) => {
          const orderA = a.order !== undefined ? a.order : 9999;
          const orderB = b.order !== undefined ? b.order : 9999;
          if (orderA !== orderB) return orderA - orderB;
          return (a.createdAt || 0) - (b.createdAt || 0);
        });
        setCategories(resolvedCats);
      }, (err) => console.error("Erro ao escutar categorias:", err));

      // Live Announcements/Avisos
      if (unsubAnnouncements) unsubAnnouncements();
      const qAnnouncements = query(collection(db, "announcements"), where("restaurantId", "==", targetOwnerId));
      unsubAnnouncements = onSnapshot(qAnnouncements, (annSnap) => {
        setAnnouncements(annSnap.docs.map(d => ({ id: d.id, ...d.data() })));
      }, (err) => console.error("Erro ao escutar avisos:", err));

      // Live Tables/Mesas
      if (unsubTables) unsubTables();
      const qTables = query(collection(db, "tables"), where("restaurantId", "==", targetOwnerId));
      unsubTables = onSnapshot(qTables, (tablesSnap) => {
        setTables(tablesSnap.docs.map(d => ({ id: d.id, ...d.data() })));
      }, (err) => console.error("Erro ao escutar mesas:", err));

      // Live Promotions
      if (unsubPromotions) unsubPromotions();
      const qPromotions = query(collection(db, "promotions"), where("restaurantId", "==", targetOwnerId));
      unsubPromotions = onSnapshot(qPromotions, (promotionsSnap) => {
        setPromotions(promotionsSnap.docs.map(d => ({ id: d.id, ...d.data() })));
      }, (err) => console.error("Erro ao escutar promoções:", err));

    }, (err) => {
      console.error("Erro ao escutar restaurante:", err);
      setLoading(false);
    });

    return () => {
      unsubStore();
      if (unsubProd) unsubProd();
      if (unsubCat) unsubCat();
      if (unsubAnnouncements) unsubAnnouncements();
      if (unsubTables) unsubTables();
      if (unsubPromotions) unsubPromotions();
    };
  }, [storeId]);

  if (loading) {
     return <div className="min-h-screen flex items-center justify-center bg-neutral-50 font-sans text-neutral-500">Carregando cardápio...</div>;
  }

  if (!restaurant) {
     return (
       <div className="min-h-screen flex flex-col items-center justify-center bg-neutral-50 font-sans p-4 text-center">
         <h1 className="text-2xl font-bold text-neutral-900 mb-2">Loja não encontrada</h1>
         <p className="text-neutral-500 mb-6">Verifique se o link está correto.</p>
         <Link to="/" className="text-orange-600 font-medium hover:underline">Voltar para o início</Link>
       </div>
     );
  }

  // Derived state
  const getTodayAbbr = (): string => {
    const daysArr = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
    return daysArr[new Date().getDay()];
  };
  const todayAbbr = getTodayAbbr();

  const isStoreOpenAtMoment = (() => {
    if (!restaurant) return true;
    if (restaurant.storeStatus === 'closed') return false;
    if (restaurant.storeStatus === 'open') return true;

    if (restaurant.storeStatus === 'auto') {
      const daysMap = ['domingo', 'segunda', 'terca', 'quarta', 'quinta', 'sexta', 'sabado'];
      const today = new Date();
      const currentDayKey = daysMap[today.getDay()];
      const todayHours = restaurant.weeklyHours?.[currentDayKey];
      
      const nowHour = today.getHours() * 60 + today.getMinutes();

      // Check yesterday's over-midnight shift
      const yesterdayDate = new Date(today);
      yesterdayDate.setDate(today.getDate() - 1);
      const yesterdayDayKey = daysMap[yesterdayDate.getDay()];
      const yesterdayHours = restaurant.weeklyHours?.[yesterdayDayKey];

      if (yesterdayHours && !yesterdayHours.closed && yesterdayHours.start && yesterdayHours.end) {
        const [ysh, ysm] = yesterdayHours.start.split(':').map(Number);
        const [yeh, yem] = yesterdayHours.end.split(':').map(Number);
        const yStartMins = ysh * 60 + ysm;
        const yEndMins = yeh * 60 + yem;
        
        if (yEndMins < yStartMins) { // Went over midnight
          if (nowHour <= yEndMins) return true; // Still open from yesterday
        }
      }

      if (!todayHours || typeof todayHours === 'string') return true;
      if (todayHours.closed) return false;
      if (!todayHours.start || !todayHours.end) return true;

      const [sh, sm] = todayHours.start.split(':').map(Number);
      const [eh, em] = todayHours.end.split(':').map(Number);
      const startMins = sh * 60 + sm;
      const endMins = eh * 60 + em;

      if (endMins < startMins) {
        return nowHour >= startMins;
      } else {
        return nowHour >= startMins && nowHour <= endMins;
      }
    }
    return true; // Default to open if missing status
  })();

  const activeAnnouncements = announcements.filter(item => {
    if (item.isActive === false) return false;
    if (item.hasExpiration && item.expiresAt && currentTime > item.expiresAt) return false;
    return true;
  });

  const filteredProducts = products.filter(p => {
    const matchesSearch = p.name.toLowerCase().includes(search.toLowerCase());
    if (!matchesSearch) return false;

    // Check availability days
    if (p.availableDays && p.availableDays.length > 0) {
      return p.availableDays.includes(todayAbbr);
    }
    return true; // Available every day if undefined or empty
  }).sort((a, b) => {
    if ((a as any).order === undefined && (b as any).order === undefined) {
      return ((a as any).createdAt || 0) - ((b as any).createdAt || 0);
    }
    return ((a as any).order || 0) - ((b as any).order || 0);
  });
  
  // Render shopping cart list calculated values
  let cartItems = cart.map(item => {
    const product = products.find(p => p.id === item.productId);
    if (!product) return null;
    const addonsTotal = item.selectedAddons.reduce((sum, ad) => sum + ad.price, 0);
    let itemPrice = product.price + addonsTotal;

    // Apply active single product discount rules
    const discountPromo = promotions.find(p => p.isActive && p.type === "discount" && p.productId === product.id);
    if (discountPromo) {
      if (discountPromo.discountType === "percentage") {
        const amt = itemPrice * (discountPromo.discountValue / 100);
        itemPrice = Math.max(0, itemPrice - amt);
      } else if (discountPromo.discountType === "fixed_value") {
        itemPrice = Math.max(0, itemPrice - discountPromo.discountValue);
      }
    }

    return {
      id: product.id,
      name: discountPromo ? `${product.name} (Promo OFF)` : product.name,
      description: product.description,
      imageUrl: product.imageUrl,
      category: product.category,
      price: itemPrice, // Overwritten to include extras and rule discount
      qty: item.qty,
      selectedFlavors: item.selectedFlavors || [],
      selectedAddons: item.selectedAddons,
      selectedComplements: item.selectedComplements || [],
      key: item.key,
      basePrice: product.price
    };
  }).filter((item): item is NonNullable<typeof item> => item !== null);

  // Apply Compre e Ganhe gifts
  const promoGifts: any[] = [];
  promotions.forEach(promo => {
    if (promo.isActive && promo.type === "buy_x_get_y") {
      const triggers = cartItems.filter(item => item.id === promo.productId);
      const totalTrigQty = triggers.reduce((sum, item) => sum + item.qty, 0);
      if (totalTrigQty >= promo.buyQty) {
        const mult = Math.floor(totalTrigQty / promo.buyQty);
        const freeQty = mult * (promo.giftQty || 1);
        const giftProd = products.find(p => p.id === promo.giftProductId);
        if (giftProd) {
          promoGifts.push({
            id: giftProd.id,
            name: `${giftProd.name} (Brinde: ${promo.name})`,
            description: "Adicionado via promoção",
            imageUrl: giftProd.imageUrl,
            category: giftProd.category,
            price: 0,
            qty: freeQty,
            selectedFlavors: [],
            selectedAddons: [],
            selectedComplements: [],
            key: `gift_${promo.id}`,
            basePrice: 0,
            isPromoGift: true
          });
        }
      }
    }
  });

  // Apply Combos discounts
  const comboDiscounts: any[] = [];
  promotions.forEach(promo => {
    if (promo.isActive && promo.type === "combo" && promo.productIds && promo.productIds.length >= 2) {
      const prodsQtys = promo.productIds.map((id: string) => {
        const match = cartItems.filter(item => item.id === id);
        return match.reduce((sum, item) => sum + item.qty, 0);
      });
      const completePacks = Math.min(...prodsQtys);
      if (completePacks > 0) {
        // Calculate original single subset sum
        const normalSumPrice = promo.productIds.reduce((sum: number, id: string) => {
          const prod = products.find(p => p.id === id);
          return sum + (prod ? prod.price : 0);
        }, 0);
        const savingPerPack = normalSumPrice - promo.comboPrice;
        if (savingPerPack > 0) {
          comboDiscounts.push({
            id: `combo_disc_${promo.id}`,
            name: `Desconto Combo: ${promo.name}`,
            description: "Desconto aplicado automaticamente",
            price: -savingPerPack,
            qty: completePacks,
            selectedFlavors: [],
            selectedAddons: [],
            selectedComplements: [],
            key: `combo_${promo.id}`,
            basePrice: -savingPerPack,
            isPromoComboDiscount: true
          });
        }
      }
    }
  });

  // Merge the calculated rules
  cartItems = [...cartItems, ...promoGifts, ...comboDiscounts];

  const cartTotal = cartItems.reduce((acc, item) => acc + item.price * item.qty, 0);
  const cartTotalItems = cartItems.reduce((acc, item) => {
    // Only count genuine products, not negative combo helper rows
    if (item.price < 0) return acc;
    return acc + item.qty;
  }, 0);

  const deliveryFeeRaw = checkoutType === "entrega" ? (restaurant?.deliveryFees?.find((f: any) => f.name === selectedNeighborhood)?.fee || 0) : 0;
  const deliveryFee = typeof deliveryFeeRaw === "string" ? parseFloat(deliveryFeeRaw.replace(",", ".")) : (Number(deliveryFeeRaw) || 0);
  const finalTotal = cartTotal + deliveryFee;

  // Unified shopping cart modifiers
  const addToCart = (
    product: Product,
    chosenFlavors: { name: string }[],
    chosenAddons: { name: string; price: number }[],
    chosenComplements: { name: string }[],
    chosenSauces: { name: string }[] = [],
    chosenObs: string = "",
    qtyToAdd: number = 1
  ) => {
    const sortedFlavorKeys = [...chosenFlavors].map(f => f.name).sort().join(",");
    const sortedAddonKeys = [...chosenAddons].map(a => a.name).sort().join(",");
    const sortedComplementKeys = [...chosenComplements].map(c => c.name).sort().join(",");
    const sortedSauceKeys = [...chosenSauces].map(s => s.name).sort().join(",");
    const key = `${product.id}_${sortedFlavorKeys}_${sortedAddonKeys}_${sortedComplementKeys}_${sortedSauceKeys}_${chosenObs}`;

    setCart(prev => {
      const existingIdx = prev.findIndex(item => item.key === key);
      const isPresent = existingIdx > -1;
      if (isPresent) {
        const updated = [...prev];
        updated[existingIdx] = {
          ...updated[existingIdx],
          qty: updated[existingIdx].qty + qtyToAdd
        };
        return updated;
      } else {
        return [...prev, {
          key,
          productId: product.id,
          qty: qtyToAdd,
          selectedFlavors: chosenFlavors,
          selectedAddons: chosenAddons,
          selectedComplements: chosenComplements,
          selectedSauces: chosenSauces,
          obs: chosenObs
        }];
      }
    });
  };

  const updateQty = (key: string, delta: number) => {
    setCart(prev => {
      return prev.map(item => {
        if (item.key === key) {
          const newQty = Math.max(0, item.qty + delta);
          return { ...item, qty: newQty };
        }
        return item;
      }).filter(item => item.qty > 0);
    });
  };

  const handleAddItemClick = (product: Product) => {
    if (!isStoreOpenAtMoment) {
      alert("Desculpe, a loja está fechada no momento. Não é possível fazer pedidos.");
      return;
    }
    if (product.isOutOfStock) {
      alert("Este produto está temporariamente esgotado!");
      return;
    }
    const hasFlavors = product.flavors && product.flavors.length > 0;
    const hasAddons = product.addons && product.addons.length > 0;
    const hasComplements = product.complements && product.complements.length > 0;
    const hasSauces = product.sauces && product.sauces.length > 0;
    if (hasFlavors || hasAddons || hasComplements || hasSauces) {
      setSelectedProductForAddons(product);
      setSelectedFlavorsForProduct([]);
      setSelectedAddonsForProduct([]);
      setSelectedComplementsForProduct([]);
      setSelectedSaucesForProduct([]);
      setModalItemQty(1);
    } else {
      addToCart(product, [], [], [], [], "", 1);
    }
  };

  const handleDecreaseItemClick = (product: Product) => {
    const matched = cart.find(item => item.productId === product.id);
    if (matched) {
      updateQty(matched.key, -1);
    }
  };

  const getCartPixPayload = () => {
    const formatEMVField = (id: string, value: string): string => {
      const len = value.length.toString().padStart(2, '0');
      return `${id}${len}${value}`;
    };

    let pixKey = "";
    if (restaurant?.pixKey && restaurant.pixKey.trim() !== "") {
       const raw = restaurant.pixKey.trim();
       if (raw.includes("@")) {
          pixKey = raw.replace(/\s/g, ""); // Email
       } else if (/-/g.test(raw) && raw.length > 25) {
          pixKey = raw.replace(/\s/g, ""); // Aleatoria
       } else {
          const numeric = raw.replace(/\D/g, "");
          if (raw.startsWith("+")) {
             pixKey = "+" + numeric; // Telefone com +
          } else if (numeric.length === 11) {
             // Pode ser CPF ou Celular sem o 55
             // Se tiver parenteses, espaço ou traço, e parecer telefone (começa com 1-9) assumimos que tentou por cel
             if (raw.includes("(") || raw.includes(")") || raw.startsWith("55")) {
                 pixKey = "+55" + numeric;
             } else {
                 pixKey = numeric; // assume CPF mantendo limpo
             }
          } else if (numeric.length === 14) {
             pixKey = numeric; // CNPJ
          } else if (numeric.length === 12 || numeric.length === 13) {
             pixKey = numeric.startsWith("55") ? "+" + numeric : "-" + numeric; // telefone internacional
             if (pixKey.startsWith("-")) pixKey = numeric; 
             if (pixKey.startsWith("+55")) pixKey = "+" + numeric; 
          } else if (numeric.length === 10) {
             pixKey = "+55" + numeric; // telefone fixo
          } else {
             pixKey = raw.replace(/\s/g, ""); // Fallback
          }
       }
    } else {
       let cleanPhone = restaurant?.phone ? restaurant.phone.replace(/\D/g, '') : "5585991276477";
       if (cleanPhone && cleanPhone.length <= 11) cleanPhone = "55" + cleanPhone;
       pixKey = `+${cleanPhone}`;
    }

    // Merchant Account Information (ID 26)
    const gui = formatEMVField("00", "br.gov.bcb.pix");
    const key = formatEMVField("01", pixKey);
    const merchantAccountInfo = formatEMVField("26", gui + key);

    // Build fields
    let payload = "";
    payload += formatEMVField("00", "01"); // Payload Format Indicator
    payload += merchantAccountInfo; // Merchant Account Information
    payload += formatEMVField("52", "0000"); // Merchant Category Code
    payload += formatEMVField("53", "986"); // Transaction Currency (BRL)
    if (finalTotal > 0) {
       payload += formatEMVField("54", finalTotal.toFixed(2)); // Transaction Amount
    }
    payload += formatEMVField("58", "BR"); // Country Code
    const safeName = (restaurant?.name || "Restaurante").normalize("NFD").replace(/[^a-zA-Z0-9\s]/g, "").replace(/\s+/g, " ").trim().substring(0, 25).trim() || "Restaurante";
    payload += formatEMVField("59", safeName); // Merchant Name
    payload += formatEMVField("60", "Fortaleza"); // Merchant City
    payload += formatEMVField("62", formatEMVField("05", "***")); // Additional Data Field

    // Calculate CRC16 CCITT
    const dataToHash = payload + "6304";
    let crc = 0xFFFF;
    for (let i = 0; i < dataToHash.length; i++) {
      crc ^= dataToHash.charCodeAt(i) << 8;
      for (let j = 0; j < 8; j++) {
        if ((crc & 0x8000) !== 0) {
          crc = (crc << 1) ^ 0x1021;
        } else {
          crc = crc << 1;
        }
      }
    }
    const hex = (crc & 0xFFFF).toString(16).toUpperCase().padStart(4, '0');
    return dataToHash + hex;
  };

  const handleCheckout = async () => {
    if (cartItems.length === 0) return;
    if (!customerName.trim()) {
      alert("Por favor, preencha o seu nome!");
      return;
    }
    if (!isTableQrMode && !contactPhone.trim()) {
      alert("Por favor, informe seu telefone de contato!");
      return;
    }
    if (checkoutType === "entrega" && !customerAddress.trim()) {
      alert("Por favor, preencha o endereço de entrega!");
      return;
    }
    if (checkoutType === "entrega" && restaurant?.deliveryFees && restaurant.deliveryFees.length > 0 && !selectedNeighborhood) {
      alert("Por favor, selecione o bairro de entrega!");
      return;
    }
    if ((checkoutType === "balcao" || isTableQrMode) && !tableNumber.trim()) {
      alert("Por favor, informe o número da mesa ou balcão!");
      return;
    }

    const cleanPhone = restaurant.phone ? restaurant.phone.replace(/\D/g, '') : "";
    if (cleanPhone === "") {
       alert("Esta loja não configurou um número de WhatsApp.");
       return;
    }

    const targetOwnerId = restaurant.ownerId || restaurant.id;
    let orderIdStr = "";
    try {
      const docRef = await addDoc(collection(db, "orders"), {
        restaurantId: targetOwnerId,
        total: finalTotal,
        itemsCount: cartTotalItems,
        timestamp: Date.now(),
        customerName: customerName.trim(),
        contactPhone: isTableQrMode ? formatTableName(tableNumber.trim()) : contactPhone.trim(),
        checkoutType,
        paymentMethod,
        customerAddress: checkoutType === "entrega" ? customerAddress.trim() : "",
        addressComplement: checkoutType === "entrega" ? addressComplement.trim() : "",
        tableNumber: (checkoutType === "balcao" || isTableQrMode) ? tableNumber.trim() : "",
        changeFor: paymentMethod === "dinheiro" ? changeFor.trim() : "",
        observation: orderObservation.trim(),
        status: "Novo",
        items: cartItems.map(item => ({
          name: item.name,
          qty: item.qty,
          price: item.price,
          productId: item.id,
          selectedFlavors: item.selectedFlavors || [],
          selectedAddons: item.selectedAddons || [],
          selectedComplements: item.selectedComplements || [],
          obs: item.obs || ""
        }))
      });
      
      orderIdStr = docRef.id.slice(-4).toUpperCase();
      localStorage.setItem(`last_order_id_${targetOwnerId}`, docRef.id);
      
      // Update the active order immediately
      setActiveOrderId(docRef.id);
      setActiveOrder({
         id: docRef.id,
         status: "Novo",
         timestamp: Date.now(),
         total: finalTotal,
         customerName: customerName.trim()
      });

      // Decrement product stock
      try {
        for (const item of cartItems) {
          if (!item.id) continue;
          const productRef = doc(db, "products", item.id);
          const prodSnap = await getDoc(productRef);
          if (prodSnap.exists()) {
            const prodData = prodSnap.data();
            if (prodData.stock !== undefined && prodData.stock !== null) {
              const currentStock = parseInt(prodData.stock, 10);
              if (!isNaN(currentStock)) {
                const newStock = Math.max(0, currentStock - item.qty);
                await updateDoc(productRef, {
                  stock: newStock,
                  isOutOfStock: newStock === 0 ? true : !!prodData.isOutOfStock
                });
              }
            }
          }
        }
      } catch (stockError) {
        console.error("Erro ao decrementar estoque:", stockError);
      }

      // Sync items to Table comanda in Firestore if ordering for a Mesa
      if ((checkoutType === "balcao" || isTableQrMode) && tableNumber.trim()) {
        try {
          const normTableNum = tableNumber.trim().toLowerCase();
          
          // Query or find existing table in local state
          let targetTable = tables.find(t => t.name && t.name.trim().toLowerCase() === normTableNum);
          
          if (!targetTable) {
            const q = query(
              collection(db, "tables"),
              where("restaurantId", "==", targetOwnerId),
              where("name", "==", tableNumber.trim())
            );
            const querySnap = await getDocs(q);
            if (!querySnap.empty) {
              const docSnap = querySnap.docs[0];
              targetTable = { id: docSnap.id, ...docSnap.data() };
            }
          }

          const newItemsForTable = cartItems.map(item => ({
            id: `item-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
            productId: item.id,
            name: item.name,
            qty: item.qty,
            price: item.price,
            selectedFlavors: item.selectedFlavors || [],
            selectedAddons: item.selectedAddons || [],
            selectedComplements: item.selectedComplements || [],
            obs: item.obs || "",
            timestamp: Date.now()
          }));

          if (targetTable) {
            const existingTableItems = targetTable.items || [];
            const updatedItems = [...existingTableItems, ...newItemsForTable];
            const updatedTotal = updatedItems.reduce((acc: number, curr: any) => acc + (Number(curr.price) * Number(curr.qty)), 0);

            await updateDoc(doc(db, "tables", targetTable.id), {
              items: updatedItems,
              total: updatedTotal,
              customerName: customerName.trim() || targetTable.customerName || formatTableName(tableNumber.trim()),
              customerPhone: contactPhone.trim() || targetTable.customerPhone || "",
              status: "Ocupada",
              updatedAt: Date.now()
            });
          } else {
            const newTotal = newItemsForTable.reduce((acc: number, curr: any) => acc + (Number(curr.price) * Number(curr.qty)), 0);
            await addDoc(collection(db, "tables"), {
              restaurantId: targetOwnerId,
              name: tableNumber.trim(),
              customerName: customerName.trim() || formatTableName(tableNumber.trim()),
              customerPhone: contactPhone.trim() || "",
              items: newItemsForTable,
              total: newTotal,
              status: "Ocupada",
              createdAt: Date.now()
            });
          }
        } catch (tableErr) {
          console.error("Erro ao sincronizar comanda da mesa:", tableErr);
        }
      }
    } catch (e) {
      console.error("Erro ao salvar pedido em tempo real:", e);
    }

    // Build WhatsApp message
    let msg = `*Novo Pedido${orderIdStr ? ` #${orderIdStr}` : ''} - ${restaurant.name || 'MenuFlow'}*\n\n`;
    msg += `👤 *Cliente:* ${customerName.trim()}\n`;
    msg += `📞 *Contato:* ${contactPhone.trim()}\n`;
    
    if (checkoutType === "entrega") {
      msg += `🚀 *Modo:* Entrega\n`;
      msg += `🏠 *Endereço:* ${customerAddress.trim()}\n`;
      if (addressComplement.trim()) {
        msg += `🏢 *Complemento:* ${addressComplement.trim()}\n`;
      }
    } else if (checkoutType === "retirada") {
      msg += `🛍️ *Modo:* Retirada\n`;
    } else if (checkoutType === "balcao" || isTableQrMode) {
      msg += `🍽️ *Modo:* Balcão / Mesa\n`;
      msg += `🔢 *Mesa/Balcão:* ${tableNumber.trim()}\n`;
    }

    msg += `💳 *Pagamento:* ${paymentMethod === "dinheiro" ? "💵 Dinheiro" : paymentMethod === "pix" ? "⚡ Pix" : "💳 Cartão"}\n`;
    if (paymentMethod === "dinheiro" && changeFor.trim()) {
      msg += `🪙 *Troco para:* R$ ${changeFor.trim()}\n`;
    }
    if (orderObservation.trim()) {
      msg += `📝 *Obs Pedido:* ${orderObservation.trim()}\n`;
    }

    msg += `\n*🛒 Itens do Pedido:*\n`;
    cartItems.forEach(item => {
      msg += `▪ ${item.qty}x ${item.name} - R$ ${(item.price * item.qty).toFixed(2)}\n`;
      if (item.selectedFlavors && item.selectedFlavors.length > 0) {
        item.selectedFlavors.forEach(fl => {
          msg += `   🍕 Sabor: ${fl.name}\n`;
        });
      }
      if (item.selectedAddons && item.selectedAddons.length > 0) {
        item.selectedAddons.forEach(addon => {
          msg += `   ➕ Adicional: ${addon.name} (${addon.price > 0 ? `+ R$ ${addon.price.toFixed(2)}` : "Grátis"})\n`;
        });
      }
      if (item.selectedComplements && item.selectedComplements.length > 0) {
        item.selectedComplements.forEach(comp => {
          msg += `   📝 Complemento: ${comp.name}\n`;
        });
      }
      if (item.obs) {
        msg += `   💬 Obs Item: ${item.obs}\n`;
      }
    });

    if (checkoutType === "entrega" && deliveryFee > 0) {
      msg += `\nSubtotal: R$ ${cartTotal.toFixed(2)}`;
      msg += `\nTaxa de Entrega (${selectedNeighborhood}): R$ ${deliveryFee.toFixed(2)}`;
    }
    msg += `\n*Total do Pedido: R$ ${finalTotal.toFixed(2)}*\n`;

    if (paymentMethod === "pix") {
      msg += `\n⚡ _Estou pagando via Pix Código Copia e Cola._`;
    }

    if ((checkoutType === "balcao" || isTableQrMode) && tableNumber.trim()) {
      setLastTableOrderDetails({
        tableNumber: tableNumber.trim(),
        customerName: customerName.trim(),
        items: cartItems.map(i => ({ name: i.name, qty: i.qty, price: i.price })),
        total: finalTotal
      });
      setTableOrderSuccessModal(true);
    } else {
      setOrderSuccess(true);
      const url = `https://wa.me/${cleanPhone}?text=${encodeURIComponent(msg)}`;
      window.open(url, "_blank");
    }

    setCart([]);
    setOrderObservation("");
    setIsCartOpen(false);
  };

  const customColor = restaurant.primaryColor || "#ea580c";

  // Find active frame dynamically
  const activeFrame = (() => {
    const today = new Date();
    const year = today.getFullYear();
    const monthStr = String(today.getMonth() + 1).padStart(2, '0');
    const dayStr = String(today.getDate()).padStart(2, '0');
    const todayStr = `${year}-${monthStr}-${dayStr}`;

    const month = today.getMonth();
    const day = today.getDate();

    for (const f of frames) {
      if (!f.imageUrl) continue;

      // Check specific dates first
      if (Array.isArray(f.specificDates) && f.specificDates.includes(todayStr)) {
        return f;
      }

      // Check commemorative types
      if (f.commemorativeType) {
        let isActive = false;
        switch (f.commemorativeType) {
          case "christmas":
            isActive = (month === 11 && day >= 15 && day <= 26);
            break;
          case "newyear":
            isActive = (month === 11 && day >= 27) || (month === 0 && day <= 5);
            break;
          case "halloween":
            isActive = (month === 9 && day >= 25 && day <= 31);
            break;
          case "valentines":
            isActive = (month === 5 && day === 12);
            break;
          case "junina":
            isActive = (month === 5); // June
            break;
          case "easter":
            isActive = (month === 3 && day >= 1 && day <= 20);
            break;
          case "mothers":
            isActive = (month === 4 && day >= 8 && day <= 15);
            break;
          case "fathers":
            isActive = (month === 7 && day >= 8 && day <= 15);
            break;
          default:
            isActive = false;
        }
        if (isActive) {
          return f;
        }
      }
    }
    return null;
  })();

  return (
    <div className="min-h-screen bg-neutral-50 pb-24 font-sans text-neutral-900">
      {/* Dynamic Theme Color Injection for primary elements */}
      <style>{`
        .theme-bg { background-color: ${customColor}; }
        .theme-text { color: ${customColor}; }
        .theme-ring-focus:focus { --tw-ring-color: ${customColor}; }
        .theme-border { border-color: ${customColor}; }
      `}</style>

      {/* Banner */}
      <div className="relative h-48 sm:h-64 bg-neutral-200">
        <img src={restaurant.bannerUrl} alt="Banner" className="h-full w-full object-cover" />
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent"></div>
      </div>

      <div className="mx-auto max-w-2xl px-4 sm:px-6">
        {/* Header Info */}
        <div className="relative -mt-16 flex flex-col items-center text-center">
          {activeFrame ? (
            <div className="relative h-32 w-32 flex items-center justify-center animate-in zoom-in-95 duration-200">
              {/* Ornament frame */}
              <img 
                src={activeFrame.imageUrl} 
                alt="Logo Frame" 
                className="absolute inset-0 h-full w-full object-contain z-10 pointer-events-none"
                referrerPolicy="no-referrer"
              />
              {/* Logo image centered inside */}
              <img 
                src={restaurant.logoUrl || "https://images.unsplash.com/photo-1590947132387-155cc02f3212?q=80&w=200&auto=format&fit=crop"} 
                alt="Logo" 
                className="h-[73%] w-[73%] rounded-full object-cover z-0 bg-white shadow-inner"
                referrerPolicy="no-referrer"
              />
            </div>
          ) : (
            <img 
              src={restaurant.logoUrl || "https://images.unsplash.com/photo-1590947132387-155cc02f3212?q=80&w=200&auto=format&fit=crop"} 
              alt="Logo" 
              className="h-24 w-24 rounded-full border-4 border-neutral-50 bg-white object-cover shadow-sm animate-in zoom-in-95 duration-205"
              referrerPolicy="no-referrer"
            />
          )}
          <h1 className="mt-4 text-2xl font-black tracking-tight text-neutral-900 capitalize flex items-center justify-center gap-2">
            {restaurant.name}
          </h1>

          {/* Segment & Status Badges */}
          <div className="mt-2.5 flex items-center justify-center gap-2 flex-wrap">
            <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold border shadow-2xs ${segmentConfig.themeAccentBg}`}>
              <span>{segmentConfig.badgeEmoji}</span>
              <span>{segmentConfig.segmentName}</span>
            </span>
            <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold ${isStoreOpenAtMoment ? "bg-emerald-50 text-emerald-700 border border-emerald-200" : "bg-red-50 text-red-700 border border-red-200"}`}>
              <span className={`w-2 h-2 rounded-full ${isStoreOpenAtMoment ? "bg-emerald-500 animate-pulse" : "bg-red-500"}`} />
              {isStoreOpenAtMoment ? "Loja Aberta" : "Loja Fechada"}
            </span>
          </div>
          {(restaurant.weeklyHours || restaurant.hours) && (() => {
            const daysMap = ['domingo', 'segunda', 'terca', 'quarta', 'quinta', 'sexta', 'sabado'];
            const todayKey = daysMap[new Date().getDay()];
            
            const formatDayHours = (hoursConfig: any) => {
              if (!hoursConfig) return null;
              if (typeof hoursConfig === 'string') return hoursConfig;
              if (hoursConfig.closed) return 'Fechado';
              if (hoursConfig.start && hoursConfig.end) return `${hoursConfig.start} às ${hoursConfig.end}`;
              if (hoursConfig.start) return `A partir das ${hoursConfig.start}`;
              if (hoursConfig.end) return `Até as ${hoursConfig.end}`;
              return null;
            };

            const todayHoursValue = formatDayHours(restaurant.weeklyHours?.[todayKey]);

            return (
              <div className="mt-2.5 flex flex-col items-center">
                <button 
                  onClick={() => restaurant.weeklyHours && setShowWeeklyHours(!showWeeklyHours)}
                  className={`flex items-center gap-1.5 text-sm text-neutral-500 hover:text-neutral-700 transition bg-neutral-100/50 px-3 py-1 rounded-full ${restaurant.weeklyHours ? 'cursor-pointer' : 'cursor-default'}`}
                >
                  <Clock size={14} className="text-neutral-400" />
                  <span>
                    {restaurant.weeklyHours 
                      ? (todayHoursValue ? `Hoje: ${todayHoursValue}` : 'Horários de atendimento')
                      : restaurant.hours}
                  </span>
                  {restaurant.weeklyHours && (
                     <span className="ml-1 text-[10px] uppercase font-bold text-neutral-400 tracking-wider">
                       {showWeeklyHours ? 'Ocultar' : 'Todos'}
                     </span>
                  )}
                </button>

                {showWeeklyHours && restaurant.weeklyHours && (
                  <div className="mt-3 w-full max-w-[260px] rounded-xl bg-white border border-neutral-100 p-4 text-xs text-neutral-600 shadow-xl shadow-black/5 text-left relative z-10">
                    {(['domingo', 'segunda', 'terca', 'quarta', 'quinta', 'sexta', 'sabado']).map(d => (
                      <div key={d} className={`flex justify-between py-1.5 border-b border-neutral-50 last:border-0 ${d === todayKey ? 'font-bold text-neutral-900' : ''}`}>
                        <span className="capitalize">{d === 'terca' ? 'Terça' : d === 'sabado' ? 'Sábado' : d}</span>
                        <span>{formatDayHours(restaurant.weeklyHours[d]) || 'Não definido'}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })()}

          {/* Redes Sociais */}
          {(restaurant.instagram || restaurant.facebook || restaurant.phone) && (
            <div className="mt-3 flex flex-wrap items-center justify-center gap-3">
              {restaurant.phone && (
                <a 
                  href={`https://wa.me/${restaurant.phone.replace(/\D/g, "").startsWith("55") ? restaurant.phone.replace(/\D/g, "") : "55" + restaurant.phone.replace(/\D/g, "")}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 rounded-full bg-emerald-500 hover:bg-emerald-600 px-3 py-1 text-xs font-bold text-white transition cursor-pointer shadow-sm"
                >
                  <MessageSquare size={12} className="text-white fill-white/10" />
                  <span>WhatsApp</span>
                </a>
              )}
              {restaurant.instagram && (
                <a 
                  href={`https://instagram.com/${restaurant.instagram.replace(/^@/, "")}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 rounded-full bg-neutral-100 px-3 py-1 text-xs font-medium text-neutral-700 hover:bg-neutral-200 transition cursor-pointer"
                >
                  <Instagram size={12} className="text-pink-600" />
                  <span>@{restaurant.instagram.replace(/^@/, "")}</span>
                </a>
              )}
              {restaurant.facebook && (
                <a 
                  href={`https://facebook.com/${restaurant.facebook}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 rounded-full bg-neutral-100 px-3 py-1 text-xs font-medium text-neutral-700 hover:bg-neutral-200 transition cursor-pointer"
                >
                  <Facebook size={12} className="text-blue-600" />
                  <span>{restaurant.facebook}</span>
                </a>
              )}
            </div>
          )}
        </div>


        {/* Closed Store Banner */}
        {!isStoreOpenAtMoment && (
          <div className="mb-8 p-3 bg-red-50 sm:rounded-xl border-y sm:border border-red-100 flex flex-col sm:flex-row items-center justify-center gap-2 text-red-700 w-full">
            <span className="relative flex h-2.5 w-2.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-red-500"></span>
            </span>
            <p className="text-sm font-medium text-center">Estamos fechados no momento. Volte mais tarde!</p>
          </div>
        )}

        {/* Table Banner when ordering from a specific Mesa */}
        {tableNumber && (
          <div className="mb-6 bg-gradient-to-r from-orange-600 to-amber-600 text-white p-4 rounded-2xl shadow-md flex items-center justify-between gap-3 animate-in fade-in duration-200">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-white/20 rounded-xl backdrop-blur-md shrink-0">
                <Store size={22} className="text-white" />
              </div>
              <div className="text-left">
                <div className="text-[10px] font-black uppercase tracking-wider text-orange-100 flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                  Atendimento Ativo na Mesa
                </div>
                <div className="text-base font-black tracking-tight">
                  {formatTableName(tableNumber)} {customerName ? `• ${customerName}` : ""}
                </div>
              </div>
            </div>
            <button
              type="button"
              onClick={() => {
                setShowProfileModal(true);
              }}
              className="px-3 py-1.5 bg-white/20 hover:bg-white/30 text-white rounded-xl text-xs font-bold transition backdrop-blur-md cursor-pointer shrink-0"
            >
              Alterar Nome
            </button>
          </div>
        )}

        {/* Avisos do Cardápio / Announcements */}
        {activeAnnouncements.length > 0 && (
          <div className="space-y-3 mb-8">
            {activeAnnouncements.map((item) => {
              // Color combinations matching the notification type
              let colorClasses = {
                cardBg: "bg-amber-50 border-amber-200 text-amber-900",
                iconColor: "text-amber-600",
                titleColor: "text-amber-950"
              };

              if (item.type === "info") {
                colorClasses = {
                  cardBg: "bg-indigo-50 border-indigo-200 text-indigo-900",
                  iconColor: "text-indigo-600",
                  titleColor: "text-indigo-950"
                };
              } else if (item.type === "success") {
                colorClasses = {
                  cardBg: "bg-emerald-50 border-emerald-200 text-emerald-950",
                  iconColor: "text-emerald-600",
                  titleColor: "text-emerald-950"
                };
              } else if (item.type === "danger") {
                colorClasses = {
                  cardBg: "bg-rose-50 border-rose-200 text-rose-950",
                  iconColor: "text-rose-600",
                  titleColor: "text-rose-950"
                };
              }

              return (
                <div 
                  key={item.id} 
                  className={`p-4 rounded-2xl border ${colorClasses.cardBg} flex gap-3 shadow-sm items-start text-left`}
                >
                  <div className={`p-1.5 rounded-full bg-white/60 shrink-0 ${colorClasses.iconColor} mt-0.5`}>
                    <Megaphone size={16} />
                  </div>
                  <div className="space-y-1">
                    {item.title && (
                      <h4 className={`font-bold text-sm ${colorClasses.titleColor}`}>
                        {item.title}
                      </h4>
                    )}
                    <p className="text-xs leading-relaxed whitespace-pre-wrap">{item.message}</p>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {activeAnnouncements.length === 0 && <div className="mb-8" />}

        {/* Pedido Ativo (Delivery/Retirada) */}
        {activeOrder && (
          <div className="mb-8 overflow-hidden rounded-3xl bg-neutral-50 border border-neutral-200 shadow-sm animate-in fade-in duration-300">
            <div className={`h-1.5 w-full ${activeOrder.status === 'Novo' ? 'bg-blue-500' : activeOrder.status === 'Preparando' ? 'bg-orange-500' : activeOrder.status === 'Pronto' ? 'bg-emerald-500' : 'theme-bg'}`} />
            <div className="p-5 text-left flex flex-col sm:flex-row sm:items-center gap-4 justify-between">
              <div className="flex items-center gap-3">
                <div className={`p-2.5 rounded-full shrink-0 ${activeOrder.status === 'Novo' ? 'bg-blue-100 text-blue-600' : activeOrder.status === 'Preparando' ? 'bg-orange-100 text-orange-600' : activeOrder.status === 'Pronto' ? 'bg-emerald-100 text-emerald-600' : 'bg-neutral-200 text-neutral-600'}`}>
                  {activeOrder.status === 'Novo' ? <Clock size={20} /> : activeOrder.status === 'Preparando' ? <Store size={20} /> : activeOrder.status === 'Pronto' ? <CheckCircle2 size={20} /> : <ReceiptText size={20} />}
                </div>
                <div>
                   <h3 className="text-sm font-black text-neutral-900 tracking-tight">Status do Pedido <span className="opacity-50">#{activeOrder.id?.slice(-4).toUpperCase()}</span></h3>
                   {activeOrder.customerName && (
                     <p className="text-xs text-neutral-600 font-bold mt-1">
                       Cliente: <span className="text-neutral-900 font-extrabold">{activeOrder.customerName}</span>
                     </p>
                   )}
                   <p className="text-xs text-neutral-500 font-medium leading-tight mt-1">
                     Seu último pedido encontra-se: <strong className="text-neutral-800">{activeOrder.status}</strong>
                   </p>
                </div>
              </div>
              <div className="text-left sm:text-right border-t border-neutral-200 pt-3 sm:border-0 sm:pt-0">
                <span className="block text-[10px] uppercase tracking-widest font-bold text-neutral-400">Total do Pedido</span>
                <span className="text-base font-black font-mono">R$ {Number(activeOrder.total || 0).toFixed(2)}</span>
              </div>
            </div>
          </div>
        )}

        {/* Comandas Ativas do PDV (Consumo no Local) */}
        {activeTableOrders.length > 0 && (
          <div className="mb-8 overflow-hidden rounded-3xl bg-neutral-900 text-white shadow-xl border border-neutral-800 animate-in fade-in duration-300">
            <div className="theme-bg h-1.5 w-full" />
            <div className="p-5 md:p-6 text-left">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 mb-4">
                <div className="flex items-center gap-2.5">
                  <div className="p-2.5 rounded-full theme-bg text-white shadow-md shrink-0">
                    <ReceiptText size={18} />
                  </div>
                  <div>
                    <h3 className="text-sm font-black tracking-tight text-white flex items-center gap-1.5">
                      Sua Comanda no Local
                      <span className="inline-block w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                    </h3>
                    <p className="text-[10px] text-neutral-400 font-semibold tracking-wide uppercase mt-0.5">
                      {formatTableName(activeTableOrders[0].name)} {activeTableOrders[0].customerName ? `• ${activeTableOrders[0].customerName}` : ""}
                    </p>
                  </div>
                </div>
                <div className="bg-neutral-800 px-3.5 py-1.5 rounded-2xl border border-neutral-700/80 text-right shrink-0">
                  <span className="block text-[9px] font-black uppercase text-neutral-400 tracking-widest leading-none mb-1">Total Consumido</span>
                  <span className="text-base font-black text-white font-mono leading-none">
                    R$ {Number(activeTableOrders[0].total || 0).toFixed(2)}
                  </span>
                </div>
              </div>

              <div className="divide-y divide-neutral-800 border-t border-b border-neutral-800 max-h-56 overflow-y-auto pr-1">
                {activeTableOrders[0].items.map((item: any, index: number) => (
                  <div key={item.id || index} className="py-2.5 flex items-center justify-between gap-3">
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-xs font-mono text-neutral-400 bg-neutral-800 px-1.5 py-0.5 rounded">
                          {item.qty || item.quantity}x
                        </span>
                        <h4 className="font-bold text-xs text-white leading-normal">
                          {item.name}
                        </h4>
                      </div>
                      
                      {/* Opcionais/Adicionais se existirem */}
                      {((item.selectedAddons && item.selectedAddons.length > 0) || 
                        (item.selectedComplements && item.selectedComplements.length > 0)) && (
                        <div className="mt-1 pl-7 space-y-0.5">
                          {item.selectedAddons?.map((add: any, idx: number) => (
                            <p key={idx} className="text-[10px] text-neutral-400 font-medium">
                              + {add.name} (R$ {Number(add.price || 0).toFixed(2)})
                            </p>
                          ))}
                          {item.selectedComplements?.map((comp: any, idx: number) => (
                            <p key={idx} className="text-[10px] text-neutral-400 font-medium">
                              • {comp.name}
                            </p>
                          ))}
                        </div>
                      )}
                    </div>
                    
                    <div className="text-right shrink-0">
                      <span className="text-xs font-bold text-neutral-300 font-mono">
                        R$ {((item.price || 0) * (item.qty || item.quantity || 1)).toFixed(2)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>

              <div className="mt-3.5 flex items-center gap-2 text-[10px] text-neutral-400 font-medium leading-relaxed">
                <div className="p-1 rounded-full bg-neutral-800 text-neutral-400 flex items-center justify-center">
                  <span className="w-1.5 h-1.5 rounded-full bg-orange-500" />
                </div>
                <span>
                  Informações sincronizadas direto do PDV em tempo real. Peça mais itens no cardápio ou fale com o atendente!
                </span>
              </div>
            </div>
          </div>
        )}

        {/* Perfil do Usuário */}
        <div className="mb-6 p-4 bg-white rounded-2xl border border-neutral-200/80 flex items-center justify-between shadow-sm text-left">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-orange-50 text-orange-600 rounded-full">
              <User size={20} className="theme-color" />
            </div>
            <div>
              <p className="text-[10px] text-neutral-400 font-extrabold uppercase tracking-wider">Seu Perfil</p>
              <h4 className="font-bold text-sm text-neutral-900 leading-tight">
                {customerName ? customerName : "Cliente não identificado"}
              </h4>
              <p className="text-[11px] text-neutral-500 mt-0.5 leading-tight">
                {contactPhone || "Sem telefone cadastrado"} 
                {customerAddress ? ` • ${customerAddress}` : ""}
                {selectedNeighborhood ? ` (${selectedNeighborhood})` : ""}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => {
              setTempName(customerName);
              setTempPhone(contactPhone);
              setTempAddress(customerAddress);
              setTempNeighborhood(selectedNeighborhood);
              setShowProfileModal(true);
            }}
            className="px-3 py-1.5 text-xs font-bold text-orange-600 hover:text-orange-700 bg-orange-50 hover:bg-orange-100 rounded-xl transition cursor-pointer flex items-center gap-1.5"
          >
            <Pencil size={12} />
            <span>Editar</span>
          </button>
        </div>

        {/* Search */}
        <div className="mb-8 relative">
          <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-neutral-400">
            <Search size={20} />
          </div>
          <input
            type="text"
            placeholder="Buscar produtos..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="block w-full rounded-2xl border-0 bg-white py-3.5 pl-10 pr-4 text-neutral-900 shadow-sm ring-1 ring-inset ring-neutral-200 placeholder:text-neutral-400 focus:ring-2 focus:ring-inset theme-ring-focus sm:text-sm sm:leading-6 outline-none"
          />
        </div>

        {/* Promotions Area */}
        {promotions && promotions.filter(p => p.isActive).length > 0 && (
          <div className="mb-10 text-left">
            <div className="flex items-center gap-2 mb-4">
              <div className="w-8 h-8 rounded-xl bg-orange-150 text-orange-600 flex items-center justify-center animate-bounce">
                <Gift size={18} />
              </div>
              <div>
                <h3 className="font-bold text-neutral-800 text-base flex items-center gap-1.5 leading-tight">
                  Promoções Especiais do Dia
                  <span className="text-[10px] bg-red-100 text-red-600 font-black px-1.5 py-0.5 rounded-full uppercase tracking-wider animate-pulse">Ativo</span>
                </h3>
                <p className="text-xs text-neutral-500 mt-0.5">
                  Os brindes e descontos são calculados e aplicados automaticamente na sua sacola!
                </p>
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              {promotions.filter(p => p.isActive).map((promo: any) => {
                const triggerProduct = products.find(p => p.id === promo.productId);
                const giftProduct = products.find(p => p.id === promo.giftProductId);
                const comboProducts = (promo.productIds || []).map((id: string) => products.find(p => p.id === id)).filter((p): p is NonNullable<typeof p> => !!p);

                return (
                  <div 
                    key={promo.id} 
                    className="relative overflow-hidden bg-gradient-to-br from-orange-50/70 to-red-50/40 border border-orange-100/80 rounded-2xl p-4 flex flex-col justify-between transition-all duration-200 hover:shadow-md hover:scale-[1.01]"
                  >
                    {/* Top indicator badge */}
                    <div className="absolute top-0 right-0">
                      <span className="text-[10px] font-extrabold uppercase tracking-widest text-orange-600 bg-orange-100 px-2.5 py-1 rounded-bl-xl rounded-tr-none flex items-center gap-1">
                        <Sparkles size={11} className="text-orange-500 fill-orange-500" />
                        {promo.type === "buy_x_get_y" ? "Compre & Ganhe" : promo.type === "discount" ? "Desconto" : "Combo"}
                      </span>
                    </div>

                    <div className="pr-20">
                      <span className="font-black text-neutral-900 text-sm tracking-tight block mb-1">
                        {promo.name}
                      </span>

                      {promo.type === "buy_x_get_y" && triggerProduct && giftProduct && (
                        <p className="text-xs text-neutral-600 leading-relaxed">
                          Leve <strong className="text-orange-600 font-bold">{promo.buyQty}x</strong> {triggerProduct.name} e ganhe totalmente grátis <strong className="text-green-650 font-bold">{promo.giftQty}x</strong> {giftProduct.name}!
                        </p>
                      )}

                      {promo.type === "discount" && triggerProduct && (
                        <p className="text-xs text-neutral-600 leading-relaxed">
                          Aproveite <strong className="text-orange-600 font-bold">{promo.discountType === "percentage" ? `${promo.discountValue}% OFF` : `R$ ${promo.discountValue} de desconto`}</strong> direto no produto {triggerProduct.name}!
                        </p>
                      )}

                      {promo.type === "combo" && comboProducts.length > 0 && (
                        <div className="space-y-1">
                          <p className="text-xs text-neutral-600 leading-relaxed">
                            Leve o combo especial por apenas <strong className="text-orange-650 font-black">R$ {Number(promo.comboPrice).toFixed(2)}</strong>!
                          </p>
                          <div className="flex flex-wrap gap-1 mt-1">
                            {comboProducts.map((p) => (
                              <span key={p.id} className="inline-block bg-white/80 border border-orange-100/60 text-[10px] text-neutral-600 px-1.5 py-0.5 rounded">
                                {p.name}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>

                    <div className="mt-3 pt-2.5 border-t border-orange-100/50 flex items-center justify-between">
                      <span className="text-[11px] text-orange-600 font-semibold flex items-center gap-1">
                        <CheckCircle2 size={12} className="stroke-[2.5]" />
                        Adicione os itens ao carrinho para ativar
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Sticky Category Bar (App Native) */}
        {categories.length > 0 && (
          <div className="sticky top-0 z-30 -mx-4 px-4 py-2.5 bg-white/95 backdrop-blur-md border-y border-neutral-200/80 shadow-xs mb-6">
            <div className="max-w-2xl mx-auto flex items-center gap-2 overflow-x-auto no-scrollbar py-0.5">
              <button
                type="button"
                onClick={() => {
                  setSelectedCategory("all");
                  window.scrollTo({ top: 0, behavior: "smooth" });
                }}
                className={`shrink-0 px-3.5 py-1.5 rounded-full text-xs font-black transition flex items-center gap-1.5 cursor-pointer ${
                  selectedCategory === "all"
                    ? "theme-bg text-white shadow-xs scale-102"
                    : "bg-neutral-100/80 text-neutral-600 hover:bg-neutral-200/60"
                }`}
              >
                <span>{segmentConfig.badgeEmoji}</span>
                <span>Todos ({products.length})</span>
              </button>
              {categories
                .filter((cat) => {
                  if (cat.isVisible === false) return false;
                  if (cat.availableDays && cat.availableDays.length > 0) {
                    return cat.availableDays.includes(todayAbbr);
                  }
                  return true;
                })
                .map((cat) => {
                  const count = products.filter((p) => p.category === cat.name).length;
                  if (count === 0) return null;
                  const isSelected = selectedCategory === cat.name;
                  return (
                    <button
                      type="button"
                      key={cat.id}
                      onClick={() => {
                        setSelectedCategory(cat.name);
                        const el = document.getElementById(`cat-${cat.id || cat.name.replace(/\s+/g, "-")}`);
                        if (el) {
                          const offset = 90;
                          const bodyRect = document.body.getBoundingClientRect().top;
                          const elementRect = el.getBoundingClientRect().top;
                          const elementPosition = elementRect - bodyRect;
                          const offsetPosition = elementPosition - offset;
                          window.scrollTo({
                            top: offsetPosition,
                            behavior: "smooth"
                          });
                        }
                      }}
                      className={`shrink-0 px-3.5 py-1.5 rounded-full text-xs font-black transition flex items-center gap-1.5 cursor-pointer ${
                        isSelected
                          ? "theme-bg text-white shadow-xs scale-102"
                          : "bg-neutral-100/80 text-neutral-600 hover:bg-neutral-200/60"
                      }`}
                    >
                      <span>{cat.name}</span>
                      <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${isSelected ? "bg-white/20 text-white" : "bg-neutral-200/80 text-neutral-600"}`}>
                        {count}
                      </span>
                    </button>
                  );
                })}
            </div>
          </div>
        )}

        {/* Categories & Products */}
        <div className="space-y-8">
          {categories.length === 0 && products.length === 0 && (
             <div className="text-center text-neutral-500 py-10 bg-white rounded-3xl border border-neutral-200">
               O cardápio está vazio no momento.
             </div>
          )}

          {categories.filter(category => {
            if (category.isVisible === false) return false;
            if (category.availableDays && category.availableDays.length > 0) {
              return category.availableDays.includes(todayAbbr);
            }
            return true;
          }).map(category => {
            const categoryProducts = filteredProducts.filter(p => p.category === category.name);
            if (categoryProducts.length === 0) return null;

            return (
              <div key={category.id} id={`cat-${category.id || category.name.replace(/\s+/g, "-")}`} className="scroll-mt-24">
                <div className="flex items-center justify-between mb-3 px-1">
                  <h2 className="text-base font-black text-neutral-900 tracking-tight flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full theme-bg" />
                    <span>{category.name}</span>
                  </h2>
                  <span className="text-[11px] font-bold text-neutral-400 bg-neutral-100 px-2.5 py-0.5 rounded-full">
                    {categoryProducts.length} {categoryProducts.length === 1 ? "item" : "itens"}
                  </span>
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  {categoryProducts.map(product => {
                    const qty = cart.filter(item => item.productId === product.id).reduce((sum, item) => sum + item.qty, 0);
                    return (
                      <div 
                        key={product.id} 
                        className={`group relative flex gap-3.5 rounded-3xl bg-white p-3.5 border border-neutral-200/80 shadow-2xs hover:shadow-md transition-all duration-200 ${
                          product.isOutOfStock ? "opacity-75 bg-neutral-50/80" : ""
                        }`}
                      >
                        <div className="flex-1 flex flex-col justify-between min-w-0">
                          <div>
                            <div className="flex items-start justify-between gap-1.5">
                              <div className="flex items-center gap-1.5 flex-wrap min-w-0">
                                <h3 className="font-bold text-sm text-neutral-900 tracking-tight leading-snug line-clamp-1 group-hover:theme-text transition-colors">
                                  {product.name}
                                </h3>
                                {isNewProduct(product) && (
                                  <span className="shrink-0 inline-flex items-center gap-0.5 rounded-full bg-emerald-500 text-white px-2 py-0.5 text-[9px] font-black uppercase tracking-wider shadow-2xs">
                                    ✨ Novo
                                  </span>
                                )}
                              </div>
                              {product.isOutOfStock && (
                                <span className="shrink-0 inline-flex items-center rounded-full bg-red-100 px-2 py-0.5 text-[9px] font-black uppercase tracking-wider text-red-700">
                                  Esgotado
                                </span>
                              )}
                            </div>
                            
                            {product.description && (
                              <p className="mt-1 text-xs text-neutral-500 line-clamp-2 leading-relaxed">
                                {product.description}
                              </p>
                            )}

                            {/* Option Badges Adapted to Segment */}
                            {((product.flavors && product.flavors.length > 0) || (product.addons && product.addons.length > 0) || (product.complements && product.complements.length > 0) || (product.sauces && product.sauces.length > 0)) && (
                              <div className="mt-2 flex flex-wrap gap-1">
                                {product.flavors && product.flavors.length > 0 && (() => {
                                  const prodSeg = getProductSegmentConfig(product.category, segmentConfig);
                                  return (
                                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold border ${prodSeg.themeAccentBg}`}>
                                      <span>{prodSeg.badgeEmoji}</span>
                                      <span>{prodSeg.flavorBadge} ({product.flavors.length})</span>
                                    </span>
                                  );
                                })()}
                                {product.addons && product.addons.length > 0 && (
                                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-orange-50 text-orange-700 border border-orange-200">
                                    <span>➕</span>
                                    <span>{restaurant?.genre === "Marmitaria" ? "Extras" : "Adicionais"}</span>
                                  </span>
                                )}
                                {product.complements && product.complements.length > 0 && (
                                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                                    <span>✨</span>
                                    <span>Acompanhamentos</span>
                                  </span>
                                )}
                                {product.sauces && product.sauces.length > 0 && (
                                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-rose-50 text-rose-700 border border-rose-200">
                                    <span>🌶️</span>
                                    <span>Molhos</span>
                                  </span>
                                )}
                              </div>
                            )}
                          </div>

                          <div className="mt-3 pt-2.5 border-t border-neutral-100 flex items-center justify-between gap-2">
                            <span className="text-sm font-black text-neutral-900 font-mono tracking-tight">
                              R$ {Number(product.price || 0).toFixed(2)}
                            </span>

                            {product.isOutOfStock ? (
                              <span className="flex h-8 items-center justify-center rounded-full bg-neutral-100 px-3 text-xs font-bold text-neutral-400 select-none">
                                Indisponível
                              </span>
                            ) : qty === 0 ? (
                              <button 
                                type="button"
                                onClick={() => handleAddItemClick(product)}
                                className="flex h-8 items-center justify-center rounded-full px-3.5 text-xs font-extrabold theme-text bg-orange-50 hover:bg-orange-100 active:scale-95 transition shadow-2xs whitespace-nowrap cursor-pointer"
                                style={{ backgroundColor: `${customColor}15` }}
                              >
                                + Adicionar
                              </button>
                            ) : (
                              <div className="flex items-center gap-2 rounded-full bg-neutral-100 p-1 border border-neutral-200/80">
                                <button 
                                  type="button"
                                  onClick={() => handleDecreaseItemClick(product)} 
                                  className="flex h-6 w-6 items-center justify-center rounded-full bg-white text-neutral-700 shadow-xs hover:bg-neutral-50 active:scale-90 transition cursor-pointer"
                                >
                                  <Minus size={12} className="stroke-[3]" />
                                </button>
                                <span className="w-4 text-center text-xs font-black font-mono">{qty}</span>
                                <button 
                                  type="button"
                                  onClick={() => handleAddItemClick(product)} 
                                  className="flex h-6 w-6 items-center justify-center rounded-full text-white shadow-xs theme-bg hover:opacity-90 active:scale-90 transition cursor-pointer"
                                >
                                  <Plus size={12} className="stroke-[3]" />
                                </button>
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Image Thumbnail */}
                        <div className="h-24 w-24 shrink-0 overflow-hidden rounded-2xl bg-neutral-100 relative shadow-2xs border border-neutral-100">
                          <img 
                            src={product.imageUrl || "https://images.unsplash.com/photo-1546069901-ba9599a7e63c?q=80&w=300&auto=format&fit=crop"} 
                            alt={product.name} 
                            className={`h-full w-full object-cover transition duration-300 group-hover:scale-105 ${product.isOutOfStock ? "grayscale opacity-50" : ""}`}
                            referrerPolicy="no-referrer"
                          />
                          {isNewProduct(product) && (
                            <span className="absolute top-1.5 left-1.5 bg-emerald-500 text-white text-[8px] font-black uppercase px-1.5 py-0.5 rounded-md shadow-md z-10 tracking-wider">
                              Novo
                            </span>
                          )}
                          {qty > 0 && (
                            <span className="absolute top-1.5 right-1.5 theme-bg text-white text-[10px] font-black px-2 py-0.5 rounded-full shadow-md animate-in zoom-in duration-150">
                              {qty}x
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Floating Cart Button */}
      {cartTotalItems > 0 && !isCartOpen && (
        <div className="fixed bottom-0 left-0 right-0 p-4 z-40 bg-gradient-to-t from-neutral-50 pb-6 pt-12 pointer-events-none">
          <div className="mx-auto max-w-2xl pointer-events-auto">
            <button 
              onClick={() => setIsCartOpen(true)}
              className="flex w-full items-center justify-between rounded-full px-6 py-4 text-white shadow-lg theme-bg hover:opacity-90 transition"
            >
              <div className="flex items-center gap-3">
                <div className="flex h-6 w-6 justify-center items-center rounded-full bg-white/20 text-sm font-medium">
                  {cartTotalItems}
                </div>
                <span className="font-semibold">Ver carrinho</span>
              </div>
              <span className="font-bold">R$ {finalTotal.toFixed(2)}</span>
            </button>
          </div>
        </div>
      )}

      {/* Cart Drawer / Modal */}
      {isCartOpen && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 backdrop-blur-sm p-0 sm:p-4">
          <div className="w-full sm:max-w-md bg-white rounded-t-3xl sm:rounded-3xl shadow-2xl flex flex-col max-h-[90vh]">
            <div className="p-4 sm:p-6 border-b border-neutral-100 flex justify-between items-center">
              <h2 className="text-xl font-bold flex items-center gap-2 theme-text">
                <ShoppingBag size={20} /> Seu Pedido
              </h2>
              <button onClick={() => setIsCartOpen(false)} className="text-neutral-500 hover:text-neutral-900 p-2 rounded-full hover:bg-neutral-100">
                Fechar
              </button>
            </div>
            
            <div className="p-4 sm:p-6 overflow-y-auto flex-1">
              {cartItems.map(item => (
                <div key={item.key} className="flex justify-between items-start mb-4 bg-neutral-50 p-3 rounded-2xl ring-1 ring-neutral-200/50">
                  <div className="flex-1 min-w-0 pr-3">
                    <h4 className="font-semibold text-neutral-900 leading-tight">{item.qty}x {item.name}</h4>
                    {item.selectedFlavors && item.selectedFlavors.length > 0 && (
                      <div className="mt-1 space-y-0.5">
                        <span className="text-[9px] font-bold text-emerald-600 uppercase tracking-wider block">{restaurant?.genre === "Açaí" ? "Sabores" : restaurant?.genre === "Macarrões" ? "Massas" : restaurant?.genre === "Pastelaria" ? "Massas" : "Sabores"}:</span>
                        {item.selectedFlavors.map((fl, fIdx) => (
                          <p key={fIdx} className="text-[10px] text-neutral-500 font-medium leading-relaxed pl-1.5">
                            ✓ {fl.name}
                          </p>
                        ))}
                      </div>
                    )}
                    {item.selectedAddons && item.selectedAddons.length > 0 && (
                      <div className="mt-1 space-y-0.5">
                        <span className="text-[9px] font-bold text-orange-600 uppercase tracking-wider block">{restaurant?.genre === "Marmitaria" ? "Extras" : "Adicionais"}:</span>
                        {item.selectedAddons.map((addon, aIdx) => (
                          <p key={aIdx} className="text-[10px] text-neutral-500 font-medium leading-relaxed pl-1.5">
                            + {addon.name} ({addon.price > 0 ? `+ R$ ${addon.price.toFixed(2)}` : "Grátis"})
                          </p>
                        ))}
                      </div>
                    )}
                    {item.selectedComplements && item.selectedComplements.length > 0 && (
                      <div className="mt-2 space-y-0.5">
                        <span className="text-[9px] font-bold text-neutral-500 uppercase tracking-wider block">{restaurant?.genre === "Marmitaria" || restaurant?.genre === "Açaí" ? "Acompanhamentos" : "Complementos"}:</span>
                        {item.selectedComplements.map((comp, cIdx) => (
                          <p key={cIdx} className="text-[10px] text-neutral-500 font-medium leading-relaxed pl-1.5">
                            ✔ {comp.name}
                          </p>
                        ))}
                      </div>
                    )}
                    {item.selectedSauces && item.selectedSauces.length > 0 && (
                      <div className="mt-2 space-y-0.5">
                        <span className="text-[9px] font-bold text-red-600 uppercase tracking-wider block">Molhos:</span>
                        {item.selectedSauces.map((sauce, sIdx) => (
                          <p key={sIdx} className="text-[10px] text-neutral-500 font-medium leading-relaxed pl-1.5">
                            ✔ {sauce.name}
                          </p>
                        ))}
                      </div>
                    )}
                    {item.obs && (
                      <div className="mt-2 p-1.5 bg-white rounded-xl ring-1 ring-neutral-200/40">
                        <span className="text-[9px] font-bold text-neutral-450 uppercase tracking-wider block">Obs:</span>
                        <p className="text-[10px] text-neutral-600 font-semibold italic">"{item.obs}"</p>
                      </div>
                    )}
                    <p className="text-xs text-neutral-600 font-bold mt-1">R$ {(item.price * item.qty).toFixed(2)}</p>
                  </div>
                  <div className="flex items-center gap-2 rounded-full bg-white p-1 ring-1 ring-neutral-200/50 shrink-0 select-none">
                    <button onClick={() => updateQty(item.key, -1)} className="p-1 text-neutral-500 hover:text-neutral-900 bg-neutral-100 rounded-full transition">
                      <Minus size={14} />
                    </button>
                    <span className="w-4 text-center text-sm font-bold">{item.qty}</span>
                    <button onClick={() => updateQty(item.key, 1)} className="p-1 text-white rounded-full theme-bg hover:opacity-95 transition">
                      <Plus size={14} />
                    </button>
                  </div>
                </div>
              ))}
              
              <div className="mt-6 border-t border-neutral-100 pt-6">
                <div className="space-y-2 mb-6">
                  {checkoutType === "entrega" && deliveryFee > 0 ? (
                    <>
                      <div className="flex justify-between items-center text-sm">
                        <span className="text-neutral-500">Subtotal</span>
                        <span className="font-semibold text-neutral-900">R$ {cartTotal.toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between items-center text-sm">
                        <span className="text-neutral-500">Taxa de Entrega</span>
                        <span className="font-semibold text-neutral-900">R$ {deliveryFee.toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between items-center pt-2 border-t border-neutral-100">
                        <span className="text-neutral-700 font-bold">Total Final</span>
                        <span className="text-xl font-bold text-neutral-900">R$ {finalTotal.toFixed(2)}</span>
                      </div>
                    </>
                  ) : (
                    <div className="flex justify-between items-center">
                      <span className="text-neutral-600">Total</span>
                      <span className="text-xl font-bold text-neutral-900">R$ {finalTotal.toFixed(2)}</span>
                    </div>
                  )}
                </div>
                
                <div className="space-y-5">
                  <h3 className="font-bold text-neutral-900 border-b pb-2 text-sm uppercase tracking-wider text-neutral-400">Dados do Pedido</h3>
                  
                  {/* Nome e celular / mesa fixa */}
                  <div className="grid grid-cols-1 gap-3">
                    <div>
                      <label className="block text-xs font-bold text-neutral-700 mb-1">Seu Nome</label>
                      <input 
                        type="text" 
                        value={customerName}
                        onChange={e => setCustomerName(e.target.value)}
                        placeholder="Ex: João"
                        className="w-full rounded-xl border-y border-x border-neutral-200 bg-neutral-50/50 px-4 py-2.5 text-neutral-950 ring-1 ring-inset ring-neutral-200 focus:ring-2 focus:ring-inset theme-ring-focus sm:text-sm outline-none font-medium"
                      />
                    </div>
                    {!isTableQrMode && (
                      <div>
                        <label className="block text-xs font-bold text-neutral-700 mb-1">Telefone / WhatsApp de Contato</label>
                        <input 
                          type="text" 
                          value={contactPhone}
                          onChange={e => setContactPhone(e.target.value)}
                          placeholder="Ex: (85) 99127-6477"
                          className="w-full rounded-xl border-y border-x border-neutral-200 bg-neutral-50/50 px-4 py-2.5 text-neutral-950 ring-1 ring-inset ring-neutral-200 focus:ring-2 focus:ring-inset theme-ring-focus sm:text-sm outline-none font-medium text-mono"
                        />
                      </div>
                    )}
                    {isTableQrMode && (
                      <div>
                        <label className="block text-xs font-bold text-neutral-700 mb-1">Mesa</label>
                        <div className="w-full rounded-xl border border-neutral-200 bg-neutral-100 px-4 py-2.5 text-neutral-950 text-sm font-bold flex items-center justify-between">
                          <span>{formatTableName(tableNumber)}</span>
                          <span className="text-[10px] text-emerald-700 bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-200">Fixa</span>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Tipo de atendimento (Entrega, Retirada, Balcão) - Apenas se não for QR Code de Mesa */}
                  {!isTableQrMode && (
                    <div>
                      <label className="block text-xs font-bold text-neutral-700 mb-1.5">Opção de Atendimento</label>
                      <div className="grid grid-cols-3 gap-2">
                        <button
                          type="button"
                          onClick={() => setCheckoutType("entrega")}
                          className={`flex flex-col items-center justify-center p-2.5 rounded-xl border text-center transition cursor-pointer select-none ${
                            checkoutType === "entrega" 
                              ? "border-neutral-900 bg-neutral-900 text-white font-bold" 
                              : "border-neutral-200 bg-white text-neutral-700 hover:bg-neutral-50"
                          }`}
                        >
                          <Truck size={18} className="mb-1" />
                          <span className="text-[10px] font-bold">Entrega</span>
                        </button>
                        
                        <button
                          type="button"
                          onClick={() => setCheckoutType("retirada")}
                          className={`flex flex-col items-center justify-center p-2.5 rounded-xl border text-center transition cursor-pointer select-none ${
                            checkoutType === "retirada" 
                              ? "border-neutral-900 bg-neutral-900 text-white font-bold" 
                              : "border-neutral-200 bg-white text-neutral-700 hover:bg-neutral-50"
                          }`}
                        >
                          <Store size={18} className="mb-1" />
                          <span className="text-[10px] font-bold">Retirada</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => setCheckoutType("balcao")}
                          className={`flex flex-col items-center justify-center p-2.5 rounded-xl border text-center transition cursor-pointer select-none ${
                            checkoutType === "balcao" 
                              ? "border-neutral-900 bg-neutral-900 text-white font-bold" 
                              : "border-neutral-200 bg-white text-neutral-700 hover:bg-neutral-50"
                          }`}
                        >
                          <Hash size={18} className="mb-1" />
                          <span className="text-[10px] font-bold">Balcão/Mesa</span>
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Opções condicionais com base no atendimento */}
                  {!isTableQrMode && checkoutType === "entrega" && (
                    <div className="space-y-3 p-3.5 bg-neutral-50 border border-neutral-150 rounded-2xl">
                      {restaurant?.deliveryFees && restaurant.deliveryFees.length > 0 && (
                        <div>
                          <label className="block text-xs font-bold text-neutral-700 mb-1">Bairro / Taxa de Entrega</label>
                          <select 
                            value={selectedNeighborhood}
                            onChange={e => setSelectedNeighborhood(e.target.value)}
                            className="w-full rounded-xl border border-neutral-200 bg-white px-3 py-2 text-neutral-900 focus:ring-2 focus:ring-inset theme-ring-focus text-xs outline-none font-medium"
                          >
                            <option value="">Selecione o seu bairro</option>
                            {restaurant.deliveryFees.map((fee: any) => (
                              <option key={fee.id} value={fee.name}>
                                {fee.name} (+ R$ {fee.fee.toFixed(2)})
                              </option>
                            ))}
                          </select>
                        </div>
                      )}
                      <div>
                        <label className="block text-xs font-bold text-neutral-700 mb-1">Local de Entrega (Rua, Nº, Compl.)</label>
                        <textarea 
                          value={customerAddress}
                          onChange={e => setCustomerAddress(e.target.value)}
                          placeholder="Rua, Número, Quadra, Complemento..."
                          rows={2}
                          className="w-full rounded-xl border border-neutral-200 bg-white px-3 py-2 text-neutral-900 focus:ring-2 focus:ring-inset theme-ring-focus text-xs resize-none outline-none font-medium"
                        ></textarea>
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-neutral-700 mb-1">Complemento / Referência</label>
                        <input 
                          type="text" 
                          value={addressComplement}
                          onChange={e => setAddressComplement(e.target.value)}
                          placeholder="Apto, Bloco, Próximo a..."
                          className="w-full rounded-xl border border-neutral-200 bg-white px-3 py-2 text-xs text-neutral-900 focus:ring-2 focus:ring-inset theme-ring-focus outline-none font-medium"
                        />
                      </div>
                    </div>
                  )}

                  {!isTableQrMode && checkoutType === "balcao" && (
                    <div className="p-3.5 bg-neutral-50 border border-neutral-150 rounded-2xl text-left">
                      <label className="block text-xs font-bold text-neutral-700 mb-1">Número da Mesa ou Balcão</label>
                      {tables && tables.length > 0 ? (
                        <select
                          value={tableNumber}
                          onChange={e => setTableNumber(e.target.value)}
                          className="w-full rounded-xl border border-neutral-200 bg-white px-3 py-2 text-xs text-neutral-900 focus:ring-2 focus:ring-inset theme-ring-focus outline-none font-semibold cursor-pointer"
                        >
                          <option value="">Selecione sua mesa</option>
                          {tables.map(t => (
                            <option key={t.id} value={t.name}>
                              {formatTableName(t.name)}
                            </option>
                          ))}
                        </select>
                      ) : (
                        <input 
                          type="text" 
                          value={tableNumber}
                          onChange={e => setTableNumber(e.target.value)}
                          placeholder="Ex: Mesa 04 ou Balcão Principal"
                          className="w-full rounded-xl border border-neutral-200 bg-white px-3 py-2 text-xs text-neutral-900 focus:ring-2 focus:ring-inset theme-ring-focus outline-none font-semibold"
                        />
                      )}
                    </div>
                  )}

                  {!isTableQrMode && checkoutType === "retirada" && (
                    <div className="p-3.5 bg-neutral-50 border border-neutral-200/60 rounded-xl flex items-center gap-2">
                      <Store size={16} className="text-neutral-500 shrink-0" />
                      <p className="text-[10px] font-bold text-neutral-600 leading-normal">
                        Você fará a retirada do seu pedido diretamente no balcão do restaurante!
                      </p>
                    </div>
                  )}

                  {/* Forma de Pagamento */}
                  <div>
                    <label className="block text-xs font-bold text-neutral-700 mb-1.5">Forma de Pagamento</label>
                    <div className="grid grid-cols-3 gap-2">
                      <button
                        type="button"
                        onClick={() => setPaymentMethod("dinheiro")}
                        className={`flex flex-col items-center justify-center p-2.5 rounded-xl border text-center transition cursor-pointer select-none ${
                          paymentMethod === "dinheiro" 
                            ? "border-neutral-900 bg-neutral-900 text-white font-bold" 
                            : "border-neutral-200 bg-white text-neutral-700 hover:bg-neutral-50"
                        }`}
                      >
                        <Coins size={18} className="mb-1" />
                        <span className="text-[10px] font-bold">Dinheiro</span>
                      </button>
                      
                      <button
                        type="button"
                        onClick={() => setPaymentMethod("pix")}
                        className={`flex flex-col items-center justify-center p-2.5 rounded-xl border text-center transition cursor-pointer select-none ${
                          paymentMethod === "pix" 
                            ? "border-neutral-900 bg-neutral-900 text-white font-bold" 
                            : "border-neutral-200 bg-white text-neutral-700 hover:bg-neutral-50"
                        }`}
                      >
                        <QrCodeIcon size={18} className="mb-1" />
                        <span className="text-[10px] font-bold">Pix</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => setPaymentMethod("cartao")}
                        className={`flex flex-col items-center justify-center p-2.5 rounded-xl border text-center transition cursor-pointer select-none ${
                          paymentMethod === "cartao" 
                            ? "border-neutral-900 bg-neutral-900 text-white font-bold" 
                            : "border-neutral-200 bg-white text-neutral-700 hover:bg-neutral-50"
                        }`}
                      >
                        <CreditCard size={18} className="mb-1" />
                        <span className="text-[10px] font-bold">Cartão</span>
                      </button>
                    </div>
                  </div>

                  {/* Opções condicionais de pagamento */}
                  {paymentMethod === "dinheiro" && (
                    <div className="p-3.5 bg-neutral-50 border border-neutral-150 rounded-2xl">
                      <label className="block text-xs font-bold text-neutral-700 mb-1">Precisa de troco?</label>
                      <input 
                        type="text" 
                        value={changeFor}
                        onChange={e => setChangeFor(e.target.value)}
                        placeholder="Ex: Troco para R$ 100,00 ou deixe em branco"
                        className="w-full rounded-xl border border-neutral-200 bg-white px-3 py-2 text-xs text-neutral-900 focus:ring-2 focus:ring-inset theme-ring-focus outline-none font-medium"
                      />
                    </div>
                  )}

                  {paymentMethod === "pix" && (
                    <div className="p-4 bg-amber-50/40 border border-amber-200 rounded-2xl space-y-3.5">
                      <div className="flex items-center gap-2">
                        <QrCodeIcon size={16} className="text-amber-500 shrink-0" />
                        <span className="text-[11px] font-bold text-neutral-800">⚡ Pix Copia e Cola Gerado</span>
                      </div>
                      
                      {/* Live generated QR Code for the specific cart total */}
                      <div className="flex flex-col items-center justify-center bg-white p-3 rounded-xl border border-neutral-100 shadow-xs max-w-[180px] mx-auto">
                        <QRCode
                          value={getCartPixPayload()}
                          size={144}
                          style={{ height: "auto", maxWidth: "100%", width: "100%" }}
                        />
                        <span className="text-[9px] font-mono text-neutral-400 mt-2">Leitor Pix habilitado</span>
                      </div>

                      {/* Copia e Cola Field */}
                      <div>
                        <span className="text-[9.5px] font-black text-neutral-500 uppercase tracking-wide block mb-1">Código Pix (R$ {finalTotal.toFixed(2)})</span>
                        <div className="flex gap-1.5">
                          <input 
                            type="text" 
                            readOnly 
                            value={getCartPixPayload()} 
                            className="flex-1 bg-white border border-neutral-200 rounded-xl text-[10px] font-mono px-3 py-2 focus:outline-none select-all overflow-ellipsis truncate text-neutral-600 font-medium"
                          />
                          <button
                            type="button"
                            onClick={() => {
                              navigator.clipboard.writeText(getCartPixPayload());
                              setCopiedPix(true);
                              setTimeout(() => setCopiedPix(false), 2000);
                            }}
                            className="bg-neutral-900 text-white px-3 rounded-xl text-xs font-bold flex items-center justify-center cursor-pointer hover:bg-neutral-800 transition"
                          >
                            {copiedPix ? <Check size={14} className="text-green-400" /> : <Copy size={14} />}
                          </button>
                        </div>
                      </div>
                    </div>
                  )}

                  {paymentMethod === "cartao" && (
                    <div className="p-3.5 bg-neutral-50 border border-neutral-200/60 rounded-xl flex items-center gap-2">
                      <CreditCard size={16} className="text-neutral-500 shrink-0" />
                      <p className="text-[10px] font-bold text-neutral-600 leading-normal">
                        O pagamento via Cartão de Débito/Crédito será efetuado na entrega ou na retirada direto na maquininha.
                      </p>
                    </div>
                  )}

                  {/* Observações Gerais do Pedido */}
                  <div className="bg-white p-4 rounded-xl border border-neutral-200/80 shadow-sm mt-4">
                    <label className="block text-xs font-bold text-neutral-800 mb-2">
                      Observações do Pedido (Opcional)
                    </label>
                    <textarea
                      placeholder="Ex: Talheres descartáveis, troco para R$ 50, condomínio bloco B..."
                      value={orderObservation}
                      onChange={(e) => setOrderObservation(e.target.value)}
                      className="w-full h-20 p-3 rounded-lg border border-neutral-200 bg-neutral-50/50 text-sm font-medium focus:ring-2 focus:ring-inset theme-ring-focus outline-none transition resize-none placeholder:text-neutral-400 text-neutral-800 font-sans"
                    />
                  </div>

                </div>
              </div>
            </div>

            <div className="p-4 sm:p-6 border-t border-neutral-100 bg-neutral-50 sm:hidden">
              <button 
                onClick={handleCheckout}
                className="w-full flex items-center justify-center gap-2 rounded-full bg-[#25D366] px-6 py-4 text-base font-semibold text-white shadow-sm hover:bg-[#20bd5a] transition"
              >
                <MessageSquare size={20} />
                Enviar Pedido
              </button>
            </div>
            {/* Desktop fixed footer inside modal */}
            <div className="hidden sm:block p-6 border-t border-neutral-100 bg-neutral-50 rounded-b-3xl">
              <button 
                onClick={handleCheckout}
                className="w-full flex items-center justify-center gap-2 rounded-full bg-[#25D366] px-6 py-4 text-base font-semibold text-white shadow-sm hover:bg-[#20bd5a] transition"
              >
                <MessageSquare size={20} />
                Enviar Pedido
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Choice Modal for Complements/Addons (Native Bottom Sheet) */}
      {selectedProductForAddons && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="w-full max-w-md bg-white rounded-t-[32px] sm:rounded-3xl overflow-hidden shadow-2xl animate-in slide-in-from-bottom duration-250 font-sans max-h-[90vh] flex flex-col">
            {/* Drag handle bar for mobile app native feel */}
            <div className="sm:hidden w-full flex justify-center pt-2.5 pb-1 bg-white shrink-0">
              <div className="w-12 h-1.5 rounded-full bg-neutral-300" />
            </div>

            {/* Modal Image Header */}
            <div className="relative h-44 bg-neutral-100 shrink-0">
              <img 
                src={selectedProductForAddons.imageUrl || "https://images.unsplash.com/photo-1546069901-ba9599a7e63c?q=80&w=300&auto=format&fit=crop"} 
                alt={selectedProductForAddons.name} 
                className="w-full h-full object-cover" 
                referrerPolicy="no-referrer"
              />
              <button 
                type="button"
                onClick={() => {
                  setSelectedProductForAddons(null);
                  setItemObservationForProduct("");
                  setModalItemQty(1);
                }}
                className="absolute top-3 right-3 bg-white/90 hover:bg-white text-neutral-800 p-2 rounded-full shadow-md transition active:scale-90 cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-5 overflow-y-auto flex-1">
              {(() => {
                const activeProductSeg = getProductSegmentConfig(selectedProductForAddons.category, segmentConfig);
                const catLower = (selectedProductForAddons.category || "").toLowerCase();
                const nameLower = (selectedProductForAddons.name || "").toLowerCase();
                const isDrinkOrVitamina = 
                  catLower.includes("bebida") || catLower.includes("vitamina") || catLower.includes("suco") ||
                  catLower.includes("drink") || catLower.includes("cerveja") || catLower.includes("refrigerante") ||
                  catLower.includes("shake") || catLower.includes("smoothie") || catLower.includes("coquetel") ||
                  catLower.includes("chopp") || catLower.includes("chope") || catLower.includes("vinho") ||
                  catLower.includes("adega") || catLower.includes("bar") || catLower.includes("destilado") ||
                  nameLower.includes("bebida") || nameLower.includes("vitamina") || nameLower.includes("suco") ||
                  nameLower.includes("drink") || nameLower.includes("shake") || nameLower.includes("vitamina");
                const hasProductPrice = (Number(selectedProductForAddons.price) || 0) > 0;
                const hideFreeFlavorBadges = isDrinkOrVitamina && hasProductPrice;

                return (
                  <>
                    <div className="flex items-center gap-2 mb-1.5">
                      <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-black border ${activeProductSeg.themeAccentBg}`}>
                        <span>{activeProductSeg.badgeEmoji}</span>
                        <span>{selectedProductForAddons.category || activeProductSeg.segmentName}</span>
                      </span>
                    </div>

                    <h3 className="text-xl font-black text-neutral-900 tracking-tight">{selectedProductForAddons.name}</h3>
                    <p className="text-xs text-neutral-500 mt-1 leading-relaxed">{selectedProductForAddons.description}</p>
                    
                    {/* Notice alert when exceeding max selection limit */}
                    {selectionNotice && (
                      <div className="bg-amber-50 border border-amber-200 text-amber-900 text-xs font-bold px-3 py-2 rounded-xl flex items-center justify-between animate-in fade-in duration-200 mt-2 mb-1">
                        <span className="flex items-center gap-1.5">
                          <span>⚠️</span>
                          <span>{selectionNotice}</span>
                        </span>
                        <button onClick={() => setSelectionNotice(null)} className="text-amber-700 hover:text-amber-950 font-black ml-2 text-xs">✕</button>
                      </div>
                    )}

                    <div className="mt-3 border-t border-neutral-100 pt-4 space-y-4">
                      {/* section of flavors if any */}
                      {selectedProductForAddons.flavors && selectedProductForAddons.flavors.length > 0 && (() => {
                        const maxFlavors = selectedProductForAddons.maxFlavors || null;
                        const isFlavorsMaxReached = maxFlavors ? selectedFlavorsForProduct.length >= maxFlavors : false;
                        return (
                          <div className="bg-neutral-50/90 p-3.5 rounded-2xl border border-neutral-200/80">
                            <div className="flex items-center justify-between mb-1">
                              <h4 className="text-xs font-black text-neutral-900 tracking-tight flex items-center gap-1.5">
                                <span>{activeProductSeg.badgeEmoji}</span>
                                <span>{activeProductSeg.flavorLabel}</span>
                              </h4>
                              {!hideFreeFlavorBadges && (
                                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase ${maxFlavors ? "text-amber-800 bg-amber-100 border border-amber-200" : "text-emerald-700 bg-emerald-100"}`}>
                                  {maxFlavors ? `Escolha até ${maxFlavors}` : "Incluso"}
                                </span>
                              )}
                            </div>
                            <div className="flex items-center justify-between text-[11px] text-neutral-500 mb-3">
                              <span>{activeProductSeg.flavorSubtitle}</span>
                              {maxFlavors && (
                                <span className={`font-bold text-[10px] px-2 py-0.5 rounded-md ${isFlavorsMaxReached ? "bg-amber-100 text-amber-800 border border-amber-200" : "bg-neutral-200/60 text-neutral-600"}`}>
                                  {selectedFlavorsForProduct.length} / {maxFlavors}
                                </span>
                              )}
                            </div>
                            <div className="space-y-2">
                              {selectedProductForAddons.flavors.map((fl, idx) => {
                                const isChecked = selectedFlavorsForProduct.some(f => f.name === fl.name);
                                return (
                                  <label 
                                    key={idx} 
                                    className={`flex items-center justify-between p-3 rounded-xl border transition cursor-pointer select-none ${
                                      isChecked 
                                        ? "theme-border bg-white ring-2 theme-ring-focus shadow-2xs font-semibold" 
                                        : "border-neutral-200/80 bg-white hover:bg-neutral-100/50"
                                    }`}
                                  >
                                    <div className="flex items-center gap-3">
                                      <input 
                                        type="checkbox" 
                                        checked={isChecked}
                                        onChange={() => {
                                          setSelectedFlavorsForProduct(prev => {
                                            if (isChecked) {
                                              return prev.filter(f => f.name !== fl.name);
                                            } else {
                                              if (maxFlavors && maxFlavors === 1) {
                                                return [fl];
                                              }
                                              if (maxFlavors && prev.length >= maxFlavors) {
                                                setSelectionNotice(`Limite máximo de ${maxFlavors} sabor(es) atingido.`);
                                                setTimeout(() => setSelectionNotice(null), 3500);
                                                return prev;
                                              }
                                              setSelectionNotice(null);
                                              return [...prev, fl];
                                            }
                                          });
                                        }}
                                        className="h-4.5 w-4.5 rounded border-neutral-300 theme-text focus:ring-orange-500 cursor-pointer"
                                      />
                                      <span className="text-xs font-bold text-neutral-800">{fl.name}</span>
                                    </div>
                                    {!hideFreeFlavorBadges && (
                                      <span className="text-[10px] font-bold uppercase text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full">
                                        Grátis
                                      </span>
                                    )}
                                  </label>
                                );
                              })}
                            </div>
                          </div>
                        );
                      })()}

                      {/* section of addons if any */}
                      {selectedProductForAddons.addons && selectedProductForAddons.addons.length > 0 && (() => {
                        const maxAddons = selectedProductForAddons.maxAddons || null;
                        const isAddonsMaxReached = maxAddons ? selectedAddonsForProduct.length >= maxAddons : false;
                        return (
                          <div className="bg-neutral-50/90 p-3.5 rounded-2xl border border-neutral-200/80">
                            <div className="flex items-center justify-between mb-1">
                              <h4 className="text-xs font-black text-neutral-900 tracking-tight flex items-center gap-1.5">
                                <span>➕</span>
                                <span>{activeProductSeg.addonLabel}</span>
                              </h4>
                              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase ${maxAddons ? "text-amber-800 bg-amber-100 border border-amber-200" : "text-orange-700 bg-orange-100"}`}>
                                {maxAddons ? `Escolha até ${maxAddons}` : "Opcional"}
                              </span>
                            </div>
                            <div className="flex items-center justify-between text-[11px] text-neutral-500 mb-3">
                              <span>{activeProductSeg.addonSubtitle}</span>
                              {maxAddons && (
                                <span className={`font-bold text-[10px] px-2 py-0.5 rounded-md ${isAddonsMaxReached ? "bg-amber-100 text-amber-800 border border-amber-200" : "bg-neutral-200/60 text-neutral-600"}`}>
                                  {selectedAddonsForProduct.length} / {maxAddons}
                                </span>
                              )}
                            </div>
                            <div className="space-y-2">
                              {selectedProductForAddons.addons.map((addon, idx) => {
                                const isChecked = selectedAddonsForProduct.some(a => a.name === addon.name);
                                return (
                                  <label 
                                    key={idx} 
                                    className={`flex items-center justify-between p-3 rounded-xl border transition cursor-pointer select-none ${
                                      isChecked 
                                        ? "theme-border bg-white ring-2 theme-ring-focus shadow-2xs font-semibold" 
                                        : "border-neutral-200/80 bg-white hover:bg-neutral-100/50"
                                    }`}
                                  >
                                    <div className="flex items-center gap-3">
                                      <input 
                                        type="checkbox" 
                                        checked={isChecked}
                                        onChange={() => {
                                          setSelectedAddonsForProduct(prev => {
                                            if (isChecked) {
                                              return prev.filter(a => a.name !== addon.name);
                                            } else {
                                              if (maxAddons && maxAddons === 1) {
                                                return [addon];
                                              }
                                              if (maxAddons && prev.length >= maxAddons) {
                                                setSelectionNotice(`Limite máximo de ${maxAddons} adicional(is) atingido.`);
                                                setTimeout(() => setSelectionNotice(null), 3500);
                                                return prev;
                                              }
                                              setSelectionNotice(null);
                                              return [...prev, addon];
                                            }
                                          });
                                        }}
                                        className="h-4.5 w-4.5 rounded border-neutral-300 theme-text focus:ring-orange-500 cursor-pointer"
                                      />
                                      <span className="text-xs font-bold text-neutral-800">{addon.name}</span>
                                    </div>
                                    <span className="text-xs font-mono font-black text-orange-600 bg-orange-50 px-2.5 py-0.5 rounded-full">
                                      + R$ {addon.price.toFixed(2)}
                                    </span>
                                  </label>
                                );
                              })}
                            </div>
                          </div>
                        );
                      })()}

                      {/* section of complements if any */}
                      {selectedProductForAddons.complements && selectedProductForAddons.complements.length > 0 && (() => {
                        const maxComplements = selectedProductForAddons.maxComplements || null;
                        const isComplementsMaxReached = maxComplements ? selectedComplementsForProduct.length >= maxComplements : false;
                        return (
                          <div className="bg-neutral-50/90 p-3.5 rounded-2xl border border-neutral-200/80">
                            <div className="flex items-center justify-between mb-1">
                              <h4 className="text-xs font-black text-neutral-900 tracking-tight flex items-center gap-1.5">
                                <span>✨</span>
                                <span>{activeProductSeg.complementLabel}</span>
                              </h4>
                              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase ${maxComplements ? "text-amber-800 bg-amber-100 border border-amber-200" : "text-emerald-700 bg-emerald-100"}`}>
                                {maxComplements ? `Escolha até ${maxComplements}` : "Sem Custo"}
                              </span>
                            </div>
                            <div className="flex items-center justify-between text-[11px] text-neutral-500 mb-3">
                              <span>{activeProductSeg.complementSubtitle}</span>
                              {maxComplements && (
                                <span className={`font-bold text-[10px] px-2 py-0.5 rounded-md ${isComplementsMaxReached ? "bg-amber-100 text-amber-800 border border-amber-200" : "bg-neutral-200/60 text-neutral-600"}`}>
                                  {selectedComplementsForProduct.length} / {maxComplements}
                                </span>
                              )}
                            </div>
                            <div className="space-y-2">
                              {selectedProductForAddons.complements.map((comp, idx) => {
                                const isChecked = selectedComplementsForProduct.some(c => c.name === comp.name);
                                return (
                                  <label 
                                    key={idx} 
                                    className={`flex items-center justify-between p-3 rounded-xl border transition cursor-pointer select-none ${
                                      isChecked 
                                        ? "theme-border bg-white ring-2 theme-ring-focus shadow-2xs font-semibold" 
                                        : "border-neutral-200/80 bg-white hover:bg-neutral-100/50"
                                    }`}
                                  >
                                    <div className="flex items-center gap-3">
                                      <input 
                                        type="checkbox" 
                                        checked={isChecked}
                                        onChange={() => {
                                          setSelectedComplementsForProduct(prev => {
                                            if (isChecked) {
                                              return prev.filter(c => c.name !== comp.name);
                                            } else {
                                              if (maxComplements && maxComplements === 1) {
                                                return [comp];
                                              }
                                              if (maxComplements && prev.length >= maxComplements) {
                                                setSelectionNotice(`Limite máximo de ${maxComplements} complemento(s) atingido.`);
                                                setTimeout(() => setSelectionNotice(null), 3500);
                                                return prev;
                                              }
                                              setSelectionNotice(null);
                                              return [...prev, comp];
                                            }
                                          });
                                        }}
                                        className="h-4.5 w-4.5 rounded border-neutral-300 theme-text focus:ring-orange-500 cursor-pointer"
                                      />
                                      <span className="text-xs font-bold text-neutral-800">{comp.name}</span>
                                    </div>
                                    <span className="text-[10px] font-bold text-emerald-600 uppercase tracking-wider bg-emerald-50 px-2 py-0.5 rounded-full">
                                      Grátis
                                    </span>
                                  </label>
                                );
                              })}
                            </div>
                          </div>
                        );
                      })()}

                      {/* section of sauces if any */}
                      {selectedProductForAddons.sauces && selectedProductForAddons.sauces.length > 0 && (() => {
                        const maxSauces = selectedProductForAddons.maxSauces || null;
                        const isSaucesMaxReached = maxSauces ? selectedSaucesForProduct.length >= maxSauces : false;
                        return (
                          <div className="bg-neutral-50/90 p-3.5 rounded-2xl border border-neutral-200/80">
                            <div className="flex items-center justify-between mb-1">
                              <h4 className="text-xs font-black text-neutral-900 tracking-tight flex items-center gap-1.5">
                                <span>🌶️</span>
                                <span>{activeProductSeg.sauceLabel}</span>
                              </h4>
                              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase ${maxSauces ? "text-amber-800 bg-amber-100 border border-amber-200" : "text-rose-700 bg-rose-100"}`}>
                                {maxSauces ? `Escolha até ${maxSauces}` : "Acompanhamentos"}
                              </span>
                            </div>
                            <div className="flex items-center justify-between text-[11px] text-neutral-500 mb-3">
                              <span>{activeProductSeg.sauceSubtitle}</span>
                              {maxSauces && (
                                <span className={`font-bold text-[10px] px-2 py-0.5 rounded-md ${isSaucesMaxReached ? "bg-amber-100 text-amber-800 border border-amber-200" : "bg-neutral-200/60 text-neutral-600"}`}>
                                  {selectedSaucesForProduct.length} / {maxSauces}
                                </span>
                              )}
                            </div>
                            <div className="space-y-2">
                              {selectedProductForAddons.sauces.map((sauce, idx) => {
                                const isChecked = selectedSaucesForProduct.some(s => s.name === sauce.name);
                                return (
                                  <label 
                                    key={idx} 
                                    className={`flex items-center justify-between p-3 rounded-xl border transition cursor-pointer select-none ${
                                      isChecked 
                                        ? "theme-border bg-white ring-2 theme-ring-focus shadow-2xs font-semibold" 
                                        : "border-neutral-200/80 bg-white hover:bg-neutral-100/50"
                                    }`}
                                  >
                                    <div className="flex items-center gap-3">
                                      <input 
                                        type="checkbox" 
                                        checked={isChecked}
                                        onChange={() => {
                                          setSelectedSaucesForProduct(prev => {
                                            if (isChecked) {
                                              return prev.filter(s => s.name !== sauce.name);
                                            } else {
                                              if (maxSauces && maxSauces === 1) {
                                                return [sauce];
                                              }
                                              if (maxSauces && prev.length >= maxSauces) {
                                                setSelectionNotice(`Limite máximo de ${maxSauces} molho(s) atingido.`);
                                                setTimeout(() => setSelectionNotice(null), 3500);
                                                return prev;
                                              }
                                              setSelectionNotice(null);
                                              return [...prev, sauce];
                                            }
                                          });
                                        }}
                                        className="h-4.5 w-4.5 rounded border-neutral-300 theme-text focus:ring-orange-500 cursor-pointer"
                                      />
                                      <span className="text-xs font-bold text-neutral-800">{sauce.name}</span>
                                    </div>
                                    <span className="text-[10px] font-bold text-rose-600 uppercase tracking-wider bg-rose-50 px-2 py-0.5 rounded-full">
                                      Grátis
                                    </span>
                                  </label>
                                );
                              })}
                            </div>
                          </div>
                        );
                      })()}
                    </div>

                    {/* Observações do Item */}
                    <div className="mt-4 pt-3 border-t border-neutral-100">
                      <label className="text-xs font-bold text-neutral-800 uppercase tracking-wider block mb-1.5">
                        Observações para o item (Opcional)
                      </label>
                      <textarea
                        placeholder="Ex: Ponto da carne, sem cebola, molho à parte..."
                        value={itemObservationForProduct}
                        onChange={(e) => setItemObservationForProduct(e.target.value)}
                        className="w-full h-16 p-3 rounded-xl border border-neutral-200 bg-neutral-50/50 text-xs font-semibold focus:ring-2 focus:ring-orange-500 focus:bg-white outline-none transition resize-none placeholder:text-neutral-400 text-neutral-800"
                        maxLength={150}
                      />
                    </div>
                  </>
                );
              })()}

              {/* Stepper + Subtotal CTA */}
              <div className="mt-5 pt-4 border-t border-neutral-200 flex flex-col sm:flex-row items-center justify-between gap-3">
                <div className="flex items-center gap-3 bg-neutral-100/80 p-1.5 rounded-full border border-neutral-200 w-full sm:w-auto justify-between sm:justify-start">
                  <button
                    type="button"
                    onClick={() => setModalItemQty(Math.max(1, modalItemQty - 1))}
                    className="w-8 h-8 rounded-full bg-white text-neutral-700 shadow-xs flex items-center justify-center hover:bg-neutral-50 active:scale-95 transition font-black cursor-pointer"
                  >
                    <Minus size={14} className="stroke-[3]" />
                  </button>
                  <span className="text-xs font-black font-mono px-2 text-neutral-900">{modalItemQty}x</span>
                  <button
                    type="button"
                    onClick={() => setModalItemQty(modalItemQty + 1)}
                    className="w-8 h-8 rounded-full theme-bg text-white shadow-xs flex items-center justify-center hover:opacity-90 active:scale-95 transition font-black cursor-pointer"
                  >
                    <Plus size={14} className="stroke-[3]" />
                  </button>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    addToCart(
                      selectedProductForAddons,
                      selectedFlavorsForProduct,
                      selectedAddonsForProduct,
                      selectedComplementsForProduct,
                      selectedSaucesForProduct,
                      itemObservationForProduct,
                      modalItemQty
                    );
                    setSelectedProductForAddons(null);
                    setItemObservationForProduct("");
                    setModalItemQty(1);
                  }}
                  className="w-full sm:w-auto flex-1 theme-bg text-white font-extrabold text-xs py-3.5 px-5 rounded-2xl shadow-md hover:opacity-90 active:scale-[0.98] transition cursor-pointer flex items-center justify-between gap-3"
                >
                  <span>Adicionar ao Pedido</span>
                  <span className="font-mono bg-black/20 px-2.5 py-1 rounded-xl text-xs font-black">
                    R$ {((selectedProductForAddons.price + selectedAddonsForProduct.reduce((sum, a) => sum + a.price, 0)) * modalItemQty).toFixed(2)}
                  </span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Success Modal */}
      {orderSuccess && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="w-full max-w-sm bg-white rounded-3xl shadow-2xl p-6 text-center animate-in fade-in zoom-in duration-250">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-green-50 text-green-600 mb-4 ring-8 ring-green-100/50">
              <CheckCircle2 size={36} />
            </div>
            <h3 className="text-xl font-black text-neutral-900 tracking-tight">Pedido Enviado!</h3>
            <p className="mt-2 text-xs text-neutral-500 leading-relaxed">
              O seu pedido foi enviado com sucesso para o painel do restaurante e estamos te levando para o WhatsApp para confirmação! 🎉
            </p>
            <button
              onClick={() => setOrderSuccess(false)}
              className="mt-6 w-full py-3.5 px-4 text-xs font-bold text-white theme-bg rounded-2xl hover:opacity-90 active:scale-[0.98] transition cursor-pointer"
            >
              Entendido
            </button>
          </div>
        </div>
      )}

      {/* Modal de Identificação Inicial (Nome, Whatsapp e Endereço) */}
      {showIdentifyModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-neutral-900/60 backdrop-blur-md p-4 animate-in fade-in duration-200">
          <div className="w-full max-w-md bg-white rounded-3xl shadow-2xl overflow-hidden relative animate-in zoom-in-95 duration-250 border border-neutral-100">
            {/* Linha decorativa da marca de acordo com o tema */}
            <div className="h-2.5 theme-bg w-full" />
            
            <div className="p-6">
              <div className="mb-5 flex items-center gap-3">
                <div className="p-2.5 rounded-full bg-orange-50 text-orange-600">
                  <Store size={22} className="theme-color" />
                </div>
                <div>
                  <h3 className="text-lg font-black text-neutral-900 tracking-tight">Seja Bem-vindo(a)!</h3>
                  <p className="text-xs text-neutral-400 font-medium">Preencha seus dados para começar e agilizar seus pedidos</p>
                </div>
              </div>

              <form onSubmit={(e) => {
                e.preventDefault();
                if (!tempName.trim()) {
                  alert("Por favor, preencha o seu nome.");
                  return;
                }
                if (!isTableQrMode) {
                  if (!tempPhone.trim()) {
                    alert("Por favor, preencha o seu WhatsApp.");
                    return;
                  }
                  if (!tempAddress.trim()) {
                    alert("Por favor, preencha o seu endereço.");
                    return;
                  }
                  if (restaurant?.deliveryFees && restaurant.deliveryFees.length > 0 && !tempNeighborhood) {
                    alert("Por favor, selecione o seu bairro.");
                    return;
                  }
                }
                
                setCustomerName(tempName.trim());
                if (!isTableQrMode) {
                  setContactPhone(tempPhone.trim());
                  setCustomerAddress(tempAddress.trim());
                  setSelectedNeighborhood(tempNeighborhood);
                }
                setTableNumber(tempTable);
                setShowIdentifyModal(false);

                if (isTableQrMode && restaurant && tempTable) {
                  const targetOwnerId = restaurant.ownerId || restaurant.id;
                  if (targetOwnerId) {
                    (async () => {
                      try {
                        const q = query(
                          collection(db, "tables"),
                          where("restaurantId", "==", targetOwnerId),
                          where("name", "==", tempTable.trim())
                        );
                        const snap = await getDocs(q);
                        if (!snap.empty) {
                          await updateDoc(doc(db, "tables", snap.docs[0].id), {
                            customerName: tempName.trim(),
                            updatedAt: Date.now()
                          });
                        }
                      } catch (err) {
                        console.error("Erro ao atualizar nome do cliente na mesa:", err);
                      }
                    })();
                  }
                }
              }} className="space-y-4">
                <div>
                  <label className="block text-[10px] font-extrabold text-neutral-500 uppercase tracking-widest mb-1">
                    {isTableQrMode ? "Seu Nome (para a Mesa)" : "Seu Nome"}
                  </label>
                  <input 
                    type="text" 
                    required
                    value={tempName}
                    onChange={e => setTempName(e.target.value)}
                    placeholder={isTableQrMode ? "Ex: João" : "Ex: João da Silva"}
                    className="w-full rounded-2xl border border-neutral-200 bg-neutral-50/50 px-4 py-3 text-neutral-950 placeholder:text-neutral-400 focus:ring-2 focus:ring-orange-500 focus:outline-none text-xs font-semibold shadow-sm transition"
                  />
                </div>

                {!isTableQrMode && (
                  <>
                    <div>
                      <label className="block text-[10px] font-extrabold text-neutral-500 uppercase tracking-widest mb-1">Telefone / WhatsApp</label>
                      <input 
                        type="text" 
                        required
                        value={tempPhone}
                        onChange={e => setTempPhone(e.target.value)}
                        placeholder="Ex: (85) 99127-6477"
                        className="w-full rounded-2xl border border-neutral-200 bg-neutral-50/50 px-4 py-3 text-neutral-950 placeholder:text-neutral-400 focus:ring-2 focus:ring-orange-500 focus:outline-none text-xs font-semibold shadow-sm transition font-mono"
                      />
                    </div>

                    {restaurant?.deliveryFees && restaurant.deliveryFees.length > 0 && (
                      <div>
                        <label className="block text-[10px] font-extrabold text-neutral-500 uppercase tracking-widest mb-1">Seu Bairro</label>
                        <select 
                          required
                          value={tempNeighborhood}
                          onChange={e => setTempNeighborhood(e.target.value)}
                          className="w-full rounded-2xl border border-neutral-200 bg-neutral-50/50 px-4 py-3 text-neutral-950 focus:ring-2 focus:ring-orange-500 focus:outline-none text-xs font-semibold shadow-sm transition outline-none"
                        >
                          <option value="">Selecione o seu bairro</option>
                          {restaurant.deliveryFees.map((fee: any) => (
                            <option key={fee.id} value={fee.name}>
                              {fee.name} (+ R$ {fee.fee.toFixed(2)})
                            </option>
                          ))}
                        </select>
                      </div>
                    )}

                    <div>
                      <label className="block text-[10px] font-extrabold text-neutral-500 uppercase tracking-widest mb-1">Seu Endereço de Entrega</label>
                      <textarea 
                        required
                        value={tempAddress}
                        onChange={e => setTempAddress(e.target.value)}
                        placeholder="Ex: Rua Floriano Peixoto, 123 - Apt 402, Aldeota"
                        rows={2.5}
                        className="w-full rounded-2xl border border-neutral-200 bg-neutral-50/50 px-4 py-2.5 text-neutral-950 placeholder:text-neutral-400 focus:ring-2 focus:ring-orange-500 focus:outline-none text-xs font-semibold shadow-sm transition resize-none"
                      />
                    </div>
                  </>
                )}

                <div className="bg-orange-50/30 p-3 rounded-2xl flex gap-2 border border-orange-100/30">
                  <AlertCircle size={14} className="text-orange-600 shrink-0 mt-0.5" />
                  <p className="text-[10px] text-neutral-500 font-medium leading-relaxed">
                    Essas informações serão salvas no seu navegador e estarão preenchidas automaticamente quando você for finalizar a compra!
                  </p>
                </div>

                <div className="pt-2 flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setShowIdentifyModal(false)}
                    className="w-1/3 py-3 px-4 text-xs font-bold text-neutral-400 hover:text-neutral-700 bg-neutral-55 hover:bg-neutral-100 rounded-2xl transition duration-150 cursor-pointer"
                  >
                    Pular
                  </button>
                  <button
                    type="submit"
                    className="flex-1 py-3 px-4 text-xs font-extrabold text-white theme-bg rounded-2xl hover:opacity-95 active:scale-[0.98] transition cursor-pointer shadow-md shadow-orange-650/5 text-center"
                  >
                    Confirmar e Entrar
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Modal / Popout de Edição de Perfil */}
      {showProfileModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-neutral-900/60 backdrop-blur-md p-4 animate-in fade-in duration-200">
          <div className="w-full max-w-md bg-white rounded-3xl shadow-2xl overflow-hidden relative animate-in zoom-in-95 duration-250 border border-neutral-100">
            {/* Upper color accent bar */}
            <div className="h-2.5 theme-bg w-full" />
            
            <div className="p-6">
              <div className="mb-5 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 rounded-full bg-orange-50 text-orange-600">
                    <User size={22} className="theme-color" />
                  </div>
                  <div>
                    <h3 className="text-lg font-black text-neutral-900 tracking-tight text-left">Editar Seu Perfil</h3>
                    <p className="text-xs text-neutral-400 font-medium text-left">Atualize seus dados para entrega e pedidos</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setShowProfileModal(false)}
                  className="p-1.5 rounded-full hover:bg-neutral-100 text-neutral-400 hover:text-neutral-600 transition"
                >
                  <X size={18} />
                </button>
              </div>

              <form onSubmit={(e) => {
                e.preventDefault();
                if (!tempName.trim()) {
                  alert("Por favor, preencha o seu nome.");
                  return;
                }
                if (!tempPhone.trim()) {
                  alert("Por favor, preencha o seu WhatsApp.");
                  return;
                }
                if (!tempAddress.trim()) {
                  alert("Por favor, preencha o seu endereço.");
                  return;
                }
                if (restaurant?.deliveryFees && restaurant.deliveryFees.length > 0 && !tempNeighborhood) {
                  alert("Por favor, selecione o seu bairro.");
                  return;
                }
                
                setCustomerName(tempName.trim());
                setContactPhone(tempPhone.trim());
                setCustomerAddress(tempAddress.trim());
                setSelectedNeighborhood(tempNeighborhood);
                
                // Save to localStorage directly to be absolutely sure
                localStorage.setItem("customer_name", tempName.trim());
                localStorage.setItem("customer_phone", tempPhone.trim());
                localStorage.setItem("customer_address", tempAddress.trim());
                localStorage.setItem("customer_neighborhood", tempNeighborhood);
                
                setShowProfileModal(false);
              }} className="space-y-4 text-left">
                <div>
                  <label className="block text-[10px] font-extrabold text-neutral-500 uppercase tracking-widest mb-1">Seu Nome</label>
                  <input 
                    type="text" 
                    required
                    value={tempName}
                    onChange={e => setTempName(e.target.value)}
                    placeholder="Ex: João da Silva"
                    className="w-full rounded-2xl border border-neutral-200 bg-neutral-50/50 px-4 py-3 text-neutral-950 placeholder:text-neutral-400 focus:ring-2 focus:ring-orange-500 focus:outline-none text-xs font-semibold shadow-sm transition"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-extrabold text-neutral-500 uppercase tracking-widest mb-1">Telefone / WhatsApp</label>
                  <input 
                    type="text" 
                    required
                    value={tempPhone}
                    onChange={e => setTempPhone(e.target.value)}
                    placeholder="Ex: (85) 99127-6477"
                    className="w-full rounded-2xl border border-neutral-200 bg-neutral-50/50 px-4 py-3 text-neutral-950 placeholder:text-neutral-400 focus:ring-2 focus:ring-orange-500 focus:outline-none text-xs font-semibold shadow-sm transition font-mono"
                  />
                </div>

                {restaurant?.deliveryFees && restaurant.deliveryFees.length > 0 ? (
                  <div>
                    <label className="block text-[10px] font-extrabold text-neutral-500 uppercase tracking-widest mb-1">Seu Bairro</label>
                    <select 
                      required
                      value={tempNeighborhood}
                      onChange={e => setTempNeighborhood(e.target.value)}
                      className="w-full rounded-2xl border border-neutral-200 bg-neutral-50/50 px-4 py-3 text-neutral-950 focus:ring-2 focus:ring-orange-500 focus:outline-none text-xs font-semibold shadow-sm transition outline-none"
                    >
                      <option value="">Selecione o seu bairro</option>
                      {restaurant.deliveryFees.map((fee: any) => (
                        <option key={fee.id} value={fee.name}>
                          {fee.name} (+ R$ {fee.fee.toFixed(2)})
                        </option>
                      ))}
                    </select>
                  </div>
                ) : (
                  <div>
                    <label className="block text-[10px] font-extrabold text-neutral-500 uppercase tracking-widest mb-1">Seu Bairro</label>
                    <input 
                      type="text" 
                      value={tempNeighborhood}
                      onChange={e => setTempNeighborhood(e.target.value)}
                      placeholder="Ex: Aldeota"
                      className="w-full rounded-2xl border border-neutral-200 bg-neutral-50/50 px-4 py-3 text-neutral-950 placeholder:text-neutral-400 focus:ring-2 focus:ring-orange-500 focus:outline-none text-xs font-semibold shadow-sm transition"
                    />
                  </div>
                )}

                <div>
                  <label className="block text-[10px] font-extrabold text-neutral-500 uppercase tracking-widest mb-1">Seu Endereço de Entrega</label>
                  <textarea 
                    required
                    value={tempAddress}
                    onChange={e => setTempAddress(e.target.value)}
                    placeholder="Ex: Rua Floriano Peixoto, 123"
                    rows={2.5}
                    className="w-full rounded-2xl border border-neutral-200 bg-neutral-50/50 px-4 py-2.5 text-neutral-950 placeholder:text-neutral-400 focus:ring-2 focus:ring-orange-500 focus:outline-none text-xs font-semibold shadow-sm transition resize-none"
                  />
                </div>

                <div className="pt-2 flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setShowProfileModal(false)}
                    className="w-1/3 py-3 px-4 text-xs font-bold text-neutral-400 hover:text-neutral-700 bg-neutral-50 hover:bg-neutral-100 rounded-2xl transition duration-150 cursor-pointer"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    className="flex-1 py-3 px-4 text-xs font-extrabold text-white theme-bg rounded-2xl hover:opacity-95 active:scale-[0.98] transition cursor-pointer shadow-md shadow-orange-650/5 text-center"
                  >
                    Salvar Alterações
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
      {/* Modal de Sucesso em Pedido de Mesa */}
      {tableOrderSuccessModal && lastTableOrderDetails && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-neutral-900/60 backdrop-blur-md p-4 animate-in fade-in duration-200">
          <div className="w-full max-w-sm bg-white rounded-3xl p-6 shadow-2xl border border-neutral-100 text-center relative animate-in zoom-in-95 duration-200">
            <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto mb-4">
              <CheckCircle2 size={36} />
            </div>
            
            <span className="px-3 py-1 bg-orange-100 text-orange-800 rounded-full text-xs font-black uppercase tracking-wider inline-block mb-2">
              {formatTableName(lastTableOrderDetails.tableNumber)}
            </span>

            <h3 className="text-xl font-black text-neutral-900 tracking-tight">Pedido Lançado na Mesa!</h3>
            <p className="text-xs text-neutral-500 mt-2 leading-relaxed">
              Olá <strong className="text-neutral-800">{lastTableOrderDetails.customerName}</strong>, seus itens foram adicionados à comanda da sua mesa e enviados para o estabelecimento.
            </p>

            <div className="bg-neutral-50 p-3.5 rounded-2xl border border-neutral-200/80 my-4 text-left">
              <div className="text-[10px] font-extrabold text-neutral-400 uppercase tracking-widest mb-1.5">Itens deste Pedido</div>
              <div className="space-y-1.5 max-h-40 overflow-y-auto pr-1">
                {lastTableOrderDetails.items?.map((item: any, idx: number) => (
                  <div key={idx} className="flex justify-between text-xs py-1 border-b border-neutral-100 last:border-0 font-medium text-neutral-700">
                    <span>{item.qty}x {item.name}</span>
                    <span className="font-mono font-bold text-neutral-900">R$ {(item.price * item.qty).toFixed(2)}</span>
                  </div>
                ))}
              </div>
              <div className="flex justify-between items-center mt-2.5 pt-2 border-t border-neutral-200 text-xs font-black text-neutral-900">
                <span>Subtotal Lançado:</span>
                <span className="text-orange-600 font-mono">R$ {Number(lastTableOrderDetails.total || 0).toFixed(2)}</span>
              </div>
            </div>

            <p className="text-[11px] text-neutral-400 mb-5 leading-snug">
              💡 Você pode continuar navegando e pedir novos itens a qualquer momento. Ao encerrar suas refeições, solicite a conta ao atendimento.
            </p>

            <button
              type="button"
              onClick={() => setTableOrderSuccessModal(false)}
              className="w-full theme-bg text-white font-extrabold py-3.5 rounded-2xl text-xs shadow-md hover:opacity-95 active:scale-98 transition cursor-pointer"
            >
              Fazer Novos Pedidos
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
