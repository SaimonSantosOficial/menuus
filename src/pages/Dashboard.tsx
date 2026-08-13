import { formatTableName } from "../lib/tableUtils";
import { useState, useEffect, useRef } from "react";
import { Menu, BarChart3, Box, Tags, Palette, QrCode, CreditCard, LogOut, Plus, Minus, Trash2, ExternalLink, ChevronDown, Check, Copy, ClipboardList, Clock, CheckCircle2, Truck, MessageSquare, AlertCircle, FileDown, FileText, Pencil, Users, ShoppingCart, Search, Store, Printer, X, ArrowUp, ArrowDown, Layers, Utensils, Cpu, Sparkles, User, Eye, EyeOff, Megaphone, Download, Upload, Gift, Percent, Calendar } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { auth, db } from "../lib/firebase";
import { onAuthStateChanged, signOut, getAuth, createUserWithEmailAndPassword } from "firebase/auth";
import { doc, getDoc, setDoc, updateDoc, collection, query, where, onSnapshot, addDoc, deleteDoc, getDocs } from "firebase/firestore";
import { initializeApp, getApps } from "firebase/app";
import firebaseConfig from "../firebase-applet-config.json";
import { jsPDF } from "jspdf";

type Tab = "overview" | "pdv" | "orders" | "products" | "categories" | "tables" | "waiters" | "appearance" | "store_settings" | "announcements" | "qrcode" | "subscription" | "promotions" | "print_menu";

const NEW_ORDER_URL = "https://download939.mediafire.com/oy5pxd7967igBkmfBbaUyntnurZDtMmjXU1EIqTimC0ruoS1kqu6Q8QP_JP1mf6tSQj8lVa85dFzgJQQPRaMk2UXYL6BvdG0emEhDIpW64QYQznL15LeOiaS1EQxASGR5N-WACmWRR0ruNNE4910wjAJxUIYG5jQPb4KTwRRjJEB9C8/liwe61r0v7y76xj/novopedido.mp3";
const READY_ORDER_URL = "https://download1347.mediafire.com/bo37rcfr8cfgYeHjxku1Hc_NpmjNS1CrP8UgB7E4yIDBKpijhbqd58CTeiq75xaQoU10m665M5qjtc--vbsbjWs0llhyIEal-D9RQO-PrK3bTsLYy_rCcG4mxq6tU3cJARpg5660NgDBQo3Ku_x17OdOYhJPbD0PKk4OopEKwzxbMpQ/ny79g03dnwhon2j/pedidopronto.mp3";

export default function Dashboard() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<Tab>("overview");
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [hideMetrics, setHideMetrics] = useState(() => localStorage.getItem("hide_metrics") === "true");
  const [appearanceSubTab, setAppearanceSubTab] = useState<"visual" | "store_settings">("visual");
  const [previewPaperWidth, setPreviewPaperWidth] = useState<"58mm" | "80mm">(() => {
    return (localStorage.getItem("printer_paper_width") as "58mm" | "80mm") || "80mm";
  });
  const [printerFontSize, setPrinterFontSize] = useState<number>(() => {
    const saved = localStorage.getItem("printer_font_size");
    return saved ? parseInt(saved, 10) : 14;
  });
  const [previewDestination, setPreviewDestination] = useState<"cozinha" | "cliente">("cliente");
  const [previewSelectedOrderId, setPreviewSelectedOrderId] = useState<string>("mock");
  const [autoConnectEnabled, setAutoConnectEnabled] = useState<boolean>(() => {
    return localStorage.getItem("printer_auto_connect") !== "false";
  });

  const handleSetPaperWidth = (width: "58mm" | "80mm") => {
    setPreviewPaperWidth(width);
    localStorage.setItem("printer_paper_width", width);
  };

  const handleSetFontSize = (size: number) => {
    setPrinterFontSize(size);
    localStorage.setItem("printer_font_size", String(size));
  };

  const handleSetAutoConnect = (enabled: boolean) => {
    setAutoConnectEnabled(enabled);
    localStorage.setItem("printer_auto_connect", String(enabled));
  };


  const prevOrdersRef = useRef<Record<string, any>>({});
  const prevTablesRef = useRef<Record<string, any>>({});
  const hasLoadedTablesRef = useRef(false);
  const [toasts, setToasts] = useState<{ id: string; message: string; type: "new" | "ready"; visible: boolean }[]>([]);

  const playNotification = (type: "new" | "ready") => {
    try {
      const audio = new Audio(type === "new" ? NEW_ORDER_URL : READY_ORDER_URL);
      audio.play().catch(e => console.warn("Áudio bloqueado pelo navegador:", e));
    } catch (err) {
      console.error("Erro ao configurar áudio", err);
    }
  };

  const addToast = (message: string, type: "new" | "ready") => {
    const id = Math.random().toString(36).substring(2, 9);
    setToasts(prev => [...prev, { id, message, type, visible: true }]);
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 5000);
  };

  // Auth & Data State
  const [user, setUser] = useState<any>(null);
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  const [restaurant, setRestaurant] = useState<any>(null);
  const [products, setProducts] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [tables, setTables] = useState<any[]>([]);
  const [orders, setOrders] = useState<any[]>([]);
  const [menuViews, setMenuViews] = useState<any[]>([]);
  const [timeFilter, setTimeFilter] = useState<"day" | "week" | "month" | "year">("month");
  const [loading, setLoading] = useState(true);
  const [debugSyncError, setDebugSyncError] = useState("");
  const [frames, setFrames] = useState<any[]>([]);

  // States for Printable Menu (Cardápio Impresso)
  const [printSelectedCategories, setPrintSelectedCategories] = useState<string[]>([]);
  const [printShowCover, setPrintShowCover] = useState(true);
  const [printShowLogo, setPrintShowLogo] = useState(true);
  const [printShowPrices, setPrintShowPrices] = useState(true);
  const [printShowDescriptions, setPrintShowDescriptions] = useState(true);
  const [printShowImages, setPrintShowImages] = useState(false);
  const [printColumns, setPrintColumns] = useState<1 | 2>(2);
  const [printThemeFont, setPrintThemeFont] = useState<"modern" | "classic" | "rustic" | "minimal">("modern");
  const [printTitle, setPrintTitle] = useState("Cardápio");
  const [printAccentStyle, setPrintAccentStyle] = useState<"colored" | "elegant" | "classic" | "none">("colored");
  const [printHideOutOfStock, setPrintHideOutOfStock] = useState(true);

  // Update Favicon and Title dynamically back to MenuFlow when opening Dashboard
  useEffect(() => {
    document.title = "MenuFlow - Dashboard";
    
    // Switch the favicon back if returning from a store menu
    let iconLink = document.querySelector("link[rel~='icon']") as HTMLLinkElement;
    if (iconLink) {
      iconLink.href = "https://i.imgur.com/v5ZKRXG.png";
    }
    
    let appleIconLink = document.querySelector("link[rel='apple-touch-icon']") as HTMLLinkElement;
    if (appleIconLink) {
      appleIconLink.href = "https://i.imgur.com/v5ZKRXG.png";
    }
  }, []);

  // Carregar do localStorage os IDs das comandas que já foram impressas automaticamente
  useEffect(() => {
    try {
      const saved = localStorage.getItem("auto_printed_order_ids");
      if (saved) {
        const arr = JSON.parse(saved);
        if (Array.isArray(arr)) {
          arr.forEach(id => {
            if (id && typeof id === "string") {
              autoPrintedOrderIdsRef.current.add(id);
            }
          });
        }
      }
    } catch (e) {
      console.error("Erro ao ler auto_printed_order_ids do localStorage:", e);
    }
  }, []);

  // Auto-initialize categories selected for print menu and keep them synced when new categories are loaded
  useEffect(() => {
    if (categories && categories.length > 0) {
      setPrintSelectedCategories(prev => {
        if (prev.length === 0) {
          return categories.map(c => c.name);
        }
        const newlyAdded = categories.map(c => c.name).filter(name => !prev.includes(name));
        if (newlyAdded.length > 0) {
          return [...prev, ...newlyAdded];
        }
        return prev;
      });
    }
  }, [categories]);

  const [adminAnnouncement, setAdminAnnouncement] = useState<any>(null);

  const [plansConfig, setPlansConfig] = useState<any>({
    premium: {
      name: "Plano Premium",
      price: 59.90,
      limitProducts: 999999,
      hasThemes: true,
      customAppearance: "Completo",
      features: "Produtos ilimitados, Temas Customizados, Suporte prioritário",
      pixKey: "pix@menuflow.com",
      pixInstructions: "Efetue o pagamento via Pix utilizando a chave acima e envie o comprovante ao nosso WhatsApp.",
      whatsappNumber: "5585991276477"
    }
  });

  // Bulk Selection States
  const [selectedProductIds, setSelectedProductIds] = useState<string[]>([]);
  const [selectedCategoryIds, setSelectedCategoryIds] = useState<string[]>([]);
  const [selectedRestockProdId, setSelectedRestockProdId] = useState<string | null>(null);
  const [restockValue, setRestockValue] = useState<string>("");

  // Custom delete confirmation modal state
  const [deleteConfirm, setDeleteConfirm] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
  } | null>(null);

  const handleBulkDeleteProducts = async () => {
    if (selectedProductIds.length === 0) return;
    setDeleteConfirm({
      isOpen: true,
      title: "Excluir Produtos Selecionados",
      message: `Tem certeza que deseja excluir os ${selectedProductIds.length} produtos selecionados? Esta ação é irreversível.`,
      onConfirm: async () => {
        try {
          await Promise.all(selectedProductIds.map(id => deleteDoc(doc(db, "products", id))));
          setSelectedProductIds([]);
        } catch (e) {
          console.error("Erro ao excluir produtos em massa:", e);
          alert("Erro ao verificar e excluir alguns produtos.");
        } finally {
          setDeleteConfirm(null);
        }
      }
    });
  };

  const handleBulkDeleteCategories = async () => {
    if (selectedCategoryIds.length === 0) return;
    setDeleteConfirm({
      isOpen: true,
      title: "Excluir Categorias Selecionadas",
      message: `Tem certeza que deseja excluir as ${selectedCategoryIds.length} categorias selecionadas? Esta ação é irreversível.`,
      onConfirm: async () => {
        try {
          await Promise.all(selectedCategoryIds.map(id => deleteDoc(doc(db, "categories", id))));
          setSelectedCategoryIds([]);
        } catch (e) {
          console.error("Erro ao excluir categorias em massa:", e);
          alert("Erro ao verificar e excluir algumas categorias.");
        } finally {
          setDeleteConfirm(null);
        }
      }
    });
  };

  // Orders Tab States
  const [ordersFilter, setOrdersFilter] = useState<string>("Todos");
  const [ordersSearch, setOrdersSearch] = useState<string>("");
  const [ordersPeriod, setOrdersPeriod] = useState<"today" | "all">("today");
  const [phoneSearchQuery, setPhoneSearchQuery] = useState<string>("");

  // Announcements/Avisos States
  const [announcements, setAnnouncements] = useState<any[]>([]);
  const [announcementsForm, setAnnouncementsForm] = useState({
    id: "",
    title: "",
    message: "",
    type: "warning" as "info" | "warning" | "success" | "danger",
    hasExpiration: false,
    expirationDate: "",
  });
  const [isAnnouncementsModalOpen, setIsAnnouncementsModalOpen] = useState(false);
  const [announcementError, setAnnouncementError] = useState("");

  // Promotions States
  const [promotions, setPromotions] = useState<any[]>([]);
  const [payments, setPayments] = useState<any[]>([]);
  const [isPromotionModalOpen, setIsPromotionModalOpen] = useState(false);
  const [editingPromotion, setEditingPromotion] = useState<any | null>(null);
  const [promoForm, setPromoForm] = useState({
    name: "",
    type: "buy_x_get_y" as "buy_x_get_y" | "discount" | "combo",
    productId: "",
    giftProductId: "",
    buyQty: 1,
    giftQty: 1,
    discountType: "percentage" as "percentage" | "fixed_value",
    discountValue: 0,
    productIds: [] as string[],
    comboPrice: 0,
    isActive: true,
  });
  const [promotionError, setPromotionError] = useState("");
  const [currentTime, setCurrentTime] = useState(Date.now());

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentTime(Date.now());
    }, 5000); // lightweight 5-sec tick for realtime monitoring
    return () => clearInterval(interval);
  }, []);

  const isNewProduct = (product: any): boolean => {
    if (!product || !product.createdAt) return false;
    let createdTime = 0;
    if (typeof product.createdAt === 'number') createdTime = product.createdAt;
    else if (typeof product.createdAt === 'string') createdTime = new Date(product.createdAt).getTime();
    else if (product.createdAt?.seconds) createdTime = product.createdAt.seconds * 1000;
    else if (typeof product.createdAt?.toDate === 'function') createdTime = product.createdAt.toDate().getTime();
    if (!createdTime || isNaN(createdTime)) return false;
    const twoDaysInMs = 2 * 24 * 60 * 60 * 1000;
    const now = Date.now();
    return (now - createdTime) <= twoDaysInMs && now >= createdTime;
  };

  // Forms
  const [isAddingProduct, setIsAddingProduct] = useState(false);
  const [editingProduct, setEditingProduct] = useState<any | null>(null);
  const [prodForm, setProdForm] = useState<{
    name: string;
    description: string;
    price: string;
    category: string;
    imageUrl: string;
    flavors: { name: string }[];
    maxFlavors: string;
    addons: { name: string; price: number }[];
    maxAddons: string;
    complements: { name: string }[];
    maxComplements: string;
    sauces: { name: string }[];
    maxSauces: string;
    availableDays: string[];
    isOutOfStock: boolean;
    stock: string;
  }>({
    name: '',
    description: '',
    price: '',
    category: '',
    imageUrl: '',
    flavors: [],
    maxFlavors: '',
    addons: [],
    maxAddons: '',
    complements: [],
    maxComplements: '',
    sauces: [],
    maxSauces: '',
    availableDays: [],
    isOutOfStock: false,
    stock: ''
  });
  const [newFlavorName, setNewFlavorName] = useState("");
  const [newSauceName, setNewSauceName] = useState("");
  const [newAddonName, setNewAddonName] = useState("");
  
  // Local image storage & upload states
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState("");
  const [dragActive, setDragActive] = useState(false);

  const handleImageUpload = async (file: File) => {
    if (!file) return;
    if (!restaurant?.name) {
      alert("Por favor, certifique-se de que o restaurante possui um nome configurado antes de fazer o upload.");
      return;
    }

    setIsUploading(true);
    setUploadError("");

    try {
      const reader = new FileReader();
      reader.onload = (event) => {
        const img = new Image();
        img.onload = async () => {
          let hasSucceeded = false;
          let compressedBase64 = "";

          try {
            // Desenhar no canvas para fazer compressão e redimensionamento automático
            const canvas = document.createElement("canvas");
            const MAX_WIDTH = 850;
            const MAX_HEIGHT = 850;
            let width = img.width;
            let height = img.height;

            if (width > height) {
              if (width > MAX_WIDTH) {
                height *= MAX_WIDTH / width;
                width = MAX_WIDTH;
              }
            } else {
              if (height > MAX_HEIGHT) {
                width *= MAX_HEIGHT / height;
                height = MAX_HEIGHT;
              }
            }

            canvas.width = width;
            canvas.height = height;
            const ctx = canvas.getContext("2d");
            if (!ctx) {
              throw new Error("Não foi possível obter o contexto 2D do canvas");
            }
            ctx.drawImage(img, 0, 0, width, height);

            // Use WEBP format for smaller sizes while supporting transparency if needed
            compressedBase64 = canvas.toDataURL("image/webp", 0.70);

            // Bypass /api/upload to avoid ephemeral file system issues in production
            setProdForm(prev => ({ ...prev, imageUrl: compressedBase64 }));
            console.log("Sucesso: Imagem convertida para WebP e adicionada.");
          } catch (err: any) {
            console.warn("Erro ao fazer processar imagem.", err);
            setUploadError("Erro ao processar imagem para o banco de dados.");
          }

          setIsUploading(false);
        };

        img.onerror = () => {
          setUploadError("Não foi possível carregar a imagem para otimização.");
          setIsUploading(false);
        };

        img.src = event.target?.result as string;
      };

      reader.onerror = () => {
        setUploadError("Erro ao ler o arquivo de imagem.");
        setIsUploading(false);
      };

      reader.readAsDataURL(file);
    } catch (e: any) {
      console.error("Erro ao preparar upload:", e);
      setUploadError(e.message || "Erro inesperado.");
      setIsUploading(false);
    }
  };

  const [isUploadingLogo, setIsUploadingLogo] = useState(false);
  const [isUploadingBanner, setIsUploadingBanner] = useState(false);
  const [appearanceUploadError, setAppearanceUploadError] = useState("");

  const handleLogoUpload = async (file: File) => {
    if (!file) return;
    if (!restaurant?.name) {
      alert("Por favor, certifique-se de que o restaurante possui um nome configurado antes de fazer o upload.");
      return;
    }

    setIsUploadingLogo(true);
    setAppearanceUploadError("");

    try {
      const reader = new FileReader();
      reader.onload = (event) => {
        const img = new Image();
        img.onload = async () => {
          let hasSucceeded = false;
          let compressedBase64 = "";

          try {
            const canvas = document.createElement("canvas");
            const MAX_WIDTH2 = 500;
            const MAX_HEIGHT2 = 500;
            let width = img.width;
            let height = img.height;

            if (width > height) {
              if (width > MAX_WIDTH2) {
                height *= MAX_WIDTH2 / width;
                width = MAX_WIDTH2;
              }
            } else {
              if (height > MAX_HEIGHT2) {
                width *= MAX_HEIGHT2 / height;
                height = MAX_HEIGHT2;
              }
            }

            canvas.width = width;
            canvas.height = height;
            const ctx = canvas.getContext("2d");
            if (ctx) {
              ctx.drawImage(img, 0, 0, width, height);
              // Use WEBP format for smaller sizes while supporting transparency if needed
              compressedBase64 = canvas.toDataURL("image/webp", 0.75);

              // Bypass /api/upload to avoid ephemeral file system issues in production
              setAppearanceForm(prev => ({ ...prev, logoUrl: compressedBase64 }));
              console.log("Sucesso: Logo convertido para WebP e adicionado.");
            }
          } catch (err: any) {
            console.warn("Erro ao processar logotipo.", err);
            setAppearanceUploadError("Erro ao processar imagem para o banco de dados.");
          }

          setIsUploadingLogo(false);
        };

        img.onerror = () => {
          setAppearanceUploadError("Não foi possível carregar o logotipo para otimização.");
          setIsUploadingLogo(false);
        };

        img.src = event.target?.result as string;
      };

      reader.onerror = () => {
        setAppearanceUploadError("Erro ao ler arquivo do logotipo.");
        setIsUploadingLogo(false);
      };

      reader.readAsDataURL(file);
    } catch (e: any) {
      console.error("Erro ao preparar upload de logo:", e);
      setAppearanceUploadError(e.message || "Erro inesperado.");
      setIsUploadingLogo(false);
    }
  };

  const handleBannerUpload = async (file: File) => {
    if (!file) return;
    if (!restaurant?.name) {
      alert("Por favor, certifique-se de que o restaurante possui um nome configurado antes de fazer o upload.");
      return;
    }

    setIsUploadingBanner(true);
    setAppearanceUploadError("");

    try {
      const reader = new FileReader();
      reader.onload = (event) => {
        const img = new Image();
        img.onload = async () => {
          let hasSucceeded = false;
          let compressedBase64 = "";

          try {
            const canvas = document.createElement("canvas");
            const MAX_WIDTH2 = 1200;
            const MAX_HEIGHT2 = 600;
            let width = img.width;
            let height = img.height;

            if (width > height) {
              if (width > MAX_WIDTH2) {
                height *= MAX_WIDTH2 / width;
                width = MAX_WIDTH2;
              }
            } else {
              if (height > MAX_HEIGHT2) {
                width *= MAX_HEIGHT2 / height;
                height = MAX_HEIGHT2;
              }
            }

            canvas.width = width;
            canvas.height = height;
            const ctx = canvas.getContext("2d");
            if (ctx) {
              ctx.drawImage(img, 0, 0, width, height);
              // Use WEBP format for smaller sizes while supporting transparency if needed
              compressedBase64 = canvas.toDataURL("image/webp", 0.70);

              // Bypass /api/upload to avoid ephemeral file system issues in production
              setAppearanceForm(prev => ({ ...prev, bannerUrl: compressedBase64 }));
              console.log("Sucesso: Banner convertido para WebP e adicionado.");
            }
          } catch (err: any) {
            console.warn("Erro ao processar imagem de banner.", err);
            setAppearanceUploadError("Erro ao processar imagem para o banco de dados.");
          }

          setIsUploadingBanner(false);
        };

        img.onerror = () => {
          setAppearanceUploadError("Não foi possível carregar o banner para otimização.");
          setIsUploadingBanner(false);
        };

        img.src = event.target?.result as string;
      };

      reader.onerror = () => {
        setAppearanceUploadError("Erro ao ler arquivo do banner.");
        setIsUploadingBanner(false);
      };

      reader.readAsDataURL(file);
    } catch (e: any) {
      console.error("Erro ao preparar upload de banner:", e);
      setAppearanceUploadError(e.message || "Erro inesperado.");
      setIsUploadingBanner(false);
    }
  };

  const [newAddonPrice, setNewAddonPrice] = useState("");
  const [newComplementName, setNewComplementName] = useState("");
  const [newCatName, setNewCatName] = useState("");
  const [newCatAvailableDays, setNewCatAvailableDays] = useState<string[]>([]);
  const [newCatIsVisible, setNewCatIsVisible] = useState(true);
  const [addingCategory, setAddingCategory] = useState(false);
  const [categoryError, setCategoryError] = useState("");
  const [editingCatId, setEditingCatId] = useState<string | null>(null);
  const [editingCatName, setEditingCatName] = useState("");
  const [editingCatAvailableDays, setEditingCatAvailableDays] = useState<string[]>([]);
  const [editingCatIsVisible, setEditingCatIsVisible] = useState(true);

  const [newTableName, setNewTableName] = useState("");
  const [isAddingTable, setAddingTable] = useState(false);
  const [bulkTableCount, setBulkTableCount] = useState("");
  const [isGeneratingBulk, setGeneratingBulk] = useState(false);
  const [customerInputs, setCustomerInputs] = useState<Record<string, string>>({});
  const [tableFilter, setTableFilter] = useState<"all" | "free" | "occupied">("all");

  // Atendentes/Waiters States
  const [waiters, setWaiters] = useState<any[]>([]);
  const [newWaiterName, setNewWaiterName] = useState("");
  const [newWaiterCode, setNewWaiterCode] = useState("");
  const [newWaiterPhone, setNewWaiterPhone] = useState("");
  const [newWaiterEmail, setNewWaiterEmail] = useState("");
  const [newWaiterPassword, setNewWaiterPassword] = useState("");
  const [isAddingWaiter, setIsAddingWaiter] = useState(false);
  const [pdvWaiterId, setPdvWaiterId] = useState("");
  const [pdvWaiterName, setPdvWaiterName] = useState("");

  // Auto-populate waiter credentials in active session
  useEffect(() => {
    if (user?.isWaiter) {
      setPdvWaiterId(user.waiterId || "");
      setPdvWaiterName(user.waiterName || "");
    }
  }, [user]);

  // PDV States
  const [finalizeTablePrintModal, setFinalizeTablePrintModal] = useState<{
    isOpen: boolean;
    order: any;
    tableName: string;
  } | null>(null);
  const [pdvTablePrintConfirm, setPdvTablePrintConfirm] = useState<{
    isOpen: boolean;
    partialOrder: any;
    onDone: () => void;
  } | null>(null);
  const [pdvOrderPrintConfirm, setPdvOrderPrintConfirm] = useState<{
    isOpen: boolean;
    order: any;
    successMessage: string;
  } | null>(null);
  const [pdvCart, setPdvCart] = useState<any[]>([]);
  const [pdvMobileTab, setPdvMobileTab] = useState<"products" | "cart">("products");
  const [pdvCustomerName, setPdvCustomerName] = useState("");
  const [pdvCustomerPhone, setPdvCustomerPhone] = useState("");
  const [pdvCustomerAddress, setPdvCustomerAddress] = useState("");
  const [pdvCheckoutType, setPdvCheckoutType] = useState<"balcao" | "entrega" | "retirada" | "troca">("balcao");
  const [pdvNeighborhood, setPdvNeighborhood] = useState("");
  const [pdvReturnedProduct, setPdvReturnedProduct] = useState("");
  const [pdvReturnedQty, setPdvReturnedQty] = useState(1);
  const [pdvSearchOrderQuery, setPdvSearchOrderQuery] = useState("");
  const [pdvSelectedOrderId, setPdvSelectedOrderId] = useState("");
  const [pdvTableNumber, setPdvTableNumber] = useState("");
  const [pdvPaymentMethod, setPdvPaymentMethod] = useState<"dinheiro" | "pix" | "cartao">("pix");
  const [pdvChangeFor, setPdvChangeFor] = useState("");
  const [pdvSearch, setPdvSearch] = useState("");
  const [pdvObservation, setPdvObservation] = useState("");
  const [prodSearch, setProdSearch] = useState("");
  const [pdvCategory, setPdvCategory] = useState("Todas");
  const [prodCategory, setProdCategory] = useState("Todas");
  const [isSubmittingOrder, setIsSubmittingOrder] = useState(false);

  const [printers, setPrinters] = useState<{id: string, name: string, type: string, connected: boolean, device: any}[]>([]);
  const printersRef = useRef(printers);
  printersRef.current = printers;
  const previewPaperWidthRef = useRef(previewPaperWidth);
  previewPaperWidthRef.current = previewPaperWidth;
  const printerFontSizeRef = useRef(printerFontSize);
  printerFontSizeRef.current = printerFontSize;
  const restaurantRef = useRef(restaurant);
  restaurantRef.current = restaurant;
  const ordersRef = useRef(orders);
  ordersRef.current = orders;
  const autoPrintedOrderIdsRef = useRef<Set<string>>(new Set());
  const [searchingPrinters, setSearchingPrinters] = useState(false);
  const [showUsbAccessDeniedGuide, setShowUsbAccessDeniedGuide] = useState(false);
  const [usbErrorDetails, setUsbErrorDetails] = useState("");

  const [appearanceForm, setAppearanceForm] = useState({ 
    logoUrl: '', 
    bannerUrl: '', 
    primaryColor: '#ea580c', 
    phone: '',
    pixKey: '',
    name: '',
    slug: '',
    storeStatus: 'auto', // 'open', 'closed', 'auto'
    genre: 'Geral',
    deliveryFees: [] as { id: string, name: string, fee: number }[],
    weeklyHours: {
      domingo: { start: '', end: '', closed: false },
      segunda: { start: '', end: '', closed: false },
      terca: { start: '', end: '', closed: false },
      quarta: { start: '', end: '', closed: false },
      quinta: { start: '', end: '', closed: false },
      sexta: { start: '', end: '', closed: false },
      sabado: { start: '', end: '', closed: false },
    },
    instagram: '',
    facebook: ''
  });

  // Premium Pix Checkout Popup
  const [showPixModal, setShowPixModal] = useState(false);
  const [copiedPix, setCopiedPix] = useState(false);
  const [copiedSubPix, setCopiedSubPix] = useState(false);
  const [submittingPayment, setSubmittingPayment] = useState(false);
  const [activatingPremium, setActivatingPremium] = useState(false);

  // Cancellation states
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [cancelingPremium, setCancelingPremium] = useState(false);

  const getPixPayload = (customAmount?: number) => {
    const formatEMVField = (id: string, value: string): string => {
      const len = value.length.toString().padStart(2, '0');
      return `${id}${len}${value}`;
    };

    // Merchant Account Information (ID 26)
    const gui = formatEMVField("00", "br.gov.bcb.pix");
    const rawPixKey = (plansConfig?.premium?.pixKey || "+5585991276477").trim();
    const key = formatEMVField("01", rawPixKey);
    const merchantAccountInfo = formatEMVField("26", gui + key);

    // Build fields
    let payload = "";
    payload += formatEMVField("00", "01"); // Payload Format Indicator
    payload += merchantAccountInfo; // Merchant Account Information
    payload += formatEMVField("52", "0000"); // Merchant Category Code
    payload += formatEMVField("53", "986"); // Transaction Currency (BRL)
    
    const premiumPrice = customAmount !== undefined ? customAmount : (plansConfig?.premium?.price !== undefined ? plansConfig.premium.price : 59.90);
    payload += formatEMVField("54", premiumPrice.toFixed(2)); // Transaction Amount
    payload += formatEMVField("58", "BR"); // Country Code
    payload += formatEMVField("59", "MenuFlow Premium"); // Merchant Name
    payload += formatEMVField("60", "Fortaleza"); // Merchant City
    payload += formatEMVField("62", formatEMVField("05", "***")); // Additional Data Field (Reference)

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

  const handleRegisterPayment = async (amount: number) => {
    if (!user || !user.uid) return;
    setSubmittingPayment(true);
    try {
      const newPayment = {
        restaurantId: user.uid,
        restaurantName: restaurant?.name || "Restaurante",
        amount: amount,
        createdAt: new Date().toISOString(),
        status: "Pendente",
        reference: `Mensalidade - ${new Date().toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })}`,
        method: "Pix"
      };
      await addDoc(collection(db, "subscription_payments"), newPayment);
      alert("Sucesso! Registro de pagamento enviado para validação pelo Admin.");
    } catch (err: any) {
      console.error("Erro ao registrar pagamento:", err);
      alert("Erro ao enviar confirmação de pagamento: " + err.message);
    } finally {
      setSubmittingPayment(false);
    }
  };

  const decrementStockForOrderItems = async (items: any[]) => {
    try {
      for (const item of items) {
        const prodId = item.productId || item.id;
        if (!prodId) continue;
        const productRef = doc(db, "products", prodId);
        const prodSnap = await getDoc(productRef);
        if (prodSnap.exists()) {
          const prodData = prodSnap.data();
          if (prodData.stock !== undefined && prodData.stock !== null) {
            const currentStock = parseInt(prodData.stock, 10);
            if (!isNaN(currentStock)) {
              const qtyToSubtract = parseInt(item.qty || item.quantity || 1, 10);
              const newStock = Math.max(0, currentStock - (isNaN(qtyToSubtract) ? 1 : qtyToSubtract));
              await updateDoc(productRef, {
                stock: newStock,
                isOutOfStock: newStock === 0 ? true : !!prodData.isOutOfStock
              });
            }
          }
        }
      }
    } catch (e) {
      console.error("Erro ao decrementar estoque do produto:", e);
    }
  };

  const syncTableStockDifferences = async (oldItems: any[], newItems: any[]) => {
    try {
      const oldQtyMap: Record<string, number> = {};
      for (const item of oldItems) {
        if (item.id) oldQtyMap[item.id] = parseInt(item.qty || item.quantity || 1, 10) || 1;
      }
      
      for (const item of newItems) {
        const prodId = item.productId || item.id;
        if (!prodId) continue;
        const newQty = parseInt(item.qty || item.quantity || 1, 10) || 1;
        const oldQty = oldQtyMap[item.id] || 0;
        const diff = newQty - oldQty;
        
        if (diff !== 0) {
          const productRef = doc(db, "products", prodId);
          const prodSnap = await getDoc(productRef);
          if (prodSnap.exists()) {
            const prodData = prodSnap.data();
            if (prodData.stock !== undefined && prodData.stock !== null) {
              const currentStock = parseInt(prodData.stock, 10);
              if (!isNaN(currentStock)) {
                const updatedStock = Math.max(0, currentStock - diff);
                await updateDoc(productRef, {
                  stock: updatedStock,
                  isOutOfStock: updatedStock === 0 ? true : !!prodData.isOutOfStock
                });
              }
            }
          }
        }
        delete oldQtyMap[item.id];
      }
      
      for (const oldId of Object.keys(oldQtyMap)) {
        const removedQty = oldQtyMap[oldId];
        const oldItem = oldItems.find(i => i.id === oldId);
        if (oldItem && (oldItem.productId || oldItem.id)) {
           const productRef = doc(db, "products", oldItem.productId || oldItem.id);
           const prodSnap = await getDoc(productRef);
           if (prodSnap.exists()) {
              const prodData = prodSnap.data();
              if (prodData.stock !== undefined && prodData.stock !== null) {
                 const currentStock = parseInt(prodData.stock, 10);
                 if (!isNaN(currentStock)) {
                    const resulting = currentStock + removedQty;
                    await updateDoc(productRef, { stock: resulting, isOutOfStock: resulting <= 0 });
                 }
              }
           }
        }
      }
    } catch (e) {
      console.error("Erro ao sincronizar estoque da mesa:", e);
    }
  };

  const sortedGlobalProducts = [...products].sort((a, b) => {
    // Primeira ordenação: Pela ordem da categoria da lista de categorias
    const catIndexA = categories.findIndex(c => c.name === a.category);
    const catIndexB = categories.findIndex(c => c.name === b.category);
    const orderCatA = catIndexA !== -1 ? catIndexA : 9999;
    const orderCatB = catIndexB !== -1 ? catIndexB : 9999;

    if (orderCatA !== orderCatB) {
      return orderCatA - orderCatB;
    }

    // Segunda ordenação: Pela ordenação própria do produto (campo order)
    const orderProdA = a.order !== undefined ? a.order : 9999;
    const orderProdB = b.order !== undefined ? b.order : 9999;
    if (orderProdA !== orderProdB) {
      return orderProdA - orderProdB;
    }

    // Terceira ordenação: Pela data de criação
    return (a.createdAt || 0) - (b.createdAt || 0);
  });

  const filteredProducts = sortedGlobalProducts.filter(p => (prodCategory === "Todas" || p.category === prodCategory) && (!prodSearch || p.name.toLowerCase().includes(prodSearch.toLowerCase())));

  const handlePrintBoth = async (order: any) => {
    if (order && order.id) {
      if (autoPrintedOrderIdsRef.current.has(order.id)) {
        console.log("Pedido já foi impresso automaticamente:", order.id);
        return;
      }
      autoPrintedOrderIdsRef.current.add(order.id);
      try {
        const arr = Array.from(autoPrintedOrderIdsRef.current).slice(-200);
        localStorage.setItem("auto_printed_order_ids", JSON.stringify(arr));
      } catch (e) {
        console.error("Erro ao salvar auto_printed_order_ids no localStorage:", e);
      }
    }
    // 1. Imprime via balcão
    const printedThermal = await handlePrintOrder(order, 'balcao');
    
    // Pequeno atraso para não encavalar
    const delay = printedThermal ? 1500 : 2500;
    await new Promise(resolve => setTimeout(resolve, delay));
    
    // 2. Imprime via cozinha
    await handlePrintOrder(order, 'cozinha');
  };

  const handlePrintOrder = async (order: any, dest: 'balcao' | 'cozinha' = 'balcao'): Promise<boolean> => {
    const orderDate = new Date(order.timestamp).toLocaleString("pt-BR");

    // Calculate sequential daily order number
    const getDailyOrderSequentialNumber = (currentOrder: any) => {
      const allOrdersList = [...ordersRef.current];
      if (!allOrdersList.some(o => o.id === currentOrder.id)) {
        allOrdersList.push(currentOrder);
      }

      // Find local date of the current order
      const targetDateStr = new Date(currentOrder.timestamp || Date.now()).toLocaleDateString("pt-BR");

      // Filter orders from the same day
      const sameDayOrders = allOrdersList.filter(o => {
        if (!o.timestamp) return false;
        const dateStr = new Date(o.timestamp).toLocaleDateString("pt-BR");
        return dateStr === targetDateStr;
      });

      // Sort them chronologically by timestamp
      sameDayOrders.sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0));

      // Find the index of currentOrder in that sorted list
      const index = sameDayOrders.findIndex(o => o.id === currentOrder.id);
      const sequentialNumber = index !== -1 ? index + 1 : 1;

      // Format with leading zero if less than 10
      return sequentialNumber < 10 ? `0${sequentialNumber}` : `${sequentialNumber}`;
    };

    const seqNumber = getDailyOrderSequentialNumber(order);
    
    const payMethodMap: Record<string, string> = {
       "dinheiro": "Dinheiro",
       "pix": "Pix",
       "cartao": "Cartão",
    };

    const typeMap: Record<string, string> = {
       "entrega": "Entrega",
       "retirada": "Retirada",
       "balcao": "Balcão",
       "troca": "Troca de Itens",
    };

    const checkoutTypeTitle = typeMap[order.checkoutType] || order.checkoutType;
    let checkoutTypeStr = `Entrega: ${checkoutTypeTitle}`;
    if (order.checkoutType === "entrega") {
      checkoutTypeStr = `Entrega: ${order.customerAddress}${order.addressComplement ? ' (' + order.addressComplement + ')' : ''}`;
    } else if (order.checkoutType === "balcao" && order.tableNumber) {
      checkoutTypeStr = `Entrega: Balcão - ${order.tableNumber}`;
    } else if (order.checkoutType === "troca") {
      checkoutTypeStr = `Tipo: Troca de Itens`;
    }

    const subtotalPrint = order.subtotal !== undefined ? order.subtotal : order.total;
    const deliveryFeePrint = order.deliveryFee || 0;

    // Se houver impressora conectada, imprime via WebUSB/WebBluetooth e não abre a popup
    const connectedPrinter = printersRef.current.find(p => p.connected && p.device);
    if (connectedPrinter) {
      const maxEscChars = previewPaperWidthRef.current === "58mm" ? 32 : 48;
      const escDividerDouble = "=".repeat(maxEscChars) + "\n";
      const escDividerSingle = "-".repeat(maxEscChars) + "\n";

      const formatEscCenter = (text: string) => {
        const padding = Math.max(0, Math.floor((maxEscChars - text.length) / 2));
        return " ".repeat(padding) + text + "\n";
      };

      const formatEscLine = (left: string, right: string = "") => {
        if (!right) {
          return left + "\n";
        }
        const spacesNeeded = maxEscChars - left.length - right.length;
        if (spacesNeeded <= 0) {
          const available = maxEscChars - right.length - 1;
          return left.substring(0, Math.max(0, available)) + " " + right + "\n";
        }
        return left + " ".repeat(spacesNeeded) + right + "\n";
      };

      let text = escDividerDouble;
      text += formatEscCenter(`DESTINO: ${dest.toUpperCase()}`);
      text += escDividerDouble;
      text += formatEscCenter(checkoutTypeTitle);
      text += escDividerDouble;
      text += formatEscCenter(orderDate);
      if (order.waiterName) {
        text += formatEscCenter(`Atendente: ${order.waiterName}`);
      }
      text += formatEscCenter(restaurantRef.current?.name || "Restaurante");
      const phone = restaurantRef.current?.phone || appearanceForm.phone;
      if (phone) {
        text += formatEscCenter(`Fone: ${phone}`);
      }
      text += escDividerDouble;
      text += formatEscCenter(`Pedido ${seqNumber}`);
      text += escDividerSingle;
      text += formatEscCenter("Lista de Pedido");
      text += escDividerSingle;
      
      if (order.checkoutType === "troca" && order.returnedProductName) {
        text += formatEscCenter("[ITEM TROCADO / DEVOLVIDO]");
        text += formatEscCenter(`${order.returnedProductQty || 1}x ${order.returnedProductName}`);
        text += escDividerSingle;
        text += formatEscCenter("[ITENS ADICIONADOS / NOVOS]");
        
        const addedItems = order.addedItems || order.items || [];
        addedItems.forEach((item: any) => {
          if (dest === 'cozinha') {
            text += formatEscLine(`${item.qty}x ${item.name}`);
          } else {
            text += formatEscLine(`${item.qty}x ${item.name}`, `R$ ${(item.price * item.qty).toFixed(2)}`);
          }
          if (item.selectedAddons && item.selectedAddons.length > 0) {
             item.selectedAddons.forEach((addon: any) => {
                 if (dest === 'cozinha') {
                    text += formatEscLine(`  + ${addon.name}`);
                 } else {
                    text += formatEscLine(`  + ${addon.name}`, `R$ ${(addon.price || 0).toFixed(2)}`);
                 }
             });
          }
          if (item.selectedComplements && item.selectedComplements.length > 0) {
             item.selectedComplements.forEach((comp: any) => {
                 text += formatEscLine(`  - ${comp.name}`);
             });
          }
          if (item.obs) {
             text += formatEscLine(`  * Obs: ${item.obs}`);
          }
        });

        const nonAddedItems = (order.items || []).filter((it: any) => !addedItems.some((ai: any) => (ai.productId === it.productId || ai.id === it.id)));
        if (nonAddedItems.length > 0) {
           text += escDividerSingle;
           text += formatEscCenter("[OUTROS ITENS DO PEDIDO]");
           nonAddedItems.forEach((item: any) => {
             if (dest === 'cozinha') {
               text += formatEscLine(`${item.qty}x ${item.name}`);
             } else {
               text += formatEscLine(`${item.qty}x ${item.name}`, `R$ ${(item.price * item.qty).toFixed(2)}`);
             }
           });
        }
      } else {
        order.items?.forEach((item: any) => {
          if (dest === 'cozinha') {
            text += formatEscLine(`${item.qty}x ${item.name}`);
          } else {
            text += formatEscLine(`${item.qty}x ${item.name}`, `R$ ${(item.price * item.qty).toFixed(2)}`);
          }
          if (item.selectedAddons && item.selectedAddons.length > 0) {
             item.selectedAddons.forEach((addon: any) => {
                 if (dest === 'cozinha') {
                    text += formatEscLine(`  + ${addon.name}`);
                 } else {
                    text += formatEscLine(`  + ${addon.name}`, `R$ ${(addon.price || 0).toFixed(2)}`);
                 }
             });
          }
          if (item.selectedComplements && item.selectedComplements.length > 0) {
             item.selectedComplements.forEach((comp: any) => {
                 text += formatEscLine(`  - ${comp.name}`);
             });
          }
          if (item.obs) {
             text += formatEscLine(`  * Obs: ${item.obs}`);
          }
        });
      }
      if (order.observation) {
         text += formatEscLine(`OBS PEDIDO: ${order.observation}`);
      }
      text += escDividerSingle;
      text += formatEscLine(`Cliente: ${order.customerName}`);
      if (order.contactPhone) text += formatEscLine(order.contactPhone);
      text += formatEscLine(checkoutTypeStr);
      
      if (dest !== 'cozinha') {
        text += escDividerSingle;
        text += formatEscLine("Subtotal:", `R$ ${subtotalPrint.toFixed(2)}`);
        if (deliveryFeePrint > 0) {
          text += formatEscLine("Taxa Entrega:", `R$ ${deliveryFeePrint.toFixed(2)}`);
        }
        text += formatEscLine("Total:", `R$ ${(order.total || 0).toFixed(2)}`);
        text += formatEscLine("Pagamento:", payMethodMap[order.paymentMethod] || order.paymentMethod);
        if (order.paymentMethod === "dinheiro" && order.changeFor) {
          const rawChange = String(order.changeFor).replace(',', '.');
          const changeForNum = parseFloat(rawChange) || 0;
          const orderTotal = order.total || 0;
          const trocoValue = changeForNum - orderTotal;
          text += formatEscLine("Troco para:", `R$ ${changeForNum.toFixed(2)}`);
          if (trocoValue > 0) {
            text += formatEscLine("Valor do Troco:", `R$ ${trocoValue.toFixed(2)}`);
          }
        }
      }
      text += escDividerSingle + "\n\n\n\n\n";

      try {
        await printTextEscPos(connectedPrinter, text);
        return true; // Sucesso, aborta impressão normal HTML
      } catch(e) {
        console.error("Falha ao imprimir na térmica:", e);
        // Fallback p/ HTML
      }
    }

    const printWindow = window.open('', '_blank', 'width=400,height=600');
    if (!printWindow) {
      alert("Por favor, permita pop-ups para usar a impressão no navegador.");
      return;
    }

    let itemsHtml = "";
    if (order.checkoutType === "troca" && order.returnedProductName) {
      itemsHtml += `<div style="font-weight: bold; padding: 6px; border-radius: 6px; margin-bottom: 8px; border: 1px solid #000; font-family: sans-serif; font-size: 14px;">`;
      itemsHtml += `ITEM DEVOLVIDO EM TROCA:<br>`;
      itemsHtml += `<span style="font-size: 16px; font-weight: 800;">${order.returnedProductQty || 1}x ${order.returnedProductName}</span>`;
      itemsHtml += `</div>`;
      itemsHtml += `<div class="divider">----------------------------------------</div>`;
      itemsHtml += `<div style="font-weight: bold; padding: 6px; border-radius: 6px; margin-bottom: 8px; border: 1px solid #000; font-family: sans-serif; font-size: 14px;">`;
      itemsHtml += `ITENS ADICIONADOS (NOVOS):`;
      itemsHtml += `</div>`;
      
      const addedItems = order.addedItems || order.items || [];
      itemsHtml += addedItems.map((item: any) => {
          let t = dest === 'cozinha'
            ? `<div style="display: flex; justify-content: flex-start; margin-bottom: 2px;"><span>(${item.qty}) ${item.name}</span></div>`
            : `<div style="display: flex; justify-content: space-between; margin-bottom: 2px;"><span>(${item.qty}) ${item.name}</span><span>R$ ${(item.price * item.qty).toFixed(2)}</span></div>`;
          if (item.selectedAddons && item.selectedAddons.length > 0) {
              item.selectedAddons.forEach((addon: any) => {
                 if (dest === 'cozinha') {
                    t += `&nbsp;&nbsp;+ ${addon.name}<br>`;
                 } else {
                    t += `&nbsp;&nbsp;+ ${addon.name} ... R$ ${(addon.price || 0).toFixed(2)}<br>`;
                 }
              });
          }
          if (item.selectedComplements && item.selectedComplements.length > 0) {
             item.selectedComplements.forEach((comp: any) => {
                 t += `&nbsp;&nbsp;- ${comp.name}<br>`;
             });
          }
          if (item.selectedSauces && item.selectedSauces.length > 0) {
             item.selectedSauces.forEach((sauce: any) => {
                 t += `&nbsp;&nbsp;~ Molho: ${sauce.name}<br>`;
             });
          }
          return t;
      }).join("") || "";

      const nonAddedItems = (order.items || []).filter((it: any) => !addedItems.some((ai: any) => (ai.productId === it.productId || ai.id === it.id)));
      if (nonAddedItems.length > 0) {
        itemsHtml += `<div class="divider">----------------------------------------</div>`;
        itemsHtml += `<div style="font-weight: bold; font-family: sans-serif; font-size: 14px; margin-top: 8px; margin-bottom: 6px;">`;
        itemsHtml += `ITENS QUE JÁ ESTAVAM NO PEDIDO:`;
        itemsHtml += `</div>`;
        itemsHtml += nonAddedItems.map((item: any) => {
          let t = dest === 'cozinha'
            ? `<div style="display: flex; justify-content: flex-start; margin-bottom: 2px;"><span>(${item.qty}) ${item.name}</span></div>`
            : `<div style="display: flex; justify-content: space-between; margin-bottom: 2px;"><span>(${item.qty}) ${item.name}</span><span>R$ ${(item.price * item.qty).toFixed(2)}</span></div>`;
          if (item.selectedAddons && item.selectedAddons.length > 0) {
              item.selectedAddons.forEach((addon: any) => {
                 if (dest === 'cozinha') {
                    t += `&nbsp;&nbsp;+ ${addon.name}<br>`;
                 } else {
                    t += `&nbsp;&nbsp;+ ${addon.name} ... R$ ${(addon.price || 0).toFixed(2)}<br>`;
                 }
              });
          }
          if (item.selectedComplements && item.selectedComplements.length > 0) {
             item.selectedComplements.forEach((comp: any) => {
                 t += `&nbsp;&nbsp;- ${comp.name}<br>`;
             });
          }
          if (item.selectedSauces && item.selectedSauces.length > 0) {
             item.selectedSauces.forEach((sauce: any) => {
                 t += `&nbsp;&nbsp;~ Molho: ${sauce.name}<br>`;
             });
          }
          return t;
        }).join("") || "";
      }
    } else {
      itemsHtml += order.items?.map((item: any) => {
          let text = dest === 'cozinha'
            ? `<div style="display: flex; justify-content: flex-start; margin-bottom: 2px;"><span>(${item.qty}) ${item.name}</span></div>`
            : `<div style="display: flex; justify-content: space-between; margin-bottom: 2px;"><span>(${item.qty}) ${item.name}</span><span>R$ ${(item.price * item.qty).toFixed(2)}</span></div>`;
          if (item.selectedAddons && item.selectedAddons.length > 0) {
              item.selectedAddons.forEach((addon: any) => {
                  if (dest === 'cozinha') {
                     text += `&nbsp;&nbsp;+ ${addon.name}<br>`;
                  } else {
                     text += `&nbsp;&nbsp;+ ${addon.name} ... R$ ${(addon.price || 0).toFixed(2)}<br>`;
                  }
              });
          }
          if (item.selectedComplements && item.selectedComplements.length > 0) {
             item.selectedComplements.forEach((comp: any) => {
                 text += `&nbsp;&nbsp;- ${comp.name}<br>`;
             });
          }
          if (item.selectedSauces && item.selectedSauces.length > 0) {
             item.selectedSauces.forEach((sauce: any) => {
                 text += `&nbsp;&nbsp;~ Molho: ${sauce.name}<br>`;
             });
          }
          if (item.obs) {
             text += `&nbsp;&nbsp;* Obs: ${item.obs}<br>`;
          }
          return text;
      }).join("") || "";
    }

    const html = `
      <html>
        <head>
          <title>Comanda #${seqNumber}</title>
          <style>
            @page { margin: 0; }
            body { 
              font-family: 'Courier New', Courier, monospace; 
              font-size: 18px; 
              font-weight: bold;
              line-height: 1.3;
              margin: 0; 
              padding: 0; 
              color: #000;
              text-align: center;
            }
            .container {
              width: ${previewPaperWidthRef.current === "58mm" ? "260px" : "360px"};
              margin: 0 auto;
              padding: 10px;
            }
            .center { text-align: center; }
            .divider { text-align: center; overflow: hidden; white-space: nowrap; margin: 5px 0; }
          </style>
        </head>
        <body>
          <div class="container center">
              <div class="divider">========================================</div>
              <div style="font-size: 18px; font-weight: 900; letter-spacing: 2px;">DESTINO: ${dest.toUpperCase()}</div>
              <div class="divider">========================================</div>
              ${checkoutTypeTitle}<br>
              <div class="divider">========================================</div>
              ${orderDate}<br>
              ${order.waiterName ? `Atendente: ${order.waiterName}<br>` : ''}
              ${restaurantRef.current?.name || "Restaurante"}<br>
              ${(restaurantRef.current?.phone || appearanceForm.phone) ? `${restaurantRef.current?.phone || appearanceForm.phone}<br>` : ""}
              <div class="divider">========================================</div>
              Pedido ${seqNumber}<br>
            <div class="divider">----------------------------------------</div>
            ${itemsHtml}
            <div class="divider">----------------------------------------</div>
            Cliente: ${order.customerName}<br>
            ${order.contactPhone ? order.contactPhone + '<br>' : ''}
            ${checkoutTypeStr}<br>
            ${order.observation ? `<b>OBS PEDIDO: ${order.observation}</b><br>` : ''}
            ${dest !== 'cozinha' ? `
            <div class="divider">----------------------------------------</div>
            Subtotal: R$ ${subtotalPrint.toFixed(2)}<br>
            ${deliveryFeePrint > 0 ? `Taxa Entrega: R$ ${deliveryFeePrint.toFixed(2)}<br>` : ''}
            Total: R$ ${(order.total || 0).toFixed(2)}<br>
            Pagamento: ${payMethodMap[order.paymentMethod] || order.paymentMethod}<br>
            ${order.paymentMethod === "dinheiro" && order.changeFor ? `Troco para: R$ ${parseFloat(String(order.changeFor).replace(',', '.')) ? parseFloat(String(order.changeFor).replace(',', '.')).toFixed(2) : order.changeFor}<br>${(parseFloat(String(order.changeFor).replace(',', '.')) - (order.total || 0)) > 0 ? `<b>Valor do Troco: R$ ${(parseFloat(String(order.changeFor).replace(',', '.')) - (order.total || 0)).toFixed(2)}</b><br>` : ''}` : ''}
            ${order.isPaid ? `<div class="divider">----------------------------------------</div><div class="center"><img src="https://i.imgur.com/I5j0Eh6.png" style="width: 100px; display: block; margin: 0 auto; filter: grayscale(100%); mix-blend-mode: multiply;" /></div>` : '<div class="divider">----------------------------------------</div>'}
            ` : ''}
            <br><br><br><br>
          </div>
          <script>
            window.onload = function() {
              setTimeout(function() {
                window.print();
                setTimeout(function() { window.close(); }, 500);
              }, 500);
            }
          </script>
        </body>
      </html>
    `;

    printWindow.document.open();
    printWindow.document.write(html);
    printWindow.document.close();
    return false;
  };

  const getFilteredDataThreshold = () => {
    const now = new Date();
    switch (timeFilter) {
      case "day":
        return new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
      case "week":
        return Date.now() - 7 * 24 * 60 * 60 * 1000;
      case "month":
        return Date.now() - 30 * 24 * 60 * 60 * 1000;
      case "year":
        return Date.now() - 365 * 24 * 60 * 60 * 1000;
      default:
        return 0;
    }
  };

  const getChartData = () => {
    const threshold = getFilteredDataThreshold();
    const filteredOrders = orders.filter(o => (o.timestamp || 0) >= threshold);
    
    if (timeFilter === "day") {
      const periods = [
        { label: "00h-04h", val: 0 },
        { label: "04h-08h", val: 0 },
        { label: "08h-12h", val: 0 },
        { label: "12h-16h", val: 0 },
        { label: "16h-20h", val: 0 },
        { label: "20h-00h", val: 0 },
      ];
      filteredOrders.forEach(o => {
        const hour = new Date(o.timestamp).getHours();
        const idx = Math.floor(hour / 4);
        if (idx >= 0 && idx < 6) periods[idx].val += o.total || 0;
      });
      return periods;
    } else if (timeFilter === "week") {
      const daysOfWeek = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
      const periods = Array.from({ length: 7 }).map((_, i) => {
        const d = new Date(Date.now() - (6 - i) * 24 * 60 * 60 * 1000);
        return {
          label: daysOfWeek[d.getDay()],
          dateStr: d.getDate() + "/" + (d.getMonth() + 1),
          val: 0,
          rawDate: d
        };
      });
      filteredOrders.forEach(o => {
        const oDate = new Date(o.timestamp);
        periods.forEach(p => {
          if (oDate.getDate() === p.rawDate.getDate() && oDate.getMonth() === p.rawDate.getMonth()) {
            p.val += o.total || 0;
          }
        });
      });
      return periods;
    } else if (timeFilter === "month") {
      const periods = [
        { label: "Sem. 1", val: 0 },
        { label: "Sem. 2", val: 0 },
        { label: "Sem. 3", val: 0 },
        { label: "Sem. 4", val: 0 },
      ];
      const oneWeekMs = 7 * 24 * 60 * 60 * 1000;
      const nowMs = Date.now();
      filteredOrders.forEach(o => {
        const age = nowMs - o.timestamp;
        const idx = 3 - Math.floor(age / oneWeekMs);
        if (idx >= 0 && idx < 4) periods[idx].val += o.total || 0;
      });
      return periods;
    } else {
      const monthsName = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
      const periods = Array.from({ length: 12 }).map((_, i) => {
        const d = new Date();
        d.setMonth(d.getMonth() - (11 - i));
        return {
          label: monthsName[d.getMonth()],
          val: 0,
          year: d.getFullYear(),
          month: d.getMonth()
        };
      });
      filteredOrders.forEach(o => {
        const oDate = new Date(o.timestamp);
        periods.forEach(p => {
          if (oDate.getMonth() === p.month && oDate.getFullYear() === p.year) {
            p.val += o.total || 0;
          }
        });
      });
      return periods;
    }
  };

  // Navigation Links
  const allTabs = [
    { id: "overview", label: "Resumo", icon: BarChart3 },
    { id: "pdv", label: "PDV", icon: Store },
    { id: "orders", label: "Pedidos", icon: ClipboardList },
    { id: "products", label: "Produtos", icon: Box },
    { id: "categories", label: "Categorias", icon: Tags },
    { id: "promotions", label: "Promoções", icon: Gift },
    { id: "tables", label: "Mesas", icon: Users },
    { id: "waiters", label: "Atendentes", icon: User },
    { id: "appearance", label: "Aparência", icon: Palette },
    { id: "store_settings", label: "Funcionamento", icon: Clock },
    { id: "announcements", label: "Avisos", icon: Megaphone },
    { id: "qrcode", label: "QR Code", icon: QrCode },
    { id: "printer", label: "Impressora", icon: Printer },
    { id: "print_menu", label: "Cardápio Impresso", icon: FileText },
    { id: "subscription", label: "Assinatura", icon: CreditCard },
  ] as const;

  const menuGroups = [
    {
      id: "gestao",
      label: "Gestão",
      icon: Layers,
      items: [
        { id: "overview", label: "Resumo", icon: BarChart3 },
        { id: "orders", label: "Pedidos", icon: ClipboardList },
        { id: "products", label: "Produtos", icon: Box },
        { id: "categories", label: "Categorias", icon: Tags },
        { id: "promotions", label: "Promoções", icon: Gift },
      ]
    },
    {
      id: "operacao",
      label: "Operação",
      icon: Utensils,
      items: [
        { id: "pdv", label: "PDV", icon: Store },
        { id: "tables", label: "Mesas", icon: Users },
        { id: "waiters", label: "Atendentes", icon: User },
      ]
    },
    {
      id: "equipamentos",
      label: "Equipamentos",
      icon: Cpu,
      items: [
        { id: "printer", label: "Impressora", icon: Printer },
        { id: "qrcode", label: "QR Code", icon: QrCode },
      ]
    },
    {
      id: "personalizacao",
      label: "Personalização",
      icon: Sparkles,
      items: [
        { id: "appearance", label: "Aparência", icon: Palette },
        { id: "store_settings", label: "Funcionamento", icon: Clock },
        { id: "print_menu", label: "Cardápio Impresso", icon: FileText },
        { id: "announcements", label: "Avisos", icon: Megaphone },
      ]
    },
    {
      id: "conta",
      label: "Conta",
      icon: User,
      items: [
        { id: "subscription", label: "Assinatura", icon: CreditCard },
      ]
    }
  ] as const;

  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({
    gestao: true,
    operacao: true,
    equipamentos: true,
    personalizacao: true,
    conta: true
  });

  const toggleGroup = (groupId: string) => {
    setExpandedGroups(prev => ({
      ...prev,
      [groupId]: !prev[groupId]
    }));
  };

  const disabledFeatures = restaurant?.disabledFeatures || [];
  const tabs = allTabs.filter(t => !disabledFeatures.includes(t.id));

  useEffect(() => {
    if (user?.isWaiter) {
      if (activeTab !== "pdv") {
        setActiveTab("pdv");
      }
    } else if (disabledFeatures.includes(activeTab)) {
      setActiveTab("overview");
    }
  }, [restaurant, activeTab, user]);

  const printTextEscPos = async (printer: any, text: string) => {
    try {
      const textToPrint = text.normalize('NFD').replace(/[\u0300-\u036f]/g, ''); // remove accents for raw ESC/POS
      const textBytes = new TextEncoder().encode(textToPrint);
      const ESC_INIT = new Uint8Array([0x1b, 0x40]);
      const FEED = new Uint8Array([0x0a, 0x0a, 0x0a, 0x0a, 0x0a]);
      const GS_V = new Uint8Array([0x1d, 0x56, 0x00]); // cut
      
      const payload = new Uint8Array(ESC_INIT.length + textBytes.length + FEED.length + GS_V.length);
      payload.set(ESC_INIT, 0);
      payload.set(textBytes, ESC_INIT.length);
      payload.set(FEED, ESC_INIT.length + textBytes.length);
      payload.set(GS_V, ESC_INIT.length + textBytes.length + FEED.length);

      if (printer.type === "USB") {
        const device = printer.device;
        if (!device.opened) await device.open();
        if (device.configuration === null) await device.selectConfiguration(1);
        try { await device.claimInterface(0); } catch (e) { /* might already be claimed */ }
        
        // Find OUT endpoint
        let endpointOut = null;
        for (const info of device.configuration.interfaces[0].alternates[0].endpoints) {
          if (info.direction === "out") {
            endpointOut = info.endpointNumber;
            break;
          }
        }
        
        if (endpointOut) {
          await device.transferOut(endpointOut, payload);
          return true;
        } else {
          throw new Error("Nenhum endpoint de saída encontrado.");
        }
      } else if (printer.type === "Bluetooth") {
        const device = printer.device;
        if (!device.gatt.connected) await device.gatt.connect();
        
        // Try some generic thermal printer services
        const servicesAndChars = [
          { s: '000018f0-0000-1000-8000-00805f9b34fb', c: '00002af1-0000-1000-8000-00805f9b34fb' },
          { s: '49535343-fe7d-4ae5-8fa9-9fafd205e455', c: '49535343-8841-43f4-a8d4-ecbe34729bb3' },
          { s: 'e7810a71-73ae-499d-8c15-faa9aef0c3f2', c: 'bef8d6c9-9c21-4c9e-b632-bd58c1009f9f' }
        ];
        
        let targetCharacteristic = null;
        for (const svcDef of servicesAndChars) {
          try {
            const service = await device.gatt.getPrimaryService(svcDef.s);
            targetCharacteristic = await service.getCharacteristic(svcDef.c);
            break;
          } catch(e) {}
        }
        
        if (targetCharacteristic) {
          // Send in chunks of 512 bytes
          const chunkSize = 512;
          for (let i = 0; i < payload.length; i += chunkSize) {
            await targetCharacteristic.writeValue(payload.slice(i, i + chunkSize));
          }
          return true;
        } else {
          throw new Error("Serviço de impressão não suportado pelo dispositivo bluetooth.");
        }
      }
    } catch (err: any) {
      console.error(err);
      throw err;
    }
    return false;
  };

  const handleSearchUSBPrinters = async () => {
    try {
      // @ts-ignore
      if (!navigator.usb) {
        alert("WebUSB não é suportado neste navegador (tente no Chrome ou Edge no PC/Android).");
        return;
      }
      setSearchingPrinters(true);
      // @ts-ignore
      const device = await navigator.usb.requestDevice({ filters: [] });
      if (device) {
        let isOpened = false;
        try {
          await device.open();
          if (device.configuration === null) await device.selectConfiguration(1);
          await device.claimInterface(0);
          isOpened = true;
        } catch (openError: any) {
          console.warn("Could not open device immediately:", openError);
          // Don't crash here - we will still add the printer to the list as not fully connected,
          // and then raise the guide modal to show them exactly how to fix the Access Denied or other drivers.
          if (openError.name === "SecurityError" || openError.message?.toLowerCase().includes("access denied") || String(openError).toLowerCase().includes("access denied")) {
            setUsbErrorDetails(openError.message || "Access denied");
            setShowUsbAccessDeniedGuide(true);
          } else {
            alert("Selecionado, mas não pôde abrir conexão direta: " + openError.message + ". Adicionado à lista abaixo.");
          }
        }

        setPrinters(prev => {
          const deviceId = device.serialNumber || device.productId.toString() || Math.random().toString(36).substring(7);
          const newPrinters = [...prev.filter(p => p.id !== deviceId)];
          newPrinters.push({
            id: deviceId,
            name: device.productName || "Impressora USB",
            type: "USB",
            connected: isOpened,
            device: device
          });
          return newPrinters;
        });

        if (isOpened) {
          alert("Impressora USB conectada!");
        }
      }
    } catch (error: any) {
      console.error(error);
      if (error.name === "SecurityError" || error.message?.toLowerCase().includes("access denied") || String(error).toLowerCase().includes("access denied")) {
        setUsbErrorDetails(error.message || "Access denied");
        setShowUsbAccessDeniedGuide(true);
      } else if (error.name !== "NotFoundError" && !String(error).includes("No device selected")) {
        alert("Erro ao conectar USB: " + error.message);
      }
    } finally {
      setSearchingPrinters(false);
    }
  };

  const handleConnectPrinter = async (printer: any) => {
    try {
      if (printer.type === "USB") {
        const device = printer.device;
        if (!device) {
          alert("Objeto de dispositivo USB inválido ou desconectado.");
          return;
        }
        await device.open();
        if (device.configuration === null) await device.selectConfiguration(1);
        await device.claimInterface(0);
        
        setPrinters(prev => prev.map(p => p.id === printer.id ? { ...p, connected: true } : p));
        alert("Impressora USB conectada com sucesso!");
      } else if (printer.type === "Bluetooth") {
        const device = printer.device;
        if (!device) {
          alert("Dispositivo Bluetooth não encontrado.");
          return;
        }
        if (!device.gatt.connected) await device.gatt.connect();
        setPrinters(prev => prev.map(p => p.id === printer.id ? { ...p, connected: true } : p));
        alert("Impressora Bluetooth conectada com sucesso!");
      }
    } catch (error: any) {
      console.error("Error manual connecting printer:", error);
      if (error.name === "SecurityError" || error.message?.toLowerCase().includes("access denied") || String(error).toLowerCase().includes("access denied")) {
        setUsbErrorDetails(error.message || "Access denied");
        setShowUsbAccessDeniedGuide(true);
      } else {
        alert("Não foi possível conectar: " + error.message);
      }
    }
  };

  // Auto-load already paired/authorized USB devices on mount
  useEffect(() => {
    const nav = navigator as any;
    if (typeof navigator !== 'undefined' && nav.usb && nav.usb.getDevices) {
      nav.usb.getDevices().then(async (devices: any[]) => {
        if (devices && devices.length > 0) {
          const loadedPrinters = [];
          for (const device of devices) {
            const id = device.serialNumber || device.productId.toString() || Math.random().toString(36).substring(7);
            let isOpened = false;

            // If autoconnect is enabled, try to open the device right away
            if (localStorage.getItem("printer_auto_connect") !== "false") {
              try {
                await device.open();
                if (device.configuration === null) await device.selectConfiguration(1);
                await device.claimInterface(0);
                isOpened = true;
                console.log(`[Auto-Conexão] Impressora USB ${device.productName || ""} conectada automaticamente com sucesso!`);
              } catch (openError) {
                console.warn(`[Auto-Conexão] Falha ao conectar automaticamente a ${device.productName || ""}:`, openError);
              }
            }

            loadedPrinters.push({
              id: id,
              name: device.productName || "Impressora USB Pareada",
              type: "USB",
              connected: isOpened,
              device: device
            });
          }

          setPrinters(prev => {
            const list = [...prev];
            loadedPrinters.forEach(lp => {
              const idx = list.findIndex(p => p.id === lp.id);
              if (idx === -1) {
                list.push(lp);
              } else {
                list[idx] = lp;
              }
            });
            return list;
          });
        }
      }).catch((err: any) => console.warn("Erro ao buscar dispositivos USB pareados:", err));
    }
  }, []);

  const handleSearchBluetoothPrinters = async () => {
    try {
      // @ts-ignore
      if (!navigator.bluetooth) {
        alert("Web Bluetooth não é suportado neste navegador (tente no Chrome no Android/PC).");
        return;
      }
      setSearchingPrinters(true);
      // @ts-ignore
      const device = await navigator.bluetooth.requestDevice({ 
        filters: [{ services: ['000018f0-0000-1000-8000-00805f9b34fb'] }],
        optionalServices: [
          '000018f0-0000-1000-8000-00805f9b34fb',
          '49535343-fe7d-4ae5-8fa9-9fafd205e455',
          'e7810a71-73ae-499d-8c15-faa9aef0c3f2'
        ],
        acceptAllDevices: false
      }).catch((e: any) => {
        // Fallback to acceptAllDevices if no filters match
        // @ts-ignore
        return navigator.bluetooth.requestDevice({ acceptAllDevices: true, optionalServices: [
          '000018f0-0000-1000-8000-00805f9b34fb',
          '49535343-fe7d-4ae5-8fa9-9fafd205e455',
          'e7810a71-73ae-499d-8c15-faa9aef0c3f2'
        ]});
      });
      
      if (device) {
        await device.gatt.connect();
        setPrinters(prev => {
          const newPrinters = [...prev.filter(p => p.id !== device.id)];
          newPrinters.push({
            id: device.id || Math.random().toString(36).substring(7),
            name: device.name || "Impressora Bluetooth",
            type: "Bluetooth",
            connected: true,
            device: device
          });
          return newPrinters;
        });
        alert("Impressora Bluetooth conectada!");
      }
    } catch (error: any) {
      console.error(error);
      if (error.name !== "NotFoundError" && !String(error).includes("User cancelled")) {
        alert("Erro ao conectar Bluetooth: " + error.message);
      }
    } finally {
      setSearchingPrinters(false);
    }
  };

  useEffect(() => {
    let unsubRest: () => void = () => {};
    const unsubAuth = onAuthStateChanged(auth, async (userDoc) => {
      if (!userDoc) {
        navigate("/auth");
        return;
      }
      
      // Check if logged in user is registered as a waiter
      try {
        const waiterRef = doc(db, "waiters", userDoc.uid);
        const waiterSnap = await getDoc(waiterRef);
        if (waiterSnap.exists()) {
          const waiterData = waiterSnap.data();
          if (waiterData.isActive === false) {
            alert("Sua conta de atendente está inativa.");
            await signOut(auth);
            navigate("/auth");
            return;
          }
          // Logged in user is indeed a waiter!
          setUser({
            uid: waiterData.restaurantId, // Set uid to parent restaurantId to query products/categories of this restaurant
            isWaiter: true,
            waiterId: userDoc.uid,
            waiterName: waiterData.name,
            email: userDoc.email,
            realUid: userDoc.uid
          });
          
          // Fetch parent restaurant data
          const parentRestRef = doc(db, "restaurants", waiterData.restaurantId);
          const parentSnap = await getDoc(parentRestRef);
          if (parentSnap.exists()) {
            setRestaurant({ id: parentSnap.id, ...parentSnap.data() });
          }
          setActiveTab("pdv");
          setLoading(false);
          return;
        }
      } catch (err) {
        console.error("Erro ao carregar atendente:", err);
      }

      // Normal admin auth flow
      setUser(userDoc);

      // Check if logged in user is a superadmin
      const isMasterAdminEmail = userDoc.email === "dexgamer277@gmail.com" || userDoc.email === "admin@menuflow.com" || userDoc.email === "saimonsantosofficial@gmail.com";
      if (isMasterAdminEmail) {
        setIsSuperAdmin(true);
      } else {
        try {
          const userDocRef = doc(db, "users", userDoc.uid);
          const userDocSnap = await getDoc(userDocRef);
          if (userDocSnap.exists()) {
            const uData = userDocSnap.data();
            if (uData?.isAdmin || uData?.role === "admin") {
              setIsSuperAdmin(true);
            }
          }
        } catch (err) {
          console.error("Erro ao verificar privilégios de superadmin:", err);
        }
      }

      const restRef = doc(db, "restaurants", userDoc.uid);
      
      unsubRest = onSnapshot(restRef, (rSnap) => {
        if (rSnap.exists()) {
          const data = rSnap.data();
          setRestaurant({ id: rSnap.id, ...data });
          setAppearanceForm(prev => {
            // If already has name/slug, avoid overwriting user's active form context
            if (prev.name && prev.slug) return prev;
            return {
              logoUrl: data.logoUrl || '',
              bannerUrl: data.bannerUrl || '',
              primaryColor: data.primaryColor || '#ea580c',
              phone: data.phone || '',
              pixKey: data.pixKey || '',
              name: data.name || '',
              slug: data.slug || '',
              storeStatus: data.storeStatus || 'auto',
              genre: data.genre || 'Geral',
              deliveryFees: data.deliveryFees || [],
              weeklyHours: (typeof data.weeklyHours === 'object' && data.weeklyHours !== null) ? data.weeklyHours : {
                domingo: { start: '', end: '', closed: false },
                segunda: { start: '', end: '', closed: false },
                terca: { start: '', end: '', closed: false },
                quarta: { start: '', end: '', closed: false },
                quinta: { start: '', end: '', closed: false },
                sexta: { start: '', end: '', closed: false },
                sabado: { start: '', end: '', closed: false },
              },
              instagram: data.instagram || '',
              facebook: data.facebook || ''
            };
          });
          setLoading(false);
        } else {
          navigate("/onboarding");
          setLoading(false);
        }
      }, (error) => {
        console.error("Erro ao escutar restaurante:", error);
      });
    });
    return () => {
      unsubAuth();
      unsubRest();
    };
  }, [navigate]);

  // Load global decorative frames to dynamically style profile logo previews
  useEffect(() => {
    const unsubFrames = onSnapshot(collection(db, "frames"), (snap) => {
      setFrames(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    }, (err) => {
      console.error("Erro ao escutar molduras:", err);
    });
    return () => unsubFrames();
  }, []);

  useEffect(() => {
    if (!user) return;
    
    // Listen to Products
    const qProd = query(collection(db, "products"), where("restaurantId", "==", user.uid));
    const unsubProd = onSnapshot(qProd, (snap) => {
      setProducts(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    }, (error) => {
      console.error("Erro ao escutar produtos:", error);
      setDebugSyncError(error.message);
    });

    // Listen to Promotions
    const qPromo = query(collection(db, "promotions"), where("restaurantId", "==", user.uid));
    const unsubPromo = onSnapshot(qPromo, (snap) => {
      setPromotions(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    }, (error) => {
      console.warn("Erro ao escutar promoções:", error);
    });

    // Listen to Categories
    const qCat = query(collection(db, "categories"), where("restaurantId", "==", user.uid));
    const unsubCat = onSnapshot(qCat, (snap) => {
      const cats = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      cats.sort((a: any, b: any) => {
        const orderA = a.order !== undefined ? a.order : 9999;
        const orderB = b.order !== undefined ? b.order : 9999;
        if (orderA !== orderB) return orderA - orderB;
        return (a.createdAt || 0) - (b.createdAt || 0);
      });
      setCategories(cats);
    }, (error) => {
      console.error("Erro ao escutar categorias:", error);
      setCategoryError("Erro de sincronização: " + error.message);
      setDebugSyncError(error.message);
    });

    // Listen to Orders
    const qOrders = query(collection(db, "orders"), where("restaurantId", "==", user.uid));
    let isInitialOrdersLoad = true;
    
    const unsubOrders = onSnapshot(qOrders, (snap) => {
      if (!isInitialOrdersLoad) {
        snap.docChanges().forEach((change) => {
          const data = change.doc.data();
          const pOrder = prevOrdersRef.current[change.doc.id];
          
          if (change.type === "added" && data.status === "Novo") {
             playNotification("new");
             const shortId = change.doc.id.slice(-4).toUpperCase();
             addToast(`Novo pedido #${shortId} recebido`, "new");
             
             // Auto-print both copies when a new order arrives from the online menu/cardapio
             const connectedPrinter = printersRef.current.find(p => p.connected && p.device);
             if (connectedPrinter) {
               handlePrintBoth({ id: change.doc.id, ...data });
             }
          } else if (change.type === "modified" && data.status === "Pronto" && pOrder && pOrder.status !== "Pronto") {
             playNotification("ready");
             const shortId = change.doc.id.slice(-4).toUpperCase();
             addToast(`Pedido #${shortId} está pronto`, "ready");
          }
          
          prevOrdersRef.current[change.doc.id] = data;
        });
      } else {
        snap.docs.forEach(d => { prevOrdersRef.current[d.id] = d.data() });
        isInitialOrdersLoad = false;
      }
      
      setOrders(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    }, (error) => {
      console.error("Erro ao escutar pedidos:", error);
      setDebugSyncError(error.message);
    });

    // Listen to Menu Views
    const qViews = query(collection(db, "menu_views"), where("restaurantId", "==", user.uid));
    const unsubViews = onSnapshot(qViews, (snap) => {
      setMenuViews(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    }, (error) => {
      console.error("Erro ao escutar visualizações:", error);
    });

    // Listen to Tables
    const qTables = query(collection(db, "tables"), where("restaurantId", "==", user.uid));
    const unsubTables = onSnapshot(qTables, (snap) => {
      const fetchedTables: any[] = snap.docs.map(d => ({ id: d.id, ...d.data() }));

      if (hasLoadedTablesRef.current) {
        snap.docChanges().forEach(change => {
          if (change.type === "modified" || change.type === "added") {
            const data = change.doc.data() as any;
            const prevData = prevTablesRef.current[change.doc.id];
            
            const justOccupied = (data.status === "Ocupada" && (!prevData || prevData.status !== "Ocupada" || (data.lastOccupiedAt && data.lastOccupiedAt > (prevData.lastOccupiedAt || 0) && Date.now() - data.lastOccupiedAt < 15000)));

            if (justOccupied) {
              playNotification("new");
              addToast(`Mesa ${data.name || 'Nova'} acabou de ocupar!`, "new");
            }
          }
        });
      } else {
        hasLoadedTablesRef.current = true;
      }

      const tablesMap: Record<string, any> = {};
      fetchedTables.forEach(t => { tablesMap[t.id] = t; });
      prevTablesRef.current = tablesMap;

      fetchedTables.sort((a, b) => (a.name || "").localeCompare((b.name || ""), undefined, { numeric: true }));
      setTables(fetchedTables);
    }, (error) => {
      console.error("Erro ao escutar mesas:", error);
    });

    // Listen to Announcements/Avisos
    const qAnnouncements = query(collection(db, "announcements"), where("restaurantId", "==", user.uid));
    const unsubAnnouncements = onSnapshot(qAnnouncements, (snap) => {
      setAnnouncements(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    }, (error) => {
      console.error("Erro ao escutar avisos:", error);
    });

    // Listen to Waiters
    const qWaiters = query(collection(db, "waiters"), where("restaurantId", "==", user.uid));
    const unsubWaiters = onSnapshot(qWaiters, (snap) => {
      setWaiters(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    }, (error) => {
      console.error("Erro ao escutar garçons:", error);
    });

    // Listen to Plans Config
    const unsubPlans = onSnapshot(doc(db, "configs", "plans"), (snap) => {
      if (snap.exists()) {
        setPlansConfig(snap.data());
      }
    }, (error) => {
      console.error("Erro ao escutar planos no Dashboard:", error);
    });

    const unsubAdminAnnouncement = onSnapshot(doc(db, "configs", "admin_announcement"), (snap) => {
      if (snap.exists()) {
        setAdminAnnouncement(snap.data());
      }
    }, (error) => {
      console.error("Erro ao escutar admin_announcement no Dashboard:", error);
    });

    const qPayments = query(collection(db, "subscription_payments"), where("restaurantId", "==", user.uid));
    const unsubPayments = onSnapshot(qPayments, (snap) => {
      setPayments(snap.docs.map(d => ({ id: d.id, ...d.data() })).sort((a: any, b: any) => {
        const dateA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
        const dateB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
        return dateB - dateA;
      }));
    }, (error) => {
      console.error("Erro ao escutar pagamentos de assinatura:", error);
    });

    return () => {
      unsubProd();
      unsubCat();
      unsubPromo();
      unsubOrders();
      unsubViews();
      unsubTables();
      unsubAnnouncements();
      unsubWaiters();
      unsubPlans();
      unsubAdminAnnouncement();
      unsubPayments();
    };
  }, [user]);

  // Actions
  const handleSignOut = () => {
    signOut(auth);
    navigate("/");
  };

  const handleSaveAnnouncement = async () => {
    if (!announcementsForm.message.trim()) {
      setAnnouncementError("Por favor, digite a mensagem do aviso.");
      return;
    }
    setAnnouncementError("");
    try {
      if (!user || !user.uid) {
        throw new Error("Usuário não autenticado");
      }
      
      let expiresAt: any = null;
      if (announcementsForm.hasExpiration && announcementsForm.expirationDate) {
        expiresAt = new Date(announcementsForm.expirationDate).getTime();
      }

      const announcementData: any = {
        restaurantId: user.uid,
        title: announcementsForm.title.trim(),
        message: announcementsForm.message.trim(),
        type: announcementsForm.type,
        hasExpiration: announcementsForm.hasExpiration,
        expiresAt: expiresAt,
        isActive: true,
        updatedAt: Date.now(),
      };

      if (announcementsForm.id) {
        // Edit
        const docRef = doc(db, "announcements", announcementsForm.id);
        await updateDoc(docRef, announcementData);
      } else {
        // Create
        announcementData.createdAt = Date.now();
        await addDoc(collection(db, "announcements"), announcementData);
      }

      // Reset Form and Close
      setAnnouncementsForm({
        id: "",
        title: "",
        message: "",
        type: "warning",
        hasExpiration: false,
        expirationDate: "",
      });
      setIsAnnouncementsModalOpen(false);
    } catch (error: any) {
      console.error("Erro ao salvar aviso:", error);
      setAnnouncementError("Erro ao salvar o aviso: " + error.message);
    }
  };

  const handleToggleAnnouncementActive = async (announcement: any) => {
    try {
      const docRef = doc(db, "announcements", announcement.id);
      await updateDoc(docRef, {
        isActive: !announcement.isActive,
        updatedAt: Date.now()
      });
    } catch (error: any) {
      console.error("Erro ao atualizar status do aviso:", error);
    }
  };

  const handleDeleteAnnouncement = async (id: string) => {
    try {
      await deleteDoc(doc(db, "announcements", id));
    } catch (error: any) {
      console.error("Erro ao excluir aviso:", error);
    }
  };

  const handleOpenAddPromo = () => {
    setPromoForm({
      name: "",
      type: "buy_x_get_y",
      productId: "",
      giftProductId: "",
      buyQty: 1,
      giftQty: 1,
      discountType: "percentage",
      discountValue: 0,
      productIds: [],
      comboPrice: 0,
      isActive: true,
    });
    setEditingPromotion(null);
    setPromotionError("");
    setIsPromotionModalOpen(true);
  };

  const handleOpenEditPromo = (promo: any) => {
    setPromoForm({
      name: promo.name || "",
      type: promo.type || "buy_x_get_y",
      productId: promo.productId || "",
      giftProductId: promo.giftProductId || "",
      buyQty: promo.buyQty !== undefined ? promo.buyQty : 1,
      giftQty: promo.giftQty !== undefined ? promo.giftQty : 1,
      discountType: promo.discountType || "percentage",
      discountValue: promo.discountValue !== undefined ? promo.discountValue : 0,
      productIds: promo.productIds || [],
      comboPrice: promo.comboPrice !== undefined ? promo.comboPrice : 0,
      isActive: promo.isActive !== undefined ? promo.isActive : true,
    });
    setEditingPromotion(promo);
    setPromotionError("");
    setIsPromotionModalOpen(true);
  };

  const handleSavePromotion = async () => {
    if (!promoForm.name.trim()) {
      setPromotionError("Por favor, digite um nome para a promoção.");
      return;
    }

    if (promoForm.type === "buy_x_get_y") {
      if (!promoForm.productId) {
        setPromotionError("Por favor, selecione o produto de gatilho (que o cliente compra).");
        return;
      }
      if (!promoForm.giftProductId) {
        setPromotionError("Por favor, selecione o produto de brinde (que o cliente ganha).");
        return;
      }
      if (promoForm.buyQty < 1) {
        setPromotionError("A quantidade de compra mínima deve ser pelo menos 1.");
        return;
      }
      if (promoForm.giftQty < 1) {
        setPromotionError("A quantidade de brinde deve ser pelo menos 1.");
        return;
      }
    }

    if (promoForm.type === "discount") {
      if (!promoForm.productId) {
        setPromotionError("Por favor, selecione o produto que receberá o desconto.");
        return;
      }
      if (promoForm.discountValue <= 0) {
        setPromotionError("Por favor, digite um valor de desconto maior que zero.");
        return;
      }
      if (promoForm.discountType === "percentage" && promoForm.discountValue > 100) {
        setPromotionError("O desconto percentual não pode ser maior que 100%.");
        return;
      }
    }

    if (promoForm.type === "combo") {
      if (!promoForm.productIds || promoForm.productIds.length < 2) {
        setPromotionError("Por favor, selecione pelo menos 2 produtos para o combo.");
        return;
      }
      if (promoForm.comboPrice <= 0) {
        setPromotionError("Por favor, insira um preço promocional maior que zero para o combo.");
        return;
      }
    }

    setPromotionError("");
    try {
      if (!user || !user.uid) {
        throw new Error("Usuário não autenticado");
      }

      const payload: any = {
        name: promoForm.name.trim(),
        type: promoForm.type,
        productId: promoForm.productId || "",
        giftProductId: promoForm.giftProductId || "",
        buyQty: Number(promoForm.buyQty) || 1,
        giftQty: Number(promoForm.giftQty) || 1,
        discountType: promoForm.discountType,
        discountValue: Number(promoForm.discountValue) || 0,
        productIds: promoForm.productIds || [],
        comboPrice: Number(promoForm.comboPrice) || 0,
        isActive: promoForm.isActive,
        updatedAt: Date.now()
      };

      if (editingPromotion) {
        await updateDoc(doc(db, "promotions", editingPromotion.id), payload);
      } else {
        await addDoc(collection(db, "promotions"), {
          ...payload,
          restaurantId: user.uid,
          createdAt: Date.now()
        });
      }

      setIsPromotionModalOpen(false);
      setEditingPromotion(null);
    } catch (error: any) {
      console.error("Erro ao salvar promoção:", error);
      setPromotionError("Erro ao salvar promoção: " + error.message);
    }
  };

  const handleTogglePromotionActive = async (promo: any) => {
    try {
      await updateDoc(doc(db, "promotions", promo.id), {
        isActive: !promo.isActive,
        updatedAt: Date.now()
      });
    } catch (error: any) {
      console.error("Erro ao atualizar status da promoção:", error);
    }
  };

  const handleDeletePromotion = (id: string, name: string) => {
    setDeleteConfirm({
      isOpen: true,
      title: "Excluir Promoção",
      message: `Deseja realmente excluir a promoção "${name}"? Esta ação não poderá ser desfeita.`,
      onConfirm: async () => {
        try {
          await deleteDoc(doc(db, "promotions", id));
        } catch (error: any) {
          console.error("Erro ao excluir promoção:", error);
        } finally {
          setDeleteConfirm(null);
        }
      }
    });
  };

  const handleAddCategory = async () => {
    if (!newCatName.trim()) {
      setCategoryError("Por favor, digite um nome para a categoria.");
      return;
    }
    setAddingCategory(true);
    setCategoryError("");
    try {
      if (!user || !user.uid) {
        throw new Error("Usuário não autenticado no Firestore");
      }
      const maxOrder = categories.reduce((max, cat) => Math.max(max, cat.order ?? 0), -1);
      await addDoc(collection(db, "categories"), {
        restaurantId: user.uid,
        name: newCatName.trim(),
        order: maxOrder + 1,
        createdAt: Date.now(),
        availableDays: newCatAvailableDays,
        isVisible: newCatIsVisible
      });
      setNewCatName("");
      setNewCatAvailableDays([]);
      setNewCatIsVisible(true);
    } catch (e: any) {
      console.error("Erro completo ao salvar categoria:", e);
      setCategoryError(e.message || "Erro inesperado ao salvar categoria no banco de dados.");
    } finally {
      setAddingCategory(false);
    }
  };

  const handleStartEditCategory = (cat: any) => {
    setEditingCatId(cat.id);
    setEditingCatName(cat.name);
    setEditingCatAvailableDays(cat.availableDays || []);
    setEditingCatIsVisible(cat.isVisible !== false);
  };

  const handleSaveEditCategory = async (id: string) => {
    if (!editingCatName.trim()) {
      alert("O nome da categoria não pode ser vazio.");
      return;
    }
    try {
      await updateDoc(doc(db, "categories", id), {
        name: editingCatName.trim(),
        availableDays: editingCatAvailableDays,
        isVisible: editingCatIsVisible
      });
      setEditingCatId(null);
      setEditingCatName("");
      setEditingCatAvailableDays([]);
      setEditingCatIsVisible(true);
    } catch (e: any) {
      console.error(e);
      alert("Erro ao salvar categoria.");
    }
  };

  const handleMoveCategory = async (cat: any, index: number, direction: "up" | "down") => {
    const targetIndex = direction === "up" ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= categories.length) return;

    setAddingCategory(true);

    try {
      const newSequence = [...categories];
      const temp = newSequence[index];
      newSequence[index] = newSequence[targetIndex];
      newSequence[targetIndex] = temp;

      const promises = newSequence.map((c, i) => 
        updateDoc(doc(db, "categories", c.id), { order: i })
      );

      await Promise.all(promises);
    } catch (e) {
      console.error("Erro ao reordenar categoria:", e);
      alert("Erro ao reordenar categoria.");
    } finally {
      setAddingCategory(false);
    }
  };

  const handleDeleteCategory = async (id: string) => {
    setDeleteConfirm({
      isOpen: true,
      title: "Excluir Categoria",
      message: "Tem certeza que deseja excluir esta categoria? Esta ação é irreversível.",
      onConfirm: async () => {
        try {
          await deleteDoc(doc(db, "categories", id));
        } catch (e) {
          console.error(e);
          alert("Erro ao excluir categoria.");
        } finally {
          setDeleteConfirm(null);
        }
      }
    });
  };

  const handleAddTable = async () => {
    if (!newTableName.trim()) {
      alert("Por favor, digite um nome/número para a mesa.");
      return;
    }
    setAddingTable(true);
    try {
      if (!user || !user.uid) throw new Error("Usuário não autenticado");
      await addDoc(collection(db, "tables"), {
        restaurantId: user.uid,
        name: newTableName.trim(),
        customerName: "",
        status: "Livre",
        createdAt: Date.now()
      });
      setNewTableName("");
    } catch (e: any) {
      console.error(e);
      alert("Erro ao salvar mesa.");
    } finally {
      setAddingTable(false);
    }
  };

  const handleDeleteTable = async (id: string) => {
    setDeleteConfirm({
      isOpen: true,
      title: "Excluir Mesa",
      message: "Tem certeza que deseja excluir esta mesa? Esta ação é irreversível.",
      onConfirm: async () => {
        try {
          await deleteDoc(doc(db, "tables", id));
        } catch (e) {
          console.error(e);
          alert("Erro ao excluir mesa.");
        } finally {
          setDeleteConfirm(null);
        }
      }
    });
  };

  const handleBulkGenerateTables = async () => {
    if (!user || !user.uid) return;
    const count = parseInt(bulkTableCount, 10);
    if (isNaN(count) || count <= 0) {
      alert("Por favor, insira um número válido maior que zero.");
      return;
    }
    
    setGeneratingBulk(true);
    try {
      const startNumber = tables.length + 1;
      const promises = [];
      for (let i = 0; i < count; i++) {
        promises.push(addDoc(collection(db, "tables"), {
          restaurantId: user.uid,
          name: `Mesa ${startNumber + i}`,
          customerName: "",
          status: "Livre",
          createdAt: Date.now() + i
        }));
      }
      await Promise.all(promises);
      setBulkTableCount("");
    } catch (e: any) {
      console.error(e);
      alert("Erro ao gerar mesas em massa.");
    } finally {
      setGeneratingBulk(false);
    }
  };

  const handleDeleteAllTables = async () => {
    if (tables.length === 0) return;
    setDeleteConfirm({
      isOpen: true,
      title: "Excluir TODAS as Mesas",
      message: `Tem certeza que deseja excluir TODAS as ${tables.length} mesas cadastradas? Esta ação é irreversível e excluirá todas as mesas e os clientes vinculados a elas.`,
      onConfirm: async () => {
        try {
          const promises = tables.map(t => deleteDoc(doc(db, "tables", t.id)));
          await Promise.all(promises);
        } catch (e) {
          console.error(e);
          alert("Erro ao excluir mesas.");
        } finally {
          setDeleteConfirm(null);
        }
      }
    });
  };

  const handleUpdateTableCustomer = async (tableId: string, customerName: string) => {
    try {
      await updateDoc(doc(db, "tables", tableId), {
        customerName: customerName,
        status: customerName.trim() ? "Ocupada" : "Livre"
      });
      setCustomerInputs(prev => ({ ...prev, [tableId]: "" }));
    } catch(e) {
      console.error(e);
      alert("Erro ao vincular cliente à mesa.");
    }
  };

  const handleClearTable = async (tableId: string, restoreStock: boolean = true) => {
    try {
      const foundTable = tables.find(t => t.id === tableId);
      if (restoreStock && foundTable && foundTable.items && foundTable.items.length > 0) {
        await syncTableStockDifferences(foundTable.items, []);
      }
      await updateDoc(doc(db, "tables", tableId), {
        customerName: "",
        status: "Livre",
        items: [],
        total: 0
      });
    } catch(e) {
      console.error(e);
      alert("Erro ao limpar mesa.");
    }
  };

  const handleFinalizeTableOrder = async (table: any) => {
    if (!table.items || table.items.length === 0) {
      alert("A mesa não possui itens consumidos.");
      return;
    }
    try {
      const orderData = {
        restaurantId: user.uid,
        customerName: table.customerName || formatTableName(table.name),
        customerPhone: "",
        contactPhone: "",
        customerAddress: "",
        items: table.items,
        total: table.total || 0,
        status: "Finalizado",
        timestamp: Date.now(),
        checkoutType: "balcao",
        tableNumber: table.name,
        paymentMethod: "dinheiro", // Pode ser ajustado pelo usuário na mesa se quisermos fazer um modal, mas p/ simplificar
        changeFor: ""
      };
      const docRef = await addDoc(collection(db, "orders"), orderData);
      
      // Stock was already decremented during table saves. No need to decrement again.
      
      handleClearTable(table.id, false); // Cancel restore stock since the items were sold

      const finalOrder = { ...orderData, id: docRef.id };
      const successMsg = `${formatTableName(table.name)} finalizada com sucesso!`;
      
      if (!user?.isWaiter && finalOrder) {
        setPdvOrderPrintConfirm({
          isOpen: true,
          order: finalOrder,
          successMessage: successMsg
        });
      } else {
        alert(successMsg);
      }
    } catch (e) {
      console.error(e);
      alert("Erro ao finalizar o pedido da mesa.");
    }
  };

  const addToPdvCart = (product: any) => {
    const existing = pdvCart.find(p => p.productId === product.id || p.id === product.id);
    const currentQty = existing ? existing.quantity : 0;
    const originalQty = existing ? (existing.originalTableQty || 0) : 0;

    if (product.isOutOfStock && currentQty >= originalQty) {
      alert(`O produto "${product.name}" está esgotado e não pode ser adicionado.`);
      return;
    }
    setPdvCart(prev => {
      const existing = prev.find(p => p.productId === product.id || p.id === product.id);
      if (existing) {
        return prev.map(p => (p.productId === product.id || p.id === product.id) ? { ...p, quantity: p.quantity + 1 } : p);
      }
      return [...prev, { ...product, quantity: 1, options: [], obs: "" }];
    });
    addToast(`${product.name} adicionado!`, "ready");
  };

  const removeFromPdvCart = (index: number) => {
    setPdvCart(prev => {
      const nw = [...prev];
      if (nw[index].quantity > 1) {
        nw[index].quantity -= 1;
      } else {
        nw.splice(index, 1);
      }
      return nw;
    });
  };

  const increasePdvCartQuantity = (index: number) => {
    const item = pdvCart[index];
    if (item) {
      const dbProd = products.find(p => p.id === (item.productId || item.id));
      if (dbProd && dbProd.isOutOfStock) {
        const currentQty = item.quantity;
        const originalQty = item.originalTableQty || 0;
        if (currentQty >= originalQty) {
          alert(`O produto "${item.name}" está esgotado e não é possível aumentar a quantidade.`);
          return;
        }
      }
    }
    setPdvCart(prev => {
      const nw = [...prev];
      if (nw[index]) {
        nw[index] = { ...nw[index], quantity: nw[index].quantity + 1 };
      }
      return nw;
    });
  };

  const decreasePdvCartQuantity = (index: number) => {
    setPdvCart(prev => {
      const nw = [...prev];
      if (nw[index]) {
        if (nw[index].quantity > 1) {
          nw[index] = { ...nw[index], quantity: nw[index].quantity - 1 };
        } else {
          nw.splice(index, 1);
        }
      }
      return nw;
    });
  };

  const removeEntirelyFromPdvCart = (index: number) => {
    setPdvCart(prev => prev.filter((_, idx) => idx !== index));
  };

  const updatePdvCartItemObs = (index: number, obs: string) => {
    setPdvCart(prev => {
      const nw = [...prev];
      if (nw[index]) {
        nw[index] = { ...nw[index], obs };
      }
      return nw;
    });
  };

  const getProcessedPdvCart = () => {
    let processed = pdvCart.map((item, index) => {
      const product = products.find(p => p.id === (item.productId || item.id));
      if (!product) return { ...item, originalIndex: index, parsedPrice: parsePrice(item.price) };

      const addonsTotal = (item.selectedAddons || []).reduce((sum: number, ad: any) => sum + parsePrice(ad.price), 0);
      let itemPrice = parsePrice(product.price) + addonsTotal;

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
        ...item,
        productId: product.id,
        name: discountPromo ? `${product.name} (Promo OFF)` : product.name,
        price: itemPrice,
        parsedPrice: itemPrice,
        originalIndex: index
      };
    });

    const promoGifts: any[] = [];
    promotions.forEach(promo => {
      if (promo.isActive && promo.type === "buy_x_get_y") {
        const triggers = processed.filter(item => (item.productId || item.id) === promo.productId);
        const totalTrigQty = triggers.reduce((sum, item) => sum + item.quantity, 0);
        if (totalTrigQty >= promo.buyQty) {
          const mult = Math.floor(totalTrigQty / promo.buyQty);
          const freeQty = mult * (promo.giftQty || 1);
          const giftProd = products.find(p => p.id === promo.giftProductId);
          if (giftProd) {
            promoGifts.push({
              id: `gift_${promo.id}`,
              productId: giftProd.id,
              name: `${giftProd.name} (Brinde: ${promo.name})`,
              price: 0,
              parsedPrice: 0,
              quantity: freeQty,
              selectedAddons: [],
              selectedComplements: [],
              image: giftProd.imageUrl || "",
              isPromoGift: true
            });
          }
        }
      }
    });

    const comboDiscounts: any[] = [];
    promotions.forEach(promo => {
      if (promo.isActive && promo.type === "combo" && promo.productIds && promo.productIds.length >= 2) {
        const prodsQtys = promo.productIds.map((id: string) => {
          const match = processed.filter(item => (item.productId || item.id) === id);
          return match.reduce((sum, item) => sum + item.quantity, 0);
        });
        const completePacks = Math.min(...prodsQtys);
        if (completePacks > 0) {
          const normalSumPrice = promo.productIds.reduce((sum: number, id: string) => {
            const prod = products.find(p => p.id === id);
            return sum + (prod ? parsePrice(prod.price) : 0);
          }, 0);
          const savingPerPack = normalSumPrice - promo.comboPrice;
          if (savingPerPack > 0) {
            comboDiscounts.push({
              id: `combo_disc_${promo.id}`,
              productId: `combo_disc_${promo.id}`,
              name: `Desconto Combo: ${promo.name}`,
              price: -savingPerPack,
              parsedPrice: -savingPerPack,
              quantity: completePacks,
              selectedAddons: [],
              selectedComplements: [],
              image: "",
              isPromoComboDiscount: true
            });
          }
        }
      }
    });

    return [...processed, ...promoGifts, ...comboDiscounts];
  };

  const getProcessedPdvCartItemsCount = () => {
    return getProcessedPdvCart().reduce((sum, item) => {
      if (item.price < 0) return sum;
      return sum + item.quantity;
    }, 0);
  };

  const parsePrice = (val: any): number => {
    if (val === undefined || val === null) return 0;
    if (typeof val === "number") return val;
    const clean = String(val).replace(/[^0-9.,-]/g, "").replace(",", ".");
    const parsed = parseFloat(clean);
    return isNaN(parsed) ? 0 : parsed;
  };

  const neighborhoods = (restaurant?.deliveryFees && restaurant.deliveryFees.length > 0)
    ? restaurant.deliveryFees
    : [
        { id: "1", name: "Centro", fee: 5.00 },
        { id: "2", name: "Bairro A", fee: 8.00 },
        { id: "3", name: "Bairro B", fee: 10.00 }
      ];

  const calculatePdvTotal = () => {
    let baseTotal = getProcessedPdvCart().reduce((sum, item) => {
      const price = parsePrice(item.price);
      return sum + (price * item.quantity);
    }, 0);
    
    if (pdvCheckoutType === "entrega") {
      const selectedNeighborhood = neighborhoods.find(n => n.name === pdvNeighborhood);
      if (selectedNeighborhood) {
        baseTotal += selectedNeighborhood.fee;
      }
    }
    return baseTotal;
  };

  const launchPdvToTable = async () => {
    if (!pdvTableNumber) {
      alert("Selecione uma mesa.");
      return;
    }
    setIsSubmittingOrder(true);
    try {
      const foundTable = tables.find(t => t.name === pdvTableNumber);
      if (!foundTable) {
        alert("Mesa não encontrada.");
        setIsSubmittingOrder(false);
        return;
      }

      const processedCart = getProcessedPdvCart();

      // Prevent generating comanda or saving if any item is out of stock in DB
      const outOfStockItem = processedCart.find(item => {
        if (item.fromTable) return false; // Ignore already saved table items
        const dbProd = products.find(p => p.id === (item.productId || item.id));
        return dbProd && dbProd.isOutOfStock;
      });
      if (outOfStockItem) {
        alert(`O produto "${outOfStockItem.name}" está esgotado e não pode ser lançado na mesa.`);
        setIsSubmittingOrder(false);
        return;
      }

      const orderItems = processedCart.map(item => ({
        id: item.fromTable ? item.id : `item-${Date.now()}-${Math.random()}`,
        productId: item.productId || item.id,
        name: item.name,
        qty: item.quantity,
        price: parsePrice(item.price),
        selectedAddons: item.selectedAddons || [],
        selectedComplements: item.selectedComplements || [],
        timestamp: item.timestamp || Date.now(),
        image: item.image || "",
        obs: item.obs || "",
        _isNew: !item.fromTable
      }));
      
      const newlyAddedItems = orderItems.filter((i: any) => i._isNew);
      orderItems.forEach((i: any) => delete i._isNew);
      newlyAddedItems.forEach((i: any) => delete i._isNew);

      const newTotal = orderItems.reduce((sum, i) => sum + (i.price * i.qty), 0);

      await syncTableStockDifferences(foundTable.items || [], orderItems);

      await updateDoc(doc(db, "tables", foundTable.id), {
        items: orderItems,
        total: newTotal,
        customerName: pdvCustomerName || foundTable.customerName || "Balcão",
        customerPhone: pdvCustomerPhone || foundTable.customerPhone || "",
        status: orderItems.length > 0 ? "Ocupada" : "Livre",
        waiterId: pdvWaiterId || "",
        waiterName: pdvWaiterName || ""
      });

      const handleAfterSave = () => {
        setPdvCart([]);
        setPdvCustomerName("");
        setPdvCustomerPhone("");
        setPdvObservation("");
        setPdvCheckoutType("balcao");
        setPdvReturnedProduct("");
        setPdvReturnedQty(1);
        setPdvSearchOrderQuery("");
        setPdvSelectedOrderId("");
        setPdvTableNumber("");
        setPdvWaiterId(user?.isWaiter ? user.waiterId || "" : "");
        setPdvWaiterName(user?.isWaiter ? user.waiterName || "" : "");
        alert(`${formatTableName(pdvTableNumber)} salva com sucesso!`);
      };

      if (!user?.isWaiter && orderItems.length > 0) {
        const partialOrder = {
          id: `acrescimo-${foundTable.id}-${Date.now()}`,
          restaurantId: user?.uid,
          customerName: pdvCustomerName || foundTable.customerName || formatTableName(pdvTableNumber),
          customerPhone: pdvCustomerPhone || foundTable.customerPhone || "",
          items: newlyAddedItems.length > 0 ? newlyAddedItems : orderItems,
          observation: "COMANDA " + formatTableName(pdvTableNumber).toUpperCase() + (pdvObservation ? `\nOBS: ${pdvObservation}` : ""),
          total: (newlyAddedItems.length > 0 ? newlyAddedItems : orderItems).reduce((acc, curr) => acc + (curr.price * curr.qty), 0),
          status: "Novo",
          timestamp: Date.now(),
          checkoutType: "balcao",
          tableNumber: pdvTableNumber,
          waiterName: pdvWaiterName || foundTable.waiterName || "",
          paymentMethod: "",
        };

        setPdvTablePrintConfirm({
          isOpen: true,
          partialOrder,
          onDone: handleAfterSave
        });
      } else {
        handleAfterSave();
      }
    } catch (e: any) {
      console.error(e);
      alert("Erro ao salvar produtos na mesa.");
    } finally {
      setIsSubmittingOrder(false);
    }
  };

  const handleEditTableInPdv = (table: any) => {
    setPdvTableNumber(table.name);
    if (table.customerName) {
      setPdvCustomerName(table.customerName);
    } else {
      setPdvCustomerName("");
    }
    if (table.customerPhone) {
      setPdvCustomerPhone(table.customerPhone);
    } else {
      setPdvCustomerPhone("");
    }
    
    if (table.items && table.items.length > 0) {
      const restoredCart = table.items.map((i: any, index: number) => ({
        id: i.id || `table-item-${table.name}-${index}`,
        productId: i.productId || i.id,
        name: i.name,
        quantity: i.qty,
        price: i.price,
        selectedAddons: i.selectedAddons || [],
        selectedComplements: i.selectedComplements || [],
        timestamp: i.timestamp,
        image: i.image,
        fromTable: table.name,
        originalTableQty: i.qty
      }));
      
      setPdvCart(prev => {
        const manuallyAdded = prev.filter(p => !p.fromTable);
        
        // Mesclar itens adicionados manualmente no restoredCart
        const mergedCart = [...restoredCart];
        manuallyAdded.forEach(manualItem => {
          const targetId = manualItem.productId || manualItem.id;
          const existingIndex = mergedCart.findIndex(rc => (rc.productId === targetId || rc.id === targetId));
          if (existingIndex !== -1) {
            mergedCart[existingIndex].quantity += manualItem.quantity;
            if (manualItem.obs) {
              mergedCart[existingIndex].obs = mergedCart[existingIndex].obs 
                ? `${mergedCart[existingIndex].obs}, ${manualItem.obs}`
                : manualItem.obs;
            }
          } else {
            mergedCart.push(manualItem);
          }
        });
        
        return mergedCart;
      });
    } else {
      setPdvCart(prev => prev.filter(p => !p.fromTable));
    }
    
    setPdvCheckoutType("balcao");
    setActiveTab("pdv");
  };

  const submitPdvTableOrder = async () => {
    if (!pdvTableNumber) return;
    setIsSubmittingOrder(true);
    try {
      const foundTable = tables.find(t => t.name === pdvTableNumber);
      if (!foundTable) {
        alert("Mesa não encontrada");
        setIsSubmittingOrder(false);
        return;
      }
      
      const orderItems = getProcessedPdvCart().map(item => ({
        id: item.fromTable ? item.id : `item-${Date.now()}-${Math.random()}`,
        productId: item.productId || item.id,
        name: item.name,
        qty: item.quantity,
        price: parsePrice(item.price),
        selectedAddons: item.selectedAddons || [],
        selectedComplements: item.selectedComplements || [],
        timestamp: item.timestamp || Date.now(),
        image: item.image || "",
        obs: item.obs || ""
      }));

      // Prevent generating comanda if any item is out of stock in DB
      const outOfStockItem = orderItems.find(item => {
        const cartItem = pdvCart.find(p => p.id === item.id || p.productId === item.productId);
        if (cartItem && cartItem.fromTable) return false;
        const dbProd = products.find(p => p.id === item.productId);
        return dbProd && dbProd.isOutOfStock;
      });
      if (outOfStockItem) {
        alert(`O produto "${outOfStockItem.name}" está esgotado e a comanda não pode ser gerada.`);
        setIsSubmittingOrder(false);
        return;
      }

      const newTotal = orderItems.reduce((sum, i) => sum + (i.price * i.qty), 0);

      if (orderItems.length === 0) {
        alert("A mesa não possui itens para finalizar.");
        setIsSubmittingOrder(false);
        return;
      }

      const orderData = {
        restaurantId: user.uid,
        customerName: pdvCustomerName || foundTable.customerName || formatTableName(pdvTableNumber),
        customerPhone: pdvCustomerPhone || "",
        contactPhone: pdvCustomerPhone || "",
        customerAddress: "",
        items: orderItems,
        observation: pdvObservation || "",
        total: newTotal,
        status: "Finalizado",
        timestamp: Date.now(),
        checkoutType: "balcao",
        tableNumber: pdvTableNumber,
        paymentMethod: pdvPaymentMethod,
        changeFor: pdvPaymentMethod === "dinheiro" ? pdvChangeFor : "",
        waiterId: pdvWaiterId || foundTable.waiterId || "",
        waiterName: pdvWaiterName || foundTable.waiterName || ""
      };
      
      const docRef = await addDoc(collection(db, "orders"), orderData);

      await syncTableStockDifferences(foundTable.items || [], orderItems);

      await updateDoc(doc(db, "tables", foundTable.id), {
        customerName: "",
        status: "Livre",
        items: [],
        total: 0,
        waiterId: "",
        waiterName: ""
      });

      const finalOrder = { ...orderData, id: docRef.id };

      setPdvCart([]);
      setPdvCustomerName("");
      setPdvCustomerPhone("");
      setPdvObservation("");
      setPdvCheckoutType("balcao");
      setPdvReturnedProduct("");
      setPdvReturnedQty(1);
      setPdvSearchOrderQuery("");
      setPdvSelectedOrderId("");
      setPdvTableNumber("");
      setPdvWaiterId(user?.isWaiter ? user.waiterId || "" : "");
      setPdvWaiterName(user?.isWaiter ? user.waiterName || "" : "");
      
      const successMsg = `${formatTableName(pdvTableNumber)} finalizada com sucesso!`;
      if (!user?.isWaiter && finalOrder) {
        setPdvOrderPrintConfirm({
          isOpen: true,
          order: finalOrder,
          successMessage: successMsg
        });
      } else {
        alert(successMsg);
      }
    } catch(e) {
      console.error(e);
      alert("Erro ao finalizar pedido da mesa.");
    } finally {
      setIsSubmittingOrder(false);
    }
  };

  const submitPdvOrder = async () => {
    if (pdvCart.length === 0) {
      alert("Adicione produtos ao pedido.");
      return;
    }
    setIsSubmittingOrder(true);
    try {
      const processedCart = getProcessedPdvCart();
      const outOfStockItem = processedCart.find(item => {
        const dbProd = products.find(p => p.id === (item.productId || item.id));
        return dbProd && dbProd.isOutOfStock;
      });
      if (outOfStockItem) {
        alert(`O produto "${outOfStockItem.name}" está esgotado e o pedido não pode ser registrado.`);
        setIsSubmittingOrder(false);
        return;
      }

      const total = calculatePdvTotal();
      let printedOrderObj = null;

      if (pdvCheckoutType === "troca" && pdvSelectedOrderId) {
        // Edit existing order in Firebase
        const orderRef = doc(db, "orders", pdvSelectedOrderId);
        const orderSnap = await getDoc(orderRef);
        if (!orderSnap.exists()) {
          alert("Pedido original não encontrado para edição.");
          setIsSubmittingOrder(false);
          return;
        }

        const originalOrder = orderSnap.data();

        // Find the returned product name
        let returnedProdName = "";
        const pData = products.find(p => p.id === pdvReturnedProduct);
        if (pData) {
          returnedProdName = pData.name;
        } else {
          const matchItem = (originalOrder.items || []).find((it: any) => it.productId === pdvReturnedProduct || it.id === pdvReturnedProduct);
          returnedProdName = matchItem ? matchItem.name : "Produto Desconhecido";
        }

        // Adjust original order items (subtract returnedQty)
        const updatedItems = (originalOrder.items || []).map((it: any) => {
          const isMatch = it.productId === pdvReturnedProduct || it.id === pdvReturnedProduct;
          if (isMatch) {
            const currentQty = parseInt(it.qty || it.quantity || 1, 10);
            return { ...it, qty: Math.max(0, currentQty - pdvReturnedQty) };
          }
          return it;
        }).filter((it: any) => it.qty > 0);

        // Map cart items of newly added products
        const newItemsToAppend = getProcessedPdvCart().map(item => ({
          name: item.name,
          qty: item.quantity,
          price: parsePrice(item.price),
          productId: item.productId || item.id,
          selectedAddons: item.selectedAddons || [],
          selectedComplements: item.selectedComplements || []
        }));

        // Merged items
        const finalOrderItems = [...updatedItems, ...newItemsToAppend];
        const finalTotal = finalOrderItems.reduce((sum, item) => sum + (item.price * item.qty), 0);
        const finalItemsCount = finalOrderItems.reduce((acc, item) => acc + item.qty, 0);

        const updatedOrderFields = {
          items: finalOrderItems,
          total: finalTotal,
          itemsCount: finalItemsCount,
          checkoutType: "troca",
          returnedProductName: returnedProdName,
          returnedProductQty: pdvReturnedQty,
          addedItems: newItemsToAppend,
          lastModified: Date.now()
        };

        await updateDoc(orderRef, updatedOrderFields);

        // Adjust stocks for new items and returned item
        await decrementStockForOrderItems(newItemsToAppend);

        if (pdvReturnedProduct) {
          try {
            if (pData && pData.stock !== undefined && pData.stock !== null && pData.stock !== "") {
              const prodRef = doc(db, "products", pdvReturnedProduct);
              const newStock = Number(pData.stock) + pdvReturnedQty;
              await updateDoc(prodRef, { stock: newStock });
            }
          } catch (err) {
            console.error("Erro ao retornar estoque na troca:", err);
          }
        }

        printedOrderObj = { ...originalOrder, ...updatedOrderFields, id: pdvSelectedOrderId };
      } else {
        // Normal Flow (Create New Order)
        let returnedProdName = "";
        if (pdvCheckoutType === "troca" && pdvReturnedProduct) {
          const pData = products.find(p => p.id === pdvReturnedProduct);
          if (pData) {
            returnedProdName = pData.name;
          } else {
            const allOrderItems = orders.flatMap(o => o.items || []);
            const matchItem = allOrderItems.find(it => it.productId === pdvReturnedProduct || it.id === pdvReturnedProduct);
            returnedProdName = matchItem ? matchItem.name : "Produto Desconhecido";
          }
        }

        const orderData = {
          restaurantId: user.uid,
          customerName: pdvCustomerName || "Balcão",
          customerPhone: pdvCustomerPhone || "",
          contactPhone: pdvCustomerPhone || "",
          customerAddress: pdvCheckoutType === "entrega" ? pdvCustomerAddress : "",
          deliveryNeighborhood: pdvCheckoutType === "entrega" ? pdvNeighborhood : "",
          deliveryFee: pdvCheckoutType === "entrega" ? (neighborhoods.find(n => n.name === pdvNeighborhood)?.fee || 0) : 0,
          items: getProcessedPdvCart().map(item => ({
            name: item.name,
            qty: item.quantity,
            price: parsePrice(item.price),
            productId: item.productId || item.id,
            selectedAddons: item.selectedAddons || [],
            selectedComplements: item.selectedComplements || [],
            obs: item.obs || ""
          })),
          observation: pdvObservation || "",
          total,
          status: "Finalizado",
          timestamp: Date.now(),
          checkoutType: pdvCheckoutType,
          tableNumber: pdvCheckoutType === "balcao" ? pdvTableNumber : "",
          paymentMethod: pdvPaymentMethod,
          changeFor: pdvPaymentMethod === "dinheiro" ? pdvChangeFor : "",
          waiterId: pdvWaiterId || "",
          waiterName: pdvWaiterName || "",
          returnedProductName: returnedProdName,
          returnedProductQty: pdvCheckoutType === "troca" ? pdvReturnedQty : 0
        };
        const docRef = await addDoc(collection(db, "orders"), orderData);
        
        await decrementStockForOrderItems(orderData.items);
        
        if (pdvCheckoutType === "troca" && pdvReturnedProduct) {
          try {
            const pData = products.find(p => p.id === pdvReturnedProduct);
            if (pData && pData.stock !== undefined && pData.stock !== null && pData.stock !== "") {
               const prodRef = doc(db, "products", pdvReturnedProduct);
               const newStock = Number(pData.stock) + pdvReturnedQty;
               await updateDoc(prodRef, { stock: newStock });
            }
          } catch (err) {
            console.error("Erro ao retornar estoque na troca:", err);
          }
        }

        printedOrderObj = { ...orderData, id: docRef.id };
      }
      
      setPdvCart([]);
      setPdvCustomerName("");
      setPdvCustomerPhone("");
      setPdvObservation("");
      setPdvCustomerAddress("");
      setPdvCheckoutType("balcao");
      setPdvReturnedProduct("");
      setPdvReturnedQty(1);
      setPdvSearchOrderQuery("");
      setPdvSelectedOrderId("");
      setPdvTableNumber("");
      setPdvPaymentMethod("pix");
      setPdvChangeFor("");
      setPdvWaiterId(user?.isWaiter ? user.waiterId || "" : "");
      setPdvWaiterName(user?.isWaiter ? user.waiterName || "" : "");
      
      const successMsg = pdvCheckoutType === "troca" && pdvSelectedOrderId ? "Pedido trocado/atualizado com sucesso!" : "Pedido registrado com sucesso!";
      if (!user?.isWaiter && printedOrderObj) {
        setPdvOrderPrintConfirm({
          isOpen: true,
          order: printedOrderObj,
          successMessage: successMsg
        });
      } else {
        alert(successMsg);
      }
    } catch (e: any) {
      console.error(e);
      alert("Erro ao registrar pedido PDV.");
    } finally {
      setIsSubmittingOrder(false);
    }
  };

  const handleSaveProduct = async () => {
    if (!prodForm.name || !prodForm.price || !prodForm.category) {
      alert("Preencha nome, preço e categoria.");
      return;
    }

    try {
      const parsedStock = prodForm.stock.trim() === "" ? null : parseInt(prodForm.stock, 10);
      const computedIsOutOfStock = (parsedStock !== null && parsedStock <= 0) ? true : !!prodForm.isOutOfStock;

      const productData = {
        restaurantId: user.uid,
        name: prodForm.name,
        description: prodForm.description,
        price: parseFloat(prodForm.price),
        category: prodForm.category,
        imageUrl: prodForm.imageUrl || "https://images.unsplash.com/photo-1546069901-ba9599a7e63c?q=80&w=300&auto=format&fit=crop",
        flavors: prodForm.flavors || [],
        maxFlavors: prodForm.maxFlavors && parseInt(prodForm.maxFlavors, 10) > 0 ? parseInt(prodForm.maxFlavors, 10) : null,
        addons: prodForm.addons || [],
        maxAddons: prodForm.maxAddons && parseInt(prodForm.maxAddons, 10) > 0 ? parseInt(prodForm.maxAddons, 10) : null,
        complements: prodForm.complements || [],
        maxComplements: prodForm.maxComplements && parseInt(prodForm.maxComplements, 10) > 0 ? parseInt(prodForm.maxComplements, 10) : null,
        sauces: prodForm.sauces || [],
        maxSauces: prodForm.maxSauces && parseInt(prodForm.maxSauces, 10) > 0 ? parseInt(prodForm.maxSauces, 10) : null,
        availableDays: prodForm.availableDays || [],
        isOutOfStock: computedIsOutOfStock,
        stock: parsedStock,
      };

      if (editingProduct) {
        await updateDoc(doc(db, "products", editingProduct.id), productData);
      } else {
        await addDoc(collection(db, "products"), {
          ...productData,
          createdAt: Date.now()
        });
      }
      setIsAddingProduct(false);
      setEditingProduct(null);
      setProdForm({ name: '', description: '', price: '', category: '', imageUrl: '', flavors: [], maxFlavors: '', addons: [], maxAddons: '', complements: [], maxComplements: '', sauces: [], maxSauces: '', availableDays: [], isOutOfStock: false, stock: '' });
    } catch (e) {
      alert("Erro ao salvar produto.");
    }
  };

  const handleStartEditProduct = (product: any) => {
    setEditingProduct(product);
    setProdForm({
      name: product.name || '',
      description: product.description || '',
      price: product.price?.toString() || '',
      category: product.category || '',
      imageUrl: product.imageUrl || '',
      flavors: product.flavors || [],
      maxFlavors: (product.maxFlavors !== undefined && product.maxFlavors !== null) ? product.maxFlavors.toString() : '',
      addons: product.addons || [],
      maxAddons: (product.maxAddons !== undefined && product.maxAddons !== null) ? product.maxAddons.toString() : '',
      complements: product.complements || [],
      maxComplements: (product.maxComplements !== undefined && product.maxComplements !== null) ? product.maxComplements.toString() : '',
      sauces: product.sauces || [],
      maxSauces: (product.maxSauces !== undefined && product.maxSauces !== null) ? product.maxSauces.toString() : '',
      availableDays: product.availableDays || [],
      isOutOfStock: !!product.isOutOfStock,
      stock: (product.stock !== undefined && product.stock !== null) ? product.stock.toString() : ''
    });
    setIsAddingProduct(true);
  };

  const handleCancelProduct = () => {
    setIsAddingProduct(false);
    setEditingProduct(null);
    setProdForm({ name: '', description: '', price: '', category: '', imageUrl: '', flavors: [], maxFlavors: '', addons: [], maxAddons: '', complements: [], maxComplements: '', sauces: [], maxSauces: '', availableDays: [], isOutOfStock: false, stock: '' });
  };

  const handleSaveRestock = async (prod: any, customVal?: number) => {
    const val = customVal !== undefined ? customVal : parseInt(restockValue, 10);
    if (!isNaN(val) && val > 0) {
      const currentStock = prod.stock || 0;
      const newStock = currentStock + val;
      try {
        await updateDoc(doc(db, "products", prod.id), {
          stock: newStock,
          isOutOfStock: false
        });
        setSelectedRestockProdId(null);
        setRestockValue("");
      } catch (err) {
        console.error("Erro ao reabastecer estoque:", err);
      }
    } else {
      alert("Por favor, digite um valor válido maior que 0.");
    }
  };

  const handleDeleteProduct = async (id: string) => {
    setDeleteConfirm({
      isOpen: true,
      title: "Excluir Produto",
      message: "Tem certeza que deseja excluir este produto? Esta ação é irreversível.",
      onConfirm: async () => {
        try {
          await deleteDoc(doc(db, "products", id));
        } catch (e) {
          console.error(e);
          alert("Erro ao excluir produto.");
        } finally {
          setDeleteConfirm(null);
        }
      }
    });
  };

  const handleMoveProductOrder = async (productId: string, direction: 'up' | 'down') => {
    const currentIndex = filteredProducts.findIndex(p => p.id === productId);
    if (currentIndex < 0) return;

    let neighborIndex = -1;
    if (direction === 'up' && currentIndex > 0) neighborIndex = currentIndex - 1;
    if (direction === 'down' && currentIndex < filteredProducts.length - 1) neighborIndex = currentIndex + 1;

    if (neighborIndex === -1) return;

    const currentProd = filteredProducts[currentIndex];
    const neighborProd = filteredProducts[neighborIndex];

    const globalOrderMap = new Map();
    sortedGlobalProducts.forEach((p, idx) => {
      globalOrderMap.set(p.id, p.order === undefined ? idx * 10 : p.order);
    });

    const origCurrentOrder = globalOrderMap.get(currentProd.id);
    const origNeighborOrder = globalOrderMap.get(neighborProd.id);
    
    // Fallback normalization logic when values are exactly equal (can happen if imported/legacy)
    if (origCurrentOrder === origNeighborOrder) {
      sortedGlobalProducts.forEach((p, idx) => {
        globalOrderMap.set(p.id, idx * 10);
      });
      globalOrderMap.set(currentProd.id, globalOrderMap.get(neighborProd.id));
      globalOrderMap.set(neighborProd.id, globalOrderMap.get(currentProd.id));
    } else {
      globalOrderMap.set(currentProd.id, origNeighborOrder);
      globalOrderMap.set(neighborProd.id, origCurrentOrder);
    }

    try {
      await Promise.all(
        sortedGlobalProducts.map((p) => {
          const newOrder = globalOrderMap.get(p.id);
          if (p.order !== newOrder) {
            return updateDoc(doc(db, "products", p.id), { order: newOrder });
          }
        })
      );
    } catch (e) {
      console.error(e);
      alert("Erro ao reordenar produtos.");
    }
  };

  const handleUpdateOrderStatus = async (orderId: string, newStatus: string) => {
    try {
      await updateDoc(doc(db, "orders", orderId), { status: newStatus });
    } catch (e) {
      console.error("Erro ao atualizar status:", e);
      alert("Erro ao atualizar status do pedido.");
    }
  };

  const handleUpdateOrderPayment = async (orderId: string, isPaid: boolean) => {
    try {
      await updateDoc(doc(db, "orders", orderId), { isPaid });
    } catch (e) {
      console.error("Erro ao atualizar pagamento:", e);
      alert("Erro ao atualizar status de pagamento.");
    }
  };

  const handleDeleteOrder = async (orderId: string) => {
    setDeleteConfirm({
      isOpen: true,
      title: "Excluir Pedido Permanentemente",
      message: "Tem certeza que deseja excluir este pedido permanentemente? Esta ação é irreversível.",
      onConfirm: async () => {
        try {
          await deleteDoc(doc(db, "orders", orderId));
        } catch (e) {
          console.error("Erro ao deletar pedido:", e);
          alert("Erro ao excluir pedido.");
        } finally {
          setDeleteConfirm(null);
        }
      }
    });
  };

  const handleSaveAppearance = async () => {
    try {
      const finalSlug = appearanceForm.slug
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/(^-|-$)+/g, "");

      if (!finalSlug) {
        alert("O link do cardápio não pode ficar vazio.");
        return;
      }

      if (!appearanceForm.name.trim()) {
        alert("O nome do restaurante não pode ficar vazio.");
        return;
      }

      const updatedForm = {
        ...appearanceForm,
        slug: finalSlug
      };

      if (finalSlug !== restaurant.slug) {
        const qStore = query(collection(db, "restaurants"), where("slug", "==", finalSlug));
        const storeSnap = await getDocs(qStore);
        if (!storeSnap.empty) {
          alert("Este link de cardápio já está em uso por outro restaurante. Por favor, escolha outro.");
          return;
        }
      }

      await updateDoc(doc(db, "restaurants", user.uid), updatedForm);
      setRestaurant((prev: any) => prev ? { ...prev, ...updatedForm } : null);
      alert("Configurações salvas com sucesso!");
    } catch (e) {
      alert("Erro ao salvar configurações.");
    }
  };

  const handleGenerateQRPDF = async () => {
    if (!restaurant?.slug) return;
    try {
      const restName = restaurant?.name || "Cardápio";
      const qrUrl = "https://api.qrserver.com/v1/create-qr-code/?size=500x500&data=" + encodeURIComponent(window.location.origin + '/' + restaurant.slug);
      
      const img = new Image();
      img.crossOrigin = "Anonymous";
      img.src = qrUrl;
      await new Promise((resolve, reject) => {
        img.onload = resolve;
        img.onerror = reject;
      });

      const canvas = document.createElement("canvas");
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext("2d");
      if (ctx) ctx.drawImage(img, 0, 0);
      const dataUrl = canvas.toDataURL("image/png");

      let logoDataUrl = null;
      if (restaurant?.logoUrl) {
         try {
           const lImg = new Image();
           lImg.crossOrigin = "Anonymous";
           lImg.src = restaurant.logoUrl;
           await new Promise((resolve, reject) => {
             lImg.onload = resolve;
             lImg.onerror = reject;
             setTimeout(reject, 3000); // 3 seconds timeout
           });
           
           const lCanvas = document.createElement("canvas");
           lCanvas.width = lImg.width;
           lCanvas.height = lImg.height;
           const lCtx = lCanvas.getContext("2d");
           if (lCtx) {
             lCtx.beginPath();
             lCtx.arc(lImg.width/2, lImg.height/2, Math.min(lImg.width, lImg.height)/2, 0, Math.PI * 2, true);
             lCtx.closePath();
             lCtx.clip();
             lCtx.drawImage(lImg, 0, 0);
           }
           logoDataUrl = lCanvas.toDataURL("image/png");
         } catch (e) {
            console.warn("Could not load logo image for PDF", e);
         }
      }

      let bannerDataUrl = null;
      if (restaurant?.bannerUrl) {
         try {
           const bImg = new Image();
           bImg.crossOrigin = "Anonymous";
           bImg.src = restaurant.bannerUrl;
           await new Promise((resolve, reject) => {
             bImg.onload = resolve;
             bImg.onerror = reject;
             setTimeout(reject, 3000); // 3 seconds timeout
           });
           
           const bCanvas = document.createElement("canvas");
           bCanvas.width = bImg.width;
           bCanvas.height = bImg.height;
           const bCtx = bCanvas.getContext("2d");
           if (bCtx) bCtx.drawImage(bImg, 0, 0);
           bannerDataUrl = bCanvas.toDataURL("image/jpeg", 0.8);
         } catch (e) {
            console.warn("Could not load banner image for PDF", e);
         }
      }

      const doc = new jsPDF({
        orientation: "portrait",
        unit: "mm",
        format: "a4",
      });

      if (bannerDataUrl) {
         doc.addImage(bannerDataUrl, "JPEG", 0, 0, 210, 75);
         doc.setFillColor(0, 0, 0);
         const anyDoc = doc as any;
         if (typeof anyDoc.setGState === "function" && typeof anyDoc.GState !== "undefined") {
           anyDoc.setGState(new anyDoc.GState({ opacity: 0.5 }));
           doc.rect(0, 0, 210, 75, "F");
           anyDoc.setGState(new anyDoc.GState({ opacity: 1.0 }));
         }
      } else {
         doc.setFillColor(234, 88, 12);
         doc.rect(0, 0, 210, 75, "F");
      }

      if (logoDataUrl) {
         doc.setFillColor(255, 255, 255);
         doc.circle(105, 75, 19, "F");
         doc.addImage(logoDataUrl, "PNG", 105 - 18, 75 - 18, 36, 36);
      }

      doc.setFont("helvetica", "bold");
      doc.setFontSize(36);
      doc.setTextColor(15, 23, 42);
      doc.text("Faça seu pedido", 105, 115, { align: "center" });

      doc.setFont("helvetica", "normal");
      doc.setFontSize(18);
      doc.setTextColor(100, 116, 139);
      doc.text("Aponte a câmera do seu celular para", 105, 130, { align: "center" });
      doc.text("acessar nosso cardápio digital", 105, 140, { align: "center" });

      // QR Code 
      // 100mm width -> x = 105 - 50 = 55
      doc.addImage(dataUrl, "PNG", 55, 160, 100, 100);

      doc.save(`Display_QRCode_${restName.replace(/\s+/g, '_')}.pdf`);
    } catch (error) {
      console.error("Erro ao gerar PDF do QR Code:", error);
      alert("Houve um erro ao gerar o PDF. Tente novamente.");
    }
  };

  const [selectedTableForQr, setSelectedTableForQr] = useState<any | null>(null);

  const handleGenerateSingleTableQRPDF = async (table: any) => {
    if (!table || !table.name) return;
    try {
      const restName = restaurant?.name || "Nosso Estabelecimento";
      const cleanName = (table.name || "").toString().trim();
      const tableNameStr = cleanName.toLowerCase().startsWith("mesa")
        ? cleanName.charAt(0).toUpperCase() + cleanName.slice(1)
        : `Mesa ${cleanName}`;

      const tableUrl = `${window.location.origin}/${restaurant?.slug || user?.uid}?mesa=${encodeURIComponent(table.name)}`;
      const qrApiUrl = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(tableUrl)}`;

      const resp = await fetch(qrApiUrl);
      const blob = await resp.blob();
      const reader = new FileReader();
      const qrDataUrl = await new Promise<string>((resolve) => {
        reader.onloadend = () => resolve(reader.result as string);
        reader.readAsDataURL(blob);
      });

      const doc = new jsPDF({
        orientation: "portrait",
        unit: "mm",
        format: "a4",
      });

      // Header Banner Background
      doc.setFillColor(234, 88, 12);
      doc.rect(0, 0, 210, 60, "F");

      // Header Title
      doc.setFont("helvetica", "bold");
      doc.setFontSize(24);
      doc.setTextColor(255, 255, 255);
      doc.text(restName, 105, 28, { align: "center" });

      doc.setFontSize(13);
      doc.setFont("helvetica", "normal");
      doc.text("CARDÁPIO DIGITAL & PEDIDOS NA MESA", 105, 42, { align: "center" });

      // Table Display Card Container
      doc.setFillColor(248, 250, 252);
      doc.roundedRect(30, 75, 150, 190, 8, 8, "F");
      doc.setDrawColor(226, 232, 240);
      doc.roundedRect(30, 75, 150, 190, 8, 8, "S");

      // Table Badge Banner
      doc.setFillColor(234, 88, 12);
      doc.roundedRect(55, 88, 100, 22, 6, 6, "F");

      doc.setFont("helvetica", "bold");
      doc.setFontSize(20);
      doc.setTextColor(255, 255, 255);
      doc.text(tableNameStr, 105, 103, { align: "center" });

      // QR Code
      doc.addImage(qrDataUrl, "PNG", 60, 118, 90, 90);

      // Instructions text
      doc.setFont("helvetica", "bold");
      doc.setFontSize(15);
      doc.setTextColor(15, 23, 42);
      doc.text("Faça seu pedido diretamente pelo celular!", 105, 222, { align: "center" });

      doc.setFont("helvetica", "normal");
      doc.setFontSize(11);
      doc.setTextColor(100, 116, 139);
      doc.text("1. Aponte a câmera do seu celular para o QR Code", 105, 233, { align: "center" });
      doc.text("2. Escolha seus produtos e confirme o pedido", 105, 241, { align: "center" });
      doc.text("3. Os itens serão lançados na conta desta mesa!", 105, 249, { align: "center" });

      doc.save(`QRCode_${tableNameStr.replace(/\s+/g, '_')}.pdf`);
    } catch (err) {
      console.error("Erro ao gerar PDF da mesa:", err);
      alert("Houve um erro ao gerar o PDF da mesa.");
    }
  };

  const handleGenerateAllTablesQRPDF = async () => {
    if (!tables || tables.length === 0) {
      alert("Nenhuma mesa cadastrada para gerar PDF.");
      return;
    }
    try {
      const restName = restaurant?.name || "Nosso Estabelecimento";
      const doc = new jsPDF({
        orientation: "portrait",
        unit: "mm",
        format: "a4",
      });

      // 4 cards per page (2x2 grid)
      // Card dimensions: width = 85mm, height = 130mm
      // Grid coordinates:
      // Col 0: x = 15, Col 1: x = 110 (15 + 85 + 10 gap)
      // Row 0: y = 15, Row 1: y = 153 (15 + 130 + 8 gap)
      const cardWidth = 85;
      const cardHeight = 130;
      const colX = [15, 110];
      const rowY = [15, 153];

      for (let i = 0; i < tables.length; i++) {
        const table = tables[i];
        const pageIndex = Math.floor(i / 4);
        const posIndex = i % 4;

        if (i > 0 && posIndex === 0) {
          doc.addPage();
        }

        const x = colX[posIndex % 2];
        const y = rowY[Math.floor(posIndex / 2)];

        const cleanName = (table.name || "").toString().trim();
        const tableNameStr = cleanName.toLowerCase().startsWith("mesa")
          ? cleanName.charAt(0).toUpperCase() + cleanName.slice(1)
          : `Mesa ${cleanName}`;

        const tableUrl = `${window.location.origin}/${restaurant?.slug || user?.uid}?mesa=${encodeURIComponent(table.name)}`;
        const qrApiUrl = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(tableUrl)}`;

        const resp = await fetch(qrApiUrl);
        const blob = await resp.blob();
        const reader = new FileReader();
        const qrDataUrl = await new Promise<string>((resolve) => {
          reader.onloadend = () => resolve(reader.result as string);
          reader.readAsDataURL(blob);
        });

        // Card Container Box
        doc.setFillColor(248, 250, 252);
        doc.roundedRect(x, y, cardWidth, cardHeight, 4, 4, "F");
        doc.setDrawColor(226, 232, 240);
        doc.roundedRect(x, y, cardWidth, cardHeight, 4, 4, "S");

        // Top Banner inside card
        doc.setFillColor(234, 88, 12);
        doc.roundedRect(x, y, cardWidth, 18, 4, 4, "F");
        doc.rect(x, y + 9, cardWidth, 9, "F"); // flatten bottom corners of banner

        doc.setFont("helvetica", "bold");
        doc.setFontSize(10);
        doc.setTextColor(255, 255, 255);
        doc.text(restName, x + cardWidth / 2, y + 11.5, { align: "center", maxWidth: cardWidth - 10 });

        // Table Name Badge
        doc.setFillColor(255, 255, 255);
        doc.setDrawColor(234, 88, 12);
        doc.roundedRect(x + 12, y + 23, cardWidth - 24, 12, 3, 3, "FD");

        doc.setFont("helvetica", "bold");
        doc.setFontSize(11);
        doc.setTextColor(234, 88, 12);
        doc.text(tableNameStr, x + cardWidth / 2, y + 31, { align: "center" });

        // QR Code Image (50x50 mm)
        const qrSize = 50;
        doc.addImage(qrDataUrl, "PNG", x + (cardWidth - qrSize) / 2, y + 38, qrSize, qrSize);

        // Instructions text
        doc.setFont("helvetica", "bold");
        doc.setFontSize(9);
        doc.setTextColor(15, 23, 42);
        doc.text("Faça seu pedido pelo celular!", x + cardWidth / 2, y + 95, { align: "center" });

        doc.setFont("helvetica", "normal");
        doc.setFontSize(7.5);
        doc.setTextColor(100, 116, 139);
        doc.text("1. Aponte a câmera para o QR Code", x + cardWidth / 2, y + 103, { align: "center" });
        doc.text("2. Escolha os itens e envie o pedido", x + cardWidth / 2, y + 110, { align: "center" });
        doc.text("3. O pedido vai direto para a mesa!", x + cardWidth / 2, y + 117, { align: "center" });
      }

      doc.save(`QRCodes_Todas_As_Mesas_${restName.replace(/\s+/g, '_')}.pdf`);
    } catch (err) {
      console.error("Erro ao gerar PDF de todas as mesas:", err);
      alert("Houve um erro ao gerar o PDF das mesas.");
    }
  };

  const storeSlug = restaurant?.slug || user?.uid || restaurant?.id || "";
  const storeUrl = storeSlug ? `${window.location.origin}/${storeSlug}` : "#";

  if (loading) return <div className="min-h-screen flex items-center justify-center bg-neutral-50 text-neutral-500">Carregando painel...</div>;

  return (
    <div className="flex min-h-screen bg-neutral-50 font-sans text-neutral-900">
      {/* Sidebar Mobile Overlay */}
      {isMobileMenuOpen && (
        <div 
          className="fixed inset-0 z-40 bg-black/50 lg:hidden"
          onClick={() => setIsMobileMenuOpen(false)}
        />
      )}

      {/* Sidebar */}
      {!user?.isWaiter && (
        <aside className={`fixed inset-y-0 left-0 z-50 w-64 transform border-r border-neutral-200 bg-white transition-transform lg:sticky lg:top-0 lg:h-screen lg:translate-x-0 flex flex-col overflow-hidden ${isMobileMenuOpen ? "translate-x-0" : "-translate-x-full"}`}>
          <div className="flex h-16 items-center px-6 border-b border-neutral-200 shrink-0">
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-orange-600 text-white font-bold">
                M
              </div>
              <span className="text-xl font-bold tracking-tight">MenuFlow</span>
            </div>
          </div>

          <div className="p-4 space-y-4 flex-1 overflow-y-auto">
            {menuGroups.map(group => {
              const filteredItems = group.items.filter(item => !disabledFeatures.includes(item.id));
              if (filteredItems.length === 0) return null;

              const isExpanded = expandedGroups[group.id];
              const GroupIcon = group.icon;

              return (
                <div key={group.id} className="space-y-1">
                  {/* Group Header */}
                  <button
                    onClick={() => toggleGroup(group.id)}
                    className="flex w-full items-center justify-between px-2 py-1.5 text-xs font-bold uppercase tracking-wider text-neutral-500 hover:text-neutral-700 hover:bg-neutral-50 rounded-lg transition"
                  >
                    <div className="flex items-center gap-1.5">
                      <GroupIcon size={14} className="text-neutral-400" />
                      <span>{group.label}</span>
                    </div>
                    <ChevronDown 
                      size={14} 
                      className={`transform transition-transform duration-200 ${isExpanded ? "rotate-0" : "-rotate-90 text-neutral-400"}`} 
                    />
                  </button>

                  {/* Group Items */}
                  <div 
                    className={`overflow-hidden transition-all duration-300 ${
                      isExpanded 
                        ? "max-h-[500px] opacity-100 mt-1 pl-1 space-y-0.5" 
                        : "max-h-0 opacity-0 pointer-events-none"
                    }`}
                  >
                    {filteredItems.map(item => {
                      const Icon = item.icon;
                      const isActive = activeTab === item.id;
                      return (
                        <button
                          key={item.id}
                          onClick={() => { setActiveTab(item.id); setIsMobileMenuOpen(false); }}
                          className={`flex w-full items-center gap-3 rounded-lg px-3 py-1.5 text-sm font-medium transition ${
                            isActive ? "bg-orange-50 text-orange-600 font-semibold" : "text-neutral-600 hover:bg-neutral-50 hover:text-neutral-900"
                          }`}
                        >
                          <Icon size={16} className={`${isActive ? "text-orange-600" : "text-neutral-400"}`} />
                          <span>{item.label}</span>
                        </button>
                      )
                    })}
                  </div>
                </div>
              );
            })}
          </div>

          <div className="p-4 border-t border-neutral-200 flex flex-col gap-2 shrink-0 bg-white">
            {/* Botão Abrir Cardápio na Sidebar */}
            <a 
              href={storeUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex w-full items-center justify-between gap-2 rounded-xl bg-orange-600 hover:bg-orange-700 text-white font-extrabold px-3.5 py-2.5 text-xs shadow-sm active:scale-[0.98] transition cursor-pointer group"
            >
              <div className="flex items-center gap-2">
                <Store size={16} />
                <span>Abrir Cardápio</span>
              </div>
              <ExternalLink size={14} className="opacity-80 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
            </a>

            {isSuperAdmin && (
              <Link 
                to="/superadmin"
                className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-orange-600 bg-orange-50 hover:bg-orange-100 transition"
              >
                <ExternalLink size={18} />
                SuperAdmin
              </Link>
            )}
            <button onClick={handleSignOut} className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-neutral-600 hover:bg-neutral-100 hover:text-neutral-900 transition">
              <LogOut size={18} />
              Sair
            </button>
          </div>
        </aside>
      )}

      {/* Main Content */}
      <main className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {(() => {
          const planStr = restaurant?.plan?.toLowerCase() || 'premium';
          const isFreePreview = planStr.includes('gratuito');
          const audience = adminAnnouncement?.targetAudience || 'all';

          const matchesAudience = 
            audience === 'all' || 
            (audience === 'free' && isFreePreview) || 
            (audience === 'premium' && !isFreePreview);

          if (!user?.isWaiter && adminAnnouncement?.isActive && matchesAudience) {
            const IconComp = 
              adminAnnouncement.icon === 'alert' ? AlertCircle : 
              adminAnnouncement.icon === 'check' ? CheckCircle2 : 
              adminAnnouncement.icon === 'star' ? Sparkles : 
              Megaphone;

            return (
              <div className={`p-4 sm:px-8 text-white flex flex-col md:flex-row md:items-start justify-between gap-4 shrink-0 shadow-sm z-10 
                ${adminAnnouncement.theme === 'blue' ? 'bg-blue-600' : 
                  adminAnnouncement.theme === 'green' ? 'bg-emerald-600' : 
                  adminAnnouncement.theme === 'orange' ? 'bg-orange-600' : 'bg-red-600'}`}
              >
                <div className="flex-1">
                  <h3 className="font-bold text-sm mb-1 flex items-center gap-2">
                    <IconComp size={16} />
                    {adminAnnouncement.title}
                  </h3>
                  <p className="text-xs pt-1 opacity-90 whitespace-pre-wrap leading-relaxed" dangerouslySetInnerHTML={{ __html: adminAnnouncement.message.replace(/\n/g, '<br/>') }}></p>
                  
                  {adminAnnouncement.showCta && adminAnnouncement.ctaLink && (
                    <div className="mt-3">
                      <a 
                        href={adminAnnouncement.ctaLink} 
                        target="_blank" 
                        rel="noopener noreferrer" 
                        className="inline-block bg-white text-neutral-900 px-4 py-2 rounded-lg text-xs font-bold hover:bg-neutral-100 transition shadow-sm"
                      >
                        {adminAnnouncement.ctaText || "Saiba mais"}
                      </a>
                    </div>
                  )}
                </div>
                {adminAnnouncement.allowDismiss !== false && (
                  <button 
                    onClick={() => setAdminAnnouncement(prev => ({...prev, isActive: false}))}
                    className="text-white/80 hover:text-white px-3 py-1.5 text-xs font-bold rounded-lg border border-white/20 hover:bg-white/10 transition shrink-0 uppercase tracking-wider self-start"
                  >
                    Ocultar Aviso
                  </button>
                )}
              </div>
            );
          }
          return null;
        })()}

        {user?.isWaiter ? (
          <header className="flex h-16 items-center justify-between border-b border-neutral-200 bg-white px-4 sm:px-8 shrink-0">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-orange-600 text-white font-extrabold shadow-sm">
                MF
              </div>
              <div>
                <span className="text-sm sm:text-base font-black tracking-tight text-neutral-900 block leading-tight">
                  {restaurant?.name || "MenuFlow"} <span className="text-orange-600">Atendimento</span>
                </span>
                <span className="text-[10px] font-bold text-neutral-500 uppercase tracking-wider block mt-0.5">
                  Atendente: {user.waiterName}
                </span>
              </div>
            </div>
            

            <div className="flex items-center gap-2">
              <a 
                href={storeUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-orange-50 text-orange-600 border border-orange-200 font-extrabold text-xs shadow-2xs hover:bg-orange-100 transition active:scale-95 cursor-pointer"
              >
                <Store size={14} />
                <span>Ver Cardápio</span>
                <ExternalLink size={12} />
              </a>

              <button 
                onClick={handleSignOut} 
                className="flex items-center gap-2 rounded-xl bg-neutral-150 hover:bg-red-50 hover:text-red-700 text-neutral-700 px-3 sm:px-4 py-2 text-xs font-bold transition border border-neutral-200/50 cursor-pointer"
              >
                <LogOut size={14} />
                <span className="hidden sm:inline">Sair</span>
              </button>
            </div>
          </header>
        ) : (
          <>
            {/* Mobile Header */}
            <header className="flex h-16 items-center justify-between border-b border-neutral-200 bg-white px-4 lg:hidden">
              <button onClick={() => setIsMobileMenuOpen(true)} className="p-2 -ml-2 text-neutral-600 hover:text-neutral-900">
                <Menu size={24} />
              </button>
              <span className="font-bold text-neutral-900 truncate max-w-[130px]">
                {tabs.find(t => t.id === activeTab)?.label}
              </span>
              <a 
                href={storeUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-orange-600 text-white font-extrabold text-xs shadow-sm hover:bg-orange-700 transition active:scale-95 cursor-pointer"
              >
                <Store size={14} />
                <span>Cardápio</span>
                <ExternalLink size={12} />
              </a>
            </header>

            {/* Top Header Desktop */}
            <header className="hidden h-16 items-center justify-between border-b border-neutral-200 bg-white px-8 lg:flex">
              <h1 className="text-xl font-bold text-neutral-900 tracking-tight">
                 {tabs.find(t => t.id === activeTab)?.label}
              </h1>
              <a 
                href={storeUrl} 
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 px-4 py-2 rounded-xl bg-orange-600 hover:bg-orange-700 text-white text-xs font-extrabold shadow-sm active:scale-95 transition cursor-pointer"
              >
                <Store size={16} />
                <span>Abrir Cardápio</span>
                <ExternalLink size={14} />
              </a>
            </header>
          </>
        )}

        <div className={`flex-1 overflow-auto ${activeTab === "pdv" ? "p-2 sm:p-6" : "p-4 sm:p-8"}`}>
          <div className={`mx-auto ${activeTab === "pdv" ? "max-w-7xl h-full" : "max-w-5xl"}`}>
            {debugSyncError && (
              <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-6 text-sm font-medium">
                Erro de Inicialização do Firebase: {debugSyncError}
              </div>
            )}

            {/* --- Resumo TAB --- */}
            {activeTab === "overview" && (() => {
              const threshold = getFilteredDataThreshold();
              const filteredOrders = orders.filter(o => (o.timestamp || 0) >= threshold);
              const filteredViews = menuViews.filter(v => (v.timestamp || 0) >= threshold);

              const totalRevenue = filteredOrders.reduce((sum, o) => sum + (o.total || 0), 0);
              const totalOrdersCount = filteredOrders.length;
              const averageTicket = totalOrdersCount > 0 ? totalRevenue / totalOrdersCount : 0;
              const totalViewsCount = filteredViews.length;
              const conversionRate = totalViewsCount > 0 ? (totalOrdersCount / totalViewsCount) * 100 : 0;

              const chartData = getChartData();
              const maxChartValue = Math.max(...chartData.map(d => d.val), 10);

              return (
                <div className="space-y-6">
                  {/* Filtros de Período */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div className="flex items-start justify-between sm:justify-start sm:items-center gap-3 w-full sm:w-auto">
                      <div>
                        <div className="flex items-center gap-2">
                          <h2 className="text-xl font-bold tracking-tight text-neutral-900">Resumo de Desempenho</h2>
                          <button
                            onClick={() => {
                              const newVal = !hideMetrics;
                              setHideMetrics(newVal);
                              localStorage.setItem("hide_metrics", String(newVal));
                            }}
                            className="p-1.5 text-neutral-400 hover:text-orange-600 hover:bg-orange-50 rounded-lg transition"
                            title={hideMetrics ? "Mostrar valores" : "Ocultar valores"}
                          >
                            {hideMetrics ? <Eye size={18} /> : <EyeOff size={18} />}
                          </button>
                        </div>
                        <p className="text-sm text-neutral-500">Acompanhe estatísticas reais de visualizações e transações.</p>
                      </div>
                    </div>
                    <div className="flex self-start sm:self-center bg-neutral-100 p-1 rounded-xl">
                      {(["day", "week", "month", "year"] as const).map((filter) => {
                        const labels = { day: "Dia", week: "Semana", month: "Mês", year: "Ano" };
                        return (
                          <button
                            key={filter}
                            onClick={() => setTimeFilter(filter)}
                            className={`px-3.5 py-1.5 text-xs font-semibold rounded-lg transition ${
                              timeFilter === filter
                                ? "bg-white text-orange-600 shadow-sm"
                                : "text-neutral-600 hover:text-neutral-900"
                            }`}
                          >
                            {labels[filter]}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Resumos Estatísticos (Faturamento, Ticket Médio, Views, Pedidos) */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
                    <div className="rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm hover:shadow-md transition">
                      <p className="text-xs font-medium uppercase tracking-wider text-neutral-500">Faturamento ({timeFilter === "day" ? "Hoje" : timeFilter === "week" ? "Semana" : timeFilter === "month" ? "Mês" : "Ano"})</p>
                      <p className="mt-2 text-2xl sm:text-3xl font-bold text-neutral-900">
                        {hideMetrics ? "R$ ••••" : `R$ ${totalRevenue.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
                      </p>
                      <p className="mt-1 text-xs text-green-600 font-medium">Faturamento real integrado</p>
                    </div>

                    <div className="rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm hover:shadow-md transition">
                      <p className="text-xs font-medium uppercase tracking-wider text-neutral-500">Ticket Médio</p>
                      <p className="mt-2 text-2xl sm:text-3xl font-bold text-neutral-900">
                        {hideMetrics ? "R$ ••••" : `R$ ${averageTicket.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
                      </p>
                      <p className="mt-1 text-xs text-neutral-500 font-medium">{hideMetrics ? "••" : totalOrdersCount} pedido(s) totais</p>
                    </div>

                    <div className="rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm hover:shadow-md transition">
                      <p className="text-xs font-medium uppercase tracking-wider text-neutral-500">Visualizações</p>
                      <p className="mt-2 text-2xl sm:text-3xl font-bold text-neutral-900">
                        {hideMetrics ? "••••" : totalViewsCount}
                      </p>
                      <p className="mt-1 text-xs text-neutral-500 font-medium">Acessos reais ao cardápio</p>
                    </div>

                    <div className="rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm hover:shadow-md transition">
                      <p className="text-xs font-medium uppercase tracking-wider text-neutral-500">Conversão</p>
                      <p className="mt-2 text-2xl sm:text-3xl font-bold text-neutral-900">
                        {hideMetrics ? "•••" : `${conversionRate.toFixed(1)}%`}
                      </p>
                      <p className="mt-1 text-xs text-neutral-500 font-medium">Taxa de visualização / pedidos</p>
                    </div>
                  </div>

                  {/* Gráfico de Evolução */}
                  <div className="rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm">
                    <div className="flex items-center justify-between mb-6">
                      <div>
                        <h3 className="font-bold text-neutral-900">Evolução do Faturamento</h3>
                        <p className="text-xs text-neutral-500">Visualização agregada das conversões baseada no filtro selecionado.</p>
                      </div>
                      <span className="text-xs font-semibold text-orange-600 bg-orange-50 px-2.5 py-1 rounded-full">
                        Em Reais (R$)
                      </span>
                    </div>

                    <div className="h-64 flex items-end gap-3 pt-6 border-b border-neutral-100 pb-2">
                      {chartData.map((data, idx) => {
                        const heightPercent = (data.val / maxChartValue) * 100;
                        return (
                          <div key={idx} className="flex-1 flex flex-col items-center h-full group relative justify-end">
                            {/* Tooltip */}
                            <div className="absolute bottom-[calc(100%+8px)] bg-neutral-900 text-white text-[10px] sm:text-xs font-semibold px-2.5 py-1.5 rounded-lg opacity-0 group-hover:opacity-100 transition duration-200 shadow-lg pointer-events-none whitespace-nowrap z-10 flex flex-col items-center">
                              <span className="text-neutral-400 font-normal">{data.label}</span>
                              <span className="font-mono text-white">{hideMetrics ? "R$ ••••" : `R$ ${data.val.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}</span>
                              <div className="w-1.5 h-1.5 bg-neutral-900 rotate-45 mt-0.5" />
                            </div>

                            {/* The Column bar */}
                            <div 
                              style={{ height: `${Math.max(heightPercent, 2)}%` }}
                              className={`w-full max-w-[44px] rounded-t-lg transition-all duration-500 ${
                                hideMetrics ? "blur-[3px]" : ""
                              } ${
                                data.val > 0 
                                  ? "bg-gradient-to-t from-orange-500 to-orange-600 group-hover:from-orange-600 group-hover:to-orange-700 shadow-sm" 
                                  : "bg-neutral-100 group-hover:bg-neutral-200"
                              }`}
                            />

                            {/* Label */}
                            <span className="text-[10px] sm:text-xs font-medium text-neutral-500 mt-2 text-center truncate w-full">
                              {data.label}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Detalhes de Pedidos Recentes e Funil de Conversões */}
                  <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    <div className="lg:col-span-2 rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm">
                      <div className="flex items-center justify-between mb-4">
                        <h3 className="font-bold text-neutral-900">Pedidos Recentes</h3>
                        <span className="text-xs font-medium text-orange-600 bg-orange-50 px-2.5 py-1 rounded-full">
                          Últimos 5 pedidos
                        </span>
                      </div>

                      {filteredOrders.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-12 text-center text-neutral-400">
                          <p className="text-sm font-semibold">Nenhum pedido recebido ainda neste período.</p>
                          <p className="text-xs max-w-sm mt-1">Divulgue o QR code e link do cardápio para os seus clientes para receber os primeiros!</p>
                        </div>
                      ) : (
                        <div className="divide-y divide-neutral-100 overflow-x-auto">
                          {filteredOrders
                            .sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0))
                            .slice(0, 5)
                            .map((order) => {
                              const date = new Date(order.timestamp);
                              const timeStr = date.toLocaleDateString("pt-BR") + " " + date.toLocaleTimeString("pt-BR", { hour: '2-digit', minute: '2-digit' });
                              return (
                                <div key={order.id} className="py-4 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                                  <div>
                                    <p className="text-sm font-bold text-neutral-900">
                                      {order.customerName || "Cliente sem Nome"}
                                    </p>
                                    <p className="text-xs text-neutral-500 truncate max-w-sm sm:max-w-md">
                                      {order.customerAddress || "Retirada/Balcão"}
                                    </p>
                                    <p className="text-[10px] text-neutral-400 font-mono mt-1">
                                      {timeStr} • {order.itemsCount || 1} item(ns)
                                    </p>
                                  </div>
                                  <div className="text-right flex flex-col items-end gap-2">
                                    <span className="inline-block text-xs font-bold text-green-700 bg-green-50 px-3 py-1.5 rounded-lg font-mono">
                                      {hideMetrics ? "+ R$ ••••" : `+ R$ ${(order.total || 0).toFixed(2)}`}
                                    </span>
                                    <div className="flex flex-col gap-1 w-full sm:w-auto mt-2">
                                      <button
                                        onClick={() => handlePrintOrder(order, 'balcao')}
                                        className="text-[10px] flex items-center gap-1 font-medium text-neutral-500 hover:text-neutral-800 bg-neutral-50 hover:bg-neutral-100 px-2 py-1 rounded-md border border-neutral-200 transition"
                                        title="Imprimir Balcão"
                                      >
                                        <Printer size={12} /> 1 Balcão
                                      </button>
                                      <button
                                        onClick={() => handlePrintOrder(order, 'cozinha')}
                                        className="text-[10px] flex items-center gap-1 font-medium text-neutral-500 hover:text-neutral-800 bg-neutral-50 hover:bg-neutral-100 px-2 py-1 rounded-md border border-neutral-200 transition"
                                        title="Imprimir Cozinha"
                                      >
                                        <Printer size={12} /> 2 Cozinha
                                      </button>
                                    </div>
                                  </div>
                                </div>
                              );
                            })}
                        </div>
                      )}
                    </div>

                    <div className="rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm flex flex-col justify-between">
                      <div>
                        <h3 className="font-bold text-neutral-900 mb-1">Funil de Vendas</h3>
                        <p className="text-xs text-neutral-500 mb-6">Veja qual porcentagem de visitantes do cardápio geram pedidos via WhatsApp.</p>

                        <div className="space-y-5">
                          <div>
                            <div className="flex justify-between text-xs font-semibold mb-1.5">
                              <span className="text-neutral-600 flex items-center gap-1.5">
                                <span className="w-2.5 h-2.5 rounded-full bg-neutral-900 inline-block" />
                                Visitas de Clientes
                              </span>
                              <span className="text-neutral-900 font-mono">{hideMetrics ? "••••" : totalViewsCount}</span>
                            </div>
                            <div className="w-full bg-neutral-100 h-2 rounded-full overflow-hidden">
                              <div className="bg-neutral-800 h-2 rounded-full" style={{ width: "100%" }} />
                            </div>
                          </div>

                          <div>
                            <div className="flex justify-between text-xs font-semibold mb-1.5">
                              <span className="text-neutral-600 flex items-center gap-1.5">
                                <span className="w-2.5 h-2.5 rounded-full bg-orange-600 inline-block" />
                                Cliques em Enviar Pedido
                              </span>
                              <span className="text-neutral-900 font-mono">{hideMetrics ? "••••" : totalOrdersCount}</span>
                            </div>
                            <div className="w-full bg-neutral-100 h-2 rounded-full overflow-hidden">
                              <div 
                                className={`bg-orange-600 h-2 rounded-full transition-all duration-500 animate-pulse ${hideMetrics ? "blur-[2px]" : ""}`} 
                                style={{ width: `${Math.min(conversionRate, 100)}%` }} 
                              />
                            </div>
                          </div>
                        </div>
                      </div>

                      <div className="bg-orange-50 border border-orange-100 rounded-xl p-4 mt-6">
                        <h4 className="text-xs font-bold text-orange-850">💡 Sugestão de Vendas:</h4>
                        <p className="text-[10px] text-orange-700 mt-1 leading-relaxed">
                          Sua conversão comercial atual é de <strong>{hideMetrics ? "•••" : `${conversionRate.toFixed(1)}%`}</strong>. Adicione categorias mais claras ou descrições ricas em seus produtos para motivar ainda mais finalizações!
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })()}

            {/* --- PDV TAB --- */}
            {activeTab === "pdv" && (() => {
              const daysArr = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
              const todayAbbr = daysArr[new Date().getDay()];

              const activeCategories = categories.filter(c => {
                if (c.availableDays && c.availableDays.length > 0) {
                  return c.availableDays.includes(todayAbbr);
                }
                return true;
              });

              const sortedPdvProducts = [...products].sort((a, b) => {
                // Primeira ordenação: Pela ordem da categoria da lista de categorias
                const catIndexA = categories.findIndex(c => c.name === a.category);
                const catIndexB = categories.findIndex(c => c.name === b.category);
                const orderCatA = catIndexA !== -1 ? catIndexA : 9999;
                const orderCatB = catIndexB !== -1 ? catIndexB : 9999;

                if (orderCatA !== orderCatB) {
                  return orderCatA - orderCatB;
                }

                // Segunda ordenação (dentro da mesma categoria): Esgotados abaixo dos disponíveis (ficam atrás)
                if (!!a.isOutOfStock !== !!b.isOutOfStock) {
                  return a.isOutOfStock ? 1 : -1;
                }

                // Terceira ordenação: Pela ordenação própria do produto (campo order)
                const orderProdA = a.order !== undefined ? a.order : 9999;
                const orderProdB = b.order !== undefined ? b.order : 9999;
                if (orderProdA !== orderProdB) {
                  return orderProdA - orderProdB;
                }

                // Quarta ordenação: Pela data de criação
                return (a.createdAt || 0) - (b.createdAt || 0);
              });

              const filteredProducts = sortedPdvProducts.filter(p => {
                const matchesCat = pdvCategory === "Todas" 
                  ? activeCategories.some(ac => ac.name === p.category) 
                  : p.category === pdvCategory;
                const matchesSearch = !pdvSearch || p.name.toLowerCase().includes(pdvSearch.toLowerCase());
                return matchesCat && matchesSearch;
              });

              return (
                <div className="flex flex-col gap-4 h-full">
                  {/* Mobile View Switcher (Only visible below lg) */}
                  <div className="flex lg:hidden w-full bg-neutral-100 p-1.5 rounded-2xl border border-neutral-250 select-none shadow-sm gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={() => setPdvMobileTab("products")}
                      className={`flex-1 py-3 text-center rounded-xl text-xs sm:text-sm font-bold transition-all duration-200 flex items-center justify-center gap-2 ${
                        pdvMobileTab === "products"
                          ? "bg-orange-600 text-white shadow-md scale-[1.02]"
                          : "text-neutral-600 hover:bg-neutral-200"
                      }`}
                    >
                      🍔 Produtos ({filteredProducts.length})
                    </button>
                    <button
                      type="button"
                      onClick={() => setPdvMobileTab("cart")}
                      className={`flex-1 py-3 text-center rounded-xl text-xs sm:text-sm font-bold transition-all duration-200 flex items-center justify-center gap-2 ${
                        pdvMobileTab === "cart"
                          ? "bg-orange-600 text-white shadow-md scale-[1.02]"
                          : "text-neutral-600 hover:bg-neutral-200"
                      }`}
                    >
                      🛒 Carrinho ({pdvCart.reduce((acc, curr) => acc + curr.quantity, 0)}) - R$ {calculatePdvTotal().toFixed(2)}
                    </button>
                  </div>

                  <div className="flex flex-col lg:flex-row gap-6 h-full relative">
                    {/* Left Side: Products Grid (hidden on mobile when cart tab is active) */}
                    <div className={`flex-1 flex flex-col space-y-4 ${
                      pdvMobileTab === "products" ? "flex" : "hidden lg:flex"
                    }`}>
                      {/* Filters */}
                      <div className="flex flex-col gap-4 bg-white p-4 rounded-xl shadow-sm border border-neutral-200">
                        <div className="relative w-full">
                          <Search className="absolute left-3 top-2.5 text-neutral-400" size={18} />
                          <input
                            type="text"
                            placeholder="Buscar produto..."
                            value={pdvSearch}
                            onChange={e => setPdvSearch(e.target.value)}
                            className="pl-10 pr-4 py-2 rounded-xl ring-1 ring-inset ring-neutral-300 outline-none focus:ring-2 focus:ring-orange-600 text-sm font-medium w-full"
                          />
                        </div>
                        <div className="flex overflow-x-auto md:flex-wrap gap-2 bg-neutral-150 p-1 rounded-xl max-w-full select-none touch-pan-x shrink-0 no-scrollbar md:overflow-visible *:shrink-0">
                           <button
                             type="button"
                             onClick={() => setPdvCategory("Todas")}
                             className={`px-4 py-2 rounded-lg text-sm font-semibold transition shrink-0 ${pdvCategory === "Todas" ? "bg-white text-orange-600 shadow-sm font-bold" : "text-neutral-600 hover:bg-neutral-200"}`}
                           >
                             Todas
                           </button>
                           {activeCategories.map(c => (
                             <button
                               key={c.id}
                               type="button"
                               onClick={() => setPdvCategory(c.name)}
                               className={`px-4 py-2 rounded-lg text-sm font-semibold transition shrink-0 ${pdvCategory === c.name ? "bg-white text-orange-600 shadow-sm font-bold" : "text-neutral-600 hover:bg-neutral-200"}`}
                             >
                               {c.name}
                             </button>
                           ))}
                        </div>
                      </div>

                      {/* Product Grid */}
                      <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-4 overflow-y-auto pb-8">
                        {filteredProducts.map(prod => {
                          const cartItem = pdvCart.find(item => item.id === prod.id || item.productId === prod.id);
                          const cartQty = cartItem ? cartItem.quantity : 0;
                          const isAlreadyInCart = pdvCart.some(item => item.id === prod.id || item.productId === prod.id);
                          const isOutOfStock = !!prod.isOutOfStock && !isAlreadyInCart;
                          return (
                            <div 
                              key={prod.id} 
                              className={`bg-white rounded-2xl shadow-sm border overflow-hidden flex flex-col transition-all duration-150 h-full relative select-none-all group ${
                                isOutOfStock 
                                  ? "opacity-60 grayscale-[40%] cursor-not-allowed border-neutral-200" 
                                  : "cursor-pointer border-neutral-200 hover:border-orange-500 hover:shadow-md active:scale-[0.98]"
                              }`}
                              onClick={() => !isOutOfStock && addToPdvCart(prod)}
                            >
                              <div className="h-28 sm:h-32 bg-neutral-100 relative overflow-hidden shrink-0">
                                {prod.imageUrl ? (
                                  <img src={prod.imageUrl} alt={prod.name} className={`w-full h-full object-cover transition duration-355 ${!isOutOfStock && "group-hover:scale-105"}`} />
                                ) : (
                                  <div className="w-full h-full flex items-center justify-center text-neutral-400 bg-neutral-50"><Box size={24} /></div>
                                )}
                                
                                {isOutOfStock && (
                                  <div className="absolute inset-0 bg-black/40 backdrop-blur-[1px] flex items-center justify-center">
                                    <span className="bg-red-600 text-white font-extrabold text-[10px] sm:text-xs tracking-wider px-2 py-1 rounded-md uppercase shadow-lg">
                                      Esgotado
                                    </span>
                                  </div>
                                )}

                                {/* Badge in top-right of image showing qty in cart if any */}
                                {!isOutOfStock && cartQty > 0 && (
                                  <div className="absolute top-2 right-2 bg-orange-600 text-white font-black text-xs h-6 px-2.5 rounded-full flex items-center justify-center shadow-lg border border-orange-500/50 animate-in zoom-in duration-200">
                                    {cartQty}x
                                  </div>
                                )}
                              </div>
                              <div className="p-3 flex flex-col flex-1 justify-between bg-white gap-2">
                                <div className="font-bold text-xs sm:text-sm text-neutral-800 leading-tight line-clamp-2 h-8 sm:h-10">
                                  {prod.name}
                                </div>
                                <div className="flex items-center justify-between mt-1 pt-1 border-t border-neutral-50">
                                  <span className="font-mono font-black text-orange-600 text-xs sm:text-sm">
                                    R$ {parseFloat(prod.price).toFixed(2)}
                                  </span>
                                  {!isOutOfStock ? (
                                    <button
                                      type="button"
                                      className="p-1.5 rounded-lg bg-orange-50 text-orange-600 hover:bg-orange-600 hover:text-white transition group/btn flex items-center justify-center"
                                      title="Adicionar ao carrinho"
                                      onClick={(e) => { e.stopPropagation(); addToPdvCart(prod); }}
                                    >
                                      <Plus size={14} className="stroke-[3]" />
                                    </button>
                                  ) : (
                                    <span className="text-[10px] font-bold text-red-500 uppercase tracking-wider">
                                      Indisponível
                                    </span>
                                  )}
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    {/* Right Side: Cart (hidden on mobile when products tab is active) */}
                    <div className={`w-full lg:w-[400px] bg-white rounded-2xl shadow-sm border border-neutral-200 flex flex-col flex-shrink-0 h-[min(calc(100vh-120px),850px)] ${
                      pdvMobileTab === "cart" ? "flex" : "hidden lg:flex"
                    }`}>
                       <div className="p-5 border-b border-neutral-100 flex items-center justify-between bg-neutral-50 rounded-t-2xl">
                          <div className="flex items-center gap-3">
                             <ShoppingCart className="text-orange-600 border border-orange-200 bg-orange-100 p-1.5 rounded-lg shrink-0" size={32} />
                             <div>
                               <h3 className="font-black text-lg text-neutral-900">Pedido PDV</h3>
                               <p className="text-xs font-semibold text-neutral-500">{pdvCart.length} item(s)</p>
                             </div>
                          </div>
                          {/* Back Button specifically for phone screen layout */}
                          <button
                            type="button"
                            onClick={() => setPdvMobileTab("products")}
                            className="lg:hidden flex items-center gap-1.5 px-3 py-2 text-xs font-bold bg-neutral-100 active:bg-neutral-200 rounded-xl text-neutral-700 transition"
                          >
                            ← Continuar
                          </button>
                       </div>

                       <div className="flex-1 overflow-y-auto p-4 space-y-5 bg-neutral-50 border-b border-neutral-100">
                          {/* 1. Checkout Type / Type of atendimento */}
                          <div className="bg-white p-4 rounded-xl border border-neutral-200 shadow-sm space-y-3">
                             <label className="block text-xs font-bold text-neutral-400 uppercase tracking-wider">Tipo de Atendimento</label>
                             <div className={`grid ${user?.isWaiter ? "grid-cols-1" : "grid-cols-2 sm:grid-cols-4"} gap-2 p-1 bg-neutral-100 rounded-xl`}>
                                <button
                                   type="button"
                                   onClick={() => {
                                     setPdvCheckoutType("balcao");
                                     setPdvTableNumber("");
                                   }}
                                   className={`py-2 px-1 rounded-lg text-xs font-bold text-center transition ${pdvCheckoutType === "balcao" ? "bg-white text-orange-600 shadow-sm" : "text-neutral-500 hover:text-neutral-800"}`}
                                >
                                   Mesa/Balcão
                                </button>
                                {!user?.isWaiter && (
                                  <>
                                    <button
                                       type="button"
                                       onClick={() => setPdvCheckoutType("entrega")}
                                       className={`py-2 px-1 rounded-lg text-xs font-bold text-center transition ${pdvCheckoutType === "entrega" ? "bg-white text-orange-600 shadow-sm" : "text-neutral-500 hover:text-neutral-800"}`}
                                    >
                                       🚀 Entrega
                                    </button>
                                    <button
                                       type="button"
                                       onClick={() => setPdvCheckoutType("retirada")}
                                       className={`py-2 px-1 rounded-lg text-xs font-bold text-center transition ${pdvCheckoutType === "retirada" ? "bg-white text-orange-600 shadow-sm" : "text-neutral-500 hover:text-neutral-800"}`}
                                    >
                                       🛍️ Retirada
                                    </button>
                                    <button
                                       type="button"
                                       onClick={() => setPdvCheckoutType("troca")}
                                       className={`py-2 px-1 rounded-lg text-xs font-bold text-center transition ${pdvCheckoutType === "troca" ? "bg-white text-orange-600 shadow-sm" : "text-neutral-500 hover:text-neutral-800"}`}
                                    >
                                       🔄 Troca
                                    </button>
                                  </>
                                )}
                             </div>
                          </div>

                          {/* 2. Customer Details Form */}
                          <div className="bg-white p-4 rounded-xl border border-neutral-200 shadow-sm space-y-3">
                             <label className="block text-xs font-bold text-neutral-400 uppercase tracking-wider">Informações do Cliente</label>
                             
                             {pdvCheckoutType === "balcao" && (
                                <div className="space-y-2">
                                   <label className="block text-xs font-bold text-neutral-500">Mesa (Opcional)</label>
                                   <select 
                                     value={pdvTableNumber} 
                                     onChange={(e) => {
                                       const val = e.target.value;
                                       setPdvTableNumber(val);
                                       if (val) {
                                         const foundTable = tables.find(t => t.name === val);
                                         if (foundTable) {
                                           if (foundTable.customerName && !pdvCustomerName) {
                                             setPdvCustomerName(foundTable.customerName);
                                           }
                                           if (foundTable.customerPhone && !pdvCustomerPhone) {
                                             setPdvCustomerPhone(foundTable.customerPhone);
                                           }
                                           if (foundTable.items && foundTable.items.length > 0) {
                                             const restoredCart = foundTable.items.map((i: any, index: number) => ({
                                               id: i.id || `table-item-${val}-${index}`, productId: i.productId || i.id,
                                               name: i.name,
                                               quantity: i.qty,
                                               price: i.price,
                                               selectedAddons: i.selectedAddons || [],
                                               selectedComplements: i.selectedComplements || [],
                                               timestamp: i.timestamp,
                                               image: i.image,
                                               fromTable: val,
                                               originalTableQty: i.qty
                                             }));
                                             
                                             setPdvCart(prev => {
                                               const manuallyAdded = prev.filter(p => !p.fromTable);
                                               const mergedCart = [...restoredCart];
                                                manuallyAdded.forEach(manualItem => {
                                                  const targetId = manualItem.productId || manualItem.id;
                                                  const existingIndex = mergedCart.findIndex(rc => (rc.productId === targetId || rc.id === targetId));
                                                  if (existingIndex !== -1) {
                                                    mergedCart[existingIndex].quantity += manualItem.quantity;
                                                    if (manualItem.obs) {
                                                      mergedCart[existingIndex].obs = mergedCart[existingIndex].obs 
                                                        ? `${mergedCart[existingIndex].obs}, ${manualItem.obs}`
                                                        : manualItem.obs;
                                                    }
                                                  } else {
                                                    mergedCart.push(manualItem);
                                                  }
                                                });
                                                return mergedCart;
                                             });
                                           } else {
                                             setPdvCart(prev => prev.filter(p => !p.fromTable));
                                           }
                                         }
                                       } else {
                                         setPdvCustomerName("");
                                         setPdvCart(prev => prev.filter(p => !p.fromTable));
                                       }
                                     }}
                                     className="w-full px-3 py-2 rounded-xl border border-neutral-200 bg-neutral-50 font-medium text-sm focus:ring-2 focus:ring-orange-600 outline-none"
                                   >
                                     <option value="">Nenhuma / No Balcão</option>
                                     {tables.map(t => (
                                       <option key={t.id} value={t.name}>
                                         {formatTableName(t.name)} {t.customerName ? `(${t.customerName})` : `(${t.status})`}
                                       </option>
                                     ))}
                                   </select>
                                </div>
                             )}

                             

                             <div className="space-y-1">
                                <label className="block text-xs font-bold text-neutral-500">Nome do Cliente</label>
                                <input
                                   type="text"
                                   placeholder="Digite o nome..."
                                   value={pdvCustomerName}
                                   onChange={(e) => setPdvCustomerName(e.target.value)}
                                   className="w-full px-3 py-2 rounded-xl border border-neutral-200 bg-neutral-50 font-medium text-sm focus:ring-2 focus:ring-orange-600 outline-none"
                                />
                             </div>

                             {(pdvCheckoutType === "entrega" || pdvCheckoutType === "retirada" || pdvCheckoutType === "balcao") && (
                                <div className="space-y-1">
                                   <label className="block text-xs font-bold text-neutral-500">Telefone / WhatsApp</label>
                                   <input
                                      type="text"
                                      placeholder="Ex: (11) 99999-9999"
                                      value={pdvCustomerPhone}
                                      onChange={(e) => setPdvCustomerPhone(e.target.value)}
                                      className="w-full px-3 py-2 rounded-xl border border-neutral-200 bg-neutral-50 font-medium text-sm focus:ring-2 focus:ring-orange-600 outline-none"
                                   />
                                </div>
                             )}

                             {pdvCheckoutType === "entrega" && (
                                <div className="space-y-3">
                                   <div className="space-y-1">
                                      <label className="block text-xs font-bold text-neutral-500">Bairro para Entrega</label>
                                      <select
                                         value={pdvNeighborhood}
                                         onChange={(e) => setPdvNeighborhood(e.target.value)}
                                         className="w-full px-3 py-2 rounded-xl border border-neutral-200 bg-neutral-50 font-medium text-sm focus:ring-2 focus:ring-orange-600 outline-none"
                                      >
                                         <option value="">Selecione o Bairro...</option>
                                         {neighborhoods.map((n: any) => (
                                            <option key={n.id || n.name} value={n.name}>
                                               {n.name} (taxa de R$ {Number(n.fee).toFixed(2)})
                                            </option>
                                         ))}
                                      </select>
                                   </div>

                                   <div className="space-y-1">
                                      <label className="block text-xs font-bold text-neutral-500">Endereço de Entrega</label>
                                      <textarea
                                         placeholder="Rua, Número, Referência, Complemento..."
                                         value={pdvCustomerAddress}
                                         onChange={(e) => setPdvCustomerAddress(e.target.value)}
                                         className="w-full px-3 py-2 rounded-xl border border-neutral-200 bg-neutral-50 font-medium text-sm focus:ring-2 focus:ring-orange-600 outline-none min-h-[60px] resize-none"
                                      />
                                   </div>
                                </div>
                             )}
                          </div>

                          <div className="bg-white p-4 rounded-xl border border-neutral-200/80 shadow-sm mt-4 space-y-2">
                             <label className="block text-xs font-bold text-neutral-800">Observações do Pedido</label>
                             <textarea
                                placeholder="Escreva observações do pedido (ex: Sem maionese, caprichar no molho...)"
                                value={pdvObservation}
                                onChange={(e) => setPdvObservation(e.target.value)}
                                className="w-full px-3 py-2 rounded-lg border border-neutral-200 bg-neutral-50/50 font-medium text-sm focus:ring-2 focus:ring-orange-600 outline-none min-h-[60px] resize-none text-neutral-800 placeholder:text-neutral-400"
                             />
                          </div>

                          {pdvCheckoutType === "troca" && (
                             <div className="bg-white p-4 rounded-xl border border-neutral-200 shadow-sm space-y-3 mb-5">
                                <label className="block text-xs font-bold text-neutral-400 uppercase tracking-wider text-orange-600">Busca de Pedido Anterior</label>

                                {/* Painel Elegante com Itens do Pedido Encontrado */}
                                {pdvSearchOrderQuery.trim().length >= 3 && (() => {
                                   const queryText = pdvSearchOrderQuery.toLowerCase().trim();
                                   const matched = orders.filter((o: any) => {
                                       const shortId = o.id ? o.id.slice(-4).toLowerCase() : "";
                                       const fullId = o.id ? o.id.toLowerCase() : "";
                                       const phone = (o.contactPhone || o.customerPhone || "").toLowerCase();
                                       const customer = (o.customerName || "").toLowerCase();
                                       return shortId.includes(queryText) || fullId.includes(queryText) || phone.includes(queryText) || customer.includes(queryText);
                                   });

                                   if (matched.length === 0) {
                                      return <p className="text-xs text-neutral-400 italic">Nenhum pedido correspondente encontrado.</p>;
                                    }

                                   return (
                                      <div className="space-y-2 mt-2 select-none">
                                         <p className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider">Itens do Pedido Encontrado (Clique em Selecionar):</p>
                                         <div className="max-h-48 overflow-y-auto space-y-2 border border-neutral-200 rounded-xl p-2 bg-neutral-50/50">
                                            {matched.map((o: any) => {
                                               const shortId = o.id ? o.id.slice(-4).toUpperCase() : "DESC";
                                               return (
                                                  <div key={o.id} className="border-b border-neutral-200/60 pb-2 last:border-0 last:pb-0">
                                                     <div className="flex justify-between items-center text-xs font-bold text-neutral-700 bg-neutral-100/80 px-2 py-1 rounded">
                                                        <span>Pedido #{shortId}</span>
                                                        <span className="text-neutral-500 font-medium">{o.customerName || "Balcão"}</span>
                                                     </div>
                                                     <div className="mt-1.5 space-y-1 pl-1">
                                                        {o.items?.map((it: any, itIdx: number) => {
                                                           const isThisSelected = pdvReturnedProduct === (it.productId || it.id);
                                                           return (
                                                              <div key={itIdx} className="flex justify-between items-center bg-white p-2 rounded-lg border border-neutral-200/50 shadow-sm">
                                                                 <div className="text-xs text-neutral-800">
                                                                    <span className="font-bold text-orange-600 mr-1.5">{it.qty}x</span>
                                                                    <span>{it.name}</span>
                                                                 </div>
                                                                 <button 
                                                                    type="button"
                                                                    onClick={() => {
                                                                       setPdvReturnedProduct(it.productId || it.id);
                                                                       setPdvReturnedQty(it.qty || 1);
                                                                       setPdvSelectedOrderId(o.id || "");
                                                                       if (o.customerName) setPdvCustomerName(o.customerName);
                                                                       if (o.contactPhone || o.customerPhone) setPdvCustomerPhone(o.contactPhone || o.customerPhone);
                                                                    }}
                                                                    className={`px-2.5 py-1 rounded-lg text-[10px] font-bold transition duration-150 ${isThisSelected ? 'bg-orange-600 text-white' : 'bg-neutral-100 hover:bg-neutral-200 text-neutral-600'}`}
                                                                 >
                                                                    {isThisSelected ? "✓ Selecionado" : "🔄 Selecionar"}
                                                                 </button>
                                                              </div>
                                                           );
                                                        })}
                                                     </div>
                                                  </div>
                                               );
                                            })}
                                         </div>
                                      </div>
                                   );
                                })()}
                                <input 
                                   type="text" 
                                   placeholder="Buscar por Tel ou Código (Ex: E2A4)"
                                   value={pdvSearchOrderQuery}
                                   onChange={(e) => {
                                      setPdvSearchOrderQuery(e.target.value);
                                      setPdvReturnedProduct("");
                                   }}
                                   className="w-full px-3 py-2 rounded-xl border border-neutral-200 bg-neutral-50 font-medium text-sm focus:ring-2 focus:ring-orange-600 outline-none" 
                                />

                                <label className="block text-xs font-bold text-neutral-400 uppercase tracking-wider text-orange-600">Item Devolvido</label>
                                <select 
                                  value={pdvReturnedProduct}
                                  onChange={(e) => setPdvReturnedProduct(e.target.value)}
                                  className="w-full px-3 py-2 rounded-xl border border-neutral-200 bg-neutral-50 font-medium text-sm focus:ring-2 focus:ring-orange-600 outline-none"
                                >
                                  <option value="">(Selecione o item original)</option>
                                  {pdvSearchOrderQuery.trim().length >= 3 ? (
                                     orders.filter((o: any) => {
                                         const term = pdvSearchOrderQuery.toLowerCase().trim();
                                         return o.id.toLowerCase().includes(term) || (o.contactPhone && o.contactPhone.includes(term)) || (o.customerPhone && o.customerPhone.includes(term));
                                     }).flatMap((o: any) => o.items.map((it: any) => ({ ...it, orderId: o.id.slice(-4).toUpperCase(), customerName: o.customerName || "Balcão" }))).map((it: any, idx: number) => (
                                         <option key={`${it.productId}-${idx}`} value={it.productId}>[{it.orderId}] {it.name} ({it.customerName})</option>
                                     ))
                                  ) : (
                                     products.filter((p: any) => !p.category?.toLowerCase().includes("opcional") && !p.category?.toLowerCase().includes("complemento")).map((p: any) => (
                                        <option key={p.id} value={p.id}>{p.name}</option>
                                     ))
                                  )}
                                </select>
                                <input 
                                  type="number" 
                                  min="1" 
                                  value={pdvReturnedQty} 
                                  onChange={(e) => setPdvReturnedQty(Number(e.target.value) || 1)}
                                  className="w-full px-3 py-2 rounded-xl border border-neutral-200 bg-neutral-50 font-medium text-sm focus:ring-2 focus:ring-orange-600 outline-none" 
                                />
                                <p className="text-[10px] text-neutral-400 leading-tight">Adicionará +{pdvReturnedQty} und ao estoque desse antigo item.</p>
                             </div>
                          )}
                          {/* 3. Payment details */}
                          <div className="bg-white p-4 rounded-xl border border-neutral-200 shadow-sm space-y-3">
                             <label className="block text-xs font-bold text-neutral-400 uppercase tracking-wider">Forma de Pagamento</label>
                             <div className="grid grid-cols-3 gap-2 p-1 bg-neutral-100 rounded-xl">
                                <button
                                   type="button"
                                   onClick={() => setPdvPaymentMethod("pix")}
                                   className={`py-2 rounded-lg text-xs font-bold text-center transition ${pdvPaymentMethod === "pix" ? "bg-white text-orange-600 shadow-sm" : "text-neutral-500 hover:text-neutral-800"}`}
                                >
                                   ⚡ Pix
                                </button>
                                <button
                                   type="button"
                                   onClick={() => setPdvPaymentMethod("cartao")}
                                   className={`py-2 rounded-lg text-xs font-bold text-center transition ${pdvPaymentMethod === "cartao" ? "bg-white text-orange-600 shadow-sm" : "text-neutral-500 hover:text-neutral-800"}`}
                                >
                                   💳 Cartão
                                </button>
                                <button
                                   type="button"
                                   onClick={() => setPdvPaymentMethod("dinheiro")}
                                   className={`py-2 rounded-lg text-xs font-bold text-center transition ${pdvPaymentMethod === "dinheiro" ? "bg-white text-orange-600 shadow-sm" : "text-neutral-500 hover:text-neutral-800"}`}
                                >
                                   💵 Dinheiro
                                </button>
                             </div>

                             {pdvPaymentMethod === "dinheiro" && (
                                <div className="space-y-1 pt-2 border-t border-dashed border-neutral-100">
                                   <label className="block text-xs font-bold text-neutral-500">Troco para</label>
                                   <input
                                      type="text"
                                      placeholder="Deixe em branco se não precisar"
                                      value={pdvChangeFor}
                                      onChange={(e) => setPdvChangeFor(e.target.value)}
                                      className="w-full px-3 py-2 rounded-xl border border-neutral-200 bg-neutral-50 font-medium text-sm focus:ring-2 focus:ring-orange-600 outline-none"
                                   />
                                </div>
                             )}
                          </div>

                          {/* 4. Cart products list */}
                          <div className="space-y-3">
                             <label className="block text-xs font-bold text-neutral-400 uppercase tracking-wider">Itens Selecionados ({getProcessedPdvCartItemsCount()})</label>
                             {pdvCart.length === 0 ? (
                                <div className="bg-white rounded-xl border border-neutral-200 p-6 flex flex-col items-center justify-center text-neutral-400 gap-2">
                                  <ShoppingCart size={32} className="opacity-20" />
                                  <p className="text-xs font-semibold">Nenhum item adicionado</p>
                                </div>
                             ) : (
                               getProcessedPdvCart().map((item, index) => {
                                  const isPromoField = item.isPromoGift || item.isPromoComboDiscount;
                                  return (
                                     <div key={`${item.id}-${index}`} className="flex flex-col bg-white p-3 rounded-xl border border-neutral-200 shadow-sm gap-2 animate-fade-in">
                                        <div className="flex items-center justify-between gap-3 w-full">
                                           <div className="flex-1 min-w-0">
                                        <p className="font-bold text-neutral-900 text-sm truncate">{item.name}</p>
                                        <p className="text-xs font-mono font-medium text-neutral-500">
                                           {parsePrice(item.price) < 0 ? `- R$ ${Math.abs(parsePrice(item.price) * item.quantity).toFixed(2)}` : `R$ ${(parsePrice(item.price) * item.quantity).toFixed(2)}`}
                                        </p>
                                     </div>
                                     
                                     {isPromoField ? (
                                        <span className="text-[10px] bg-orange-100 text-orange-600 font-extrabold px-2 py-1 rounded-lg uppercase tracking-wide">
                                           Promoção
                                        </span>
                                     ) : (
                                        <>
                                           {/* Controles de Quantidade (+ e -) */}
                                           <div className="flex items-center bg-neutral-100 rounded-lg p-1 shrink-0 border border-neutral-200">
                                              <button 
                                                 type="button"
                                                 onClick={() => decreasePdvCartQuantity(item.originalIndex)}
                                                 className="w-7 h-7 flex items-center justify-center text-neutral-600 hover:text-red-500 hover:bg-white rounded-md transition duration-150 shadow-none hover:shadow-sm"
                                                 title="Diminuir"
                                              >
                                                 <Minus size={13} strokeWidth={2.5} />
                                              </button>
                                              
                                              <span className="w-8 text-center text-xs font-black text-neutral-800 font-mono">
                                                 {item.quantity}
                                              </span>
                                              
                                              <button 
                                                 type="button"
                                                 onClick={() => increasePdvCartQuantity(item.originalIndex)}
                                                 className="w-7 h-7 flex items-center justify-center text-neutral-600 hover:text-green-600 hover:bg-white rounded-md transition duration-150 shadow-none hover:shadow-sm"
                                                 title="Aumentar"
                                              >
                                                 <Plus size={13} strokeWidth={2.5} />
                                              </button>
                                           </div>

                                           {/* Botão de Excluir */}
                                           <button 
                                              type="button"
                                              onClick={() => removeEntirelyFromPdvCart(item.originalIndex)} 
                                              className="p-2 text-neutral-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition shrink-0"
                                              title="Remover toda a quantidade"
                                           >
                                              <Trash2 size={16} />
                                           </button>
                                        </>
                                     )}
                                     </div>
                                     {!isPromoField && (
                                        <div className="w-full">
                                           <input
                                              type="text"
                                              placeholder="Observação para este item (ex: Bem passado, sem cebola...)"
                                              value={item.obs || ""}
                                              onChange={(e) => updatePdvCartItemObs(item.originalIndex, e.target.value)}
                                              className="w-full px-2 py-1.5 rounded-lg border border-neutral-200 bg-neutral-50 text-xs font-medium focus:ring-1 focus:ring-orange-500 outline-none"
                                           />
                                        </div>
                                     )}
                                  </div>
                                  );
                               })
                             )}
                          </div>
                       </div>

                       <div className="p-5 bg-white rounded-b-2xl flex flex-col gap-4">
                          <div className="flex justify-between items-end pb-4 border-b border-neutral-100">
                             <span className="text-sm font-bold text-neutral-500 uppercase tracking-wider">Total</span>
                             <span className="text-2xl font-black text-neutral-900 font-mono">R$ {calculatePdvTotal().toFixed(2)}</span>
                          </div>
                          <div className="flex flex-col gap-3">
                             {pdvCheckoutType === "balcao" && pdvTableNumber ? (
                                <div className="grid grid-cols-2 gap-3">
                                   <button
                                      type="button"
                                      disabled={isSubmittingOrder}
                                      onClick={launchPdvToTable}
                                      className="w-full py-4 bg-emerald-600 hover:bg-emerald-700 disabled:bg-neutral-300 disabled:text-neutral-500 rounded-xl text-white font-black uppercase tracking-wider transition shadow-sm hover:shadow-md text-xs sm:text-sm"
                                   >
                                      {isSubmittingOrder ? "Processando..." : "Salvar na Mesa"}
                                   </button>
                                   <button
                                      type="button"
                                      disabled={isSubmittingOrder}
                                      onClick={submitPdvTableOrder}
                                      className="w-full py-4 bg-orange-600 hover:bg-orange-700 disabled:bg-neutral-300 disabled:text-neutral-500 rounded-xl text-white font-black uppercase tracking-wider transition shadow-sm hover:shadow-md text-xs sm:text-sm"
                                   >
                                      {isSubmittingOrder ? "Processando..." : "Finalizar Pedido da Mesa"}
                                   </button>
                                </div>
                             ) : (
                                <button
                                   type="button"
                                   disabled={isSubmittingOrder}
                                   onClick={submitPdvOrder}
                                   className="w-full py-4 bg-orange-600 hover:bg-orange-700 disabled:bg-neutral-300 disabled:text-neutral-500 rounded-xl text-white font-black uppercase tracking-wider transition shadow-sm hover:shadow-md"
                                >
                                   {isSubmittingOrder ? "Processando..." : "Finalizar Pedido"}
                                </button>
                             )}
                          </div>
                       </div>
                    </div>

                    {/* Floating Mobile Sticky Cart Bar (visible only below lg, and when cart has items, and pdvMobileTab is "products") */}
                    {pdvCart.length > 0 && pdvMobileTab === "products" && (
                      <div className="lg:hidden fixed bottom-6 left-4 right-4 z-40">
                        <button
                          type="button"
                          onClick={() => setPdvMobileTab("cart")}
                          className="w-full bg-orange-600 active:bg-orange-700 hover:bg-orange-700 text-white rounded-2xl shadow-xl border-2 border-orange-500/30 py-4 px-6 flex items-center justify-between font-black text-xs sm:text-sm tracking-wide transition transform active:scale-95 duration-100"
                        >
                          <div className="flex items-center gap-3">
                            <div className="bg-white/20 p-2 rounded-xl">
                              <ShoppingCart size={18} strokeWidth={3} className="animate-pulse" />
                            </div>
                            <span className="font-extrabold uppercase">Ver Carrinho ({pdvCart.reduce((sum, item) => sum + item.quantity, 0)})</span>
                          </div>
                          <div className="flex items-center gap-1.5 font-mono text-sm sm:text-base font-black">
                            <span>R$ {calculatePdvTotal().toFixed(2)}</span>
                            <span className="p-1 bg-white/10 rounded-full">⚡</span>
                          </div>
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              );
            })()}

            {/* --- Pedidos TAB --- */}
            {activeTab === "orders" && (() => {
              // Helper to check if timestamp corresponds to today
              const isFromToday = (ts: any) => {
                if (!ts) return false;
                const d = new Date(ts);
                const today = new Date();
                return d.getDate() === today.getDate() &&
                       d.getMonth() === today.getMonth() &&
                       d.getFullYear() === today.getFullYear();
              };

              // Filter collection based on active mode (today only vs all older ones)
              const ordersPool = orders.filter(o => {
                if (phoneSearchQuery.trim() !== "") {
                  const rawPhone = (o.contactPhone || "").replace(/\D/g, "");
                  const rawSearch = phoneSearchQuery.replace(/\D/g, "");
                  return rawPhone.includes(rawSearch) || (o.contactPhone || "").includes(phoneSearchQuery);
                }
                if (ordersPeriod === "today") {
                  return isFromToday(o.timestamp);
                }
                return true;
              });

              // Get counting for tabs
              const totalOrders = ordersPool.length;
              const countByStatus = (statusName: string) => ordersPool.filter(o => (o.status || "Novo") === statusName).length;

              const novosCount = countByStatus("Novo");
              const preparandoCount = countByStatus("Preparando");
              const prontoCount = countByStatus("Pronto");
              const saiuCount = countByStatus("Saiu para Entrega");
              const entregueCount = countByStatus("Entregue");
               const finalizadoCount = countByStatus("Finalizado");

              // Filter logic
              const sortedOrders = [...ordersPool].sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
              const filteredOrders = sortedOrders.filter(o => {
                const matchesFilter = ordersFilter === "Todos" || (o.status || "Novo") === ordersFilter;
                const matchesSearch = !ordersSearch || 
                  (o.customerName || "").toLowerCase().includes(ordersSearch.toLowerCase()) ||
                  (o.customerAddress || "").toLowerCase().includes(ordersSearch.toLowerCase()) ||
                  (o.items || []).some((item: any) => (item.name || "").toLowerCase().includes(ordersSearch.toLowerCase()));
                return matchesFilter && matchesSearch;
              });

              const formatOrderTime = (timestamp: number) => {
                if (!timestamp) return "N/A";
                try {
                  const d = new Date(timestamp);
                  return d.toLocaleString("pt-BR", {
                    day: "2-digit",
                    month: "2-digit",
                    hour: "2-digit",
                    minute: "2-digit"
                  });
                } catch {
                  return "N/A";
                }
              };

              const getStatusStyles = (status: string) => {
                switch (status) {
                  case "Novo":
                    return { bg: "bg-blue-50 text-blue-700 border-blue-200", label: "Novo" };
                  case "Preparando":
                    return { bg: "bg-amber-50 text-amber-800 border-amber-200", label: "Preparando" };
                  case "Pronto":
                    return { bg: "bg-purple-50 text-purple-700 border-purple-200", label: "Pronto" };
                  case "Saiu para Entrega":
                    return { bg: "bg-indigo-50 text-indigo-700 border-indigo-200", label: "Saiu para Entrega" };
                  case "Entregue":
                    return { bg: "bg-green-50 text-green-700 border-green-200", label: "Entregue" };
                  case "Finalizado":
                    return { bg: "bg-emerald-50 text-emerald-700 border-emerald-200", label: "Finalizado" };
                  default:
                    return { bg: "bg-neutral-50 text-neutral-600 border-neutral-250", label: "Novo" };
                }
              };

              return (
                <div className="space-y-6 animate-in fade-in duration-200">
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div>
                      <h1 className="text-2xl font-black text-neutral-900 tracking-tight">Painel de Pedidos</h1>
                      <p className="text-xs text-neutral-500 mt-0.5">Gerencie os pedidos recebidos em tempo real e atualize seus status.</p>
                    </div>

                    <div className="flex items-center gap-2 bg-neutral-100 p-1 rounded-xl self-start md:self-auto">
                      <span className="inline-flex h-2.5 w-2.5 rounded-full bg-emerald-500 animate-ping ml-2 shrink-0" />
                      <span className="text-[10px] font-bold text-neutral-600 pr-2 uppercase tracking-wide">Monitor Ativo</span>
                    </div>
                  </div>

                  {/* Alerta de Estoque Baixo */}
                  {(() => {
                    const lowStockList = products.filter(p => p.stock !== undefined && p.stock !== null && p.stock <= 5);
                    if (lowStockList.length === 0) return null;
                    return (
                      <div className="rounded-xl border border-amber-200 bg-amber-50/50 p-4 shadow-sm animate-in fade-in slide-in-from-top-2 duration-300">
                        <div className="flex gap-3">
                          <AlertCircle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
                          <div className="space-y-1 w-full">
                            <h4 className="text-sm font-bold text-amber-900 flex items-center gap-1.5">
                              ⚠️ Atenção: Há produtos com estoque baixo!
                            </h4>
                            <p className="text-xs text-amber-700">Por favor, verifique e reabasteça o estoque dos itens listados abaixo para evitar falta no cardápio de pedidos. Digite a quantidade no campo e pressione <b>Enter</b> ou clique em <b>Repor</b>.</p>
                            <div className="flex flex-wrap gap-3 mt-3">
                              {lowStockList.map(p => {
                                return (
                                  <div key={p.id} className="flex items-center gap-2 rounded-lg bg-white px-3 py-1.5 text-xs font-bold text-amber-900 shadow-sm border border-amber-200/80">
                                    <div className="flex items-center gap-1.5">
                                      <span className="w-2 h-2 rounded-full bg-red-500 shrink-0" />
                                      <span className="font-semibold text-neutral-800 text-xs">{p.name}</span>
                                      <span className="text-red-600 font-extrabold font-mono text-[11px] ml-0.5">({p.stock} un restante)</span>
                                    </div>
                                    <div className="h-4 w-px bg-neutral-200 mx-1" />
                                    <div className="flex items-center gap-1.5">
                                      <input 
                                        type="number" 
                                        placeholder="+ Adicionar" 
                                        className="w-16 rounded border border-neutral-200 px-1.5 py-0.5 text-[11px] outline-none focus:ring-1 focus:ring-amber-500 font-mono text-neutral-800"
                                        onKeyDown={async (e) => {
                                          if (e.key === 'Enter') {
                                            const val = parseInt((e.target as HTMLInputElement).value, 10);
                                            if (!isNaN(val) && val > 0) {
                                              const newStock = (p.stock || 0) + val;
                                              await updateDoc(doc(db, "products", p.id), { 
                                                stock: newStock,
                                                isOutOfStock: false 
                                              });
                                              (e.target as HTMLInputElement).value = '';
                                            }
                                          }
                                        }}
                                      />
                                      <button
                                        onClick={async (e) => {
                                          const input = (e.currentTarget.previousSibling as HTMLInputElement);
                                          const val = parseInt(input.value, 10);
                                          if (!isNaN(val) && val > 0) {
                                            const newStock = (p.stock || 0) + val;
                                            await updateDoc(doc(db, "products", p.id), { 
                                              stock: newStock,
                                              isOutOfStock: false 
                                            });
                                            input.value = '';
                                          } else {
                                            alert("Digite um valor válido maior que 0.");
                                          }
                                        }}
                                        className="bg-amber-600 hover:bg-amber-700 active:bg-amber-800 text-white rounded px-2 py-0.5 text-[10px] shrink-0 font-bold transition"
                                      >
                                        Repor
                                      </button>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })()}

                  {/* Filtro do Período e Busca de Pedidos Anteriores por Telefone */}
                  <div className="bg-white border border-neutral-200 rounded-2xl p-4 shadow-sm flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                    {/* Period View Selector */}
                    <div className="space-y-1.5 shrink-0">
                      <span className="text-[10px] uppercase font-black text-neutral-400 tracking-wider block">Filtro de Período</span>
                      <div className="flex bg-neutral-100 p-1.5 rounded-xl border border-neutral-200 select-none gap-2 w-fit">
                        <button
                          type="button"
                          onClick={() => {
                            setOrdersPeriod("today");
                            setPhoneSearchQuery("");
                          }}
                          className={`px-4 py-2 rounded-lg text-xs font-bold transition flex items-center gap-1.5 ${
                            ordersPeriod === "today" && !phoneSearchQuery
                              ? "bg-white text-orange-600 shadow-sm font-extrabold"
                              : "text-neutral-600 hover:text-neutral-900"
                          }`}
                        >
                          ☀️ Pedidos de Hoje
                        </button>
                        <button
                          type="button"
                          onClick={() => setOrdersPeriod("all")}
                          className={`px-4 py-2 rounded-lg text-xs font-bold transition flex items-center gap-1.5 ${
                            ordersPeriod === "all" && !phoneSearchQuery
                              ? "bg-white text-orange-600 shadow-sm font-extrabold"
                              : "text-neutral-600 hover:text-neutral-900"
                          }`}
                        >
                          🕒 Todos os Dias
                        </button>
                      </div>
                    </div>

                    {/* Previous/Anterior Orders Search by Phone */}
                    <div className="flex-1 max-w-lg space-y-1.5">
                      <span className="text-[10px] uppercase font-black text-neutral-400 tracking-wider block">
                        Procurar Pedidos Anteriores por Telefone
                      </span>
                      <div className="relative">
                        <input
                          type="text"
                          placeholder="Digite o telefone ou WhatsApp (ex: 85991276477)..."
                          value={phoneSearchQuery}
                          onChange={(e) => {
                            setPhoneSearchQuery(e.target.value);
                            if (e.target.value.trim() !== "") {
                              setOrdersPeriod("all"); // auto-switch to "all" when typing a phone query
                            }
                          }}
                          className={`w-full rounded-xl px-4 py-2.5 text-xs outline-none font-bold ring-1 ring-inset ${
                            phoneSearchQuery
                              ? "ring-orange-500 bg-orange-50/30 text-orange-950 placeholder-orange-400"
                              : "ring-neutral-200 bg-white text-neutral-800 placeholder-neutral-400"
                          } focus:ring-2 focus:ring-orange-600`}
                        />
                        {phoneSearchQuery && (
                          <button
                            type="button"
                            onClick={() => {
                              setPhoneSearchQuery("");
                              setOrdersPeriod("today");
                            }}
                            className="absolute right-3 top-3 text-orange-500 hover:text-orange-700"
                            title="Limpar busca e voltar para Hoje"
                          >
                            <X size={14} className="stroke-[2.5]" />
                          </button>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Informational Feedback Banner based on Period & Phone */}
                  {phoneSearchQuery ? (
                    <div className="bg-orange-50 border border-orange-255 text-orange-900 rounded-2xl px-4 py-3 text-xs font-semibold flex flex-col sm:flex-row sm:items-center justify-between gap-2 shadow-sm animate-in fade-in duration-200">
                      <div className="flex items-center gap-2">
                        <span className="flex h-2 w-2 rounded-full bg-orange-600 animate-ping shrink-0" />
                        <span>Mostrando histórico completo de todos os pedidos anteriores para o telefone: <b className="font-extrabold font-mono text-neutral-950 underline">{phoneSearchQuery}</b></span>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          setPhoneSearchQuery("");
                          setOrdersPeriod("today");
                        }}
                        className="text-xs font-bold text-orange-600 hover:text-orange-850 hover:underline shrink-0 text-left"
                      >
                        Desativar busca e ver Hoje
                      </button>
                    </div>
                  ) : ordersPeriod === "all" ? (
                    <div className="bg-neutral-50 border border-neutral-200 text-neutral-700 rounded-2xl px-4 py-3 text-xs font-semibold flex flex-col sm:flex-row sm:items-center justify-between gap-2 shadow-sm animate-in fade-in duration-200">
                      <div className="flex items-center gap-2">
                        <span className="shrink-0 text-neutral-500">🕒</span>
                        <span>Exibindo histórico de <b>todos os pedidos anteriores</b> cadastrados.</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => setOrdersPeriod("today")}
                        className="text-xs font-bold text-orange-600 hover:text-orange-700 hover:underline shrink-0 text-left font-extrabold"
                      >
                        Ver apenas os pedidos de hoje
                      </button>
                    </div>
                  ) : (
                    <div className="text-neutral-400 text-xs font-semibold flex items-center gap-1.5 ml-1 animate-in fade-in duration-200">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                      <span>Exibindo apenas os pedidos de <b>Hoje</b> por padrão.</span>
                    </div>
                  )}

                  {/* Summary Status Badges */}
                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-7 gap-3">
                    {[
                      { id: "Todos", label: "Todos", count: totalOrders, activeBg: "bg-neutral-900 text-white border-neutral-900", inactiveBg: "bg-white border-neutral-200 text-neutral-700 hover:bg-neutral-50" },
                      { id: "Novo", label: "Novos", count: novosCount, activeBg: "bg-blue-600 text-white border-blue-600", inactiveBg: "bg-blue-50/40 border-blue-100 text-blue-700 hover:bg-blue-50/80" },
                      { id: "Preparando", label: "Preparando", count: preparandoCount, activeBg: "bg-amber-500 text-white border-amber-500", inactiveBg: "bg-amber-50 border-amber-100 text-amber-800 hover:bg-amber-100/50" },
                      { id: "Pronto", label: "Prontos", count: prontoCount, activeBg: "bg-purple-600 text-white border-purple-600", inactiveBg: "bg-purple-50 border-purple-100 text-purple-700 hover:bg-purple-100/50" },
                      { id: "Saiu para Entrega", label: "Em Rota", count: saiuCount, activeBg: "bg-indigo-600 text-white border-indigo-600", inactiveBg: "bg-indigo-50 border-indigo-100 text-indigo-700 hover:bg-indigo-100/50" },
                      { id: "Entregue", label: "Entregues", count: entregueCount, activeBg: "bg-green-600 text-white border-green-600", inactiveBg: "bg-green-50 border-green-100 text-green-700 hover:bg-green-100/50" },
                       { id: "Finalizado", label: "Finalizados", count: finalizadoCount, activeBg: "bg-emerald-600 text-white border-emerald-600", inactiveBg: "bg-emerald-50 border-emerald-100 text-emerald-700 hover:bg-emerald-100/50" },
                    ].map(statusTab => (
                      <button
                        key={statusTab.id}
                        onClick={() => setOrdersFilter(statusTab.id)}
                        className={`flex flex-col p-3 rounded-2xl border text-left transition select-none cursor-pointer ${
                          ordersFilter === statusTab.id ? statusTab.activeBg : statusTab.inactiveBg
                        }`}
                      >
                        <span className="text-[10px] uppercase font-bold tracking-wider opacity-90">{statusTab.label}</span>
                        <span className="text-lg font-black mt-1">{statusTab.count}</span>
                      </button>
                    ))}
                  </div>

                  {/* Search bar */}
                  <div className="relative max-w-md">
                    <input 
                      type="text" 
                      placeholder="Pesquisar por cliente, endereço ou produto..."
                      value={ordersSearch}
                      onChange={e => setOrdersSearch(e.target.value)}
                      className="w-full rounded-xl ring-1 ring-inset ring-neutral-300 bg-white px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-orange-600 font-medium text-neutral-800"
                    />
                  </div>

                  {/* Orders Listing */}
                  {filteredOrders.length === 0 ? (
                    <div className="rounded-2xl border border-neutral-200 bg-white text-center py-16 px-4">
                      <ClipboardList className="mx-auto h-12 w-12 text-neutral-300 mb-3" />
                      <h3 className="font-bold text-neutral-800">Nenhum pedido encontrado</h3>
                      <p className="text-xs text-neutral-500 mt-1 max-w-md mx-auto">
                        Tente alterar seus filtros de status ou a busca para encontrar o que procura.
                      </p>
                    </div>
                  ) : (
                    <div className="grid gap-4 md:grid-cols-2">
                      {filteredOrders.map(order => {
                        const statusStyle = getStatusStyles(order.status || "Novo");
                        return (
                          <div key={order.id} className="rounded-2xl border border-neutral-200 bg-white shadow-sm flex flex-col justify-between overflow-hidden">
                            
                            {/* Card Header */}
                            <div className="px-5 py-4 border-b border-neutral-100 flex items-start justify-between bg-neutral-50/50">
                              <div className="min-w-0 flex-1 pr-2">
                                <span className="font-mono text-[10px] font-bold text-neutral-400 block uppercase">ID: #{order.id?.slice(-6).toUpperCase()}</span>
                                <h3 className="font-bold text-neutral-900 truncate mt-0.5">{order.customerName}</h3>
                              </div>
                              <div className="flex flex-col items-end gap-1.5 min-w-[70px]">
                                <span className="text-[10px] font-bold text-neutral-400 font-mono">
                                  {formatOrderTime(order.timestamp)}
                                </span>
                                <span className={`inline-flex px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${statusStyle.bg}`}>
                                  {statusStyle.label}
                                </span>
                              </div>
                            </div>

                            {/* Card Body */}
                            <div className="px-5 py-4 flex-1 space-y-4">
                              
                              {/* Info Panel: Modo, Contato e Pagamento */}
                              <div className="grid grid-cols-2 gap-3 bg-neutral-50 p-3 rounded-2xl border border-neutral-100">
                                <div>
                                  <span className="text-[9px] font-bold text-neutral-400 uppercase tracking-widest block">Atendimento:</span>
                                  <p className="text-xs font-bold text-neutral-850 mt-0.5 font-sans">
                                    {order.checkoutType === "entrega" ? "🚀 Entrega" : order.checkoutType === "retirada" ? "🛍️ Retirada" : "🍽️ Balcão/Mesa"}
                                    {order.checkoutType === "balcao" && order.tableNumber && ` (${order.tableNumber})`}
                                  </p>
                                </div>
                                <div>
                                  <span className="text-[9px] font-bold text-neutral-400 uppercase tracking-widest block">Pagamento:</span>
                                  <p className="text-xs font-bold text-neutral-850 mt-0.5 font-sans">
                                    {order.paymentMethod === "dinheiro" ? "💵 Dinheiro" : order.paymentMethod === "pix" ? "⚡ Pix" : order.paymentMethod === "cartao" ? "💳 Cartão" : "Pendente"}
                                  </p>
                                  {order.paymentMethod === "dinheiro" && order.changeFor && (() => {
                                    const rawVal = parseFloat(String(order.changeFor).replace(',', '.')) || 0;
                                    const trocoVal = rawVal - (order.total || 0);
                                    return (
                                      <div className="mt-1 text-[10px] leading-tight text-neutral-600 font-medium">
                                        <div>Paga com: R$ {rawVal.toFixed(2)}</div>
                                        {trocoVal > 0 && (
                                          <div className="text-green-600 font-bold bg-green-50 px-1.5 py-0.5 rounded mt-0.5 inline-block">
                                            Troco: R$ {trocoVal.toFixed(2)}
                                          </div>
                                        )}
                                      </div>
                                    );
                                  })()}
                                </div>
                                {order.waiterName && (
                                  <div className="col-span-2 border-t border-neutral-200/60 pt-2">
                                    <span className="text-[9px] font-bold text-neutral-400 uppercase tracking-widest block">Anotado por (PDV):</span>
                                    <p className="text-xs font-bold text-orange-600 font-sans mt-0.5">👤 {order.waiterName}</p>
                                  </div>
                                )}
                                {order.contactPhone && (
                                  <div className="col-span-2 border-t border-neutral-200/60 pt-2 flex flex-col sm:flex-row gap-2 items-start sm:items-center justify-between">
                                    <div>
                                      <span className="text-[9px] font-bold text-neutral-400 uppercase tracking-widest block">WhatsApp:</span>
                                      <p className="text-xs font-semibold text-neutral-800 tracking-wide font-mono leading-none mt-0.5">{order.contactPhone}</p>
                                    </div>
                                    <div className="flex items-center gap-1.5 w-full sm:w-auto">
                                      <div className="flex flex-col gap-1 w-full sm:w-auto">
                                        <button
                                          onClick={() => handlePrintOrder(order, 'balcao')}
                                          className="flex-1 sm:flex-initial text-[10px] font-bold text-neutral-600 hover:text-neutral-800 hover:bg-neutral-100 px-2.5 py-1 rounded-md border border-neutral-200 transition flex items-center justify-center gap-1 cursor-pointer select-none"
                                          title="Imprimir comanda Balcão"
                                        >
                                          <Printer size={11} className="shrink-0" />
                                          <span>1 Balcão</span>
                                        </button>
                                        <button
                                          onClick={() => handlePrintOrder(order, 'cozinha')}
                                          className="flex-1 sm:flex-initial text-[10px] font-bold text-neutral-600 hover:text-neutral-800 hover:bg-neutral-100 px-2.5 py-1 rounded-md border border-neutral-200 transition flex items-center justify-center gap-1 cursor-pointer select-none"
                                          title="Imprimir comanda Cozinha"
                                        >
                                          <Printer size={11} className="shrink-0" />
                                          <span>2 Cozinha</span>
                                        </button>
                                      </div>
                                      <a
                                        href={`https://wa.me/${order.contactPhone.replace(/\D/g, "")}`}
                                        target="_blank"
                                        rel="noreferrer"
                                        className="flex-1 sm:flex-initial text-[10px] font-bold text-green-600 hover:text-green-700 hover:bg-green-50 px-2.5 py-1 rounded-lg border border-green-200 transition flex items-center justify-center select-none text-center"
                                      >
                                        Conversar
                                      </a>
                                    </div>
                                  </div>
                                )}
                              </div>

                              {order.checkoutType === "entrega" && order.customerAddress && (
                                <div>
                                  <span className="text-[9px] font-bold text-neutral-400 uppercase tracking-widest block">Endereço de Entrega:</span>
                                  <p className="text-xs font-medium text-neutral-700 leading-relaxed mt-0.5">{order.customerAddress}</p>
                                  {order.addressComplement && (
                                    <p className="text-xs text-neutral-500 font-semibold leading-relaxed mt-0.5">Comp: {order.addressComplement}</p>
                                  )}
                                </div>
                              )}

                              {order.customerAddress && !order.checkoutType && (
                                <div>
                                  <span className="text-[9px] font-bold text-neutral-400 uppercase tracking-widest block">Endereço de Entrega:</span>
                                  <p className="text-xs font-medium text-neutral-700 leading-relaxed mt-0.5">{order.customerAddress}</p>
                                </div>
                              )}

                              {order.observation && (
                                <div className="p-2.5 bg-amber-50 border border-amber-200/60 rounded-xl">
                                  <span className="text-[9px] font-bold text-amber-800 uppercase tracking-widest block">Observação do Pedido:</span>
                                  <p className="text-xs font-semibold text-amber-950 mt-0.5 whitespace-pre-wrap">{order.observation}</p>
                                </div>
                              )}

                              {/* Items list */}
                              <div>
                                <span className="text-[9px] font-bold text-neutral-400 uppercase tracking-widest block mb-1">Itens:</span>
                                <div className="space-y-3 max-h-48 overflow-y-auto pr-1">
                                  {order.items?.map((item: any, itemIdx: number) => (
                                    <div key={itemIdx} className="text-xs border-b border-dashed border-neutral-100 pb-2.5 last:border-0 last:pb-0">
                                      <div className="flex justify-between items-start font-medium text-neutral-850">
                                        <div className="flex-1">
                                          <span className="font-bold text-neutral-900 mr-1.5">{item.qty}x</span>
                                          <span>{item.name}</span>
                                        </div>
                                        <span className="font-mono font-bold text-neutral-750">R$ {(item.price * item.qty).toFixed(2)}</span>
                                      </div>

                                      {/* Sabores */}
                                      {item.selectedFlavors && item.selectedFlavors.length > 0 && (
                                        <div className="mt-1 pl-4 space-y-0.5">
                                          <span className="text-[9px] font-bold text-emerald-600 uppercase tracking-wider block">Sabores:</span>
                                          {item.selectedFlavors.map((fl: any, fIdx: number) => (
                                            <p key={fIdx} className="text-[10px] text-neutral-500 leading-tight">
                                              ✓ {fl.name}
                                            </p>
                                          ))}
                                        </div>
                                      )}

                                      {/* Addons */}
                                      {item.selectedAddons && item.selectedAddons.length > 0 && (
                                        <div className="mt-1 pl-4 space-y-0.5">
                                          <span className="text-[9px] font-bold text-orange-500 uppercase tracking-wider block">Adicionais:</span>
                                          {item.selectedAddons.map((addon: any, aIdx: number) => (
                                            <p key={aIdx} className="text-[10px] text-neutral-500 leading-tight">
                                              + {addon.name} ({addon.price > 0 ? `+ R$ ${addon.price.toFixed(2)}` : "Grátis"})
                                            </p>
                                          ))}
                                        </div>
                                      )}

                                      {/* Complements */}
                                      {item.selectedComplements && item.selectedComplements.length > 0 && (
                                        <div className="mt-1.5 pl-4 space-y-0.5">
                                          <span className="text-[9px] font-bold text-neutral-400 uppercase tracking-wider block">Complementos:</span>
                                          {item.selectedComplements.map((comp: any, cIdx: number) => (
                                            <p key={cIdx} className="text-[10px] text-neutral-500 leading-tight">
                                              ✔ {comp.name}
                                            </p>
                                          ))}
                                        </div>
                                      )}

                                      {/* Sauces */}
                                      {item.selectedSauces && item.selectedSauces.length > 0 && (
                                        <div className="mt-1.5 pl-4 space-y-0.5">
                                          <span className="text-[9px] font-bold text-red-500 uppercase tracking-wider block">Molhos:</span>
                                          {item.selectedSauces.map((sauce: any, sIdx: number) => (
                                            <p key={sIdx} className="text-[10px] text-neutral-500 leading-tight">
                                              ✔ {sauce.name}
                                            </p>
                                          ))}
                                        </div>
                                      )}

                                      {/* Obs do item */}
                                      {item.obs && (
                                        <div className="mt-1.5 pl-4 p-1.5 bg-neutral-50 rounded-lg border border-neutral-200/50">
                                          <span className="text-[9px] font-bold text-neutral-400 uppercase tracking-wider block">Observação:</span>
                                          <p className="text-[10px] text-neutral-600 font-medium italic">
                                            "{item.obs}"
                                          </p>
                                        </div>
                                      )}
                                    </div>
                                  ))}
                                </div>
                              </div>
                            </div>

                            {/* Card Footer */}
                            <div className="px-5 py-4 border-t border-neutral-150/40 bg-neutral-50/30 flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between">
                              <div>
                                <span className="text-[9px] font-bold text-neutral-400 uppercase tracking-wider">Total</span>
                                <p className="text-lg font-black text-neutral-900 font-mono leading-none">R$ {order.total?.toFixed(2)}</p>
                              </div>

                              <div className="flex items-center gap-2 self-stretch sm:self-auto">
                                <div className="flex flex-col gap-1">
                                  <button
                                    onClick={() => handlePrintOrder(order, 'balcao')}
                                    className="px-2.5 py-1 text-[10px] font-bold text-neutral-600 hover:text-neutral-800 bg-white hover:bg-neutral-100 border border-neutral-200 rounded-md transition flex items-center gap-1.5 shadow-sm whitespace-nowrap"
                                    title="Imprimir Balcão"
                                  >
                                    <Printer size={12} />
                                    1 Balcão
                                  </button>
                                  <button
                                    onClick={() => handlePrintOrder(order, 'cozinha')}
                                    className="px-2.5 py-1 text-[10px] font-bold text-neutral-600 hover:text-neutral-800 bg-white hover:bg-neutral-100 border border-neutral-200 rounded-md transition flex items-center gap-1.5 shadow-sm whitespace-nowrap"
                                    title="Imprimir Cozinha"
                                  >
                                    <Printer size={12} />
                                    2 Cozinha
                                  </button>
                                </div>
                                <div className="flex items-center gap-1.5 px-2 py-1 rounded-lg border border-neutral-200">
                                  <input
                                     type="checkbox"
                                     checked={!!order.isPaid}
                                     onChange={(e) => handleUpdateOrderPayment(order.id, e.target.checked)}
                                     className="h-3.5 w-3.5 rounded border-neutral-300 text-orange-600 focus:ring-orange-600 cursor-pointer"
                                  />
                                  <span className="text-[10px] font-bold text-neutral-600">PAGO</span>
                                </div>
                                <span className="text-[10px] font-bold text-neutral-500 uppercase tracking-wider hidden sm:inline">Status:</span>
                                <div className="flex-1 sm:flex-initial relative">
                                  <select
                                    value={order.status || "Novo"}
                                    onChange={(e) => handleUpdateOrderStatus(order.id, e.target.value)}
                                    className="w-full sm:w-auto text-xs font-semibold px-3 py-2 rounded-xl ring-1 ring-inset ring-neutral-300 bg-white hover:bg-neutral-50 outline-none focus:ring-1 focus:ring-orange-600"
                                  >
                                    <option value="Novo">Novo</option>
                                    <option value="Preparando">Preparando</option>
                                    <option value="Pronto">Pronto</option>
                                    <option value="Saiu para Entrega">Saiu para Entrega</option>
                                    <option value="Entregue">Entregue</option>
                                     <option value="Finalizado">Finalizado</option>
                                  </select>
                                </div>
                                <button
                                  onClick={() => handleDeleteOrder(order.id)}
                                  className="p-2 text-neutral-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition"
                                  title="Excluir Pedido"
                                >
                                  <Trash2 size={16} />
                                </button>
                              </div>
                            </div>

                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })()}

            {/* --- Produtos TAB --- */}
            {activeTab === "products" && (
              <div className="space-y-4">
                {!isAddingProduct ? (
                  <>
                    {/* Alerta de Estoque Baixo */}
                    {(() => {
                      const lowStockList = products.filter(p => p.stock !== undefined && p.stock !== null && p.stock <= 5);
                      if (lowStockList.length === 0) return null;
                      return (
                        <div className="rounded-2xl border border-amber-200 bg-amber-50/70 p-3.5 shadow-xs animate-in fade-in slide-in-from-top-2 duration-300">
                          <div className="flex gap-2.5">
                            <AlertCircle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
                            <div className="space-y-1 w-full">
                              <h4 className="text-xs font-black text-amber-900 flex items-center gap-1.5">
                                ⚠️ Produtos com estoque baixo ({lowStockList.length})
                              </h4>
                              <p className="text-[11px] text-amber-800 leading-snug">Digite a quantidade para adicionar e pressione <b>Enter</b> ou clique em <b>Repor</b>.</p>
                              <div className="flex flex-wrap gap-2 mt-2">
                                {lowStockList.map(p => {
                                  return (
                                    <div key={p.id} className="flex items-center gap-2 rounded-xl bg-white px-2.5 py-1 text-xs font-bold text-amber-900 shadow-2xs border border-amber-200/80">
                                      <div className="flex items-center gap-1.5">
                                        <span className="w-2 h-2 rounded-full bg-red-500 shrink-0" />
                                        <span className="font-bold text-neutral-800 text-xs truncate max-w-[120px]">{p.name}</span>
                                        <span className="text-red-600 font-extrabold font-mono text-[10px]">({p.stock} un)</span>
                                      </div>
                                      <div className="h-3.5 w-px bg-neutral-200" />
                                      <div className="flex items-center gap-1">
                                        <input 
                                          type="number" 
                                          placeholder="+ Qtd" 
                                          className="w-14 rounded-lg border border-neutral-200 px-1.5 py-0.5 text-[10px] outline-none focus:ring-1 focus:ring-amber-500 font-mono text-neutral-800 bg-neutral-50"
                                          onKeyDown={async (e) => {
                                            if (e.key === 'Enter') {
                                              const val = parseInt((e.target as HTMLInputElement).value, 10);
                                              if (!isNaN(val) && val > 0) {
                                                const newStock = (p.stock || 0) + val;
                                                await updateDoc(doc(db, "products", p.id), { 
                                                  stock: newStock,
                                                  isOutOfStock: false 
                                                });
                                                (e.target as HTMLInputElement).value = '';
                                              }
                                            }
                                          }}
                                        />
                                        <button
                                          onClick={async (e) => {
                                            const input = (e.currentTarget.previousSibling as HTMLInputElement);
                                            const val = parseInt(input.value, 10);
                                            if (!isNaN(val) && val > 0) {
                                              const newStock = (p.stock || 0) + val;
                                              await updateDoc(doc(db, "products", p.id), { 
                                                stock: newStock,
                                                isOutOfStock: false 
                                              });
                                              input.value = '';
                                            } else {
                                              alert("Digite um valor válido maior que 0.");
                                            }
                                          }}
                                          className="bg-amber-600 hover:bg-amber-700 text-white rounded-lg px-2 py-0.5 text-[10px] font-black shrink-0 transition"
                                        >
                                          Repor
                                        </button>
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })()}

                    {/* Barra de Controles e Filtros */}
                    <div className="bg-white p-3 rounded-2xl border border-neutral-200/80 shadow-xs flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
                      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 flex-1">
                        <div className="text-sm font-black text-neutral-900 shrink-0 flex items-center gap-2">
                          <span>Produtos</span>
                          <span className="px-2 py-0.5 bg-neutral-100 text-neutral-700 rounded-full text-xs font-mono font-bold">{products.length}</span>
                        </div>
                        
                        <div className="relative flex-1 min-w-[140px]">
                          <Search className="absolute left-3 top-2.5 text-neutral-400" size={14} />
                          <input
                            type="text"
                            placeholder="Buscar produto..."
                            value={prodSearch}
                            onChange={e => setProdSearch(e.target.value)}
                            className="pl-8 pr-3 py-1.5 rounded-xl border border-neutral-200 outline-none focus:ring-2 focus:ring-orange-600 text-xs font-semibold w-full bg-neutral-50/50 text-neutral-900 placeholder-neutral-400"
                          />
                        </div>

                        <div className="relative min-w-[140px]">
                          <select
                            value={prodCategory}
                            onChange={e => setProdCategory(e.target.value)}
                            className="pl-3 pr-7 py-1.5 rounded-xl border border-neutral-200 outline-none focus:ring-2 focus:ring-orange-600 text-xs font-semibold w-full bg-neutral-50/50 text-neutral-900 appearance-none cursor-pointer"
                          >
                            <option value="Todas">Todas as categorias</option>
                            {categories.map(c => (
                              <option key={c.id} value={c.name}>{c.name}</option>
                            ))}
                          </select>
                          <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-neutral-400">
                            <ChevronDown size={14} />
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 justify-end">
                        {selectedProductIds.length > 0 && (
                          <button 
                            onClick={handleBulkDeleteProducts}
                            className="flex items-center justify-center gap-1.5 rounded-xl bg-red-600 px-3 py-2 text-xs font-bold text-white hover:bg-red-700 transition shadow-xs cursor-pointer"
                          >
                            <Trash2 size={14} /> <span>Excluir ({selectedProductIds.length})</span>
                          </button>
                        )}
                        <button 
                          onClick={() => { handleCancelProduct(); setIsAddingProduct(true); }}
                          className="flex items-center justify-center gap-1.5 rounded-xl bg-orange-600 px-4 py-2 text-xs font-extrabold text-white hover:bg-orange-700 active:scale-95 transition shadow-xs cursor-pointer shrink-0"
                        >
                          <Plus size={15} /> <span>Novo Produto</span>
                        </button>
                      </div>
                    </div>

                    {/* Conteúdo: Tabela no Desktop / Cards no Mobile */}
                    {filteredProducts.length === 0 ? (
                      <div className="p-8 text-center text-xs font-semibold text-neutral-400 bg-white rounded-2xl border border-neutral-200 shadow-xs">
                        {products.length === 0 ? "Nenhum produto cadastrado ainda." : "Nenhum produto encontrado para os filtros selecionados."}
                      </div>
                    ) : (
                      <>
                        {/* Lista Mobile (Cards Compactos) */}
                        <div className="block md:hidden space-y-2.5">
                          {filteredProducts.map((prod) => {
                            const isChecked = selectedProductIds.includes(prod.id);
                            return (
                              <div 
                                key={prod.id} 
                                className={`bg-white border rounded-2xl p-3 shadow-2xs space-y-2.5 transition ${
                                  isChecked ? 'border-orange-300 bg-orange-50/20' : 'border-neutral-200'
                                }`}
                              >
                                <div className="flex items-start gap-2.5">
                                  <input
                                    type="checkbox"
                                    className="mt-1 rounded border-neutral-300 text-orange-600 focus:ring-orange-600 h-4 w-4 cursor-pointer"
                                    checked={isChecked}
                                    onChange={() => {
                                      if (isChecked) {
                                        setSelectedProductIds(prev => prev.filter(id => id !== prod.id));
                                      } else {
                                        setSelectedProductIds(prev => [...prev, prod.id]);
                                      }
                                    }}
                                  />
                                  <img src={prod.imageUrl} alt={prod.name} className="h-12 w-12 shrink-0 rounded-xl object-cover bg-neutral-100 border border-neutral-200/60" />
                                  <div className="flex-1 min-w-0">
                                    <div className="flex items-center justify-between gap-2">
                                      <span className="font-bold text-neutral-900 text-xs truncate">{prod.name}</span>
                                      <span className="font-mono font-black text-xs text-orange-600 shrink-0">R$ {prod.price.toFixed(2)}</span>
                                    </div>

                                    <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                                      <span className="px-2 py-0.5 rounded-md bg-neutral-100 text-neutral-600 text-[10px] font-bold">
                                        {prod.category}
                                      </span>
                                      {prod.isOutOfStock ? (
                                        <span className="px-1.5 py-0.5 rounded bg-red-100 text-red-700 text-[9px] font-extrabold uppercase">
                                          Esgotado
                                        </span>
                                      ) : prod.stock !== undefined && prod.stock !== null ? (
                                        <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold ${
                                          prod.stock <= 5 ? "bg-red-100 text-red-700 font-black animate-pulse" : "bg-emerald-50 text-emerald-700"
                                        }`}>
                                          Estoque: {prod.stock} un
                                        </span>
                                      ) : (
                                        <span className="text-[10px] text-neutral-400 italic">Estoque Ilimitado</span>
                                      )}
                                    </div>
                                  </div>
                                </div>

                                {/* Ações e Botão de Repor no Card Mobile */}
                                <div className="pt-2 border-t border-neutral-100 flex items-center justify-between gap-2">
                                  <div className="flex items-center gap-1">
                                    <button 
                                      type="button"
                                      onClick={() => {
                                        if (selectedRestockProdId === prod.id) {
                                          setSelectedRestockProdId(null);
                                          setRestockValue("");
                                        } else {
                                          setSelectedRestockProdId(prod.id);
                                          setRestockValue("");
                                        }
                                      }}
                                      className={`px-2 py-1 rounded-lg text-[10px] font-bold transition flex items-center gap-1 border ${
                                        selectedRestockProdId === prod.id 
                                          ? "bg-orange-50 text-orange-600 border-orange-200" 
                                          : "bg-neutral-50 text-neutral-700 border-neutral-200 hover:bg-orange-50 hover:text-orange-600"
                                      }`}
                                    >
                                      <Plus size={12} />
                                      <span>Repor Estoque</span>
                                    </button>
                                  </div>

                                  <div className="flex items-center gap-1">
                                    <button 
                                      onClick={() => handleMoveProductOrder(prod.id, 'up')} 
                                      className="p-1.5 text-neutral-400 hover:text-orange-600 hover:bg-neutral-100 rounded-lg transition"
                                      title="Mover para Cima"
                                    >
                                      <ArrowUp size={14} />
                                    </button>
                                    <button 
                                      onClick={() => handleMoveProductOrder(prod.id, 'down')} 
                                      className="p-1.5 text-neutral-400 hover:text-orange-600 hover:bg-neutral-100 rounded-lg transition"
                                      title="Mover para Baixo"
                                    >
                                      <ArrowDown size={14} />
                                    </button>
                                    <button 
                                      onClick={() => handleStartEditProduct(prod)} 
                                      className="p-1.5 text-neutral-500 hover:text-orange-600 hover:bg-orange-50 rounded-lg transition"
                                      title="Editar Produto"
                                    >
                                      <Pencil size={14} />
                                    </button>
                                    <button 
                                      onClick={() => handleDeleteProduct(prod.id)} 
                                      className="p-1.5 text-neutral-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition"
                                      title="Excluir Produto"
                                    >
                                      <Trash2 size={14} />
                                    </button>
                                  </div>
                                </div>

                                {/* Widget Repor Estoque Mobile */}
                                {selectedRestockProdId === prod.id && (
                                  <div className="p-2.5 bg-amber-50/80 border border-amber-200 rounded-xl space-y-2 text-xs shadow-2xs animate-in fade-in duration-200">
                                    <div className="text-neutral-700 text-[11px] font-mono flex items-center justify-between">
                                      <span>Atual: <b>{prod.stock || 0}</b></span>
                                      <span>Novo Total: <b className="text-emerald-700">{(prod.stock || 0) + (parseInt(restockValue, 10) || 0)} un</b></span>
                                    </div>
                                    <div className="flex gap-1.5 items-center">
                                      <input 
                                        type="number"
                                        value={restockValue}
                                        onChange={(e) => setRestockValue(e.target.value)}
                                        placeholder="+ Adicionar qtd"
                                        className="flex-1 px-2 py-1 text-xs border border-neutral-300 rounded-lg font-mono focus:ring-1 focus:ring-orange-500 outline-none text-neutral-800 bg-white"
                                        onKeyDown={async (e) => {
                                          if (e.key === 'Enter') {
                                            await handleSaveRestock(prod);
                                          }
                                        }}
                                        autoFocus
                                      />
                                      <button
                                        type="button"
                                        onClick={() => handleSaveRestock(prod)}
                                        className="px-3 py-1 bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold rounded-lg text-xs transition"
                                      >
                                        Salvar
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => { setSelectedRestockProdId(null); setRestockValue(""); }}
                                        className="p-1 text-neutral-400 hover:text-neutral-700"
                                      >
                                        <X size={14} />
                                      </button>
                                    </div>
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>

                        {/* Tabela Desktop Compacta */}
                        <div className="hidden md:block overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-xs">
                          <table className="min-w-full divide-y divide-neutral-200 text-xs text-left">
                            <thead className="bg-neutral-50/80 text-neutral-500 font-extrabold text-[10px] uppercase tracking-wider">
                              <tr>
                                <th className="px-3 py-3 w-8">
                                  <input
                                    type="checkbox"
                                    className="rounded border-neutral-300 text-orange-600 focus:ring-orange-600 h-3.5 w-3.5 cursor-pointer"
                                    checked={filteredProducts.length > 0 && filteredProducts.every(p => selectedProductIds.includes(p.id))}
                                    onChange={(e) => {
                                      if (e.target.checked) {
                                        const allFilteredIds = filteredProducts.map(p => p.id);
                                        setSelectedProductIds(prev => Array.from(new Set([...prev, ...allFilteredIds])));
                                      } else {
                                        const filteredIdsSet = new Set(filteredProducts.map(p => p.id));
                                        setSelectedProductIds(prev => prev.filter(id => !filteredIdsSet.has(id)));
                                      }
                                    }}
                                  />
                                </th>
                                <th className="px-3 py-3">Produto</th>
                                <th className="px-3 py-3">Categoria</th>
                                <th className="px-3 py-3">Preço</th>
                                <th className="px-3 py-3">Estoque</th>
                                <th className="px-3 py-3 text-right">Ações</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-neutral-150">
                              {filteredProducts.map((prod) => {
                                const isChecked = selectedProductIds.includes(prod.id);
                                return (
                                  <tr key={prod.id} className={`hover:bg-orange-50/20 transition-colors ${isChecked ? 'bg-orange-50/10' : ''}`}>
                                    <td className="px-3 py-2.5 w-8">
                                      <input
                                        type="checkbox"
                                        className="rounded border-neutral-300 text-orange-600 focus:ring-orange-600 h-3.5 w-3.5 cursor-pointer"
                                        checked={isChecked}
                                        onChange={() => {
                                          if (isChecked) {
                                            setSelectedProductIds(prev => prev.filter(id => id !== prod.id));
                                          } else {
                                            setSelectedProductIds(prev => [...prev, prod.id]);
                                          }
                                        }}
                                      />
                                    </td>
                                    <td className="px-3 py-2.5">
                                      <div className="flex items-center gap-3">
                                        <img src={prod.imageUrl} alt={prod.name} className="h-9 w-9 shrink-0 rounded-lg object-cover bg-neutral-100 border border-neutral-200/60" />
                                        <div>
                                          <div className="flex items-center gap-1.5 flex-wrap">
                                            <span className="font-bold text-neutral-900 text-xs block">{prod.name}</span>
                                            {isNewProduct(prod) && (
                                              <span className="inline-flex items-center rounded bg-emerald-100 border border-emerald-300 px-1.5 py-0.5 text-[9px] font-black uppercase text-emerald-800">
                                                ✨ Novo
                                              </span>
                                            )}
                                            {prod.isOutOfStock && (
                                              <span className="inline-flex items-center rounded bg-red-100 px-1.5 py-0.5 text-[9px] font-black uppercase text-red-700">
                                                Esgotado
                                              </span>
                                            )}
                                          </div>
                                          <div className="mt-0.5 flex flex-wrap gap-1 items-center">
                                            {prod.addons && prod.addons.length > 0 && (
                                              <span className="text-[10px] text-orange-600 font-semibold bg-orange-50 px-1.5 py-0.5 rounded">
                                                +{prod.addons.length} Adicionais
                                              </span>
                                            )}
                                            {prod.complements && prod.complements.length > 0 && (
                                              <span className="text-[10px] text-neutral-600 font-semibold bg-neutral-100 px-1.5 py-0.5 rounded">
                                                +{prod.complements.length} Complements
                                              </span>
                                            )}
                                          </div>
                                        </div>
                                      </div>
                                    </td>
                                    <td className="px-3 py-2.5 text-neutral-600 font-medium">{prod.category}</td>
                                    <td className="px-3 py-2.5 font-mono font-bold text-neutral-900">R$ {prod.price.toFixed(2)}</td>
                                    <td className="px-3 py-2.5">
                                      <div className="flex items-center gap-1.5">
                                        {prod.stock !== undefined && prod.stock !== null ? (
                                          <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-bold ${
                                            prod.stock <= 5 ? "bg-red-100 text-red-800 animate-pulse" : "bg-emerald-50 text-emerald-700"
                                          }`}>
                                            {prod.stock} un
                                          </span>
                                        ) : (
                                          <span className="text-[11px] text-neutral-400 italic">Ilimitado</span>
                                        )}
                                        
                                        <button 
                                          type="button"
                                          onClick={() => {
                                            if (selectedRestockProdId === prod.id) {
                                              setSelectedRestockProdId(null);
                                              setRestockValue("");
                                            } else {
                                              setSelectedRestockProdId(prod.id);
                                              setRestockValue("");
                                            }
                                          }}
                                          className={`p-1 rounded-lg transition border ${
                                            selectedRestockProdId === prod.id 
                                              ? "text-orange-600 bg-orange-50 border-orange-200" 
                                              : "text-neutral-400 hover:text-orange-600 hover:bg-orange-50 border-transparent"
                                          }`}
                                          title="Repor Estoque"
                                        >
                                          <Plus size={13} className="stroke-[2.5]" />
                                        </button>
                                      </div>

                                      {/* Widget Repor Desktop */}
                                      {selectedRestockProdId === prod.id && (
                                        <div className="mt-1.5 p-2 bg-amber-50/90 border border-amber-200 rounded-xl space-y-1 text-xs shadow-2xs max-w-[170px]">
                                          <div className="text-neutral-700 text-[10px] font-mono">
                                            Total: <b className="text-emerald-700">{(prod.stock || 0) + (parseInt(restockValue, 10) || 0)} un</b>
                                          </div>
                                          <div className="flex gap-1 items-center">
                                            <input 
                                              type="number"
                                              value={restockValue}
                                              onChange={(e) => setRestockValue(e.target.value)}
                                              placeholder="+ Qtd"
                                              className="w-16 px-1.5 py-0.5 text-xs border border-neutral-300 rounded-md font-mono outline-none text-neutral-800 bg-white"
                                              onKeyDown={async (e) => {
                                                if (e.key === 'Enter') {
                                                  await handleSaveRestock(prod);
                                                }
                                              }}
                                              autoFocus
                                            />
                                            <button
                                              type="button"
                                              onClick={() => handleSaveRestock(prod)}
                                              className="p-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-md transition"
                                            >
                                              <Check size={12} className="stroke-[3]" />
                                            </button>
                                            <button
                                              type="button"
                                              onClick={() => { setSelectedRestockProdId(null); setRestockValue(""); }}
                                              className="p-1 bg-neutral-200 text-neutral-600 rounded-md transition"
                                            >
                                              <X size={12} className="stroke-[3]" />
                                            </button>
                                          </div>
                                        </div>
                                      )}
                                    </td>
                                    <td className="px-3 py-2.5 text-right">
                                      <div className="flex justify-end items-center gap-1">
                                        <button 
                                          onClick={() => handleMoveProductOrder(prod.id, 'up')} 
                                          className="p-1.5 text-neutral-400 hover:text-orange-600 hover:bg-orange-50 rounded-md transition"
                                          title="Mover para Cima"
                                        >
                                          <ArrowUp size={14} />
                                        </button>
                                        <button 
                                          onClick={() => handleMoveProductOrder(prod.id, 'down')} 
                                          className="p-1.5 text-neutral-400 hover:text-orange-600 hover:bg-orange-50 rounded-md transition"
                                          title="Mover para Baixo"
                                        >
                                          <ArrowDown size={14} />
                                        </button>
                                        <button 
                                          onClick={() => handleStartEditProduct(prod)} 
                                          className="p-1.5 text-neutral-500 hover:text-orange-600 hover:bg-orange-50 rounded-md transition"
                                          title="Editar Produto"
                                        >
                                          <Pencil size={14} />
                                        </button>
                                        <button 
                                          onClick={() => handleDeleteProduct(prod.id)} 
                                          className="p-1.5 text-neutral-400 hover:text-red-600 hover:bg-red-50 rounded-md transition"
                                          title="Excluir Produto"
                                        >
                                          <Trash2 size={14} />
                                        </button>
                                      </div>
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      </>
                    )}
                  </>
                ) : (
                  <div className="rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm max-w-2xl">
                    <h2 className="text-lg font-semibold mb-6 text-neutral-900">
                      {editingProduct ? "Editar Produto" : "Novo Produto"}
                    </h2>
                    <div className="space-y-4">
                      <div>
                        <label className="block text-sm font-semibold text-neutral-800 mb-1">Foto do Produto</label>
                        <p className="text-[11px] text-neutral-500 mb-2">Envie uma foto ou insira um link correspondente.</p>
                        
                        <div 
                          className={`border-2 border-dashed rounded-xl p-4 flex flex-col items-center justify-center transition-all ${
                            dragActive ? "border-orange-500 bg-orange-50/50" : "border-neutral-300 bg-neutral-50 hover:bg-neutral-100/50"
                          }`}
                          onDragEnter={(e) => { e.preventDefault(); setDragActive(true); }}
                          onDragLeave={(e) => { e.preventDefault(); setDragActive(false); }}
                          onDragOver={(e) => { e.preventDefault(); }}
                          onDrop={(e) => {
                            e.preventDefault();
                            setDragActive(false);
                            if (e.dataTransfer.files && e.dataTransfer.files[0]) {
                              handleImageUpload(e.dataTransfer.files[0]);
                            }
                          }}
                        >
                          {prodForm.imageUrl ? (
                            <div className="flex flex-col items-center gap-3 w-full text-center">
                              <img 
                                src={prodForm.imageUrl} 
                                alt="Visualização" 
                                className="w-24 h-24 object-cover rounded-xl shadow-inner border border-neutral-250"
                              />
                              <div className="text-xs">
                                <span className="font-bold text-neutral-900 block truncate max-w-xs">{prodForm.imageUrl.split('/').pop()}</span>
                                <span className="text-green-600 font-medium block mt-0.5 text-[11px]">
                                  Salvo em: <code className="bg-neutral-100 rounded px-1.5 py-0.5 text-[10px] font-mono font-bold">img/{restaurant?.name ? restaurant.name.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-zA-Z0-9\s-_]/g, "").trim().replace(/\s+/g, "_") : "default"}</code>
                                </span>
                              </div>
                              <button 
                                type="button" 
                                onClick={() => setProdForm({ ...prodForm, imageUrl: "" })}
                                className="text-xs font-bold text-red-600 hover:text-red-700 bg-red-50 hover:bg-red-100/80 px-2.5 py-1 rounded-lg transition"
                              >
                                Remover Imagem
                              </button>
                            </div>
                          ) : (
                            <div className="flex flex-col items-center justify-center text-center gap-2 py-2">
                              {isUploading ? (
                                <div className="flex flex-col items-center gap-2">
                                  <div className="h-6 w-6 animate-spin rounded-full border-2 border-orange-500 border-t-transparent"></div>
                                  <span className="text-xs font-bold text-neutral-600">Processando e salvando imagem...</span>
                                </div>
                              ) : (
                                <>
                                  <span className="text-xs font-semibold text-neutral-600">Arraste e solte uma imagem aqui</span>
                                  <span className="text-[10px] text-neutral-400">ou</span>
                                  <label className="px-3 py-1.5 bg-orange-600 hover:bg-orange-700 text-white text-xs font-bold rounded-lg cursor-pointer transition shadow-sm active:scale-[0.98]">
                                    Selecionar do Aparelho
                                    <input 
                                      type="file" 
                                      accept="image/*" 
                                      className="hidden" 
                                      onChange={(e) => {
                                        if (e.target.files && e.target.files[0]) {
                                          handleImageUpload(e.target.files[0]);
                                        }
                                      }}
                                    />
                                  </label>
                                  <span className="text-[9px] text-neutral-400 mt-1">Armazenamento na pasta de: <strong className="text-neutral-600">{restaurant?.name || "Restaurante"}</strong></span>
                                </>
                              )}
                            </div>
                          )}
                        </div>

                        {uploadError && (
                          <p className="text-xs text-red-600 font-semibold mt-1">{uploadError}</p>
                        )}

                        <div className="mt-2.5">
                          <label className="block text-[10px] font-bold uppercase tracking-wider text-neutral-500 mb-1">Ou se preferir, insira uma URL manual</label>
                          <input 
                            type="text" 
                            value={prodForm.imageUrl} 
                            onChange={e => setProdForm({...prodForm, imageUrl: e.target.value})} 
                            placeholder="https://..." 
                            className="w-full rounded-lg ring-1 ring-inset ring-neutral-300 px-3 py-2 text-xs focus:ring-2 focus:ring-orange-600 outline-none" 
                          />
                        </div>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-neutral-700 mb-1">Nome do produto</label>
                        <input type="text" value={prodForm.name} onChange={e => setProdForm({...prodForm, name: e.target.value})} className="w-full rounded-lg ring-1 ring-inset ring-neutral-300 px-3 py-2 text-sm focus:ring-2 focus:ring-orange-600 outline-none" />
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="block text-sm font-medium text-neutral-700 mb-1">Preço (R$)</label>
                          <input type="number" step="0.01" value={prodForm.price} onChange={e => setProdForm({...prodForm, price: e.target.value})} className="w-full rounded-lg ring-1 ring-inset ring-neutral-300 px-3 py-2 text-sm focus:ring-2 focus:ring-orange-600 outline-none" />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-neutral-700 mb-1">Categoria</label>
                          <div className="relative">
                            <select value={prodForm.category} onChange={e => setProdForm({...prodForm, category: e.target.value})} className="w-full appearance-none rounded-lg ring-1 ring-inset ring-neutral-300 px-3 py-2 text-sm focus:ring-2 focus:ring-orange-600 outline-none bg-white">
                              <option value="" disabled>Selecione...</option>
                              {categories.map(c => (
                                <option key={c.id} value={c.name}>{c.name}</option>
                              ))}
                            </select>
                            <ChevronDown size={16} className="absolute right-3 top-2.5 pointer-events-none text-neutral-500" />
                          </div>
                        </div>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-neutral-700 mb-1">Descrição</label>
                        <textarea rows={3} value={prodForm.description} onChange={e => setProdForm({...prodForm, description: e.target.value})} className="w-full rounded-lg ring-1 ring-inset ring-neutral-300 px-3 py-2 text-sm focus:ring-2 focus:ring-orange-600 outline-none resize-none"></textarea>
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-neutral-700 mb-1">Quantidade em Estoque (Opcional)</label>
                        <input
                          type="number"
                          min="0"
                          placeholder="Ex: 50 (Deixe em branco para estoque ilimitado)"
                          value={prodForm.stock}
                          onChange={e => setProdForm({ ...prodForm, stock: e.target.value })}
                          className="w-full rounded-lg ring-1 ring-inset ring-neutral-300 px-3 py-2 text-sm focus:ring-2 focus:ring-orange-600 outline-none"
                        />
                        <p className="text-[11px] text-neutral-400 mt-1">Ativa a baixa automática de estoque nas vendas. Quando chegar a zero, o produto é marcado automaticamente como esgotado do cardápio digital.</p>
                      </div>

                      <div>
                        <label className="block text-sm font-semibold text-neutral-800 mb-1">Dias Disponíveis</label>
                        <p className="text-[11px] text-neutral-500 mb-2.5">Marque os dias da semana em que este produto estará ativo/disponível no cardápio público. Se nenhum for marcado, ele ficará disponível todos os dias.</p>
                        <div className="flex flex-wrap gap-1.5">
                          {[
                            { id: "Seg", label: "Segunda" },
                            { id: "Ter", label: "Terça" },
                            { id: "Qua", label: "Quarta" },
                            { id: "Qui", label: "Quinta" },
                            { id: "Sex", label: "Sexta" },
                            { id: "Sáb", label: "Sábado" },
                            { id: "Dom", label: "Domingo" }
                          ].map((day) => {
                            const isSelected = prodForm.availableDays?.includes(day.id);
                            return (
                              <button
                                key={day.id}
                                type="button"
                                onClick={() => {
                                  const currentDays = prodForm.availableDays || [];
                                  let newDays;
                                  if (currentDays.includes(day.id)) {
                                    newDays = currentDays.filter(d => d !== day.id);
                                  } else {
                                    newDays = [...currentDays, day.id];
                                  }
                                  setProdForm(prev => ({ ...prev, availableDays: newDays }));
                                }}
                                className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition cursor-pointer select-none ${
                                  isSelected 
                                    ? "bg-orange-600 text-white border-orange-600 shadow-sm" 
                                    : "bg-neutral-50 hover:bg-neutral-100 text-neutral-700 border-neutral-200"
                                }`}
                              >
                                {day.label}
                              </button>
                            );
                          })}
                        </div>
                      </div>

                      <div className="flex items-center justify-between rounded-xl border border-neutral-200 bg-neutral-50 px-4 py-3">
                        <div>
                          <span className="text-sm font-semibold text-neutral-800 block">Marcar como Esgotado</span>
                          <span className="text-[11px] text-neutral-500 block">Inativa temporariamente o produto no cardápio de forma que clientes não consigam comprar.</span>
                        </div>
                        <label className="relative inline-flex items-center cursor-pointer select-none">
                          <input 
                            type="checkbox" 
                            checked={prodForm.isOutOfStock || false} 
                            onChange={e => setProdForm({...prodForm, isOutOfStock: e.target.checked})}
                            className="sr-only peer" 
                          />
                          <div className="w-11 h-6 bg-neutral-350 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-neutral-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-red-600"></div>
                        </label>
                      </div>

                      {/* Seção de Sabores, Adicionais e Complementos Separados */}
                      <div className="border-t border-neutral-100 pt-4 mt-2 space-y-6">
                        {/* 1. SABORES */}
                        {appearanceForm.genre !== "Espetinho" && appearanceForm.genre !== "Marmitaria" && (
                          <div>
                            <div className="flex items-center justify-between gap-2 mb-1">
                              <label className="text-sm font-semibold text-neutral-800">
                                1. {appearanceForm.genre === "Açaí" ? "Cremes / Sabores" : appearanceForm.genre === "Macarrões" ? "Tipos de Massa" : appearanceForm.genre === "Pastelaria" ? "Sabores / Recheios" : (prodForm.category && (prodForm.category.toLowerCase().includes("bebida") || prodForm.category.toLowerCase().includes("vitamina") || prodForm.category.toLowerCase().includes("drink") || prodForm.category.toLowerCase().includes("suco") || prodForm.category.toLowerCase().includes("cerveja") || prodForm.category.toLowerCase().includes("refrigerante") || prodForm.category.toLowerCase().includes("shake"))) ? "Sabores da Bebida / Vitamina" : "Sabores (Grátis / Opcional)"}
                              </label>
                              <div className="flex items-center gap-1.5 shrink-0 bg-neutral-100 px-2 py-1 rounded-lg border border-neutral-200/60">
                                <span className="text-[11px] font-bold text-neutral-700 whitespace-nowrap">Máx. seleções:</span>
                                <input
                                  type="number"
                                  min="1"
                                  placeholder="Ilimitado"
                                  value={prodForm.maxFlavors}
                                  onChange={e => setProdForm({ ...prodForm, maxFlavors: e.target.value })}
                                  className="w-16 bg-white rounded border border-neutral-300 px-1.5 py-0.5 text-xs text-center font-bold text-neutral-800 outline-none focus:ring-1 focus:ring-orange-500"
                                />
                              </div>
                            </div>
                            <p className="text-[11px] text-neutral-500 mb-2.5">
                              {appearanceForm.genre === "Macarrões" ? "Ex: Espaguete, Penne, Talharim" : appearanceForm.genre === "Açaí" ? "Massa base. Ex: Açaí, Cupuaçu, Pitaya" : appearanceForm.genre === "Pastelaria" ? "Defina os sabores ou recheios disponíveis para este produto (ex: Queijo, Carne, Frango, Chocolate)." : (prodForm.category && (prodForm.category.toLowerCase().includes("bebida") || prodForm.category.toLowerCase().includes("drink") || prodForm.category.toLowerCase().includes("suco") || prodForm.category.toLowerCase().includes("cerveja") || prodForm.category.toLowerCase().includes("refrigerante"))) ? "Defina os sabores ou variações disponíveis para esta bebida (ex: Laranja, Maracujá, Limão, Coca-Cola, Guaraná)." : "Defina os sabores disponíveis para este produto (ex: Calabresa, Marguerita)."}
                            </p>
                            
                            <div className="flex gap-2 mb-3">
                              <input 
                                type="text" 
                                placeholder="Nome do item..." 
                                value={newFlavorName}
                                onChange={e => setNewFlavorName(e.target.value)}
                                className="flex-1 rounded-lg ring-1 ring-inset ring-neutral-300 px-3 py-2 text-sm focus:ring-2 focus:ring-orange-600 outline-none"
                              />
                              <button
                                type="button"
                                onClick={() => {
                                  if (!newFlavorName.trim()) return;
                                  setProdForm(prev => ({
                                    ...prev,
                                    flavors: [...(prev.flavors || []), { name: newFlavorName.trim() }]
                                  }));
                                  setNewFlavorName("");
                                }}
                                className="px-4 py-2 bg-neutral-900 text-white rounded-lg text-xs font-semibold hover:bg-neutral-800 transition shadow-sm whitespace-nowrap"
                              >
                                Adicionar
                              </button>
                            </div>

                            {prodForm.flavors && prodForm.flavors.length > 0 && (
                              <div className="bg-neutral-50 rounded-xl p-3 border border-neutral-200/50 divide-y divide-neutral-100 max-h-36 overflow-y-auto">
                                {prodForm.flavors.map((fl, idx) => (
                                  <div key={idx} className="flex justify-between items-center py-1.5 first:pt-0 last:pb-0 text-xs">
                                    <span className="font-semibold text-neutral-750">{fl.name}</span>
                                    <div className="flex items-center gap-3">
                                      <span className="font-semibold text-neutral-500 bg-neutral-100 px-2 py-0.5 rounded">
                                        {(() => { const c = (prodForm.category || "").toLowerCase(); const n = (prodForm.name || "").toLowerCase(); const isDrinkOrVit = c.includes("bebida") || c.includes("vitamina") || c.includes("suco") || c.includes("drink") || c.includes("cerveja") || c.includes("refrigerante") || c.includes("shake") || n.includes("bebida") || n.includes("vitamina") || n.includes("suco") || n.includes("drink") || n.includes("shake"); return (isDrinkOrVit && (Number(prodForm.price) || 0) > 0) ? "Sabor" : "Grátis"; })()}
                                      </span>
                                      <button
                                        type="button"
                                        onClick={() => {
                                          setProdForm(prev => ({
                                            ...prev,
                                            flavors: prev.flavors.filter((_, i) => i !== idx)
                                          }));
                                        }}
                                        className="text-red-500 hover:text-red-700 font-medium transition"
                                      >
                                        Remover
                                      </button>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        )}

                        {appearanceForm.genre === "Macarrões" && (
                          <div>
                            <div className="flex items-center justify-between gap-2 mb-1">
                              <label className="text-sm font-semibold text-neutral-800">
                                1.5 Molhos (Grátis / Opcionais)
                              </label>
                              <div className="flex items-center gap-1.5 shrink-0 bg-neutral-100 px-2 py-1 rounded-lg border border-neutral-200/60">
                                <span className="text-[11px] font-bold text-neutral-700 whitespace-nowrap">Máx. seleções:</span>
                                <input
                                  type="number"
                                  min="1"
                                  placeholder="Ilimitado"
                                  value={prodForm.maxSauces}
                                  onChange={e => setProdForm({ ...prodForm, maxSauces: e.target.value })}
                                  className="w-16 bg-white rounded border border-neutral-300 px-1.5 py-0.5 text-xs text-center font-bold text-neutral-800 outline-none focus:ring-1 focus:ring-orange-500"
                                />
                              </div>
                            </div>
                            <p className="text-[11px] text-neutral-500 mb-2.5">
                              Ex: Bolonhesa, Molho Branco, Quatro Queijos, Pesto.
                            </p>
                            
                            <div className="flex gap-2 mb-3">
                              <input 
                                type="text" 
                                placeholder="Nome do molho..." 
                                value={newSauceName}
                                onChange={e => setNewSauceName(e.target.value)}
                                className="flex-1 rounded-lg ring-1 ring-inset ring-neutral-300 px-3 py-2 text-sm focus:ring-2 focus:ring-orange-600 outline-none"
                              />
                              <button
                                type="button"
                                onClick={() => {
                                  if (!newSauceName.trim()) return;
                                  setProdForm(prev => ({
                                    ...prev,
                                    sauces: [...(prev.sauces || []), { name: newSauceName.trim() }]
                                  }));
                                  setNewSauceName("");
                                }}
                                className="px-4 py-2 bg-neutral-900 text-white rounded-lg text-xs font-semibold hover:bg-neutral-800 transition shadow-sm whitespace-nowrap"
                              >
                                Adicionar
                              </button>
                            </div>

                            {prodForm.sauces && prodForm.sauces.length > 0 && (
                              <div className="bg-neutral-50 rounded-xl p-3 border border-neutral-200/50 divide-y divide-neutral-100 max-h-36 overflow-y-auto">
                                {prodForm.sauces.map((sauce, idx) => (
                                  <div key={idx} className="flex justify-between items-center py-1.5 first:pt-0 last:pb-0 text-xs">
                                    <span className="font-semibold text-neutral-750">{sauce.name}</span>
                                    <div className="flex items-center gap-3">
                                      <span className="font-semibold text-neutral-500 bg-neutral-100 px-2 py-0.5 rounded">
                                        Grátis
                                      </span>
                                      <button
                                        type="button"
                                        onClick={() => {
                                          setProdForm(prev => ({
                                            ...prev,
                                            sauces: prev.sauces.filter((_, i) => i !== idx)
                                          }));
                                        }}
                                        className="text-red-500 hover:text-red-700 font-medium transition"
                                      >
                                        Remover
                                      </button>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        )}

                        {/* 2. ADICIONAIS PAGOS */}
                        <div>
                          <div className="flex items-center justify-between gap-2 mb-1">
                            <label className="text-sm font-semibold text-neutral-800">
                              {appearanceForm.genre === "Espetinho" || appearanceForm.genre === "Marmitaria" ? "1. " : "2. "}
                              {appearanceForm.genre === "Marmitaria" ? "Misturas / Acompanhamentos Pagos (Extras)" : appearanceForm.genre === "Açaí" ? "Adicionais Pagos (Extras)" : "Adicionais (Pagos / Extras)"}
                            </label>
                            <div className="flex items-center gap-1.5 shrink-0 bg-orange-50 px-2 py-1 rounded-lg border border-orange-200/60">
                              <span className="text-[11px] font-bold text-orange-900 whitespace-nowrap">Máx. seleções:</span>
                              <input
                                type="number"
                                min="1"
                                placeholder="Ilimitado"
                                value={prodForm.maxAddons}
                                onChange={e => setProdForm({ ...prodForm, maxAddons: e.target.value })}
                                className="w-16 bg-white rounded border border-orange-300 px-1.5 py-0.5 text-xs text-center font-bold text-neutral-800 outline-none focus:ring-1 focus:ring-orange-500"
                              />
                            </div>
                          </div>
                          <p className="text-[11px] text-neutral-500 mb-2.5">Defina itens extras pagos para este produto (ex: Queijo Extra por R$ 3,50, Porção Extra por R$ 8,00).</p>
                          
                          <div className="flex flex-col sm:flex-row gap-2 mb-3">
                            <input 
                              type="text" 
                              placeholder="Nome do adicional (ex: Hambúrguer Extra)" 
                              value={newAddonName}
                              onChange={e => setNewAddonName(e.target.value)}
                              className="flex-1 rounded-lg ring-1 ring-inset ring-neutral-300 px-3 py-2 text-sm focus:ring-2 focus:ring-orange-600 outline-none"
                            />
                            <div className="flex gap-2">
                              <input 
                                type="number" 
                                step="0.01"
                                placeholder="Preço R$ (ex: 3.00)" 
                                value={newAddonPrice}
                                onChange={e => setNewAddonPrice(e.target.value)}
                                className="w-28 rounded-lg ring-1 ring-inset ring-neutral-300 px-3 py-2 text-sm focus:ring-2 focus:ring-orange-600 outline-none"
                              />
                              <button
                                type="button"
                                onClick={() => {
                                  if (!newAddonName.trim()) return;
                                  const priceVal = parseFloat(newAddonPrice) || 0;
                                  setProdForm(prev => ({
                                    ...prev,
                                    addons: [...(prev.addons || []), { name: newAddonName.trim(), price: priceVal }]
                                  }));
                                  setNewAddonName("");
                                  setNewAddonPrice("");
                                }}
                                className="px-4 py-2 bg-orange-600 text-white rounded-lg text-xs font-semibold hover:bg-orange-700 transition shadow-sm whitespace-nowrap"
                              >
                                Adicionar
                              </button>
                            </div>
                          </div>

                          {prodForm.addons && prodForm.addons.length > 0 && (
                            <div className="bg-orange-50/20 rounded-xl p-3 border border-orange-100 divide-y divide-orange-105 max-h-36 overflow-y-auto">
                              {prodForm.addons.map((ad, idx) => (
                                <div key={idx} className="flex justify-between items-center py-1.5 first:pt-0 last:pb-0 text-xs">
                                  <span className="font-semibold text-neutral-750">{ad.name}</span>
                                  <div className="flex items-center gap-3">
                                    <span className="font-mono text-orange-600 font-bold bg-orange-50 px-2 py-0.5 rounded">
                                      + R$ {ad.price.toFixed(2)}
                                    </span>
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setProdForm(prev => ({
                                          ...prev,
                                          addons: prev.addons.filter((_, i) => i !== idx)
                                        }));
                                      }}
                                      className="text-red-500 hover:text-red-700 font-medium transition"
                                    >
                                      Remover
                                    </button>
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>

                        {/* 3. COMPLEMENTOS GRÁTIS */}
                        <div>
                          <div className="flex items-center justify-between gap-2 mb-1">
                            <label className="text-sm font-semibold text-neutral-800">
                              {appearanceForm.genre === "Espetinho" || appearanceForm.genre === "Marmitaria" ? "2. " : "3. "}
                              {appearanceForm.genre === "Marmitaria" ? "Acompanhamentos Grátis" : appearanceForm.genre === "Açaí" ? "Complementos Grátis" : "Complementos (Opções / Grátis)"}
                            </label>
                            <div className="flex items-center gap-1.5 shrink-0 bg-neutral-100 px-2 py-1 rounded-lg border border-neutral-200/60">
                              <span className="text-[11px] font-bold text-neutral-700 whitespace-nowrap">Máx. seleções:</span>
                              <input
                                type="number"
                                min="1"
                                placeholder="Ilimitado"
                                value={prodForm.maxComplements}
                                onChange={e => setProdForm({ ...prodForm, maxComplements: e.target.value })}
                                className="w-16 bg-white rounded border border-neutral-300 px-1.5 py-0.5 text-xs text-center font-bold text-neutral-800 outline-none focus:ring-1 focus:ring-orange-500"
                              />
                            </div>
                          </div>
                          <p className="text-[11px] text-neutral-500 mb-2.5">
                            {appearanceForm.genre === "Marmitaria" ? "Defina os acompanhamentos gratuitos da marmita (ex: Arroz, Feijão, Macarrão)." : "Defina opções de escolha ou observações grátis para este produto (ex: Sem Cebola, Bem Passado, Molho Especial)."}
                          </p>
                          
                          <div className="flex gap-2 mb-3">
                            <input 
                              type="text" 
                              placeholder="Nome do complemento (ex: Sem Maionese, Ponto da Carne: Ao Ponto)" 
                              value={newComplementName}
                              onChange={e => setNewComplementName(e.target.value)}
                              className="flex-1 rounded-lg ring-1 ring-inset ring-neutral-300 px-3 py-2 text-sm focus:ring-2 focus:ring-orange-600 outline-none"
                            />
                            <button
                              type="button"
                              onClick={() => {
                                if (!newComplementName.trim()) return;
                                setProdForm(prev => ({
                                  ...prev,
                                  complements: [...(prev.complements || []), { name: newComplementName.trim() }]
                                }));
                                setNewComplementName("");
                              }}
                              className="px-4 py-2 bg-neutral-900 text-white rounded-lg text-xs font-semibold hover:bg-neutral-800 transition shadow-sm whitespace-nowrap"
                            >
                              Adicionar
                            </button>
                          </div>

                          {prodForm.complements && prodForm.complements.length > 0 && (
                            <div className="bg-neutral-50 rounded-xl p-3 border border-neutral-200/50 divide-y divide-neutral-100 max-h-36 overflow-y-auto">
                              {prodForm.complements.map((cp, idx) => (
                                <div key={idx} className="flex justify-between items-center py-1.5 first:pt-0 last:pb-0 text-xs">
                                  <span className="font-semibold text-neutral-750">{cp.name}</span>
                                  <div className="flex items-center gap-3">
                                    <span className="font-semibold text-neutral-500 bg-neutral-100 px-2 py-0.5 rounded">
                                      Grátis
                                    </span>
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setProdForm(prev => ({
                                          ...prev,
                                          complements: prev.complements.filter((_, i) => i !== idx)
                                        }));
                                      }}
                                      className="text-red-500 hover:text-red-700 font-medium transition"
                                    >
                                      Remover
                                    </button>
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>

                      <div className="flex justify-end gap-3 pt-4">
                        <button 
                          onClick={handleCancelProduct} 
                          className="px-4 py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-100 rounded-lg transition pointer-events-auto"
                        >
                          Cancelar
                        </button>
                        <button 
                          onClick={handleSaveProduct} 
                          className="px-4 py-2 text-sm font-medium text-white bg-orange-600 hover:bg-orange-700 rounded-lg transition pointer-events-auto"
                        >
                          {editingProduct ? "Salvar Alterações" : "Salvar Produto"}
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* --- Categorias TAB --- */}
            {activeTab === "categories" && (
              <div className="space-y-6">
                <form 
                  onSubmit={(e) => {
                    e.preventDefault();
                    handleAddCategory();
                  }}
                  className="bg-neutral-50 border border-neutral-200 p-5 rounded-2xl flex flex-col gap-4 max-w-2xl"
                >
                  <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
                    <div className="flex-1 w-full">
                      <label className="block text-xs font-bold text-neutral-500 uppercase tracking-wider mb-1.5">Nome da Categoria</label>
                      <input 
                        type="text" 
                        value={newCatName}
                        onChange={e => {
                          setNewCatName(e.target.value);
                          if (categoryError) setCategoryError("");
                        }}
                        disabled={addingCategory}
                        placeholder="Ex: Hambúrgueres, Bebidas, Pizzas..." 
                        className="w-full rounded-lg border-neutral-300 ring-1 ring-inset ring-neutral-300 py-2.5 px-4 text-sm focus:ring-2 focus:ring-orange-600 outline-none bg-white disabled:bg-neutral-50 disabled:text-neutral-500 text-neutral-800"
                      />
                      {categoryError && (
                        <p className="text-xs text-red-600 mt-1.5 font-medium">{categoryError}</p>
                      )}
                    </div>
                    <button 
                      type="submit" 
                      disabled={addingCategory}
                      className="w-full sm:w-auto self-end flex items-center justify-center gap-2 rounded-lg bg-orange-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-orange-700 disabled:bg-neutral-400 transition shrink-0 h-[42px]"
                    >
                      {addingCategory ? (
                        <>
                          <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                          Adicionando...
                        </>
                      ) : (
                        <>
                          <Plus size={16} /> Adicionar Categoria
                        </>
                      )}
                    </button>
                  </div>

                  {/* Visibilidade no Cardápio */}
                  <div className="border-t border-neutral-200/60 pt-3 flex items-center justify-between">
                    <div>
                      <label className="block text-xs font-bold text-neutral-500 uppercase tracking-wider">Visibilidade no Cardápio</label>
                      <p className="text-[10px] text-neutral-500">Defina se esta categoria aparece no cardápio digital para os clientes.</p>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input 
                        type="checkbox" 
                        checked={newCatIsVisible}
                        onChange={e => setNewCatIsVisible(e.target.checked)}
                        className="sr-only peer"
                      />
                      <div className="w-11 h-6 bg-neutral-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-neutral-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-orange-600"></div>
                      <span className="ml-3 text-xs font-bold text-neutral-700">{newCatIsVisible ? "Visível" : "Invisível"}</span>
                    </label>
                  </div>

                  {/* Seleção de Dias da Semana */}
                  <div className="border-t border-neutral-200/60 pt-3">
                    <label className="block text-xs font-bold text-neutral-500 uppercase tracking-wider mb-2">Dias de Exibição (Semana)</label>
                    <p className="text-[10px] text-neutral-500 mb-2.5">Escolha os dias em que esta categoria (e seus produtos) irá aparecer no PDV e Cardápio de Pedidos. Se nenhum dia for selecionado, ela ficará visível <b>sempre</b>.</p>
                    <div className="flex flex-wrap gap-1.5">
                      {[
                        { id: "Seg", label: "Segunda" },
                        { id: "Ter", label: "Terça" },
                        { id: "Qua", label: "Quarta" },
                        { id: "Qui", label: "Quinta" },
                        { id: "Sex", label: "Sexta" },
                        { id: "Sáb", label: "Sábado" },
                        { id: "Dom", label: "Domingo" }
                      ].map((day) => {
                        const isSelected = newCatAvailableDays.includes(day.id);
                        return (
                          <button
                            key={day.id}
                            type="button"
                            onClick={() => {
                              if (isSelected) {
                                setNewCatAvailableDays(prev => prev.filter(d => d !== day.id));
                              } else {
                                setNewCatAvailableDays(prev => [...prev, day.id]);
                              }
                            }}
                            className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition cursor-pointer select-none ${
                              isSelected 
                                ? "bg-orange-600 border-orange-600 text-white shadow-sm" 
                                : "bg-white border-neutral-200 text-neutral-600 hover:bg-neutral-100 hover:border-neutral-300"
                            }`}
                          >
                            {day.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </form>

                {selectedCategoryIds.length > 0 && (
                  <div className="flex justify-between items-center bg-red-50 border border-red-200 rounded-xl p-4 max-w-2xl">
                    <span className="text-sm font-semibold text-red-800">
                      {selectedCategoryIds.length} {selectedCategoryIds.length === 1 ? 'categoria selecionada' : 'categorias selecionadas'}
                    </span>
                    <button
                      type="button"
                      onClick={handleBulkDeleteCategories}
                      className="flex items-center gap-2 rounded-lg bg-red-600 px-4 py-2 text-xs font-bold text-white hover:bg-red-700 transition"
                    >
                      <Trash2 size={14} /> Deletar selecionadas
                    </button>
                  </div>
                )}

                <div className="overflow-hidden rounded-xl border border-neutral-200 bg-white shadow-sm max-w-2xl">
                  {categories.length === 0 ? (
                     <div className="p-6 text-neutral-500 text-center">Nenhuma categoria cadastrada.</div>
                  ) : (
                    <>
                      <div className="flex items-center px-6 py-3 bg-neutral-50 border-b border-neutral-200">
                        <label className="flex items-center gap-3 cursor-pointer select-none">
                          <input
                            type="checkbox"
                            className="rounded border-neutral-300 text-orange-600 focus:ring-orange-600 h-4 w-4 cursor-pointer"
                            checked={categories.length > 0 && categories.every(c => selectedCategoryIds.includes(c.id))}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setSelectedCategoryIds(categories.map(c => c.id));
                              } else {
                                setSelectedCategoryIds([]);
                              }
                            }}
                          />
                          <span className="text-xs font-bold text-neutral-500 uppercase tracking-wider">Selecionar Tudo</span>
                        </label>
                      </div>
                      <ul className="divide-y divide-neutral-200">
                        {categories.map((cat, index) => {
                          const isEditing = editingCatId === cat.id;
                          const isChecked = selectedCategoryIds.includes(cat.id);
                          return (
                            <li key={cat.id} className={`flex justify-between items-center px-6 py-4 hover:bg-neutral-50 transition gap-4 ${isChecked ? 'bg-orange-50/10' : ''}`}>
                              <div className="flex items-center gap-3 flex-1">
                                {!isEditing && (
                                  <input
                                    type="checkbox"
                                    className="rounded border-neutral-300 text-orange-600 focus:ring-orange-600 h-4 w-4 cursor-pointer shrink-0"
                                    checked={isChecked}
                                    onChange={() => {
                                      if (isChecked) {
                                        setSelectedCategoryIds(prev => prev.filter(id => id !== cat.id));
                                      } else {
                                        setSelectedCategoryIds(prev => [...prev, cat.id]);
                                      }
                                    }}
                                  />
                                )}
                                {isEditing ? (
                                  <div className="flex-1 flex flex-col gap-2.5">
                                    <div className="flex gap-2 items-center">
                                      <input
                                        type="text"
                                        value={editingCatName}
                                        onChange={e => setEditingCatName(e.target.value)}
                                        className="flex-1 rounded-lg border-neutral-300 ring-1 ring-inset ring-neutral-300 py-1.5 px-3 text-sm focus:ring-2 focus:ring-orange-600 outline-none bg-white text-neutral-900 font-medium"
                                        placeholder="Novo nome da categoria"
                                        autoFocus
                                      />
                                      <button
                                        type="button"
                                        onClick={() => handleSaveEditCategory(cat.id)}
                                        className="p-2 bg-green-50 text-green-700 hover:bg-green-100 rounded-lg transition"
                                        title="Salvar"
                                      >
                                        <Check size={16} />
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => setEditingCatId(null)}
                                        className="p-2 bg-neutral-100 text-neutral-700 hover:bg-neutral-200 rounded-lg transition"
                                        title="Cancelar"
                                      >
                                        <X size={16} />
                                      </button>
                                    </div>
                                    
                                    {/* Editor de Dias da Semana para Edição */}
                                    <div className="flex flex-col gap-1 bg-neutral-50 p-2 rounded-lg border border-neutral-200">
                                      <span className="text-[10px] font-bold text-neutral-500 uppercase tracking-widest">Dias ativos (Semana)</span>
                                      <div className="flex flex-wrap gap-1">
                                        {[
                                          { id: "Seg", label: "Seg" },
                                          { id: "Ter", label: "Ter" },
                                          { id: "Qua", label: "Qua" },
                                          { id: "Qui", label: "Qui" },
                                          { id: "Sex", label: "Sex" },
                                          { id: "Sáb", label: "Sáb" },
                                          { id: "Dom", label: "Dom" }
                                        ].map(day => {
                                          const isSelected = editingCatAvailableDays.includes(day.id);
                                          return (
                                            <button
                                              type="button"
                                              key={day.id}
                                              onClick={() => {
                                                if (isSelected) {
                                                  setEditingCatAvailableDays(prev => prev.filter(d => d !== day.id));
                                                } else {
                                                  setEditingCatAvailableDays(prev => [...prev, day.id]);
                                                }
                                              }}
                                              className={`px-2 py-0.5 rounded text-[10px] font-bold border transition duration-150 cursor-pointer ${
                                                isSelected 
                                                  ? "bg-orange-600 border-orange-600 text-white" 
                                                  : "bg-white border-neutral-200 text-neutral-600 hover:bg-neutral-100"
                                              }`}
                                            >
                                              {day.id}
                                            </button>
                                          );
                                        })}
                                      </div>
                                    </div>
                                  </div>
                                ) : (
                                  <div className="flex flex-col gap-1">
                                    <span className="font-semibold text-neutral-900">{cat.name}</span>
                                    {/* Visualizadores dos Dias Ativos da Categoria */}
                                    <div className="flex items-center gap-1 flex-wrap">
                                      <span className="text-[9px] text-neutral-400 font-semibold mr-1">Dias:</span>
                                      {["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"].map(day => {
                                        const isAvailable = !cat.availableDays || cat.availableDays.length === 0 || cat.availableDays.includes(day);
                                        return (
                                          <span 
                                            key={day} 
                                            className={`text-[9px] font-extrabold px-1.5 py-0.5 rounded ${
                                              isAvailable 
                                                ? "bg-orange-100 text-orange-850" 
                                                : "bg-neutral-100 text-neutral-400 opacity-60 line-through"
                                            }`}
                                          >
                                            {day}
                                          </span>
                                        );
                                      })}
                                    </div>
                                  </div>
                                )}
                              </div>
                              {!isEditing && (
                                <div className="flex items-center gap-2 shrink-0">
                                  <button
                                    type="button"
                                    onClick={async () => {
                                      try {
                                        const current = cat.isVisible !== false;
                                        await updateDoc(doc(db, "categories", cat.id), {
                                          isVisible: !current
                                        });
                                      } catch (e) {
                                        console.error(e);
                                        alert("Erro ao alterar visibilidade.");
                                      }
                                    }}
                                    className={`px-2.5 py-1 text-xs font-bold rounded-lg transition ${cat.isVisible !== false ? 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100' : 'bg-neutral-100 text-neutral-600 hover:bg-neutral-200'}`}
                                    title={cat.isVisible !== false ? "Tornar Invisível" : "Tornar Visível"}
                                  >
                                    {cat.isVisible !== false ? "Desativar" : "Ativar"}
                                  </button>
                                  {/* Up/Down Sort orders */}
                                  <button
                                    type="button"
                                    onClick={() => handleMoveCategory(cat, index, "up")}
                                    disabled={index === 0 || addingCategory}
                                    className="p-2 text-neutral-400 hover:text-orange-600 disabled:opacity-30 disabled:hover:text-neutral-400 rounded-lg transition"
                                    title="Subir"
                                  >
                                    <ArrowUp size={16} />
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleMoveCategory(cat, index, "down")}
                                    disabled={index === categories.length - 1 || addingCategory}
                                    className="p-2 text-neutral-400 hover:text-orange-600 disabled:opacity-30 disabled:hover:text-neutral-400 rounded-lg transition"
                                    title="Descer"
                                  >
                                    <ArrowDown size={16} />
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleStartEditCategory(cat)}
                                    className="p-2 text-neutral-400 hover:text-orange-600 rounded-lg transition"
                                    title="Editar"
                                  >
                                    <Pencil size={16} />
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleDeleteCategory(cat.id)}
                                    className="p-2 text-neutral-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition"
                                    title="Excluir"
                                  >
                                    <Trash2 size={16} />
                                  </button>
                                </div>
                              )}
                            </li>
                          );
                        })}
                      </ul>
                    </>
                  )}
                </div>
              </div>
            )}

            {/* --- Promoções TAB --- */}
            {activeTab === "promotions" && (
              <div className="space-y-6">
                {/* Header da Seção */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div>
                    <h2 className="text-xl font-bold text-neutral-900 flex items-center gap-2">
                      <Gift className="text-orange-600" size={24} />
                      Central de Promoções
                    </h2>
                    <p className="text-neutral-500 text-sm mt-0.5">
                      Configure regras de Compre e Ganhe, descontos por produto ou monte combos com preços especiais para atrair mais clientes.
                    </p>
                  </div>
                  <button
                    onClick={handleOpenAddPromo}
                    className="flex items-center justify-center gap-2 rounded-xl bg-orange-600 hover:bg-orange-700 text-white px-5 py-2.5 font-semibold text-sm transition shrink-0 shadow-lg shadow-orange-600/10"
                  >
                    <Plus size={18} /> Criar Promoção
                  </button>
                </div>

                {/* Lista de Promoções */}
                {promotions.length === 0 ? (
                  <div className="bg-neutral-50 border border-neutral-200/80 rounded-2xl p-12 text-center max-w-2xl mx-auto mt-6">
                    <div className="w-14 h-14 bg-orange-50 text-orange-600 rounded-2xl flex items-center justify-center mx-auto mb-4">
                      <Gift size={28} />
                    </div>
                    <h3 className="font-bold text-neutral-800 text-lg">Nenhuma promoção ativa</h3>
                    <p className="text-neutral-500 text-sm mt-1 max-w-md mx-auto">
                      Crie promoções atraentes de "Compre e Ganhe", combos de produtos ou descontos diretos para incentivar seus clientes a fazerem pedidos maiores.
                    </p>
                    <button
                      onClick={handleOpenAddPromo}
                      className="mt-5 inline-flex items-center gap-2 rounded-lg bg-orange-600 hover:bg-orange-700 text-white px-4 py-2 text-sm font-semibold transition"
                    >
                      <Plus size={16} /> Cadastrar Primeira
                    </button>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-left">
                    {promotions.map((promo: any) => {
                      return (
                         <div
                           key={promo.id}
                           className="bg-white border border-neutral-200 rounded-2xl p-5 hover:shadow-md transition flex flex-col justify-between"
                         >
                           <div>
                             {/* Topo do Card */}
                             <div className="flex items-start justify-between gap-4 mb-3">
                               <h3 className="font-bold text-neutral-800 text-base leading-tight">
                                 {promo.name}
                               </h3>
                               {promo.type === "buy_x_get_y" && (
                                 <span className="shrink-0 inline-flex items-center gap-1 text-[11px] font-bold text-green-700 bg-green-50 border border-green-200 px-2 py-0.5 rounded-full">
                                   Compre & Ganhe
                                 </span>
                               )}
                               {promo.type === "discount" && (
                                 <span className="shrink-0 inline-flex items-center gap-1 text-[11px] font-bold text-blue-700 bg-blue-50 border border-blue-200 px-2 py-0.5 rounded-full">
                                   Desconto Direto
                                 </span>
                               )}
                               {promo.type === "combo" && (
                                 <span className="shrink-0 inline-flex items-center gap-1 text-[11px] font-bold text-purple-700 bg-purple-50 border border-purple-200 px-2 py-0.5 rounded-full">
                                   Combo Promocional
                                 </span>
                               )}
                             </div>

                             {/* Detalhes da Promoção */}
                             <div className="text-xs text-neutral-600 mb-5 space-y-1.5 bg-neutral-50 rounded-xl p-3 border border-neutral-100">
                               {promo.type === "buy_x_get_y" && (
                                 <>
                                   <div>
                                     <span className="font-bold text-neutral-500 uppercase tracking-wide text-[10px] block mb-0.5">Se comprar:</span>
                                     <span className="font-medium text-neutral-800">
                                       {promo.buyQty}x {products.find(p => p.id === promo.productId)?.name || "Produto excluído"}
                                     </span>
                                   </div>
                                   <div className="pt-1.5 border-t border-neutral-200/50">
                                     <span className="font-bold text-neutral-500 uppercase tracking-wide text-[10px] block mb-0.5">Leva de Brinde:</span>
                                     <span className="font-semibold text-green-600">
                                       {promo.giftQty}x {products.find(p => p.id === promo.giftProductId)?.name || "Produto excluído"}
                                     </span>
                                   </div>
                                 </>
                               )}

                               {promo.type === "discount" && (
                                 <>
                                   <div>
                                     <span className="font-bold text-neutral-500 uppercase tracking-wide text-[10px] block mb-0.5">Produto:</span>
                                     <span className="font-medium text-neutral-800">
                                       {products.find(p => p.id === promo.productId)?.name || "Produto excluído"}
                                     </span>
                                   </div>
                                   <div className="pt-1.5 border-t border-neutral-200/50 flex items-center justify-between">
                                     <span className="font-bold text-neutral-500 uppercase tracking-wide text-[10px]">Desconto Aplicado:</span>
                                     <span className="font-bold text-orange-600 text-sm">
                                       {promo.discountType === "percentage"
                                         ? `${promo.discountValue}% OFF`
                                         : `R$ ${Number(promo.discountValue).toFixed(2)} de desconto`}
                                     </span>
                                   </div>
                                 </>
                               )}

                               {promo.type === "combo" && (
                                 <>
                                   <div>
                                     <span className="font-bold text-neutral-500 uppercase tracking-wide text-[10px] block mb-0.5">Produtos inclusos:</span>
                                     <div className="flex flex-wrap gap-1 mt-1">
                                       {(promo.productIds || []).map((id: string) => {
                                         const prod = products.find(p => p.id === id);
                                         return prod ? (
                                           <span key={id} className="inline-block bg-neutral-200/80 text-neutral-700 px-2 py-0.5 rounded text-[11px] font-medium">
                                             {prod.name}
                                           </span>
                                         ) : null;
                                       })}
                                     </div>
                                   </div>
                                   <div className="pt-1.5 border-t border-neutral-200/50 flex items-center justify-between text-left">
                                     <span className="font-bold text-neutral-500 uppercase tracking-wide text-[10px]">Preço do Combo:</span>
                                     <span className="font-bold text-purple-600 text-sm">
                                       R$ {Number(promo.comboPrice).toFixed(2)}
                                     </span>
                                   </div>
                                 </>
                               )}
                             </div>
                           </div>

                           {/* Rodapé do Card (Toggles + Ações) */}
                           <div className="flex items-center justify-between border-t border-neutral-100 pt-3 mt-1">
                             {/* Alternar Ativo */}
                             <button
                               onClick={() => handleTogglePromotionActive(promo)}
                               className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border transition ${
                                 promo.isActive
                                   ? "bg-green-50 border-green-200 text-green-700"
                                   : "bg-neutral-50 border-neutral-200 text-neutral-500"
                               }`}
                             >
                               <span className={`w-2 h-2 rounded-full ${promo.isActive ? "bg-green-500" : "bg-neutral-450"}`}></span>
                               {promo.isActive ? "Ativa" : "Inativa"}
                             </button>

                             {/* Botões de Ação */}
                             <div className="flex items-center gap-1">
                               <button
                                 onClick={() => handleOpenEditPromo(promo)}
                                 className="p-2 text-neutral-500 hover:text-orange-600 hover:bg-orange-50 rounded-lg transition"
                                 title="Editar"
                               >
                                 <Pencil size={16} />
                               </button>
                               <button
                                 onClick={() => handleDeletePromotion(promo.id, promo.name)}
                                 className="p-2 text-neutral-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition"
                                 title="Excluir"
                               >
                                 <Trash2 size={16} />
                               </button>
                             </div>
                           </div>
                         </div>
                      );
                    })}
                  </div>
                )}

                {/* Modal overlay de Criar/Editar Promoção */}
                {isPromotionModalOpen && (
                  <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 overflow-y-auto">
                    <div className="bg-white rounded-3xl w-full max-w-lg shadow-2xl relative my-8 overflow-hidden text-left bg-solid">
                      {/* Cabecalho Modal */}
                      <div className="flex items-center justify-between px-6 py-4 border-b border-neutral-150">
                        <h3 className="font-bold text-lg text-neutral-900 flex items-center gap-2">
                          <Gift size={20} className="text-orange-600" />
                          {editingPromotion ? "Editar Promoção" : "Nova Promoção"}
                        </h3>
                        <button
                          onClick={() => setIsPromotionModalOpen(false)}
                          className="p-2 text-neutral-400 hover:text-neutral-600 hover:bg-neutral-100 rounded-lg transition"
                        >
                          <X size={18} />
                        </button>
                      </div>

                      {/* Corpo Modal */}
                      <div className="p-6 space-y-4 max-h-[60vh] overflow-y-auto">
                        {promotionError && (
                          <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl p-3 text-xs font-semibold flex items-center gap-2">
                            <AlertCircle size={16} className="shrink-0" />
                            {promotionError}
                          </div>
                        )}

                        {/* Nome da Promo */}
                        <div>
                          <label className="block text-xs font-bold text-neutral-500 uppercase tracking-wider mb-1">
                            Nome da Promoção
                          </label>
                          <input
                            type="text"
                            value={promoForm.name}
                            onChange={e => setPromoForm(prev => ({ ...prev, name: e.target.value }))}
                            placeholder="Ex: Quinta do Burger Pró, Compre Burguer Ganhe Refri..."
                            className="w-full rounded-xl border border-neutral-200 py-2.5 px-4 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-orange-600 text-neutral-800"
                          />
                        </div>

                        {/* Tipo de Promoção */}
                        <div>
                          <label className="block text-xs font-bold text-neutral-500 uppercase tracking-wider mb-1.5">
                            Tipo de Regra
                          </label>
                          <div className="grid grid-cols-3 gap-2">
                            {[
                              { id: "buy_x_get_y", label: "Compre e Ganhe" },
                              { id: "discount", label: "Desconto item" },
                              { id: "combo", label: "Combo Fixo" },
                            ].map(t => (
                              <button
                                key={t.id}
                                type="button"
                                onClick={() => setPromoForm(prev => ({ ...prev, type: t.id as any }))}
                                className={`py-2.5 px-1.5 rounded-xl text-xs font-bold border transition flex flex-col items-center justify-center gap-1 ${
                                  promoForm.type === t.id
                                    ? "bg-orange-50 border-orange-200 text-orange-700"
                                    : "bg-neutral-50 border-neutral-200 text-neutral-500 hover:bg-neutral-100"
                                }`}
                              >
                                {t.label}
                              </button>
                            ))}
                          </div>
                        </div>

                        {/* Parâmetros Dinâmicos baseados no tipo */}
                        {promoForm.type === "buy_x_get_y" && (
                          <div className="space-y-4 pt-2 border-t border-neutral-100">
                            <p className="text-[11px] text-neutral-400">
                              Para recompensar o cliente ao comprar um determinado produto, adicione um brinde grátis ao carrinho.
                            </p>

                            {/* Produto de gatilho */}
                            <div className="grid grid-cols-3 gap-2 text-left">
                              <div className="col-span-2">
                                <label className="block text-[11px] font-bold text-neutral-500 uppercase tracking-wider mb-1">
                                  Ao Comprar o Produto
                                </label>
                                <select
                                  value={promoForm.productId}
                                  onChange={e => setPromoForm(prev => ({ ...prev, productId: e.target.value }))}
                                  className="w-full rounded-xl border border-neutral-200 py-2.5 px-3 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-orange-600 text-neutral-800"
                                >
                                  <option value="">Selecione...</option>
                                  {products.map(p => (
                                    <option key={p.id} value={p.id}>{p.name}</option>
                                  ))}
                                </select>
                              </div>
                              <div>
                                <label className="block text-[11px] font-bold text-neutral-500 uppercase tracking-wider mb-1">
                                  Quantidade
                                </label>
                                <input
                                  type="number"
                                  min="1"
                                  value={promoForm.buyQty}
                                  onChange={e => setPromoForm(prev => ({ ...prev, buyQty: Math.max(1, parseInt(e.target.value) || 1) }))}
                                  className="w-full rounded-xl border border-neutral-200 py-2.5 px-3 text-sm bg-white text-center focus:outline-none focus:ring-2 focus:ring-orange-600 text-neutral-800"
                                />
                              </div>
                            </div>

                            {/* Produto de brinde */}
                            <div className="grid grid-cols-3 gap-2 text-left">
                              <div className="col-span-2">
                                <label className="block text-[11px] font-bold text-neutral-500 uppercase tracking-wider mb-1">
                                  Ganha Inteiramente Grátis
                                </label>
                                <select
                                  value={promoForm.giftProductId}
                                  onChange={e => setPromoForm(prev => ({ ...prev, giftProductId: e.target.value }))}
                                  className="w-full rounded-xl border border-neutral-200 py-2.5 px-3 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-orange-600 text-neutral-800"
                                >
                                  <option value="">Selecione...</option>
                                  {products.map(p => (
                                    <option key={p.id} value={p.id}>{p.name}</option>
                                  ))}
                                </select>
                              </div>
                              <div>
                                <label className="block text-[11px] font-bold text-neutral-500 uppercase tracking-wider mb-1">
                                  Qtd Brinde
                                </label>
                                <input
                                  type="number"
                                  min="1"
                                  value={promoForm.giftQty}
                                  onChange={e => setPromoForm(prev => ({ ...prev, giftQty: Math.max(1, parseInt(e.target.value) || 1) }))}
                                  className="w-full rounded-xl border border-neutral-200 py-2.5 px-3 text-sm bg-white text-center focus:outline-none focus:ring-2 focus:ring-orange-600 text-neutral-800"
                                />
                              </div>
                            </div>
                          </div>
                        )}

                        {promoForm.type === "discount" && (
                          <div className="space-y-4 pt-2 border-t border-neutral-100 text-left">
                            <p className="text-[11px] text-neutral-400">
                              Aplica um desconto direto sobre o preço de venda de um item singular no cardápio.
                            </p>

                            {/* Produto */}
                            <div>
                              <label className="block text-[11px] font-bold text-neutral-500 uppercase tracking-wider mb-1">
                                Produto com Desconto
                              </label>
                              <select
                                value={promoForm.productId}
                                onChange={e => setPromoForm(prev => ({ ...prev, productId: e.target.value }))}
                                className="w-full rounded-xl border border-neutral-200 py-2.5 px-3 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-orange-600 text-neutral-800"
                              >
                                <option value="">Selecione...</option>
                                {products.map(p => (
                                  <option key={p.id} value={p.id}>{p.name} (R$ {Number(p.price).toFixed(2)})</option>
                                ))}
                              </select>
                            </div>

                            {/* Tipo de Desconto e Valor */}
                            <div className="grid grid-cols-2 gap-3">
                              <div>
                                <label className="block text-[11px] font-bold text-neutral-500 uppercase tracking-wider mb-1">
                                  Tipo do Desconto
                                </label>
                                <div className="grid grid-cols-2 gap-1 bg-neutral-100 p-1 rounded-xl">
                                  <button
                                    type="button"
                                    onClick={() => setPromoForm(prev => ({ ...prev, discountType: "percentage" }))}
                                    className={`py-1.5 px-2 text-center rounded-lg text-xs font-bold ${
                                      promoForm.discountType === "percentage"
                                        ? "bg-white text-neutral-800 shadow-sm"
                                        : "text-neutral-500 hover:text-neutral-800"
                                    }`}
                                  >
                                    % Porcentagem
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => setPromoForm(prev => ({ ...prev, discountType: "fixed_value" }))}
                                    className={`py-1.5 px-2 text-center rounded-lg text-xs font-bold ${
                                      promoForm.discountType === "fixed_value"
                                        ? "bg-white text-neutral-800 shadow-sm"
                                        : "text-neutral-500 hover:text-neutral-800"
                                    }`}
                                  >
                                    $ Fixo (R$)
                                  </button>
                                </div>
                              </div>

                              <div>
                                <label className="block text-[11px] font-bold text-neutral-500 uppercase tracking-wider mb-1">
                                  Valor de Desconto
                                </label>
                                <input
                                  type="number"
                                  step="0.01"
                                  min="0"
                                  value={promoForm.discountValue || ""}
                                  onChange={e => setPromoForm(prev => ({ ...prev, discountValue: Math.max(0, parseFloat(e.target.value) || 0) }))}
                                  placeholder={promoForm.discountType === "percentage" ? "De 1 a 100" : "R$ Desconto"}
                                  className="w-full rounded-xl border border-neutral-200 py-2.5 px-3 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-orange-600 text-neutral-800"
                                />
                              </div>
                            </div>
                          </div>
                        )}

                        {promoForm.type === "combo" && (
                          <div className="space-y-4 pt-2 border-t border-neutral-100 text-left">
                            <p className="text-[11px] text-neutral-400">
                              Reconhece quando vários produtos específicos estão no carrinho e atribui-lhes um valor único especial.
                            </p>

                            {/* Seleção de Produtos Multi */}
                            <div>
                              <label className="block text-[11px] font-bold text-neutral-500 uppercase tracking-wider mb-1">
                                Selecionar Produtos Integrantes do Combo
                              </label>
                              <div className="border border-neutral-200 rounded-xl p-3 max-h-48 overflow-y-auto space-y-2 bg-neutral-50">
                                {products.map(p => {
                                  const isChecked = promoForm.productIds.includes(p.id);
                                  return (
                                    <label key={p.id} className="flex items-center gap-2.5 text-xs text-neutral-700 cursor-pointer hover:bg-white p-2 rounded-lg transition border border-transparent hover:border-neutral-200">
                                      <input
                                        type="checkbox"
                                        checked={isChecked}
                                        onChange={() => {
                                          if (isChecked) {
                                            setPromoForm(prev => ({ ...prev, productIds: prev.productIds.filter(id => id !== p.id) }));
                                          } else {
                                            setPromoForm(prev => ({ ...prev, productIds: [...prev.productIds, p.id] }));
                                          }
                                        }}
                                        className="rounded border-neutral-300 text-orange-600 focus:ring-orange-600 h-4.5 w-4.5"
                                      />
                                      <span className="font-semibold text-neutral-800">
                                        {p.name} <span className="text-neutral-400 font-normal ml-1">R$ {Number(p.price).toFixed(2)}</span>
                                      </span>
                                    </label>
                                  );
                                })}
                              </div>
                            </div>

                            {/* Preço do Combo */}
                            <div>
                              <label className="block text-[11px] font-bold text-neutral-500 uppercase tracking-wider mb-1">
                                Preço Fixo Promocional do Combo Inteiro (R$)
                              </label>
                              <input
                                type="number"
                                step="0.01"
                                min="0"
                                value={promoForm.comboPrice || ""}
                                onChange={e => setPromoForm(prev => ({ ...prev, comboPrice: Math.max(0, parseFloat(e.target.value) || 0) }))}
                                placeholder="Preço único de venda especial"
                                className="w-full rounded-xl border border-neutral-200 py-2.5 px-3 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-orange-600 text-neutral-800"
                              />
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Footer Modal */}
                      <div className="flex items-center justify-end gap-2 px-6 py-4 bg-neutral-50 border-t border-neutral-150">
                        <button
                          type="button"
                          onClick={() => setIsPromotionModalOpen(false)}
                          className="px-4 py-2 text-sm font-medium text-neutral-500 hover:text-neutral-800 bg-white border border-neutral-200 hover:bg-neutral-50 rounded-lg transition"
                        >
                          Cancelar
                        </button>
                        <button
                          onClick={handleSavePromotion}
                          className="px-4 py-2 text-sm font-semibold text-white bg-orange-600 hover:bg-orange-700 rounded-lg transition shadow-lg shadow-orange-600/10 pointer-events-auto"
                        >
                          {editingPromotion ? "Salvar Alterações" : "Criar Promoção"}
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* --- Mesas TAB --- */}
            {activeTab === "tables" && (
              <div className="space-y-6">
                {!user?.isWaiter && (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {/* Simple Add */}
                    <div className="bg-white p-5 rounded-2xl border border-neutral-200/80 shadow-sm space-y-4">
                      <h3 className="text-sm font-bold text-neutral-800">Adicionar Individual</h3>
                      <form 
                        onSubmit={(e) => {
                          e.preventDefault();
                          handleAddTable();
                        }}
                        className="flex flex-col gap-3"
                      >
                        <input 
                          type="text" 
                          placeholder="Ex: Mesa 01, Balcão 2" 
                          value={newTableName}
                          onChange={e => setNewTableName(e.target.value)}
                          className="w-full rounded-xl ring-1 ring-inset ring-neutral-300 bg-white px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-orange-600"
                        />
                        <button 
                          type="submit"
                          disabled={isAddingTable}
                          className="flex items-center justify-center gap-2 rounded-xl bg-neutral-900 px-6 py-2.5 text-sm font-semibold text-white hover:bg-neutral-800 transition disabled:opacity-50 w-full"
                        >
                          {isAddingTable ? "Adicionando..." : "Adicionar Mesa"}
                        </button>
                      </form>
                    </div>

                    {/* Bulk Add */}
                    <div className="bg-white p-5 rounded-2xl border border-neutral-200/80 shadow-sm space-y-4">
                      <h3 className="text-sm font-bold text-neutral-800">Gerar em Lote</h3>
                      <form 
                        onSubmit={(e) => {
                          e.preventDefault();
                          handleBulkGenerateTables();
                        }}
                        className="flex flex-col gap-3"
                      >
                        <input 
                          type="number" 
                          min="1"
                          max="50"
                          placeholder="Quantidade (ex: 20)" 
                          value={bulkTableCount}
                          onChange={e => setBulkTableCount(e.target.value)}
                          className="w-full rounded-xl ring-1 ring-inset ring-neutral-300 bg-white px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-orange-600"
                        />
                        <button 
                          type="submit"
                          disabled={isGeneratingBulk}
                          className="flex items-center justify-center gap-2 rounded-xl bg-orange-600 px-6 py-2.5 text-sm font-semibold text-white hover:bg-orange-700 transition disabled:opacity-50 w-full"
                        >
                          {isGeneratingBulk ? "Gerando..." : "Gerar Mesas"}
                        </button>
                      </form>
                    </div>

                    {/* Danger Zone */}
                    <div className="bg-rose-50/50 p-5 rounded-2xl border border-rose-200/60 shadow-sm space-y-4 flex flex-col justify-between">
                      <div>
                        <h3 className="text-sm font-bold text-rose-800">Zona de Perigo</h3>
                        <p className="text-xs text-rose-600/80 mt-1 font-medium leading-relaxed">Exclua todas as mesas cadastradas de uma só vez. Ação irreversível.</p>
                      </div>
                      <button 
                        type="button"
                        onClick={handleDeleteAllTables}
                        disabled={tables.length === 0}
                        className="flex items-center justify-center gap-2 rounded-xl bg-rose-600 px-6 py-2.5 text-sm font-semibold text-white hover:bg-rose-700 transition disabled:opacity-50 w-full"
                      >
                        <Trash2 size={16} /> Excluir Todas ({tables.length})
                      </button>
                    </div>
                  </div>
                )}

                <div className="pt-2">
                  {/* Stats Cards Grid */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
                    <div className="bg-white border border-neutral-200 rounded-2xl p-4 flex items-center gap-4 shadow-sm">
                      <div className="p-3 rounded-xl bg-neutral-100 text-neutral-700">
                        <Users size={20} />
                      </div>
                      <div>
                        <div className="text-xs font-semibold text-neutral-500">Total de Mesas</div>
                        <div className="text-xl font-black text-neutral-900">{tables.length}</div>
                      </div>
                    </div>

                    <div className="bg-white border border-neutral-200 rounded-2xl p-4 flex items-center gap-4 shadow-sm">
                      <div className="p-3 rounded-xl bg-green-50 text-green-600">
                        <div className="w-5 h-5 flex items-center justify-center font-bold text-sm">🟢</div>
                      </div>
                      <div>
                        <div className="text-xs font-semibold text-neutral-500">Mesas Livres</div>
                        <div className="text-xl font-black text-green-600">
                          {tables.filter(t => t.status !== "Ocupada").length}
                        </div>
                      </div>
                    </div>

                    <div className="bg-white border border-neutral-200 rounded-2xl p-4 flex items-center gap-4 shadow-sm">
                      <div className="p-3 rounded-xl bg-amber-50 text-amber-600">
                        <div className="w-5 h-5 flex items-center justify-center font-bold text-sm">🔴</div>
                      </div>
                      <div>
                        <div className="text-xs font-semibold text-neutral-500">Mesas Ocupadas</div>
                        <div className="text-xl font-black text-amber-600">
                          {tables.filter(t => t.status === "Ocupada").length}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Filter and Title */}
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
                    <div>
                      <h3 className="text-lg font-black text-neutral-900">Mesas Cadastradas</h3>
                      <p className="text-xs text-neutral-500 mt-0.5">Filtre ou visualize as suas ordens ativas por mesa</p>
                    </div>

                    <div className="flex flex-wrap items-center gap-3">
                      <button
                        type="button"
                        onClick={handleGenerateAllTablesQRPDF}
                        disabled={tables.length === 0}
                        className="flex items-center gap-2 px-4 py-2 bg-orange-600 hover:bg-orange-700 text-white rounded-xl text-xs font-extrabold shadow-sm transition disabled:opacity-50 cursor-pointer"
                      >
                        <QrCode size={16} />
                        <span>Imprimir QR Codes (PDF)</span>
                      </button>

                      <div className="flex bg-neutral-100 p-1 rounded-xl w-fit border border-neutral-200/50 text-neutral-800">
                        <button
                          type="button"
                          onClick={() => setTableFilter("all")}
                          className={`px-4 py-2 rounded-lg text-xs font-bold transition flex items-center gap-1.5 ${
                            tableFilter === "all"
                              ? "bg-white text-neutral-900 shadow-sm"
                              : "text-neutral-500 hover:text-neutral-800"
                          }`}
                        >
                          Todas ({tables.length})
                        </button>
                        <button
                          type="button"
                          onClick={() => setTableFilter("free")}
                          className={`px-4 py-2 rounded-lg text-xs font-bold transition flex items-center gap-1.5 ${
                            tableFilter === "free"
                              ? "bg-green-100 text-green-800 shadow-sm"
                              : "text-neutral-500 hover:text-green-600"
                          }`}
                        >
                          <span className="w-2 h-2 rounded-full bg-green-500 inline-block animate-pulse"></span>
                          Livres ({tables.filter(t => t.status !== "Ocupada").length})
                        </button>
                        <button
                          type="button"
                          onClick={() => setTableFilter("occupied")}
                          className={`px-4 py-2 rounded-lg text-xs font-bold transition flex items-center gap-1.5 ${
                            tableFilter === "occupied"
                              ? "bg-white text-neutral-900 shadow-sm"
                              : "text-neutral-500 hover:text-amber-600"
                          }`}
                        >
                          <span className="w-2 h-2 rounded-full bg-amber-500 inline-block"></span>
                          Ocupadas ({tables.filter(t => t.status === "Ocupada").length})
                        </button>
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                               {(() => {
                      const filteredTables = tables.filter((table) => {
                        if (tableFilter === "all") return true;
                        if (tableFilter === "free") return table.status !== "Ocupada";
                        if (tableFilter === "occupied") return table.status === "Ocupada";
                        return true;
                      });

                      if (filteredTables.length === 0) {
                        return (
                          <div className="col-span-full p-8 text-neutral-500 text-center border border-neutral-200 rounded-xl bg-white shadow-sm">
                            {tables.length === 0
                              ? "Nenhuma mesa cadastrada."
                              : "Nenhuma mesa encontrada para o filtro selecionado."}
                          </div>
                        );
                      }

                      return filteredTables.map((table) => (
                        <div key={table.id} className="bg-white border text-center border-neutral-200 rounded-2xl p-6 flex flex-col items-center justify-between gap-5 shadow-sm hover:shadow-md transition">
                          <div className="w-full flex justify-between items-center gap-2">
                             <span className={`px-3 py-1 text-xs font-black uppercase tracking-wider rounded-full ${table.status === 'Ocupada' ? 'bg-amber-100 text-amber-800' : 'bg-green-100 text-green-800'}`}>
                               {table.status}
                             </span>
                             <div className="flex items-center gap-1">
                               <button
                                 type="button"
                                 onClick={() => setSelectedTableForQr(table)}
                                 title="Visualizar/Imprimir QR Code da Mesa"
                                 className="p-1.5 px-2 text-orange-600 hover:bg-orange-50 rounded-lg transition border border-orange-200 flex items-center gap-1 text-xs font-extrabold cursor-pointer"
                               >
                                 <QrCode size={14} />
                                 <span>QR Code</span>
                               </button>
                               {!user?.isWaiter && (
                                 <button type="button" onClick={() => handleDeleteTable(table.id)} className="p-1.5 text-neutral-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition"><Trash2 size={16} /></button>
                               )}
                             </div>
                          </div>
                          
                          <div className="flex flex-col items-center gap-1">
                            <span className="text-2xl font-black text-neutral-900">{table.name}</span>
                            {table.status === 'Ocupada' ? (
                              <span className="text-[11px] font-medium text-amber-600 flex items-center gap-1 bg-amber-50 px-2 py-0.5 rounded-full">
                                <span className="w-1.5 h-1.5 rounded-full bg-amber-500 inline-block"></span>
                                Em Atendimento
                              </span>
                            ) : (
                              <span className="text-[11px] font-medium text-green-600 flex items-center gap-1 bg-green-50 px-2 py-0.5 rounded-full">
                                <span className="w-1.5 h-1.5 rounded-full bg-green-500 inline-block"></span>
                                Disponível
                              </span>
                            )}
                          </div>
                          
                          {table.status === 'Ocupada' ? (
                            <div className="w-full flex flex-col gap-3 mt-1">
                               <div className="bg-neutral-50 rounded-xl p-3 text-sm text-neutral-700 font-medium border border-neutral-100 flex items-center justify-center gap-2 overflow-hidden text-ellipsis">
                                 <User size={15} className="text-neutral-400 shrink-0" />
                                 <span className="text-neutral-500">Cliente:</span>
                                 <span className="font-bold text-neutral-900 truncate">
                                   {table.customerName || "Balcão"}
                                 </span>
                               </div>
                               {(table.items && table.items.length > 0) && (
                                  <div className="bg-orange-50 rounded-xl p-3 text-sm text-orange-850 font-medium border border-orange-100 flex justify-between items-center">
                                    <span className="flex items-center gap-1 text-orange-700">
                                      <Utensils size={14} />
                                      {table.items.length} {table.items.length === 1 ? 'item' : 'itens'}
                                    </span>
                                    <span className="font-bold text-orange-950">R$ {parseFloat(table.total || 0).toFixed(2)}</span>
                                  </div>
                               )}
                               <div className="flex flex-col gap-2 w-full">
                                   <button
                                     type="button"
                                     onClick={() => handleEditTableInPdv(table)}
                                     className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-700 rounded-xl text-xs sm:text-sm font-bold text-white transition shadow-sm flex items-center justify-center gap-1.5"
                                   >
                                     <Plus size={15} /> Lançar Itens
                                   </button>
                                   <div className="flex flex-col sm:flex-row gap-2">
                                  <button
                                    type="button"
                                    onClick={() => handleClearTable(table.id)}
                                    className="flex-1 py-2.5 bg-neutral-100 hover:bg-neutral-200 rounded-xl text-xs sm:text-sm font-bold text-neutral-700 transition"
                                  >
                                    Liberar Mesa
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      const orderData = {
                                        timestamp: Date.now(),
                                        items: table.items,
                                        total: table.total || 0,
                                        customerName: table.customerName || formatTableName(table.name),
                                        checkoutType: "balcao",
                                        tableNumber: table.name,
                                        paymentMethod: "dinheiro",
                                        changeFor: ""
                                      };
                                      handlePrintOrder({ ...orderData, id: table.id });
                                    }}
                                    className="px-3 py-2.5 bg-neutral-100 hover:bg-neutral-200 rounded-xl text-neutral-700 transition"
                                  >
                                    <Printer size={16} />
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleFinalizeTableOrder(table)}
                                    className="flex-[2] py-2.5 bg-orange-600 hover:bg-orange-700 rounded-xl text-xs sm:text-sm font-bold text-white transition shadow-sm"
                                  >
                                    Finalizar Pedido
                                  </button>
                                  </div>
                               </div>
                            </div>
                          ) : (
                            <div className="w-full flex flex-col gap-3 mt-1">
                               <div className="relative">
                                 <input 
                                   type="text"
                                   placeholder="Nome do Cliente"
                                   value={customerInputs[table.id] || ""}
                                   onChange={e => setCustomerInputs(prev => ({...prev, [table.id]: e.target.value}))}
                                   className="w-full rounded-xl ring-1 ring-inset ring-neutral-300 bg-white placeholder-neutral-400 px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-orange-600 font-medium text-center"
                                 />
                               </div>
                               <button
                                 type="button"
                                 onClick={() => handleUpdateTableCustomer(table.id, customerInputs[table.id] || "")}
                                 disabled={!customerInputs[table.id]?.trim()}
                                 className="w-full py-2.5 bg-orange-600 hover:bg-orange-700 disabled:bg-neutral-300 rounded-xl text-sm font-bold text-white transition disabled:cursor-not-allowed"
                               >
                                 Ocupar Mesa
                               </button>
                             </div>
                           )}
                         </div>
                       ));
                    })()}
                 </div>
               </div>
             </div>
           )}

          {/* --- Atendentes/Garçons TAB --- */}
            {activeTab === "waiters" && (
              <div className="space-y-6">
                <div>
                  <h1 className="text-2xl font-black text-neutral-900 tracking-tight">Atendentes & Garçons</h1>
                  <p className="text-xs text-neutral-500 mt-0.5">Cadastre e gerencie a equipe que anota pedidos no PDV.</p>
                </div>

                <form 
                  onSubmit={async (e) => {
                    e.preventDefault();
                    if (!newWaiterName.trim()) {
                      alert("Por favor, digite o nome do atendente.");
                      return;
                    }
                    if (!newWaiterEmail.trim() || !newWaiterPassword.trim()) {
                      alert("Por favor, preencha o e-mail e a senha do atendente.");
                      return;
                    }
                    if (newWaiterPassword.trim().length < 6) {
                      alert("A senha deve possuir pelo menos 6 caracteres.");
                      return;
                    }

                    setIsAddingWaiter(true);
                    try {
                      if (!user || !user.uid) throw new Error("Usuário não autenticado");

                      // 1. Register the waiter in Firebase Auth using a secondary Firebase app instance so the primary user is not logged out
                      let secondaryApp;
                      const apps = getApps();
                      const existing = apps.find(app => app.name === "secondary-waiter");
                      if (existing) {
                        secondaryApp = existing;
                      } else {
                        secondaryApp = initializeApp(firebaseConfig, "secondary-waiter");
                      }
                      const secondaryAuth = getAuth(secondaryApp);
                      const userCredential = await createUserWithEmailAndPassword(secondaryAuth, newWaiterEmail.trim(), newWaiterPassword.trim());
                      const waiterUid = userCredential.user.uid;
                      await secondaryAuth.signOut();

                      // 2. Add the waiter details document in the waiters collection with the Registered authenticating UID
                      await setDoc(doc(db, "waiters", waiterUid), {
                        restaurantId: user.uid,
                        name: newWaiterName.trim(),
                        email: newWaiterEmail.trim().toLowerCase(),
                        code: newWaiterCode.trim() || String(waiters.length + 1),
                        phone: newWaiterPhone.trim(),
                        isActive: true,
                        role: "waiter",
                        createdAt: Date.now()
                      });

                      setNewWaiterName("");
                      setNewWaiterCode("");
                      setNewWaiterPhone("");
                      setNewWaiterEmail("");
                      setNewWaiterPassword("");
                      alert("Atendente cadastrado com sucesso!");
                    } catch (err: any) {
                      console.error("Erro ao adicionar atendente:", err);
                      let errMsg = err.message;
                      if (err.code === "auth/email-already-in-use") {
                        errMsg = "Este e-mail já está sendo utilizado por outro atendente ou usuário.";
                      } else if (err.code === "auth/weak-password") {
                        errMsg = "A senha é muito fraca. Escolha uma senha mais forte.";
                      } else if (err.code === "auth/invalid-email") {
                        errMsg = "E-mail inválido.";
                      }
                      alert("Erro ao adicionar atendente: " + errMsg);
                    } finally {
                      setIsAddingWaiter(false);
                    }
                  }}
                  className="bg-white border border-neutral-200 rounded-2xl p-5 shadow-sm space-y-4"
                >
                  <h3 className="text-sm font-bold text-neutral-800 uppercase tracking-wider">Cadastrar Novo Atendente</h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-neutral-500 mb-1">Nome Completo</label>
                      <input 
                        type="text" 
                        placeholder="Ex: Carlos Silva" 
                        value={newWaiterName}
                        onChange={e => setNewWaiterName(e.target.value)}
                        className="w-full rounded-xl ring-1 ring-neutral-300 bg-white px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-orange-600 font-medium text-neutral-800"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-neutral-500 mb-1">E-mail de Acesso (Login)</label>
                      <input 
                        type="email" 
                        placeholder="Ex: carlos@restaurante.com" 
                        value={newWaiterEmail}
                        onChange={e => setNewWaiterEmail(e.target.value)}
                        className="w-full rounded-xl ring-1 ring-neutral-300 bg-white px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-orange-600 font-medium text-neutral-800"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-neutral-500 mb-1">Senha de Acesso</label>
                      <input 
                        type="password" 
                        placeholder="Mínimo 6 caracteres" 
                        value={newWaiterPassword}
                        onChange={e => setNewWaiterPassword(e.target.value)}
                        className="w-full rounded-xl ring-1 ring-neutral-300 bg-white px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-orange-600 font-medium text-neutral-800"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-neutral-500 mb-1">Código / ID (Opcional)</label>
                      <input 
                        type="text" 
                        placeholder="Ex: 01" 
                        value={newWaiterCode}
                        onChange={e => setNewWaiterCode(e.target.value)}
                        className="w-full rounded-xl ring-1 ring-neutral-300 bg-white px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-orange-600 font-medium text-neutral-800"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-neutral-500 mb-1">Telefone (Opcional)</label>
                      <input 
                        type="text" 
                        placeholder="Ex: (11) 98888-7777" 
                        value={newWaiterPhone}
                        onChange={e => setNewWaiterPhone(e.target.value)}
                        className="w-full rounded-xl ring-1 ring-neutral-300 bg-white px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-orange-600 font-medium text-neutral-800"
                      />
                    </div>
                  </div>
                  <div className="flex justify-end pt-2">
                    <button 
                      type="submit"
                      disabled={isAddingWaiter}
                      className="flex items-center justify-center gap-2 rounded-xl bg-orange-600 px-6 py-2.5 text-sm font-semibold text-white hover:bg-orange-700 transition disabled:opacity-50 w-full sm:w-auto"
                    >
                      {isAddingWaiter ? "Cadastrando..." : "Cadastrar Atendente"}
                    </button>
                  </div>
                </form>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                  {waiters.length === 0 ? (
                    <div className="col-span-full p-12 text-neutral-500 text-center border border-neutral-200 rounded-2xl bg-white shadow-sm">
                      <Users className="mx-auto text-neutral-300 mb-2 font-black" size={36} />
                      <p className="font-bold">Nenhum atendente cadastrado.</p>
                      <p className="text-xs text-neutral-450 mt-1">Cadastre seus garçons ou equipe do caixa para começar a organizar pedidos.</p>
                    </div>
                  ) : (
                    waiters.map((waiter) => {
                      const waiterOrders = orders.filter(o => o.waiterId === waiter.id);
                      const totalSales = waiterOrders.reduce((sum, o) => sum + (o.total || 0), 0);

                      return (
                        <div key={waiter.id} className="bg-white border border-neutral-200 rounded-2xl p-5 flex flex-col justify-between gap-4 shadow-sm hover:shadow-md transition">
                          <div className="flex justify-between items-start">
                            <div>
                              <span className={`inline-block px-2.5 py-0.5 text-[9px] font-black uppercase tracking-wider rounded-full ${waiter.isActive !== false ? 'bg-green-100 text-green-800' : 'bg-neutral-100 text-neutral-600'}`}>
                                {waiter.isActive !== false ? 'Ativo' : 'Inativo'}
                              </span>
                              <span className="ml-2 inline-block px-2.5 py-0.5 text-[9px] font-mono font-bold bg-neutral-100 text-neutral-600 rounded">
                                ID: {waiter.code}
                              </span>
                            </div>
                            <div className="flex items-center gap-1.5">
                              <button 
                                onClick={async () => {
                                  try {
                                    await updateDoc(doc(db, "waiters", waiter.id), {
                                      isActive: waiter.isActive === false ? true : false
                                    });
                                  } catch (e) {
                                    console.error(e);
                                    alert("Erro ao alterar status do atendente.");
                                  }
                                }} 
                                className="text-xs font-bold text-orange-600 hover:text-orange-700 bg-orange-50 hover:bg-orange-100 px-2 py-1 rounded transition"
                                title={waiter.isActive !== false ? "Desativar" : "Ativar"}
                              >
                                {waiter.isActive !== false ? "Desativar" : "Ativar"}
                              </button>
                              <button 
                                onClick={() => {
                                  setDeleteConfirm({
                                    isOpen: true,
                                    title: "Excluir Atendente",
                                    message: `Tem certeza que deseja excluir o atendente "${waiter.name}"? Esta ação é irreversível.`,
                                    onConfirm: async () => {
                                      try {
                                        await deleteDoc(doc(db, "waiters", waiter.id));
                                      } catch (e) {
                                        console.error(e);
                                        alert("Erro ao excluir atendente.");
                                      } finally {
                                        setDeleteConfirm(null);
                                      }
                                    }
                                  });
                                }} 
                                className="p-2 text-neutral-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition"
                                title="Excluir"
                              >
                                <Trash2 size={16} />
                              </button>
                            </div>
                          </div>

                          <div>
                            <div className="text-lg font-black text-neutral-900 leading-tight">{waiter.name}</div>
                            {waiter.email && (
                              <div className="text-xs font-semibold text-orange-600/80 font-mono mt-0.5">{waiter.email}</div>
                            )}
                            {waiter.phone && (
                              <div className="text-xs font-semibold text-neutral-400 font-mono mt-0.5">{waiter.phone}</div>
                            )}
                          </div>

                          <div className="grid grid-cols-2 gap-2 pt-2 border-t border-neutral-100 text-center mt-2">
                            <div className="bg-neutral-50 p-2.5 rounded-xl border border-neutral-100">
                              <span className="block text-[8px] uppercase tracking-wider font-extrabold text-neutral-400">Pedidos Anotados</span>
                              <span className="text-sm font-black text-neutral-800">{waiterOrders.length}</span>
                            </div>
                            <div className="bg-orange-50/50 p-2.5 rounded-xl border border-orange-100/50">
                              <span className="block text-[8px] uppercase tracking-wider font-extrabold text-orange-400">Total Vendas</span>
                              <span className="text-sm font-black text-orange-600">R$ {totalSales.toFixed(2)}</span>
                            </div>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            )}

            {/* --- Aparência TAB --- */}
            {activeTab === "appearance" && (
              <div className="space-y-6 max-w-2xl">
                <div className="rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm space-y-6">
                  {/* Identidade e Endereço */}
                  <div className="border-b border-neutral-100 pb-4">
                    <h3 className="text-base font-semibold text-neutral-900">Identidade e Endereço</h3>
                    <p className="text-xs text-neutral-500 mt-1">Configure o nome do restaurante e o link de acesso exclusivo.</p>
                  </div>

                  <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
                    <div className="sm:col-span-2">
                      <label className="block text-sm font-medium text-neutral-700 mb-1">Nome do Restaurante</label>
                      <input 
                        type="text" 
                        value={appearanceForm.name} 
                        onChange={e => setAppearanceForm({...appearanceForm, name: e.target.value})} 
                        className="w-full rounded-lg ring-1 ring-inset ring-neutral-300 px-3 py-2 text-sm focus:ring-2 focus:ring-orange-600 outline-none" 
                      />
                    </div>
                    <div className="sm:col-span-2">
                      <label className="block text-sm font-medium text-neutral-700 mb-1">Link do Cardápio (Slug)</label>
                      <div className="flex rounded-lg shadow-sm ring-1 ring-inset ring-neutral-300 focus-within:ring-2 focus-within:ring-orange-600">
                        <span className="flex select-none items-center pl-3 pr-2 text-neutral-500 text-xs sm:text-sm bg-neutral-100 rounded-l-lg border-r border-neutral-300">
                          {window.location.host}/
                        </span>
                        <input 
                          type="text" 
                          value={appearanceForm.slug} 
                          onChange={e => {
                            const formatted = e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "");
                            setAppearanceForm({...appearanceForm, slug: formatted});
                          }} 
                          className="block min-w-0 flex-1 border-0 bg-transparent py-2 pl-3 pr-3 text-sm text-neutral-900 focus:ring-0 outline-none placeholder:text-neutral-400"
                        />
                      </div>
                      <p className="text-[10px] text-neutral-400 mt-1">Isso alterará o endereço exclusivo de acesso ao seu cardápio público e atualizará o seu QR Code correspondente.</p>
                    </div>
                  </div>

                  {/* Visual e Cores */}
                  <div className="border-t border-neutral-100 pt-6 border-b border-neutral-100 pb-4">
                    <h3 className="text-base font-semibold text-neutral-900">Visual e Cores</h3>
                    <p className="text-xs text-neutral-500 mt-1">Logotipo, banner e paleta de cores principal.</p>
                  </div>

                  <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
                    {appearanceUploadError && (
                      <div className="sm:col-span-2 rounded-xl border border-red-200 bg-red-50 p-3 text-xs text-red-700 font-bold flex items-center gap-2">
                        <span>⚠️ Erro no envio: {appearanceUploadError}</span>
                      </div>
                    )}

                    <div className="sm:col-span-2">
                      <label className="block text-sm font-bold text-neutral-800 mb-1">Logotipo (Logo)</label>
                      <p className="text-[11px] text-neutral-500 mb-2">Recomendado: imagem quadrada (1:1), formato JPG/PNG. Compressão otimizada em tempo real.</p>
                      <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center bg-neutral-50 p-4 rounded-xl border border-neutral-200/60 shadow-none">
                        {appearanceForm.logoUrl ? (() => {
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
                            <div className="relative group shrink-0">
                              {activeFrame ? (
                                <div className="relative h-20 w-20 flex items-center justify-center">
                                  {/* Ornament frame */}
                                  <img 
                                    src={activeFrame.imageUrl} 
                                    alt="Logo Frame" 
                                    className="absolute inset-0 h-full w-full object-contain z-10 pointer-events-none"
                                    referrerPolicy="no-referrer"
                                  />
                                  <img 
                                    src={appearanceForm.logoUrl} 
                                    className="h-[73%] w-[73%] rounded-full object-cover z-0 bg-white" 
                                    referrerPolicy="no-referrer"
                                  />
                                </div>
                              ) : (
                                <img 
                                  src={appearanceForm.logoUrl} 
                                  className="h-16 w-16 rounded-full object-cover border border-neutral-300 bg-white shadow-sm" 
                                  referrerPolicy="no-referrer"
                                />
                              )}
                              <button
                                type="button"
                                onClick={() => setAppearanceForm({...appearanceForm, logoUrl: ''})}
                                className="absolute -top-1 -right-1 bg-red-500 hover:bg-red-600 text-white rounded-full p-0.5 shadow-md hover:scale-105 transition z-20"
                                title="Remover logotipo"
                              >
                                <X size={11} strokeWidth={3} />
                              </button>
                            </div>
                          );
                        })() : (
                          <div className="w-16 h-16 rounded-full bg-neutral-100 border border-neutral-200 flex items-center justify-center text-[10px] font-black text-neutral-400 shrink-0 select-none uppercase tracking-wide">Sem Logo</div>
                        )}
                        <div className="flex-1 space-y-2 w-full">
                          <input 
                            type="text" 
                            placeholder="Insira a URL do Logotipo ou faça upload ao lado..." 
                            value={appearanceForm.logoUrl} 
                            onChange={e => setAppearanceForm({...appearanceForm, logoUrl: e.target.value})} 
                            className="w-full rounded-lg ring-1 ring-inset ring-neutral-300 px-3 py-2 text-sm focus:ring-2 focus:ring-orange-600 outline-none bg-white font-sans text-neutral-800"
                          />
                          <div className="flex items-center gap-2">
                            <label className="inline-flex items-center gap-2 px-3 py-1.5 bg-neutral-950 hover:bg-neutral-800 text-white font-bold text-xs rounded-lg cursor-pointer shadow-sm hover:shadow transition">
                              <Upload size={12} strokeWidth={2.5} />
                              {isUploadingLogo ? "Processando..." : "Fazer Upload do Logo"}
                              <input 
                                type="file" 
                                accept="image/*" 
                                onChange={(e) => {
                                  if (e.target.files && e.target.files[0]) {
                                    handleLogoUpload(e.target.files[0]);
                                  }
                                }} 
                                className="hidden" 
                                disabled={isUploadingLogo}
                              />
                            </label>
                            {isUploadingLogo && (
                              <span className="text-neutral-500 text-[11px] animate-pulse">Armazenando imagem...</span>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="sm:col-span-2">
                      <label className="block text-sm font-bold text-neutral-800 mb-1">Banner do Cardápio</label>
                      <p className="text-[11px] text-neutral-500 mb-2">Recomendado: formato retangular largo (ex: 1200x500). Redimensionamento inteligente ativo.</p>
                      <div className="flex flex-col gap-3 bg-neutral-50 p-4 rounded-xl border border-neutral-200/60 shadow-none">
                        {appearanceForm.bannerUrl ? (
                          <div className="relative group w-full">
                            <img src={appearanceForm.bannerUrl} className="w-full h-32 rounded-lg border border-neutral-200 object-cover" />
                            <button
                              type="button"
                              onClick={() => setAppearanceForm({...appearanceForm, bannerUrl: ''})}
                              className="absolute top-2 right-2 bg-red-500 hover:bg-red-600 text-white rounded-full p-1 shadow-md hover:scale-105 transition"
                              title="Remover banner"
                            >
                              <X size={12} strokeWidth={2.5} />
                            </button>
                          </div>
                        ) : (
                          <div className="w-full h-24 rounded-lg bg-neutral-100 border border-dashed border-neutral-200 flex items-center justify-center text-[10px] font-black text-neutral-400 select-none uppercase tracking-wide">Sem Banner</div>
                        )}
                        <div className="space-y-2">
                          <input 
                            type="text" 
                            placeholder="Insira a URL do Banner ou faça upload ao lado..." 
                            value={appearanceForm.bannerUrl} 
                            onChange={e => setAppearanceForm({...appearanceForm, bannerUrl: e.target.value})} 
                            className="w-full rounded-lg ring-1 ring-inset ring-neutral-300 px-3 py-2 text-sm focus:ring-2 focus:ring-orange-600 outline-none bg-white font-sans text-neutral-800"
                          />
                          <div className="flex items-center gap-2 font-sans">
                            <label className="inline-flex items-center gap-2 px-3 py-1.5 bg-neutral-950 hover:bg-neutral-800 text-white font-bold text-xs rounded-lg cursor-pointer shadow-sm hover:shadow transition">
                              <Upload size={12} strokeWidth={2.5} />
                              {isUploadingBanner ? "Processando..." : "Fazer Upload do Banner"}
                              <input 
                                type="file" 
                                accept="image/*" 
                                onChange={(e) => {
                                  if (e.target.files && e.target.files[0]) {
                                    handleBannerUpload(e.target.files[0]);
                                  }
                                }} 
                                className="hidden" 
                                disabled={isUploadingBanner}
                              />
                            </label>
                            {isUploadingBanner && (
                              <span className="text-neutral-500 text-[11px] animate-pulse">Armazenando imagem...</span>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-neutral-700 mb-1">Cor Principal (Hex)</label>
                      <div className="flex gap-2 items-center hover:opacity-90 transition">
                         <input type="color" value={appearanceForm.primaryColor} onChange={e => setAppearanceForm({...appearanceForm, primaryColor: e.target.value})} className="w-10 h-10 border-0 p-0 rounded-lg cursor-pointer animate-none" />
                         <input type="text" value={appearanceForm.primaryColor} disabled className="rounded-lg ring-1 ring-inset ring-neutral-300 px-3 py-2 text-sm bg-neutral-50 shrink-0 w-24 text-center font-mono font-bold" />
                      </div>
                    </div>
                  </div>

                  {/* Redes Sociais */}
                  <div className="border-t border-neutral-100 pt-6 border-b border-neutral-100 pb-4">
                    <h3 className="text-base font-semibold text-neutral-900">Redes Sociais</h3>
                    <p className="text-xs text-neutral-500 mt-1">Seus canais digitais exibidos no rodapé do cardápio público.</p>
                  </div>

                  <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
                    <div>
                      <label className="block text-sm font-medium text-neutral-700 mb-1">Instagram (Nome Usuário)</label>
                      <input 
                        type="text" 
                        placeholder="Ex: seu.estabelecimento" 
                        value={appearanceForm.instagram || ""} 
                        onChange={e => setAppearanceForm({...appearanceForm, instagram: e.target.value})} 
                        className="w-full rounded-lg ring-1 ring-inset ring-neutral-300 px-3 py-2 text-sm focus:ring-2 focus:ring-orange-600 outline-none" 
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-neutral-700 mb-1">Facebook (Nome Usuário)</label>
                      <input 
                        type="text" 
                        placeholder="Ex: seu.estabelecimento" 
                        value={appearanceForm.facebook || ""} 
                        onChange={e => setAppearanceForm({...appearanceForm, facebook: e.target.value})} 
                        className="w-full rounded-lg ring-1 ring-inset ring-neutral-300 px-3 py-2 text-sm focus:ring-2 focus:ring-orange-600 outline-none" 
                      />
                    </div>
                  </div>

                  <div className="pt-6 flex justify-end border-t border-neutral-100 mt-6">
                    <button onClick={handleSaveAppearance} className="px-6 py-2.5 text-sm font-medium text-white bg-neutral-900 hover:bg-neutral-800 rounded-full transition cursor-pointer select-none">Salvar Alterações</button>
                  </div>
                </div>
              </div>
            )}

            {/* --- Funcionamento TAB --- */}
            {activeTab === "store_settings" && (
              <div className="space-y-6 max-w-2xl">
                <div className="rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm space-y-6">
                  {/* Status da Loja */}
                  <div className="border-b border-neutral-100 pb-4 flex justify-between items-end gap-4">
                    <div>
                      <h3 className="text-base font-semibold text-neutral-900">Status & Nicho da Loja</h3>
                      <p className="text-xs text-neutral-500 mt-1">Configurações globais de funcionamento e adaptação da interface para o modelo de negócio.</p>
                    </div>
                    <div className="min-w-[180px]">
                      <label className="block text-xs font-semibold text-neutral-700 mb-1">Gênero / Estilo</label>
                      <select 
                        value={appearanceForm.genre || 'Geral'}
                        onChange={(e) => setAppearanceForm({...appearanceForm, genre: e.target.value})}
                        className="w-full appearance-none rounded-lg ring-1 ring-inset ring-neutral-300 px-3 py-2 text-sm focus:ring-2 focus:ring-orange-600 outline-none bg-white font-medium"
                      >
                        <option value="Geral">Geral (Padrão)</option>
                        <option value="Marmitaria">Marmitaria</option>
                        <option value="Pastelaria">Pastelaria</option>
                        <option value="Espetinho">Espetaria / Espetinho</option>
                        <option value="Açaí">Açaí</option>
                        <option value="Macarrões">Macarrões / Massas</option>
                        <option value="Pizzaria">Pizzaria</option>
                        <option value="Hamburgueria">Hamburgueria</option>
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <label className={`relative flex items-center justify-center p-4 border rounded-xl cursor-pointer transition ${appearanceForm.storeStatus === 'open' ? 'border-green-500 bg-green-50' : 'border-neutral-200 hover:border-neutral-300'}`}>
                      <input type="radio" value="open" checked={appearanceForm.storeStatus === 'open'} onChange={() => setAppearanceForm({...appearanceForm, storeStatus: 'open'})} className="sr-only" />
                      <div className="flex flex-col items-center gap-1">
                        <span className={`text-sm font-medium ${appearanceForm.storeStatus === 'open' ? 'text-green-700' : 'text-neutral-700'}`}>Sempre Aberto</span>
                        <span className="text-[10px] text-center text-neutral-500">Aceita pedidos a qualquer hora</span>
                      </div>
                    </label>

                    <label className={`relative flex items-center justify-center p-4 border rounded-xl cursor-pointer transition ${appearanceForm.storeStatus === 'closed' ? 'border-red-500 bg-red-50' : 'border-neutral-200 hover:border-neutral-300'}`}>
                      <input type="radio" value="closed" checked={appearanceForm.storeStatus === 'closed'} onChange={() => setAppearanceForm({...appearanceForm, storeStatus: 'closed'})} className="sr-only" />
                      <div className="flex flex-col items-center gap-1">
                        <span className={`text-sm font-medium ${appearanceForm.storeStatus === 'closed' ? 'text-red-700' : 'text-neutral-700'}`}>Fechado Manual</span>
                        <span className="text-[10px] text-center text-neutral-500">Não aceitará novos pedidos agora</span>
                      </div>
                    </label>

                    <label className={`relative flex items-center justify-center p-4 border rounded-xl cursor-pointer transition ${appearanceForm.storeStatus === 'auto' ? 'border-orange-500 bg-orange-50' : 'border-neutral-200 hover:border-neutral-300'}`}>
                      <input type="radio" value="auto" checked={appearanceForm.storeStatus === 'auto'} onChange={() => setAppearanceForm({...appearanceForm, storeStatus: 'auto'})} className="sr-only" />
                      <div className="flex flex-col items-center gap-1">
                        <span className={`text-sm font-medium ${appearanceForm.storeStatus === 'auto' ? 'text-orange-700' : 'text-neutral-700'}`}>Automático</span>
                        <span className="text-[10px] text-center text-neutral-500">Segue os horários configurados abaixo</span>
                      </div>
                    </label>
                  </div>

                  {/* Informações de Contato & Pagamentos */}
                  <div className="border-t border-neutral-100 pt-6 border-b border-neutral-100 pb-4">
                    <h3 className="text-base font-semibold text-neutral-900">Informações de Contato & Recepção</h3>
                    <p className="text-xs text-neutral-500 mt-1">Canais de recebimento e contato para pedidos do seu restaurante.</p>
                  </div>

                  <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
                    <div>
                      <label className="block text-sm font-medium text-neutral-700 mb-1">Telefone WhatsApp</label>
                      <input type="text" value={appearanceForm.phone} onChange={e => setAppearanceForm({...appearanceForm, phone: e.target.value})} className="w-full rounded-lg ring-1 ring-inset ring-neutral-300 px-3 py-2 text-sm focus:ring-2 focus:ring-orange-600 outline-none" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-neutral-700 mb-1">Chave Pix (Para receber pagamentos)</label>
                      <input type="text" value={appearanceForm.pixKey} onChange={e => setAppearanceForm({...appearanceForm, pixKey: e.target.value})} className="w-full rounded-lg ring-1 ring-inset ring-neutral-300 px-3 py-2 text-sm focus:ring-2 focus:ring-orange-600 outline-none" placeholder="Ex: email@..., +5585999..., 123.456.789-00" />
                      <p className="text-[11px] text-neutral-500 mt-1">Para telefone use o formato: <strong>+55DDD999999999</strong> (sem espaços/traços)</p>
                    </div>
                  </div>

                  {/* Horários de Atendimento na Semana */}
                  <div className="sm:col-span-2 mt-4 border-t border-neutral-100 pt-6">
                    <label className="block text-sm font-semibold text-neutral-950 mb-3">Horários de Atendimento na Semana</label>
                    <div className="flex flex-col gap-3">
                      {(['segunda', 'terca', 'quarta', 'quinta', 'sexta', 'sabado', 'domingo'] as const).map(day => {
                        const isClosed = appearanceForm.weeklyHours?.[day]?.closed || false;
                        const startTime = appearanceForm.weeklyHours?.[day]?.start || '';
                        const endTime = appearanceForm.weeklyHours?.[day]?.end || '';

                        return (
                          <div key={day} className="flex flex-col sm:flex-row sm:items-center gap-3">
                            <span className="w-24 text-sm font-medium text-neutral-600 capitalize">
                              {day === 'terca' ? 'Terça' : day === 'sabado' ? 'Sábado' : day}
                            </span>
                            
                            <div className="flex items-center gap-2 flex-grow">
                              <label className="flex items-center gap-2 text-sm text-neutral-700 w-24 select-none cursor-pointer">
                                <input 
                                  type="checkbox" 
                                  checked={isClosed}
                                  onChange={e => setAppearanceForm({
                                    ...appearanceForm, 
                                    weeklyHours: {
                                      ...appearanceForm.weeklyHours, 
                                      [day]: { ...appearanceForm.weeklyHours?.[day], closed: e.target.checked }
                                    }
                                  })}
                                  className="rounded border-neutral-300 text-orange-600 focus:ring-orange-600"
                                />
                                Fechado
                              </label>

                              <div className={`flex items-center gap-2 transition-opacity ${isClosed ? 'opacity-30 pointer-events-none' : ''}`}>
                                <input 
                                  type="time" 
                                  value={startTime} 
                                  onChange={e => setAppearanceForm({...appearanceForm, weeklyHours: {...appearanceForm.weeklyHours, [day]: { ...appearanceForm.weeklyHours?.[day], start: e.target.value }}})} 
                                  className="rounded-lg ring-1 ring-inset ring-neutral-300 px-3 py-1.5 text-sm focus:ring-2 focus:ring-orange-600 outline-none w-28" 
                                />
                                <span className="text-neutral-400 text-sm">às</span>
                                <input 
                                  type="time" 
                                  value={endTime} 
                                  onChange={e => setAppearanceForm({...appearanceForm, weeklyHours: {...appearanceForm.weeklyHours, [day]: { ...appearanceForm.weeklyHours?.[day], end: e.target.value }}})} 
                                  className="rounded-lg ring-1 ring-inset ring-neutral-300 px-3 py-1.5 text-sm focus:ring-2 focus:ring-orange-600 outline-none w-28" 
                                />
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Taxas de Entrega / Bairros */}
                  <div className="border-t border-neutral-100 mt-6 pt-6 mb-4">
                    <h3 className="text-base font-semibold text-neutral-900">Taxas de Entrega / Bairros</h3>
                    <p className="text-xs text-neutral-500 mt-1">Configure o valor da entrega para cada bairro ou região.</p>
                  </div>
                  
                  <div className="space-y-4">
                    {(appearanceForm.deliveryFees || []).map((fee, index) => (
                      <div key={fee.id} className="flex flex-col sm:flex-row items-center gap-3">
                        <input 
                          type="text" 
                          value={fee.name}
                          placeholder="Nome do Bairro"
                          onChange={(e) => {
                            const newFees = [...(appearanceForm.deliveryFees || [])];
                            newFees[index] = { ...newFees[index], name: e.target.value };
                            setAppearanceForm({ ...appearanceForm, deliveryFees: newFees });
                          }}
                          className="w-full sm:flex-1 rounded-lg ring-1 ring-inset ring-neutral-300 px-3 py-2 text-sm focus:ring-2 focus:ring-orange-600 outline-none"
                        />
                        <div className="flex items-center gap-2 w-full sm:w-auto">
                          <span className="text-sm text-neutral-500 font-bold ml-1">R$</span>
                          <input 
                            type="number"
                            min="0"
                            step="0.01"
                            value={fee.fee}
                            onChange={(e) => {
                              const newFees = [...(appearanceForm.deliveryFees || [])];
                              newFees[index] = { ...newFees[index], fee: parseFloat(e.target.value) || 0 };
                              setAppearanceForm({ ...appearanceForm, deliveryFees: newFees });
                            }}
                            className="w-24 rounded-lg ring-1 ring-inset ring-neutral-300 px-3 py-2 text-sm focus:ring-2 focus:ring-orange-600 outline-none"
                          />
                          <button 
                            type="button"
                            onClick={() => {
                              const newFees = (appearanceForm.deliveryFees || []).filter((_, i) => i !== index);
                              setAppearanceForm({ ...appearanceForm, deliveryFees: newFees });
                            }}
                            className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition"
                          >
                            <Trash2 size={18} />
                          </button>
                        </div>
                      </div>
                    ))}
                    <button 
                      type="button"
                      onClick={() => {
                        setAppearanceForm({ 
                          ...appearanceForm, 
                          deliveryFees: [...(appearanceForm.deliveryFees || []), { id: Date.now().toString(), name: '', fee: 0 }] 
                        });
                      }}
                      className="flex items-center justify-center p-3 rounded-xl border border-dashed border-orange-300 text-orange-600 hover:bg-orange-50 font-semibold transition gap-2 w-full text-sm"
                    >
                      <Plus size={16} /> Adicionar Taxa de Entrega
                    </button>
                  </div>

                  <div className="pt-6 flex justify-end border-t border-neutral-100 mt-6">
                    <button onClick={handleSaveAppearance} className="px-6 py-2.5 text-sm font-medium text-white bg-neutral-900 hover:bg-neutral-800 rounded-full transition cursor-pointer select-none">Salvar Alterações</button>
                  </div>
                </div>
              </div>
            )}

            {/* --- Avisos TAB --- */}
            {activeTab === "announcements" && (
              <div className="space-y-6 max-w-4xl">
                {/* Header */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div>
                    <h2 className="text-xl font-bold text-neutral-900">Avisos do Cardápio</h2>
                    <p className="text-xs text-neutral-500 mt-1">
                      Crie avisos, comunicados e promoções para os clientes verem no topo do seu cardápio público.
                    </p>
                  </div>
                  <button 
                    onClick={() => {
                      setAnnouncementsForm({
                        id: "",
                        title: "",
                        message: "",
                        type: "warning",
                        hasExpiration: false,
                        expirationDate: "",
                      });
                      setAnnouncementError("");
                      setIsAnnouncementsModalOpen(true);
                    }}
                    className="flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-bold text-white bg-orange-600 hover:bg-orange-700 rounded-full transition shadow-md shadow-orange-100 cursor-pointer"
                  >
                    <Plus size={16} /> Novo Aviso
                  </button>
                </div>

                {/* List */}
                <div className="space-y-4">
                  {announcements.length === 0 ? (
                    <div className="rounded-2xl border border-neutral-200 border-dashed bg-white p-12 text-center flex flex-col items-center justify-center gap-3">
                      <div className="p-4 bg-orange-50 text-orange-600 rounded-full">
                        <Megaphone size={32} />
                      </div>
                      <div className="space-y-1">
                        <h3 className="font-semibold text-neutral-900 text-sm">Nenhum aviso criado</h3>
                        <p className="text-xs text-neutral-500 max-w-xs mx-auto">
                          Comunique-se diretamente com seus clientes de forma instantânea adicionando um aviso que aparecerá no topo do cardápio.
                        </p>
                      </div>
                      <button 
                        onClick={() => {
                          setAnnouncementsForm({
                            id: "",
                            title: "",
                            message: "",
                            type: "warning",
                            hasExpiration: false,
                            expirationDate: "",
                          });
                          setAnnouncementError("");
                          setIsAnnouncementsModalOpen(true);
                        }}
                        className="text-xs font-bold text-orange-600 hover:text-orange-700 cursor-pointer"
                      >
                        Criar meu primeiro aviso
                      </button>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 gap-4">
                      {announcements.map((item) => {
                        const isExpired = item.hasExpiration && item.expiresAt && currentTime > item.expiresAt;
                        
                        // Get type styled color variables
                        let colorClasses = {
                          bg: "bg-amber-50 border-amber-200 text-amber-800",
                          indicator: "bg-amber-500",
                          badge: "bg-amber-100 text-amber-800"
                        };
                        
                        if (item.type === "info") {
                          colorClasses = {
                            bg: "bg-indigo-50 border-indigo-200 text-indigo-800",
                            indicator: "bg-indigo-500",
                            badge: "bg-indigo-100 text-indigo-800"
                          };
                        } else if (item.type === "success") {
                          colorClasses = {
                            bg: "bg-emerald-50 border-emerald-200 text-emerald-800",
                            indicator: "bg-emerald-500",
                            badge: "bg-emerald-100 text-emerald-800"
                          };
                        } else if (item.type === "danger") {
                          colorClasses = {
                            bg: "bg-rose-50 border-rose-200 text-rose-800",
                            indicator: "bg-rose-500",
                            badge: "bg-rose-100 text-rose-800"
                          };
                        }

                        return (
                          <div 
                            key={item.id} 
                            className="rounded-2xl border bg-white p-5 shadow-sm hover:shadow-md transition flex flex-col md:flex-row md:items-center justify-between gap-4"
                          >
                            <div className="flex gap-4">
                              <div className={`w-2 rounded-full ${colorClasses.indicator} shrink-0`} />
                              
                              <div className="space-y-1.5 flex-grow">
                                <div className="flex flex-wrap items-center gap-2">
                                  {item.title && (
                                    <h4 className="font-bold text-neutral-900 text-sm">{item.title}</h4>
                                  )}
                                  
                                  <span className={`text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full ${colorClasses.badge}`}>
                                    {item.type === "warning" ? "Atenção" : item.type === "info" ? "Informativo" : item.type === "success" ? "Sucesso" : "Urgente"}
                                  </span>

                                  {item.isActive ? (
                                    <span className="text-[10px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full">Ativo</span>
                                  ) : (
                                    <span className="text-[10px] font-semibold text-neutral-500 bg-neutral-100 px-2 py-0.5 rounded-full">Pausado</span>
                                  )}

                                  {isExpired && (
                                    <span className="text-[10px] font-semibold text-rose-700 bg-rose-50 px-2 py-0.5 rounded-full border border-rose-100 animate-pulse">Expirado</span>
                                  )}
                                </div>
                                
                                <p className="text-xs text-neutral-700 leading-relaxed whitespace-pre-wrap">{item.message}</p>
                                
                                <div className="flex items-center gap-1 text-[11px] text-neutral-500 pt-1">
                                  <Clock size={12} />
                                  <span>
                                    {item.hasExpiration && item.expiresAt ? (
                                      <>Expira em: <strong>{new Date(item.expiresAt).toLocaleString("pt-BR")}</strong></>
                                    ) : (
                                      "Sem expiração (persistente)"
                                    )}
                                  </span>
                                </div>
                              </div>
                            </div>

                            <div className="flex items-center gap-2 self-end md:self-center">
                              <button
                                onClick={() => handleToggleAnnouncementActive(item)}
                                className={`px-3 py-1.5 rounded-xl text-xs font-semibold cursor-pointer select-none transition ${item.isActive ? 'bg-neutral-100 text-neutral-700 hover:bg-neutral-200' : 'bg-orange-50 text-orange-600 hover:bg-orange-100'}`}
                              >
                                {item.isActive ? "Pausar" : "Ativar"}
                              </button>
                              
                              <button
                                onClick={() => {
                                  setAnnouncementsForm({
                                    id: item.id,
                                    title: item.title || "",
                                    message: item.message || "",
                                    type: item.type || "warning",
                                    hasExpiration: !!item.hasExpiration,
                                    expirationDate: item.expiresAt ? new Date(item.expiresAt - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 16) : "",
                                  });
                                  setAnnouncementError("");
                                  setIsAnnouncementsModalOpen(true);
                                }}
                                className="p-2 text-neutral-500 hover:text-neutral-700 hover:bg-neutral-100 rounded-xl transition cursor-pointer"
                                title="Editar aviso"
                              >
                                <Pencil size={16} />
                              </button>

                              <button
                                onClick={() => {
                                  setDeleteConfirm({
                                    isOpen: true,
                                    title: "Excluir Aviso",
                                    message: "Deseja realmente excluir este aviso? Esta ação é irreversível.",
                                    onConfirm: () => {
                                      handleDeleteAnnouncement(item.id);
                                      setDeleteConfirm(null);
                                    }
                                  });
                                }}
                                className="p-2 text-rose-500 hover:text-rose-700 hover:bg-rose-50 rounded-xl transition cursor-pointer"
                                title="Excluir aviso"
                              >
                                <Trash2 size={16} />
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* --- QR Code TAB --- */}
            {activeTab === "qrcode" && (
              <div className="space-y-6 max-w-2xl">
                <div className="rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm text-center py-12">
                  <div className="mb-6 mx-auto w-48 h-48 bg-neutral-100 rounded-xl flex items-center justify-center p-4 overflow-hidden">
                    {restaurant?.slug ? (
                      <img src={`https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${encodeURIComponent(window.location.origin + '/' + restaurant.slug)}`} alt="QR Code" className="w-full h-full mix-blend-multiply" />
                    ) : (
                      <div className="text-xs text-neutral-400">Carregando QR Code...</div>
                    )}
                  </div>
                  <h2 className="text-xl font-bold text-neutral-900 mb-2">Seu QR Code está pronto!</h2>
                  <p className="text-neutral-600 mb-8 max-w-md mx-auto">Imprima e coloque nas mesas ou balcão para seus clientes acessarem o cardápio instantaneamente.</p>
                  <p className="font-mono text-sm text-orange-600 mb-4 break-all">
                    {restaurant?.slug ? `${window.location.origin}/${restaurant.slug}` : "Carregando endereço..."}
                  </p>
                  {restaurant?.slug && (
                    <div className="flex justify-center mt-6">
                      <button
                        onClick={handleGenerateQRPDF}
                        className="px-6 py-3 bg-orange-600 text-white font-semibold rounded-full hover:bg-orange-700 transition flex items-center justify-center gap-2 cursor-pointer"
                      >
                        <FileDown size={18} />
                        Gerar PDF para Impressão (A4)
                      </button>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* --- Impressora TAB --- */}
            {activeTab === "printer" && (
              <div className="space-y-6 max-w-6xl">
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
                  
                  {/* Left Column: Printer Configuration */}
                  <div className="lg:col-span-7 space-y-6">
                    <div className="rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm">
                      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-neutral-100 pb-4 mb-6">
                        <div>
                          <h2 className="text-lg font-bold text-neutral-900">Impressora de Comandas</h2>
                          <p className="text-sm text-neutral-600 mt-1">Conecte sua impressora térmica via USB ou Bluetooth para imprimir pedidos.</p>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          <button 
                            onClick={handleSearchUSBPrinters}
                            disabled={searchingPrinters}
                            className="px-4 py-2 bg-neutral-900 text-white rounded-xl text-sm font-medium hover:bg-neutral-800 transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                          >
                            {searchingPrinters ? (
                              <>
                                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                Buscando...
                              </>
                            ) : (
                              <>
                                <Search size={16} /> USB
                              </>
                            )}
                          </button>
                          <button 
                            onClick={handleSearchBluetoothPrinters}
                            disabled={searchingPrinters}
                            className="px-4 py-2 bg-neutral-900 text-white rounded-xl text-sm font-medium hover:bg-blue-800 transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                          >
                            {searchingPrinters ? (
                              <>
                                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                Buscando...
                              </>
                            ) : (
                              <>
                                <Search size={16} /> Bluetooth
                              </>
                            )}
                          </button>
                        </div>
                      </div>

                      <div className="space-y-3">
                        {printers.length === 0 && !searchingPrinters ? (
                          <div className="text-center py-10 bg-neutral-50 rounded-xl border border-neutral-100">
                            <Printer size={32} className="mx-auto text-neutral-300 mb-2" />
                            <p className="text-sm text-neutral-500 font-medium">Nenhuma impressora conectada</p>
                            <p className="text-xs text-neutral-400 mt-1">Busque por dispositivos via USB ou Bluetooth acima.</p>
                          </div>
                        ) : (
                          printers.map(printer => (
                            <div key={printer.id} className="flex flex-col sm:flex-row items-center justify-between p-4 border rounded-xl bg-white border-neutral-200 shadow-sm gap-4">
                              <div className="flex items-center gap-3 w-full sm:w-auto">
                                <div className={`p-2 rounded-lg ${printer.connected ? 'bg-green-100 text-green-700' : 'bg-neutral-100 text-neutral-600'}`}>
                                  <Printer size={20} />
                                </div>
                                <div>
                                  <p className="font-semibold text-neutral-900 text-sm flex items-center gap-2">
                                    {printer.name}
                                    {printer.connected && (
                                      <span className="flex items-center gap-1 text-[10px] font-bold text-green-700 bg-green-100 px-2 py-0.5 rounded-full uppercase tracking-wider">
                                        <CheckCircle2 size={10} /> Conectado
                                      </span>
                                    )}
                                  </p>
                                  <p className="text-xs text-neutral-500 mt-0.5">Conexão via {printer.type}</p>
                                </div>
                              </div>
                              
                              <div className="flex items-center gap-2 w-full sm:w-auto">
                                <button 
                                  onClick={() => {
                                    const text = "================================\n" +
                                                 "         TESTE IMPRESSORA       \n" +
                                                 "================================\n" +
                                                 "MenuFlow PDV\n" +
                                                 "Conexão OK!\n\n\n\n\n";
                                    printTextEscPos(printer, text).then(() => alert("Enviado para impressora.")).catch(e => alert("Erro: " + e.message));
                                  }}
                                  className="flex-1 sm:flex-none px-3 py-1.5 border border-neutral-200 rounded-lg text-xs font-medium text-neutral-700 hover:bg-neutral-50 transition"
                                >
                                  Testar Impressão
                                </button>
                                {!printer.connected && (
                                  <button 
                                    onClick={() => handleConnectPrinter(printer)}
                                    className="flex-1 sm:flex-none px-3 py-1.5 bg-orange-600 text-white rounded-lg text-xs font-medium hover:bg-orange-700 transition"
                                  >
                                    Conectar
                                  </button>
                                )}
                              </div>
                            </div>
                          ))
                        )}
                      </div>
                      
                      {/* Configurações Globais de Impressão */}
                      <div className="mt-8 border-t border-neutral-100 pt-6 space-y-5">
                        <div>
                          <h3 className="text-sm font-bold text-neutral-800 uppercase tracking-wider flex items-center gap-2">
                            <span>⚙️</span> Configurações Gerais da Comanda
                          </h3>
                          <p className="text-xs text-neutral-500 mt-1">Ajuste o formato e o tamanho da comanda para a sua impressora física.</p>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
                          {/* Largura da Bobina */}
                          <div className="bg-neutral-50 p-4 rounded-xl border border-neutral-100 space-y-2">
                            <label className="text-xs font-bold text-neutral-600 block">
                              Largura da Bobina Térmica:
                            </label>
                            <div className="flex bg-neutral-200/60 rounded-xl p-0.5">
                              <button
                                type="button"
                                onClick={() => handleSetPaperWidth("58mm")}
                                className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition ${
                                  previewPaperWidth === "58mm"
                                    ? "bg-white text-neutral-900 shadow-sm"
                                    : "text-neutral-500 hover:text-neutral-800"
                                }`}
                              >
                                58mm
                              </button>
                              <button
                                type="button"
                                onClick={() => handleSetPaperWidth("80mm")}
                                className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition ${
                                  previewPaperWidth === "80mm"
                                    ? "bg-white text-neutral-900 shadow-sm"
                                    : "text-neutral-500 hover:text-neutral-800"
                                }`}
                              >
                                80mm (Padrão)
                              </button>
                            </div>
                          </div>

                          {/* Tamanho da Fonte */}
                          <div className="bg-neutral-50 p-4 rounded-xl border border-neutral-100 space-y-2">
                            <label className="text-xs font-bold text-neutral-600 block">
                              Tamanho da Fonte:
                            </label>
                            <div className="flex items-center gap-3">
                              <input
                                type="range"
                                min="10"
                                max="24"
                                value={printerFontSize}
                                onChange={(e) => handleSetFontSize(parseInt(e.target.value, 10))}
                                className="flex-1 accent-orange-600 h-1.5 bg-neutral-200 rounded-lg appearance-none cursor-pointer"
                              />
                              <span className="text-xs font-bold text-neutral-800 font-mono w-12 text-center bg-white border border-neutral-200 py-1 rounded-lg shadow-sm">
                                {printerFontSize}px
                              </span>
                            </div>
                          </div>

                          {/* Auto Conectar */}
                          <div className="bg-neutral-50 p-4 rounded-xl border border-neutral-100 space-y-2">
                            <label className="text-xs font-bold text-neutral-600 block">
                              Conexão Automática:
                            </label>
                            <div className="flex items-center justify-between h-9">
                              <span className="text-[11px] text-neutral-500 font-medium leading-tight">
                                Auto-conectar ao iniciar o PDV
                              </span>
                              <button
                                type="button"
                                onClick={() => handleSetAutoConnect(!autoConnectEnabled)}
                                className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                                  autoConnectEnabled ? "bg-orange-600" : "bg-neutral-200"
                                }`}
                              >
                                <span
                                  className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                                    autoConnectEnabled ? "translate-x-4" : "translate-x-0"
                                  }`}
                                />
                              </button>
                            </div>
                          </div>
                        </div>
                      </div>
                      
                      <div className="mt-8 space-y-4">
                        <div className="bg-orange-50 border border-orange-100 rounded-2xl p-5 flex flex-col md:flex-row gap-4 items-start">
                          <div className="text-orange-600 mt-1 shrink-0 bg-white p-1.5 rounded-xl shadow-sm">
                            <AlertCircle size={20} />
                          </div>
                          <div className="space-y-2">
                            <p className="text-sm font-extrabold text-orange-950">
                              Método Recomendado: Impressão Inteligente do Navegador (Sem Instalar Nada)
                            </p>
                            <p className="text-xs text-orange-850 leading-relaxed font-medium">
                              Se você não conseguir conectar por USB direta (devido a bloqueios de driver do Windows), 
                              <strong> não se preocupe!</strong> Nosso sistema já abre uma janela de impressão do navegador perfeitamente formatada para bobinas térmicas de <strong>58mm e 80mm</strong>.
                            </p>
                            <p className="text-xs text-orange-850 leading-relaxed font-medium">
                              Basta clicar em "Imprimir" em qualquer pedido. Se nenhuma impressora direta estiver pareada, a janela do próprio sistema abrirá para você selecionar sua impressora térmica instalada e imprimir instantaneamente com 100% de compatibilidade!
                            </p>
                          </div>
                        </div>

                        <div className="bg-blue-50 border border-blue-150 rounded-2xl p-5 flex flex-col md:flex-row gap-4 items-start">
                          <div className="text-blue-600 mt-1 shrink-0 bg-white p-1.5 rounded-xl shadow-sm">
                            <Printer size={20} />
                          </div>
                          <div className="space-y-3 w-full">
                            <div>
                              <p className="text-sm font-extrabold text-blue-950">
                                Método Avançado: Impressão Direta (WebUSB)
                              </p>
                              <p className="text-xs text-blue-800 leading-relaxed font-medium mt-1">
                                A impressão direta envia o texto diretamente para a impressora por cabo, sem abrir nenhuma janela na tela.
                                No entanto, por padrão o Windows bloqueia o navegador de acessar portas USB.
                              </p>
                            </div>
                            <div className="flex flex-wrap gap-2">
                              <button
                                onClick={() => {
                                  setUsbErrorDetails("Guia de Configuração Zadig");
                                  setShowUsbAccessDeniedGuide(true);
                                }}
                                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-sm"
                              >
                                <span>📖</span> Como resolver "Acesso Negado" no Windows (Guia Zadig)
                              </button>
                              
                              <button
                                onClick={() => {
                                  // Abre uma popup de teste usando o HTML print
                                  const testWindow = window.open('', '_blank', 'width=350,height=500');
                                  if (testWindow) {
                                    testWindow.document.write(`
                                      <html>
                                        <head>
                                          <title>Teste de Impressão</title>
                                          <style>
                                            @page { margin: 0; }
                                            body { font-family: 'Courier New', monospace; font-size: 14px; font-weight: bold; padding: 15px; }
                                          </style>
                                        </head>
                                        <body>
                                          <div style="text-align: center;">
                                            <h3>TESTE DE IMPRESSÃO</h3>
                                            <p>---------------------------</p>
                                            <p>MenuFlow funcionando!</p>
                                            <p>Seja bem-vindo!</p>
                                            <p>---------------------------</p>
                                            <p>Selecione sua impressora térmica na lista de impressão que abrir agora.</p>
                                          </div>
                                          <script>
                                            window.onload = function() {
                                              window.print();
                                              window.close();
                                            }
                                          </script>
                                        </body>
                                      </html>
                                    `);
                                    testWindow.document.close();
                                  } else {
                                    alert("Por favor, habilite popups no seu navegador.");
                                  }
                                }}
                                className="px-4 py-2 bg-neutral-100 hover:bg-neutral-200 text-neutral-800 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer border border-neutral-200"
                              >
                                <span>🖨️</span> Testar Impressão do Navegador (Sem cabo/Zadig)
                              </button>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Right Column: Visual Thermal Receipt Preview */}
                  <div className="lg:col-span-5 space-y-4 lg:sticky lg:top-6">
                    <div className="rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm space-y-6">
                      <div className="border-b border-neutral-100 pb-3">
                        <h3 className="text-base font-bold text-neutral-900 flex items-center gap-2">
                          <Eye size={18} className="text-orange-600 animate-pulse" />
                          Visualizar Impressão da Comanda
                        </h3>
                        <p className="text-xs text-neutral-500 mt-1">
                          Veja como o cupom/ticket fica formatado antes de enviar para a impressora térmica física.
                        </p>
                      </div>

                      {/* Controls inside Preview Card */}
                      <div className="space-y-4">
                        <div>
                          <label className="text-xs font-bold text-neutral-500 uppercase tracking-wider block mb-1.5">
                            Selecione o Pedido:
                          </label>
                          <select
                            value={previewSelectedOrderId}
                            onChange={(e) => setPreviewSelectedOrderId(e.target.value)}
                            className="w-full px-3 py-2 border border-neutral-200 rounded-xl text-xs font-medium focus:ring-1 focus:ring-orange-500 focus:border-orange-500 bg-neutral-50 text-neutral-800 cursor-pointer"
                          >
                            <option value="mock">✨ Pedido de Exemplo (MenuFlow)</option>
                            {orders && orders.slice(0, 10).map((o) => {
                              const dateStr = o.createdAt
                                ? new Date(o.createdAt).toLocaleTimeString("pt-BR", {
                                    hour: "2-digit",
                                    minute: "2-digit",
                                  })
                                : "";
                              return (
                                <option key={o.id} value={o.id}>
                                  #{o.sequenceNumber || "S/N"} - {o.customerName || "Cliente"} ({dateStr}) - R$ {(o.total || 0).toFixed(2)}
                                </option>
                              );
                            })}
                          </select>
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <label className="text-xs font-bold text-neutral-500 uppercase tracking-wider block mb-1.5">
                              Largura da Bobina:
                            </label>
                            <div className="flex bg-neutral-100 rounded-xl p-0.5">
                              <button
                                type="button"
                                onClick={() => handleSetPaperWidth("58mm")}
                                className={`flex-1 py-1.5 text-[10px] font-bold rounded-lg transition ${
                                  previewPaperWidth === "58mm"
                                    ? "bg-white text-neutral-900 shadow-sm"
                                    : "text-neutral-500 hover:text-neutral-800"
                                }`}
                              >
                                58mm (Estrita)
                              </button>
                              <button
                                type="button"
                                onClick={() => handleSetPaperWidth("80mm")}
                                className={`flex-1 py-1.5 text-[10px] font-bold rounded-lg transition ${
                                  previewPaperWidth === "80mm"
                                    ? "bg-white text-neutral-900 shadow-sm"
                                    : "text-neutral-500 hover:text-neutral-800"
                                }`}
                              >
                                80mm (Padrão)
                              </button>
                            </div>
                          </div>

                          <div>
                            <label className="text-xs font-bold text-neutral-500 uppercase tracking-wider block mb-1.5">
                              Tipo de Comanda:
                            </label>
                            <div className="flex bg-neutral-100 rounded-xl p-0.5">
                              <button
                                type="button"
                                onClick={() => setPreviewDestination("cliente")}
                                className={`flex-1 py-1.5 text-[10px] font-bold rounded-lg transition ${
                                  previewDestination === "cliente"
                                    ? "bg-white text-neutral-900 shadow-sm"
                                    : "text-neutral-500 hover:text-neutral-800"
                                }`}
                              >
                                Cliente/Caixa
                              </button>
                              <button
                                type="button"
                                onClick={() => setPreviewDestination("cozinha")}
                                className={`flex-1 py-1.5 text-[10px] font-bold rounded-lg transition ${
                                  previewDestination === "cozinha"
                                    ? "bg-white text-neutral-900 shadow-sm"
                                    : "text-neutral-500 hover:text-neutral-800"
                                }`}
                              >
                                Cozinha
                              </button>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Printer Mockup Container */}
                      <div className="bg-neutral-950 rounded-3xl p-4 pt-6 shadow-2xl relative border border-neutral-800">
                        {/* Status light and feed buttons */}
                        <div className="absolute top-3 left-5 flex gap-1.5 items-center">
                          <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse shadow-[0_0_8px_rgba(34,197,94,0.8)]" />
                          <span className="text-[8px] text-neutral-500 font-mono tracking-widest font-bold">READY</span>
                        </div>
                        <div className="absolute top-3 right-5 flex gap-2 text-[8px] text-neutral-500 font-mono font-bold">
                          <span>FEED</span>
                          <span>ONLINE</span>
                        </div>

                        {/* Paper Output Slot Mockup */}
                        <div className="bg-neutral-900 h-2.5 rounded-md shadow-[inset_0_2px_4px_rgba(0,0,0,0.6)] border-b border-neutral-850 relative z-10" />

                        {/* The Actual Thermal Receipt Paper */}
                        <div className="relative mt-[-1px] z-0">
                          {/* Torn paper top pattern */}
                          <div className="h-2 bg-white" style={{
                            backgroundImage: "linear-gradient(-45deg, #0a0a0a 4px, transparent 0), linear-gradient(45deg, #0a0a0a 4px, transparent 0)",
                            backgroundSize: "8px 8px",
                            backgroundPosition: "bottom center"
                          }} />

                          {/* Paper Roll content */}
                          <div 
                            className={`bg-white text-neutral-950 p-5 font-mono leading-relaxed shadow-xl border-x border-neutral-200 transition-all duration-300 mx-auto ${
                              previewPaperWidth === "58mm" ? "max-w-[250px]" : "max-w-[340px]"
                            }`}
                            style={{
                              boxShadow: "0 15px 35px -10px rgba(0,0,0,0.3)",
                              fontFamily: "'Courier New', Courier, monospace",
                              fontWeight: "bold",
                              fontSize: `${Math.max(8, printerFontSize - 4)}px`
                            }}
                          >
                            <div className="whitespace-pre overflow-hidden">
                              {(() => {
                                // Dynamic characters per line based on paper width selection
                                const maxChars = previewPaperWidth === "58mm" ? 32 : 40;
                                const charLine = (char: string) => char.repeat(maxChars);
                                
                                const formatReceiptLine = (left: string, right: string = "") => {
                                  if (!right) return left;
                                  const spacesNeeded = maxChars - left.length - right.length;
                                  if (spacesNeeded <= 0) {
                                    const available = maxChars - right.length - 1;
                                    return left.substring(0, Math.max(0, available)) + " " + right;
                                  }
                                  return left + " ".repeat(spacesNeeded) + right;
                                };

                                const formatCenter = (text: string) => {
                                  const padding = Math.max(0, Math.floor((maxChars - text.length) / 2));
                                  return " ".repeat(padding) + text;
                                };

                                // Get actual or mock order
                                const order = (() => {
                                  if (previewSelectedOrderId !== "mock") {
                                    const found = orders.find(o => o.id === previewSelectedOrderId);
                                    if (found) return found;
                                  }
                                  return {
                                    id: "sample-123",
                                    sequenceNumber: 15,
                                    checkoutType: "entrega",
                                    createdAt: Date.now() - 10 * 60 * 1000,
                                    waiterName: pdvWaiterName || "Carlos Souza",
                                    customerName: "André Oliveira",
                                    contactPhone: "(85) 99123-4567",
                                    paymentMethod: "dinheiro",
                                    changeFor: "100.00",
                                    deliveryFee: 7.00,
                                    neighborhood: "Aldeota",
                                    deliveryAddress: "Rua Maria Tomásia, 1500 - Ap 402",
                                    observation: "Sem cebola no hambúrguer.",
                                    total: 62.90,
                                    isPaid: true,
                                    items: [
                                      {
                                        name: "Burguer Especial MenuFlow",
                                        qty: 1,
                                        price: 32.90,
                                        selectedFlavors: [],
                                        selectedAddons: [
                                          { name: "Cheddar Duplo", price: 5.00 },
                                          { name: "Bacon Crocante", price: 4.00 }
                                        ],
                                        selectedComplements: [
                                          { name: "Batata Frita 150g" }
                                        ],
                                        selectedSauces: [
                                          { name: "Maionese de Ervas" }
                                        ],
                                        obs: "Retirar cebola"
                                      },
                                      {
                                        name: "Lata Coca-Cola",
                                        qty: 1,
                                        price: 6.00,
                                        selectedFlavors: [],
                                        selectedAddons: [],
                                        selectedComplements: [],
                                        selectedSauces: [],
                                        obs: "Gelada"
                                      },
                                      {
                                        name: "Batata Frita Tradicional",
                                        qty: 1,
                                        price: 8.00,
                                        selectedFlavors: [],
                                        selectedAddons: [],
                                        selectedComplements: [],
                                        selectedSauces: [],
                                        obs: ""
                                      }
                                    ]
                                  };
                                })();

                                const seqNumber = String(order.sequenceNumber || "01").padStart(2, "0");
                                const checkoutTypeTitle = order.checkoutType === "mesa" ? `MESA ${order.tableNumber || ""}` : (order.checkoutType || "BALCÃO").toUpperCase();
                                const orderDate = order.createdAt 
                                  ? new Date(order.createdAt).toLocaleDateString("pt-BR") + " " + new Date(order.createdAt).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })
                                  : new Date().toLocaleDateString("pt-BR") + " " + new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });

                                // Items rendering in pure text
                                const itemsText = order.items?.map((item: any) => {
                                  let itemLines = formatReceiptLine(`${item.qty}x ${item.name}`, previewDestination !== "cozinha" ? `R$ ${(item.price * item.qty).toFixed(2)}` : "") + "\n";
                                  
                                  if (item.selectedFlavors && item.selectedFlavors.length > 0) {
                                    item.selectedFlavors.forEach((fl: any) => {
                                      itemLines += formatReceiptLine(`  Sabor: ${fl.name}`) + "\n";
                                    });
                                  }
                                  if (item.selectedAddons && item.selectedAddons.length > 0) {
                                    item.selectedAddons.forEach((ad: any) => {
                                      itemLines += formatReceiptLine(`  + ${ad.name}`, previewDestination !== "cozinha" ? `R$ ${(ad.price || 0).toFixed(2)}` : "") + "\n";
                                    });
                                  }
                                  if (item.selectedComplements && item.selectedComplements.length > 0) {
                                    item.selectedComplements.forEach((co: any) => {
                                      itemLines += formatReceiptLine(`  - ${co.name}`) + "\n";
                                    });
                                  }
                                  if (item.selectedSauces && item.selectedSauces.length > 0) {
                                    item.selectedSauces.forEach((sa: any) => {
                                      itemLines += formatReceiptLine(`  ~ Molho: ${sa.name}`) + "\n";
                                    });
                                  }
                                  if (item.obs) {
                                    itemLines += formatReceiptLine(`  * Obs: ${item.obs}`) + "\n";
                                  }
                                  return itemLines;
                                }).join("") || "";

                                // Build lines array
                                const lines: string[] = [];
                                lines.push(charLine("="));
                                lines.push(formatCenter(`DESTINO: ${previewDestination.toUpperCase()}`));
                                lines.push(charLine("="));
                                lines.push(formatCenter(checkoutTypeTitle));
                                lines.push(charLine("="));
                                lines.push(formatCenter(orderDate));
                                if (order.waiterName) {
                                  lines.push(formatCenter(`Atendente: ${order.waiterName}`));
                                }
                                lines.push(formatCenter(restaurant?.name?.toUpperCase() || "RESTAURANTE"));
                                const previewPhone = restaurant?.phone || appearanceForm.phone;
                                if (previewPhone) {
                                  lines.push(formatCenter(`Fone: ${previewPhone}`));
                                }
                                lines.push(charLine("="));
                                lines.push(formatCenter(`Pedido ${seqNumber}`));
                                lines.push(charLine("-"));
                                
                                // Append item block (which ends with a newline)
                                lines.push(itemsText.trimEnd());
                                
                                lines.push(charLine("-"));
                                lines.push(formatReceiptLine(`Cliente: ${order.customerName}`));
                                if (order.contactPhone) {
                                  lines.push(formatReceiptLine(`Fone: ${order.contactPhone}`));
                                }
                                
                                if (order.checkoutType === "entrega") {
                                  lines.push(formatReceiptLine(`End: ${order.deliveryAddress || ""}`));
                                  if (order.neighborhood) {
                                    lines.push(formatReceiptLine(`Bairro: ${order.neighborhood}`));
                                  }
                                } else if (order.checkoutType === "mesa") {
                                  lines.push(formatReceiptLine(`Mesa: ${order.tableNumber || ""}`));
                                }

                                if (order.observation) {
                                  lines.push(formatReceiptLine(`OBS: ${order.observation}`));
                                }

                                if (previewDestination !== "cozinha") {
                                  lines.push(charLine("-"));
                                  const subtotal = order.total - (order.deliveryFee || 0);
                                  lines.push(formatReceiptLine("Subtotal:", `R$ ${subtotal.toFixed(2)}`));
                                  if (order.deliveryFee > 0) {
                                    lines.push(formatReceiptLine("Taxa Entrega:", `R$ ${order.deliveryFee.toFixed(2)}`));
                                  }
                                  lines.push(formatReceiptLine("TOTAL:", `R$ ${order.total.toFixed(2)}`));
                                  
                                  const payMethodMap: Record<string, string> = { dinheiro: "Dinheiro", pix: "Pix", cartao: "Cartão" };
                                  lines.push(formatReceiptLine("Pagamento:", payMethodMap[order.paymentMethod] || order.paymentMethod));
                                  
                                  if (order.paymentMethod === "dinheiro" && order.changeFor) {
                                    const rawChange = String(order.changeFor).replace(",", ".");
                                    const changeForNum = parseFloat(rawChange) || 0;
                                    const trocoValue = changeForNum - order.total;
                                    lines.push(formatReceiptLine("Troco para:", `R$ ${changeForNum.toFixed(2)}`));
                                    if (trocoValue > 0) {
                                      lines.push(formatReceiptLine("Valor do Troco:", `R$ ${trocoValue.toFixed(2)}`));
                                    }
                                  }
                                }

                                return lines.map((l, i) => <div key={i} className="min-h-[1.2em]">{l}</div>);
                              })()}
                            </div>

                            {/* Paid stamp */}
                            {previewDestination !== "cozinha" && (() => {
                              const order = (() => {
                                if (previewSelectedOrderId !== "mock") {
                                  const found = orders.find(o => o.id === previewSelectedOrderId);
                                  if (found) return found;
                                }
                                return { isPaid: true };
                              })();
                              return order.isPaid ? (
                                <div className="mt-5 flex justify-center opacity-75">
                                  <div className="border-4 border-double border-green-600 text-green-600 px-3 py-1 rounded-xl font-sans font-black text-[10px] uppercase tracking-widest rotate-[-6deg] select-none shadow-sm">
                                    ✓ PAGO / CONFIRMADO
                                  </div>
                                </div>
                              ) : null;
                            })()}
                          </div>

                          {/* Torn paper bottom pattern */}
                          <div className="h-3 bg-white" style={{
                            backgroundImage: "linear-gradient(-45deg, transparent 4px, #0a0a0a 0), linear-gradient(45deg, transparent 4px, #0a0a0a 0)",
                            backgroundSize: "8px 8px",
                            backgroundPosition: "top center"
                          }} />
                        </div>
                      </div>
                    </div>
                  </div>

                </div>
              </div>
            )}

            {/* --- Assinatura TAB --- */}
            {activeTab === "subscription" && (() => {
              const basePrice = plansConfig?.premium?.price ?? 59.90;
              const disc = restaurant?.subscriptionDiscount || 0;
              const finalPrice = Math.max(0, basePrice - disc);
              
              const getNextPaymentDate = () => {
                if (!restaurant?.paymentDay) return null;
                const payDay = Number(restaurant.paymentDay);
                const now = new Date();
                let billingDate = new Date(now.getFullYear(), now.getMonth(), payDay);
                if (now.getDate() > payDay) {
                  billingDate.setMonth(billingDate.getMonth() + 1);
                }
                return billingDate.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
              };

              const getPlanStartDate = () => {
                const ts = restaurant?.planStartedAt || restaurant?.createdAt;
                if (!ts) return null;
                return new Date(ts).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
              };

              const getDaysUntilVencimentoVal = () => {
                if (!restaurant?.paymentDay) return null;
                const payDay = Number(restaurant.paymentDay);
                const now = new Date();
                let billingDate = new Date(now.getFullYear(), now.getMonth(), payDay);
                if (now.getDate() > payDay) {
                  billingDate.setMonth(billingDate.getMonth() + 1);
                }
                const diffTime = billingDate.getTime() - now.getTime();
                const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
                return diffDays;
              };

              const nextPayDate = getNextPaymentDate();
              const startDate = getPlanStartDate();
              const daysRemaining = getDaysUntilVencimentoVal();

              return (
                <div className="space-y-6 max-w-3xl">
                  {/* Main Plan Card Header */}
                  <div className="relative overflow-hidden rounded-3xl border border-neutral-200 bg-white p-6 sm:p-8 shadow-sm flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
                    {/* Background Subtle Accent */}
                    <div className="absolute top-0 right-0 w-32 h-32 bg-orange-600/5 rounded-bl-full pointer-events-none" />
                    
                    <div className="space-y-2 max-w-xl">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-black uppercase tracking-widest text-orange-600 bg-orange-50 px-2.5 py-1 rounded-lg">
                          Premium/Mensal
                        </span>
                        <span className="text-xs font-bold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-lg flex items-center gap-1">
                          ● Ativo e Regularizado
                        </span>
                      </div>
                      <h3 className="text-2xl font-black text-neutral-900 tracking-tight">
                        {plansConfig?.premium?.name || "Premium"}
                      </h3>
                    </div>
                    
                    <div className="shrink-0 flex flex-col items-start md:items-end gap-1.5 bg-neutral-50/50 p-4 rounded-2xl border border-neutral-100">
                      <span className="text-[10px] uppercase font-bold text-neutral-400 tracking-wider">Valor do faturamento</span>
                      <strong className="text-2xl font-black text-neutral-900 font-mono">
                        R$ {finalPrice.toFixed(2).replace('.', ',')} <span className="text-xs font-normal text-neutral-500">/mês</span>
                      </strong>
                      {disc > 0 && (
                        <span className="text-[10px] text-emerald-650 bg-emerald-50 px-2 py-0.5 rounded font-black uppercase animate-pulse">
                          Desconto de R$ {disc.toFixed(2).replace('.', ',')} ativo
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Detailed Subscription Info Grid */}
                  {restaurant?.plan === "Premium" && (
                    <div className="grid gap-4 sm:grid-cols-2">
                      {/* Subscription Detail Card 1 */}
                      <div className="bg-white border border-neutral-200 rounded-3xl p-5 shadow-none flex items-start gap-4">
                        <div className="w-10 h-10 rounded-2xl bg-orange-50 text-orange-600 flex items-center justify-center shrink-0">
                          <Clock size={20} />
                        </div>
                        <div className="space-y-1">
                          <span className="text-xs text-neutral-400 font-bold uppercase tracking-wider block">Datas de Vigência</span>
                          <div className="text-sm text-neutral-800 font-medium space-y-1 mt-1">
                            <p className="flex justify-between gap-4">
                              <span className="text-neutral-500">Ativação do Plano:</span>
                              <strong className="text-neutral-900 font-semibold">{startDate || "Cadastro inicial"}</strong>
                            </p>
                            <p className="flex justify-between gap-4">
                              <span className="text-neutral-500">Dia de faturamento:</span>
                              <strong className="text-neutral-900 font-semibold">
                                {restaurant?.paymentDay ? `Todo dia ${restaurant.paymentDay}` : "Sem dia fixo"}
                              </strong>
                            </p>
                          </div>
                        </div>
                      </div>

                      {/* Subscription Detail Card 2 (Expiration) */}
                      <div className="bg-white border border-neutral-200 rounded-3xl p-5 shadow-none flex items-start gap-4">
                        <div className="w-10 h-10 rounded-2xl bg-orange-50 text-orange-600 flex items-center justify-center shrink-0">
                          <Calendar size={20} />
                        </div>
                        <div className="space-y-1 flex-1">
                          <span className="text-xs text-neutral-400 font-bold uppercase tracking-wider block">Próximo Vencimento</span>
                          {nextPayDate ? (
                            <div className="mt-1">
                              <p className="text-lg font-black text-neutral-900 font-mono tracking-tight">{nextPayDate}</p>
                              <p className="text-[11px] text-neutral-500 font-medium">A cobrança será enviada via WhatsApp para renovação simples.</p>
                            </div>
                          ) : (
                            <div className="mt-1">
                              <p className="text-sm font-semibold text-neutral-700 italic">Vencimento flexível</p>
                              <p className="text-[11px] text-neutral-400">Contate o suporte ou Master Admin para definir seu dia de faturamento fixo.</p>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Pix Area when due within 5 days */}
                  {restaurant?.plan === "Premium" && daysRemaining !== null && daysRemaining <= 5 && (
                    <div className="bg-orange-50/50 border border-orange-200 rounded-3xl p-6 shadow-sm space-y-4 animate-in fade-in slide-in-from-top-4 duration-300">
                      <div className="flex gap-3 items-center">
                        <span className="w-2.5 h-2.5 rounded-full bg-orange-500 animate-pulse shrink-0" />
                        <h4 className="text-base font-extrabold text-orange-955 uppercase tracking-wider flex items-center gap-2">
                           Pagar Renovação Mensal ({daysRemaining <= 0 ? "Vencido" : `Vence em ${daysRemaining} dias`})
                        </h4>
                      </div>
                      <p className="text-sm text-neutral-600 leading-relaxed">
                        Faltam {daysRemaining <= 0 ? "0" : daysRemaining} dias para o faturamento da sua mensalidade. Realize o pagamento de forma simples via Pix para garantir a continuidade do seu painel e do catálogo sem limite de produtos!
                      </p>

                      <div className="flex flex-col md:flex-row gap-6 items-center p-4 bg-white border border-neutral-200 rounded-2xl">
                        {/* QR Code Column */}
                        <div className="w-40 h-40 bg-white border border-neutral-100 rounded-xl flex items-center justify-center p-2 shadow-sm shrink-0">
                          <img 
                            src={`https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(getPixPayload(finalPrice))}`}
                            alt="QRCode Pix"
                            className="w-full h-full object-contain"
                            referrerPolicy="no-referrer"
                          />
                        </div>

                        {/* Copy & Paste Column */}
                        <div className="flex-1 space-y-3 w-full">
                          <span className="text-xs text-neutral-400 font-bold uppercase tracking-wider block">Chave Pix Copia e Cola</span>
                          <div className="flex gap-2 w-full">
                            <input 
                              type="text" 
                              readOnly 
                              value={getPixPayload(finalPrice)} 
                              className="flex-1 rounded-xl bg-neutral-50 border border-neutral-200 px-3 py-2 text-xs font-mono text-neutral-600 focus:outline-none select-all truncate"
                            />
                            <button 
                              type="button"
                              onClick={() => {
                                navigator.clipboard.writeText(getPixPayload(finalPrice));
                                setCopiedSubPix(true);
                                setTimeout(() => setCopiedSubPix(false), 2500);
                              }}
                              className="px-4 py-2 bg-neutral-900 hover:bg-neutral-800 text-white rounded-xl text-xs font-semibold transition flex items-center gap-1 shrink-0"
                            >
                              {copiedSubPix ? (
                                <>
                                  <Check size={14} className="text-green-400" />
                                  Copiado!
                                </>
                              ) : (
                                <>
                                  <Copy size={14} />
                                  Copiar
                                </>
                              )}
                            </button>
                          </div>
                          
                          <div className="flex flex-col sm:flex-row gap-2 pt-2">
                            <button
                              type="button"
                              disabled={submittingPayment}
                              onClick={() => handleRegisterPayment(finalPrice)}
                              className="flex-1 px-4 py-2.5 bg-orange-600 hover:bg-orange-700 disabled:opacity-50 text-white font-semibold text-xs rounded-xl transition flex items-center justify-center gap-1.5 shadow-sm"
                            >
                              {submittingPayment ? "Registrando..." : "Já paguei! Informar Pagamento"}
                            </button>
                            <a
                              href={`https://wa.me/${(plansConfig?.premium?.whatsappNumber || "5585991276477").replace(/\D/g, '')}?text=${encodeURIComponent(`Olá, acabei de realizar o pagamento da mensalidade de R$ ${finalPrice.toFixed(2).replace('.', ',')} da minha loja (${restaurant?.name}). Segue o comprovante.`)}`}
                              target="_blank"
                              rel="noreferrer"
                              className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-xl transition flex items-center justify-center gap-1.5"
                            >
                              Enviar Comprovante
                            </a>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Pricing and Billing Breakdown Sheet */}
                  {restaurant?.plan === "Premium" && (
                    <div className="bg-white border border-neutral-200 rounded-3xl p-6 shadow-sm space-y-4">
                      <h4 className="text-sm font-extrabold text-neutral-900 uppercase tracking-wider">Extrato da Fatura Atual</h4>
                      
                      <div className="divide-y divide-neutral-100 text-sm font-medium">
                        <div className="py-2.5 flex justify-between">
                          <span className="text-neutral-500">Valor Base Premium</span>
                          <span className="text-neutral-900 font-mono">R$ {basePrice.toFixed(2).replace('.', ',')}</span>
                        </div>
                        <div className="py-2.5 flex justify-between">
                          <span className="text-neutral-500">Desconto Especial Concedido</span>
                          <span className="text-emerald-700 font-mono">
                            {disc > 0 ? `- R$ ${disc.toFixed(2).replace('.', ',')}` : "R$ 0,00"}
                          </span>
                        </div>
                        <div className="py-3 flex justify-between text-base font-black border-t-2 border-neutral-200">
                          <span className="text-neutral-900">Total Mensal</span>
                          <span className="text-orange-600 font-mono">R$ {finalPrice.toFixed(2).replace('.', ',')}</span>
                        </div>
                      </div>

                      <div className="bg-neutral-50 rounded-2xl border border-neutral-200 p-4 text-xs text-neutral-500 leading-relaxed">
                        <div className="flex gap-2 items-start">
                          <div className="w-1.5 h-1.5 rounded-full bg-orange-500 shrink-0 mt-1.5" />
                          <p>
                            O faturamento é recorrente. Visando a facilidade e agilidade, as renovações são tratadas via PIX manual ou faturamento integrado no painel financeiro pelo Admin de forma individual.
                          </p>
                        </div>
                        <div className="flex gap-2 items-start mt-2">
                          <div className="w-1.5 h-1.5 rounded-full bg-orange-500 shrink-0 mt-1.5" />
                          <p>
                            Caso precise atualizar os dados cadastrais da fatura ou solicitar um desconto maior, fale diretamente com o suporte no WhatsApp.
                          </p>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Extrato de todos os pagamentos feito do plano */}
                  <div className="bg-white border border-neutral-200 rounded-3xl p-6 shadow-sm space-y-4">
                    <div className="flex justify-between items-center pb-2 border-b border-neutral-100">
                      <h4 className="text-sm font-extrabold text-neutral-900 uppercase tracking-wider flex items-center gap-2">
                        <FileText size={18} className="text-orange-500" />
                        Histórico de Extrato e Pagamentos do Plano
                      </h4>
                      <span className="text-[10px] uppercase font-bold text-neutral-400 bg-neutral-100 px-2 py-0.5 rounded-lg font-mono">
                        {payments.length} registradas
                      </span>
                    </div>

                    {payments.length === 0 ? (
                      <div className="text-center py-8 text-neutral-550 space-y-2">
                        <ClipboardList className="w-10 h-10 text-neutral-300 mx-auto" />
                        <p className="text-sm font-black text-neutral-700">Nenhum histórico ou recibo registrado.</p>
                        <p className="text-xs text-neutral-400 leading-normal max-w-md mx-auto">Quando houver faturamentos ou baixa de mensalidades pelo Administrador Master do sistema, eles aparecerão detalhados aqui.</p>
                      </div>
                    ) : (
                      <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse text-sm">
                          <thead>
                            <tr className="border-b border-neutral-100 text-[10px] uppercase font-bold text-neutral-400 tracking-wider">
                              <th className="py-2.5">Descrição</th>
                              <th className="py-2.5">Valor</th>
                              <th className="py-2.5">Data Baixa</th>
                              <th className="py-2.5">Método</th>
                              <th className="py-2.5 text-right">Status</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-neutral-100">
                            {payments.map((p) => {
                              const payDate = p.createdAt ? new Date(p.createdAt).toLocaleDateString('pt-BR') : '-';
                              return (
                                <tr key={p.id} className="hover:bg-neutral-50/20">
                                  <td className="py-3 font-semibold text-neutral-800">{p.reference || "Mensalidade"}</td>
                                  <td className="py-3 font-mono font-bold text-neutral-900">R$ {Number(p.amount || 0).toFixed(2).replace('.', ',')}</td>
                                  <td className="py-3 text-neutral-500 text-xs">{payDate}</td>
                                  <td className="py-3 text-neutral-500 text-xs">{p.method || "Pix"}</td>
                                  <td className="py-3 text-right">
                                    <span className={`inline-block px-2.5 py-1 text-[10px] font-bold rounded-lg uppercase tracking-wide ${
                                      p.status === "Pago" ? "bg-green-150 text-green-800" :
                                      p.status === "Pendente" ? "bg-orange-100 text-orange-800 animate-pulse" :
                                      "bg-red-100 text-red-800"
                                    }`}>
                                      {p.status || "Pendente"}
                                    </span>
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>

                </div>
              );
            })()}

            {/* --- Cardápio Impresso TAB --- */}
            {activeTab === "print_menu" && (
              <div className="space-y-6">
                {/* Style Overrides for Print and Custom Fonts */}
                <style dangerouslySetInnerHTML={{ __html: `
                  @import url('https://fonts.googleapis.com/css2?family=Outfit:wght@400;600;800&family=Playfair+Display:ital,wght@0,600;0,800;1,600&family=Merriweather:ital,wght@0,400;0,700;1,400&family=JetBrains+Mono:wght@400;700&display=swap');
                  
                  .font-modern { font-family: 'Outfit', sans-serif !important; }
                  .font-classic { font-family: 'Playfair Display', Georgia, serif !important; }
                  .font-rustic { font-family: 'Merriweather', Georgia, serif !important; }
                  .font-minimal { font-family: 'JetBrains Mono', monospace !important; }

                  @media print {
                    /* Hide everything in the UI */
                    body * {
                      visibility: hidden !important;
                    }
                    /* Show only the print area */
                    #print-area, #print-area * {
                      visibility: visible !important;
                    }
                    #print-area {
                      position: absolute !important;
                      left: 0 !important;
                      top: 0 !important;
                      width: 210mm !important;
                      margin: 0 !important;
                      padding: 0 !important;
                      background: white !important;
                    }
                    /* Force page breaks cleanly */
                    .print-page-break {
                      page-break-before: always !important;
                      break-before: page !important;
                    }
                    /* Clean A4 setup */
                    @page {
                      size: A4 portrait !important;
                      margin: 0 !important;
                    }
                  }
                `}} />

                {/* Main page Header block */}
                <div className="bg-white border border-neutral-200 rounded-3xl p-6 sm:p-8 shadow-sm flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
                  <div className="space-y-1">
                    <h3 className="text-xl font-bold text-neutral-900 flex items-center gap-2">
                      <FileText size={24} className="text-orange-600" />
                      Gerador de Cardápio Impresso A4
                    </h3>
                    <p className="text-sm text-neutral-500 font-medium">
                      Configure e exporte um cardápio físico personalizado pronto para impressão em folhas A4.
                    </p>
                  </div>
                  <button
                    onClick={() => window.print()}
                    className="px-6 py-3 bg-neutral-900 hover:bg-neutral-800 text-white rounded-xl text-sm font-bold shadow-md hover:shadow-lg transition flex items-center gap-2 cursor-pointer shrink-0"
                  >
                    <Printer size={18} />
                    Imprimir / Salvar PDF
                  </button>
                </div>

                {/* Dashboard layout */}
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                  {/* Left panel: Customizer settings */}
                  <div className="lg:col-span-5 space-y-6">
                    
                    {/* Categories selection checkboxes */}
                    <div className="bg-white border border-neutral-200 rounded-3xl p-6 shadow-sm space-y-4">
                      <div className="flex justify-between items-center pb-2 border-b border-neutral-100">
                        <h4 className="text-sm font-extrabold text-neutral-900 uppercase tracking-wider">Selecionar Categorias</h4>
                        <span className="text-[10px] bg-neutral-100 text-neutral-600 font-extrabold px-2 py-0.5 rounded-lg">
                          {printSelectedCategories.length} selecionadas
                        </span>
                      </div>
                      
                      <div className="flex gap-2 text-xs font-bold">
                        <button
                          onClick={() => setPrintSelectedCategories(categories.map(c => c.name))}
                          className="text-orange-600 hover:underline cursor-pointer"
                        >
                          Selecionar Todas
                        </button>
                        <span className="text-neutral-300">|</span>
                        <button
                          onClick={() => setPrintSelectedCategories([])}
                          className="text-neutral-500 hover:underline cursor-pointer"
                        >
                          Desmarcar Todas
                        </button>
                      </div>

                      <div className="space-y-1 max-h-48 overflow-y-auto pr-1">
                        {categories.map((cat) => {
                          const isChecked = printSelectedCategories.includes(cat.name);
                          return (
                            <label key={cat.id} className="flex items-center gap-3 p-2 hover:bg-neutral-50 rounded-xl cursor-pointer transition select-none">
                              <input
                                type="checkbox"
                                checked={isChecked}
                                onChange={() => {
                                  if (isChecked) {
                                    setPrintSelectedCategories(prev => prev.filter(name => name !== cat.name));
                                  } else {
                                    setPrintSelectedCategories(prev => [...prev, cat.name]);
                                  }
                                }}
                                className="w-4 h-4 rounded text-orange-600 border-neutral-350 focus:ring-orange-500 cursor-pointer"
                              />
                              <span className="text-sm text-neutral-800 font-bold">{cat.name}</span>
                            </label>
                          );
                        })}
                      </div>
                    </div>

                    {/* Styling presets & layout customizer */}
                    <div className="bg-white border border-neutral-200 rounded-3xl p-6 shadow-sm space-y-5">
                      <h4 className="text-sm font-extrabold text-neutral-900 uppercase tracking-wider pb-2 border-b border-neutral-100">
                        Estilo e Layout do Papel
                      </h4>

                      {/* Theme Font pairings */}
                      <div className="space-y-1.5">
                        <label className="block text-xs font-bold text-neutral-700">Tema Tipográfico</label>
                        <div className="grid grid-cols-2 gap-2">
                          {[
                            { id: "modern", label: "Moderno", desc: "Outfit / Clean" },
                            { id: "classic", label: "Clássico", desc: "Playfair / Elegante" },
                            { id: "rustic", label: "Rústico", desc: "Merriweather / Vintage" },
                            { id: "minimal", label: "Minimalista", desc: "Monospace / Bold" }
                          ].map((theme) => (
                            <button
                              key={theme.id}
                              onClick={() => setPrintThemeFont(theme.id as any)}
                              className={`p-3 rounded-2xl border text-left transition flex flex-col cursor-pointer ${
                                printThemeFont === theme.id
                                  ? "border-orange-600 bg-orange-50/50 ring-1 ring-orange-500"
                                  : "border-neutral-200 hover:border-neutral-300 bg-white"
                              }`}
                            >
                              <span className="text-xs font-bold text-neutral-900">{theme.label}</span>
                              <span className="text-[10px] text-neutral-500 font-medium mt-0.5">{theme.desc}</span>
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Columns alignment */}
                      <div className="grid grid-cols-2 gap-3 pt-1">
                        <div className="space-y-1.5">
                          <label className="block text-xs font-bold text-neutral-700">Visualização de Colunas</label>
                          <div className="flex rounded-xl border border-neutral-200 p-0.5 bg-neutral-50">
                            <button
                              type="button"
                              onClick={() => setPrintColumns(1)}
                              className={`flex-1 py-1.5 rounded-lg text-center text-xs font-bold transition cursor-pointer ${
                                printColumns === 1
                                  ? "bg-white text-neutral-900 shadow-sm"
                                  : "text-neutral-500 hover:text-neutral-800"
                              }`}
                            >
                              1 Coluna
                            </button>
                            <button
                              type="button"
                              onClick={() => setPrintColumns(2)}
                              className={`flex-1 py-1.5 rounded-lg text-center text-xs font-bold transition cursor-pointer ${
                                printColumns === 2
                                  ? "bg-white text-neutral-900 shadow-sm"
                                  : "text-neutral-500 hover:text-neutral-800"
                              }`}
                            >
                              2 Colunas
                            </button>
                          </div>
                        </div>

                        <div className="space-y-1.5">
                          <label className="block text-xs font-bold text-neutral-700">Destaques Visuais</label>
                          <select
                            value={printAccentStyle}
                            onChange={(e) => setPrintAccentStyle(e.target.value as any)}
                            className="w-full rounded-xl border border-neutral-200 px-3 py-1.5 text-xs font-bold text-neutral-700 bg-white outline-none focus:ring-2 focus:ring-orange-500 transition cursor-pointer"
                          >
                            <option value="colored">Cor da Loja</option>
                            <option value="elegant">Bordas Grafite</option>
                            <option value="classic">Clássico Vintage</option>
                            <option value="none">Preto e Branco</option>
                          </select>
                        </div>
                      </div>

                      {/* Header Title custom label */}
                      <div className="space-y-1.5">
                        <label className="block text-xs font-bold text-neutral-700">Título do Cardápio</label>
                        <input
                          type="text"
                          value={printTitle}
                          onChange={(e) => setPrintTitle(e.target.value)}
                          placeholder="Ex: Cardápio Principal"
                          className="w-full rounded-xl border border-neutral-200 px-3 py-2 text-xs font-bold text-neutral-800 bg-white outline-none focus:ring-2 focus:ring-orange-500 transition"
                        />
                      </div>
                    </div>

                    {/* Toggles and checkboxes to customize card content */}
                    <div className="bg-white border border-neutral-200 rounded-3xl p-6 shadow-sm space-y-4">
                      <h4 className="text-sm font-extrabold text-neutral-900 uppercase tracking-wider pb-2 border-b border-neutral-100">
                        Capa e Informações
                      </h4>

                      {/* Cover toggle */}
                      <div className="flex items-center justify-between p-1">
                        <div className="space-y-0.5">
                          <span className="text-xs font-bold text-neutral-800 block">Gerar Página de Capa</span>
                          <span className="text-[10px] text-neutral-500 block">Cria a página 1 com QR Code e logo ampliado</span>
                        </div>
                        <label className="relative inline-flex items-center cursor-pointer">
                          <input
                            type="checkbox"
                            checked={printShowCover}
                            onChange={(e) => setPrintShowCover(e.target.checked)}
                            className="sr-only peer"
                          />
                          <div className="w-9 h-5 bg-neutral-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-neutral-350 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-orange-600"></div>
                        </label>
                      </div>

                      {printShowCover && (
                        <div className="flex items-center justify-between p-1 border-t border-neutral-100 pt-3">
                          <div className="space-y-0.5">
                            <span className="text-xs font-bold text-neutral-800 block">Mostrar Logo na Capa</span>
                            <span className="text-[10px] text-neutral-500 block">Exibe a imagem oficial da loja na capa</span>
                          </div>
                          <label className="relative inline-flex items-center cursor-pointer">
                            <input
                              type="checkbox"
                              checked={printShowLogo}
                              onChange={(e) => setPrintShowLogo(e.target.checked)}
                              className="sr-only peer"
                            />
                            <div className="w-9 h-5 bg-neutral-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-neutral-350 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-orange-600"></div>
                          </label>
                        </div>
                      )}

                      {/* Prices toggle */}
                      <div className="flex items-center justify-between p-1 border-t border-neutral-100 pt-3">
                        <div className="space-y-0.5">
                          <span className="text-xs font-bold text-neutral-800 block">Mostrar Preços</span>
                          <span className="text-[10px] text-neutral-500 block">Exibe valores ao lado de cada item</span>
                        </div>
                        <label className="relative inline-flex items-center cursor-pointer">
                          <input
                            type="checkbox"
                            checked={printShowPrices}
                            onChange={(e) => setPrintShowPrices(e.target.checked)}
                            className="sr-only peer"
                          />
                          <div className="w-9 h-5 bg-neutral-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-neutral-350 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-orange-600"></div>
                        </label>
                      </div>

                      {/* Descriptions toggle */}
                      <div className="flex items-center justify-between p-1 border-t border-neutral-100 pt-3">
                        <div className="space-y-0.5">
                          <span className="text-xs font-bold text-neutral-800 block">Mostrar Descrições</span>
                          <span className="text-[10px] text-neutral-500 block">Imprime as descrições abaixo dos produtos</span>
                        </div>
                        <label className="relative inline-flex items-center cursor-pointer">
                          <input
                            type="checkbox"
                            checked={printShowDescriptions}
                            onChange={(e) => setPrintShowDescriptions(e.target.checked)}
                            className="sr-only peer"
                          />
                          <div className="w-9 h-5 bg-neutral-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-neutral-350 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-orange-600"></div>
                        </label>
                      </div>

                      {/* Out of Stock toggle */}
                      <div className="flex items-center justify-between p-1 border-t border-neutral-100 pt-3">
                        <div className="space-y-0.5">
                          <span className="text-xs font-bold text-neutral-800 block">Ocultar Indisponíveis</span>
                          <span className="text-[10px] text-neutral-500 block">Oculta itens marcados como esgotados</span>
                        </div>
                        <label className="relative inline-flex items-center cursor-pointer">
                          <input
                            type="checkbox"
                            checked={printHideOutOfStock}
                            onChange={(e) => setPrintHideOutOfStock(e.target.checked)}
                            className="sr-only peer"
                          />
                          <div className="w-9 h-5 bg-neutral-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-neutral-350 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-orange-600"></div>
                        </label>
                      </div>

                      {/* Product images toggle */}
                      <div className="flex items-center justify-between p-1 border-t border-neutral-100 pt-3">
                        <div className="space-y-0.5">
                          <span className="text-xs font-bold text-neutral-800 block">Imprimir Fotos dos Produtos</span>
                          <span className="text-[10px] text-amber-600 font-semibold block">Aviso: Consome mais tinta na impressão física</span>
                        </div>
                        <label className="relative inline-flex items-center cursor-pointer">
                          <input
                            type="checkbox"
                            checked={printShowImages}
                            onChange={(e) => setPrintShowImages(e.target.checked)}
                            className="sr-only peer"
                          />
                          <div className="w-9 h-5 bg-neutral-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-neutral-350 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-orange-600"></div>
                        </label>
                      </div>
                    </div>

                    {/* Quick helper notes on print setup */}
                    <div className="bg-amber-50 border border-amber-200 rounded-3xl p-4 text-xs text-amber-800 leading-relaxed space-y-1">
                      <p className="font-bold">💡 Dica de Impressão Profissional:</p>
                      <p>Na janela de impressão que abrir, configure o papel para tamanho <strong>A4</strong> e certifique-se de ativar a opção <strong>"Imprimir gráficos de fundo"</strong> (ou "Background Graphics") nas opções avançadas para imprimir as cores e faixas temáticas da sua loja!</p>
                    </div>

                  </div>

                  {/* Right panel: Live simulator preview page */}
                  <div className="lg:col-span-7 space-y-4">
                    <div className="flex items-center justify-between border-b border-neutral-200 pb-2">
                      <span className="text-xs font-extrabold text-neutral-500 uppercase tracking-wider block">
                        Visualização Prévia (A4 Portrait)
                      </span>
                      <span className="text-xs text-neutral-400 italic">
                        Visualização simulada proporcional
                      </span>
                    </div>

                    {/* Paper Container Simulator */}
                    <div className="bg-neutral-100 rounded-3xl p-6 border border-neutral-200 flex flex-col items-center justify-start min-h-[600px] max-h-[85vh] overflow-y-auto space-y-8 no-print select-none shadow-inner">
                      
                      {/* Simulated A4 Sheet 1: Cover Page */}
                      {printShowCover && (
                        <div className={`w-[450px] aspect-[1/1.414] bg-white border border-neutral-300 shadow-md p-8 flex flex-col justify-between items-center relative text-neutral-800 font-${printThemeFont} animate-in fade-in duration-250`}>
                          {/* Accent bar decoration */}
                          <div className="absolute top-0 inset-x-0 h-2" style={{ backgroundColor: printAccentStyle === 'colored' ? (restaurant?.primaryColor || '#ea580c') : printAccentStyle === 'elegant' ? '#404040' : printAccentStyle === 'classic' ? '#000000' : 'transparent' }}></div>
                          
                          {/* Upper Half: Restaurant Name & Description */}
                          <div className="w-full flex-1 flex flex-col items-center justify-center text-center space-y-2 pt-4">
                            <h1 className="text-2xl font-black tracking-tight text-neutral-900 leading-tight">
                              {restaurant?.name || "MenuFlow"}
                            </h1>
                            <p className="text-[10px] text-neutral-500 font-extrabold tracking-widest uppercase">
                              Cardápio de Delícias
                            </p>
                          </div>

                          {/* Middle Border & Logo Badge */}
                          <div className="w-full relative py-6 flex items-center justify-center">
                            {/* Horizontal Line (Middle Border) */}
                            <div className="absolute inset-x-0 top-1/2 h-[2px] -translate-y-1/2" style={{ backgroundColor: printAccentStyle === 'colored' ? (restaurant?.primaryColor || '#ea580c') : printAccentStyle === 'elegant' ? '#a3a3a3' : printAccentStyle === 'classic' ? '#171717' : '#e5e5e5' }}></div>
                            
                            {/* Circular Logo sitting centered on the border */}
                            {printShowLogo && (
                              <div className="relative z-10 bg-white p-1.5 rounded-full border border-neutral-200 shadow-md">
                                {restaurant?.logoUrl ? (
                                  <img src={restaurant.logoUrl} alt="Logo" className="w-16 h-16 object-cover rounded-full" />
                                ) : (
                                  <div className="w-16 h-16 rounded-full flex items-center justify-center text-white" style={{ backgroundColor: restaurant?.primaryColor || '#ea580c' }}>
                                    <Store size={28} />
                                  </div>
                                )}
                              </div>
                            )}
                          </div>

                          {/* Lower Half: QR Code, Call to action, and Footer */}
                          <div className="w-full flex-1 flex flex-col items-center justify-center space-y-4">
                            {/* Center big QR Code */}
                            <div className="flex flex-col items-center space-y-2.5 text-center">
                              <div className="p-3 bg-neutral-50 rounded-2xl border border-neutral-200 shadow-sm">
                                <img
                                  src={`https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(window.location.origin + '/' + (restaurant?.slug || ""))}`}
                                  alt="QR Code"
                                  className="w-24 h-24 mix-blend-multiply"
                                />
                              </div>
                              <div className="space-y-0.5 max-w-[280px]">
                                <p className="text-xs font-bold text-neutral-800">
                                  Faça seu pedido também pelo celular!
                                </p>
                                <p className="text-[9px] text-neutral-500 font-medium leading-relaxed">
                                  Aponte a câmera do celular para ver fotos, adicionar adicionais e pedir de forma 100% digital e prática.
                                </p>
                              </div>
                            </div>
                          </div>

                          {/* Footer */}
                          <div className="w-full text-center pb-1 border-t border-neutral-100 pt-3 text-[8px] text-neutral-400 font-bold space-y-1">
                            {restaurant?.phone && <p>📞 Whatsapp para Pedidos: {restaurant.phone}</p>}
                            <p>Acesse online: {window.location.origin}/{restaurant?.slug}</p>
                          </div>
                        </div>
                      )}

                      {/* Simulated A4 Sheet 2: Menu Items Page */}
                      <div className={`w-[450px] aspect-[1/1.414] bg-white border border-neutral-300 shadow-md p-8 flex flex-col justify-between items-stretch relative text-neutral-800 font-${printThemeFont}`}>
                        {/* Accent bar decoration */}
                        <div className="absolute top-0 inset-x-0 h-2" style={{ backgroundColor: printAccentStyle === 'colored' ? (restaurant?.primaryColor || '#ea580c') : printAccentStyle === 'elegant' ? '#404040' : printAccentStyle === 'classic' ? '#000000' : 'transparent' }}></div>
                        
                        <div className="flex-1 overflow-hidden flex flex-col pt-4">
                          {/* Header of printed menu sheet */}
                          <div className="flex items-center justify-between border-b pb-4 mb-4 border-neutral-200">
                            <div className="space-y-1">
                              <h2 className="text-xl font-extrabold tracking-tight text-neutral-900 leading-none">
                                {printTitle}
                              </h2>
                              <p className="text-[9px] font-bold text-neutral-400 uppercase tracking-widest">
                                {restaurant?.name}
                              </p>
                            </div>
                            <div className="flex items-center gap-2 shrink-0">
                              {printShowLogo && restaurant?.logoUrl && (
                                <img src={restaurant.logoUrl} alt="Logo" className="w-10 h-10 object-cover rounded-lg border border-neutral-150" />
                              )}
                              <div className="p-1 bg-white border border-neutral-200 rounded-lg shadow-sm flex items-center justify-center">
                                <img
                                  src={`https://api.qrserver.com/v1/create-qr-code/?size=100x100&data=${encodeURIComponent(window.location.origin + '/' + (restaurant?.slug || ""))}`}
                                  alt="QR Code"
                                  className="w-10 h-10 mix-blend-multiply"
                                />
                              </div>
                            </div>
                          </div>

                          {/* Menu sections inside previews */}
                          <div className="flex-1 overflow-y-auto pr-1 space-y-6">
                            {categories
                              .filter(cat => printSelectedCategories.includes(cat.name))
                              .map((cat) => {
                                const catProducts = products.filter(p => p.category === cat.name && (!printHideOutOfStock || !p.isOutOfStock));
                                if (catProducts.length === 0) return null;
                                return (
                                  <div key={cat.id} className="space-y-3">
                                    <h3 className="text-xs font-bold border-l-4 border-neutral-900 pl-2 text-neutral-900 uppercase tracking-wider" style={{ borderColor: printAccentStyle === 'colored' ? (restaurant?.primaryColor || '#ea580c') : undefined }}>
                                      {cat.name}
                                    </h3>
                                    
                                    <div className={printColumns === 2 ? "grid grid-cols-2 gap-x-4 gap-y-3" : "space-y-3"}>
                                      {catProducts.map(p => (
                                        <div key={p.id} className="text-left flex gap-2 items-start break-inside-avoid">
                                          {printShowImages && p.imageUrl && (
                                            <img src={p.imageUrl} alt={p.name} className="w-7 h-7 object-cover rounded border border-neutral-100 shrink-0" />
                                          )}
                                          <div className="flex-1 min-w-0 space-y-0.5">
                                            <div className="flex items-baseline justify-between gap-1.5">
                                              <span className="text-[11px] font-bold text-neutral-900 truncate">{p.name}</span>
                                              <div className="flex-1 border-b border-dotted border-neutral-350"></div>
                                              {printShowPrices && (
                                                <span className="text-[11px] font-bold text-neutral-900 shrink-0">R$ {Number(p.price || 0).toFixed(2)}</span>
                                              )}
                                            </div>
                                            {printShowDescriptions && p.description && (
                                              <p className="text-[9px] text-neutral-500 leading-tight line-clamp-2">{p.description}</p>
                                            )}
                                          </div>
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                );
                              })}
                            {printSelectedCategories.length === 0 && (
                              <div className="text-center py-16 text-neutral-400">
                                <p className="text-xs font-bold">Nenhuma categoria selecionada.</p>
                                <p className="text-[10px] mt-1">Marque pelo menos uma categoria no menu à esquerda.</p>
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Sheet footer */}
                        <div className="border-t border-neutral-100 pt-3 mt-4 text-center text-[8px] text-neutral-400 font-bold flex justify-between items-center">
                          <span>{restaurant?.name}</span>
                          <span className="flex items-center gap-1">
                            <QrCode size={10} /> Peça Online via QR Code
                          </span>
                        </div>
                      </div>

                    </div>
                  </div>
                </div>

                {/* HIDDEN PRINT CONTAINER: Styled and sized precisely for standard A4 Page output */}
                <div id="print-area" className="hidden print:block bg-white text-black text-left font-sans">
                  {/* Print Page 1: Cover Page */}
                  {printShowCover && (
                    <div className={`w-[210mm] min-h-[297mm] bg-white p-[25mm] flex flex-col justify-between items-center relative text-neutral-800 font-${printThemeFont} print-page`}>
                      {/* Top banner accent border */}
                      <div className="absolute top-0 inset-x-0 h-4" style={{ backgroundColor: printAccentStyle === 'colored' ? (restaurant?.primaryColor || '#ea580c') : printAccentStyle === 'elegant' ? '#404040' : printAccentStyle === 'classic' ? '#000000' : 'transparent' }}></div>

                      {/* Upper Half: Restaurant Name & Description */}
                      <div className="w-full flex-1 flex flex-col items-center justify-center text-center space-y-[4mm] pt-[10mm]">
                        <h1 className="text-[42px] font-black tracking-tight text-neutral-900 leading-tight">
                          {restaurant?.name || "MenuFlow"}
                        </h1>
                        <p className="text-[14px] font-bold tracking-[6px] text-neutral-500 uppercase">
                          Cardápio de Delícias
                        </p>
                      </div>

                      {/* Middle Border & Logo Badge for Print */}
                      <div className="w-full relative py-[12mm] flex items-center justify-center">
                        {/* Horizontal Line (Middle Border) */}
                        <div className="absolute inset-x-0 top-1/2 h-[4px] -translate-y-1/2" style={{ backgroundColor: printAccentStyle === 'colored' ? (restaurant?.primaryColor || '#ea580c') : printAccentStyle === 'elegant' ? '#a3a3a3' : printAccentStyle === 'classic' ? '#171717' : '#e5e5e5' }}></div>
                        
                        {/* Circular Logo sitting centered on the border */}
                        {printShowLogo && (
                          <div className="relative z-10 bg-white p-[4mm] rounded-full border border-neutral-200 shadow-md">
                            {restaurant?.logoUrl ? (
                              <img src={restaurant.logoUrl} alt="Logo" className="w-[36mm] h-[36mm] object-cover rounded-full" />
                            ) : (
                              <div className="w-[36mm] h-[36mm] rounded-full flex items-center justify-center text-white" style={{ backgroundColor: restaurant?.primaryColor || '#ea580c' }}>
                                <Store size={64} />
                              </div>
                            )}
                          </div>
                        )}
                      </div>

                      {/* Print Big QR Code */}
                      <div className="w-full flex-1 flex flex-col items-center justify-center space-y-[6mm]">
                        <div className="flex flex-col items-center space-y-[4mm] text-center">
                          <div className="p-[8mm] bg-neutral-50 rounded-[24px] border border-neutral-200">
                            <img
                              src={`https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(window.location.origin + '/' + (restaurant?.slug || ""))}`}
                              alt="QR Code"
                              className="w-[50mm] h-[50mm] mix-blend-multiply"
                            />
                          </div>
                          <div className="space-y-[2mm] max-w-[140mm]">
                            <p className="text-[18px] font-bold text-neutral-800">
                              Faça seu pedido também pelo celular!
                            </p>
                            <p className="text-[12px] text-neutral-500 leading-relaxed font-bold">
                              Aponte a câmera do celular para ver fotos reais dos pratos, selecionar acompanhamentos adicionais e realizar seu pedido de forma rápida!
                            </p>
                          </div>
                        </div>
                      </div>

                      {/* Cover Footer */}
                      <div className="w-full text-center pb-[5mm] border-t border-neutral-100 pt-[6mm] text-[12px] text-neutral-500 font-bold space-y-[1.5mm]">
                        {restaurant?.phone && <p>📞 Whatsapp para Contato: {restaurant.phone}</p>}
                        <p>Acesse nosso cardápio digital: {window.location.origin}/{restaurant?.slug}</p>
                      </div>
                    </div>
                  )}

                  {/* Print Page 2: Menu Items Page */}
                  <div className={`w-[210mm] min-h-[297mm] bg-white p-[20mm] flex flex-col justify-between items-stretch relative text-neutral-800 font-${printThemeFont} ${printShowCover ? "print-page-break" : ""}`}>
                    {/* Top banner accent border */}
                    <div className="absolute top-0 inset-x-0 h-4" style={{ backgroundColor: printAccentStyle === 'colored' ? (restaurant?.primaryColor || '#ea580c') : printAccentStyle === 'elegant' ? '#404040' : printAccentStyle === 'classic' ? '#000000' : 'transparent' }}></div>

                    <div className="flex-1 flex flex-col pt-[10mm]">
                      {/* Menu Sheet Header */}
                      <div className="flex items-center justify-between border-b pb-[6mm] mb-[8mm] border-neutral-200">
                        <div className="space-y-[2mm]">
                          <h2 className="text-[28px] font-black tracking-tight text-neutral-900 leading-none">
                            {printTitle}
                          </h2>
                          <p className="text-[11px] font-bold text-neutral-500 uppercase tracking-[3px]">
                            {restaurant?.name}
                          </p>
                        </div>
                        <div className="flex items-center gap-[4mm] shrink-0">
                          {printShowLogo && restaurant?.logoUrl && (
                            <img src={restaurant.logoUrl} alt="Logo" className="w-[16mm] h-[16mm] object-cover rounded-2xl border border-neutral-150" />
                          )}
                          <div className="p-[1.5mm] bg-white border border-neutral-200 rounded-xl shadow-sm flex items-center justify-center">
                            <img
                              src={`https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(window.location.origin + '/' + (restaurant?.slug || ""))}`}
                              alt="QR Code"
                              className="w-[16mm] h-[16mm] mix-blend-multiply"
                            />
                          </div>
                        </div>
                      </div>

                      {/* Items rendered by category */}
                      <div className="space-y-[10mm]">
                        {categories
                          .filter(cat => printSelectedCategories.includes(cat.name))
                          .map((cat) => {
                            const catProducts = products.filter(p => p.category === cat.name && (!printHideOutOfStock || !p.isOutOfStock));
                            if (catProducts.length === 0) return null;
                            return (
                              <div key={cat.id} className="space-y-[4mm] break-inside-avoid">
                                <h3 className="text-[13px] font-bold border-l-4 border-neutral-900 pl-[3.5mm] text-neutral-900 uppercase tracking-[1.5px]" style={{ borderColor: printAccentStyle === 'colored' ? (restaurant?.primaryColor || '#ea580c') : undefined }}>
                                  {cat.name}
                                </h3>
                                
                                <div className={printColumns === 2 ? "grid grid-cols-2 gap-x-[12mm] gap-y-[4mm]" : "space-y-[4mm]"}>
                                  {catProducts.map(p => (
                                    <div key={p.id} className="text-left flex gap-[3.5mm] items-start break-inside-avoid">
                                      {printShowImages && p.imageUrl && (
                                        <img src={p.imageUrl} alt={p.name} className="w-[11mm] h-[11mm] object-cover rounded-xl border border-neutral-200 shrink-0" />
                                      )}
                                      <div className="flex-1 min-w-0 space-y-[0.8mm]">
                                        <div className="flex items-baseline justify-between gap-[1.5mm]">
                                          <span className="text-[12px] font-bold text-neutral-900 truncate">{p.name}</span>
                                          <div className="flex-1 border-b border-dotted border-neutral-350"></div>
                                          {printShowPrices && (
                                            <span className="text-[12px] font-bold text-neutral-900 shrink-0">R$ {Number(p.price || 0).toFixed(2)}</span>
                                          )}
                                        </div>
                                        {printShowDescriptions && p.description && (
                                          <p className="text-[10px] text-neutral-500 leading-relaxed font-bold">{p.description}</p>
                                        )}
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            );
                          })}
                      </div>
                    </div>

                    {/* Menu Sheet Footer */}
                    <div className="border-t border-neutral-200 pt-[4mm] mt-[8mm] text-center text-[10px] text-neutral-500 font-bold flex justify-between items-center">
                      <span>{restaurant?.name} — Cardápio Oficial</span>
                      <span className="flex items-center gap-[1.5mm]">
                        <QrCode size={12} /> Acesse nosso Cardápio Digital para fazer pedidos
                      </span>
                    </div>
                  </div>
                </div>

              </div>
            )}

            {/* Pix Premium Checkout Modal */}
            {showPixModal && (
              <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
                <div className="w-full max-w-lg bg-white rounded-3xl border border-neutral-200 shadow-2xl overflow-hidden flex flex-col animate-in fade-in zoom-in-95 duration-200">
                  {/* Modal Header */}
                  <div className="px-6 py-4 border-b border-neutral-100 flex items-center justify-between bg-neutral-50">
                    <div>
                      <h3 className="font-bold text-lg text-neutral-900">Upgrade para Premium</h3>
                      <p className="text-xs text-neutral-500">Siga as instruções para ativar seu plano</p>
                    </div>
                    <button 
                      onClick={() => setShowPixModal(false)}
                      className="rounded-full p-1 text-neutral-400 hover:text-neutral-650 hover:bg-neutral-100 transition font-sans text-sm font-extrabold w-6 h-6 flex items-center justify-center"
                    >
                      ✕
                    </button>
                  </div>

                  {/* Modal Content */}
                  <div className="p-6 overflow-y-auto max-h-[80vh] space-y-6">
                    {/* Price Tag Details */}
                    <div className="bg-orange-50 border border-orange-100 rounded-2xl p-4 text-center">
                      <p className="text-xs text-orange-850 font-bold uppercase tracking-wider">Assinatura Mensal</p>
                      <p className="text-3xl font-extrabold text-neutral-900 mt-1">R$ {(plansConfig?.premium?.price ?? 59.90).toFixed(2).replace('.', ',')}</p>
                      <p className="text-xs text-neutral-500 mt-1 font-medium">Recursos ilimitados para sua loja decolar</p>
                    </div>

                    {/* QR Code and Instructions */}
                    <div className="flex flex-col items-center text-center space-y-4">
                      <div className="p-3 bg-neutral-50 rounded-2xl border border-neutral-100">
                        <img 
                          src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(getPixPayload())}`}
                          alt="QR Code Pix"
                          className="w-44 h-44 object-contain mix-blend-multiply"
                        />
                      </div>
                      <p className="text-xs text-neutral-500 max-w-xs leading-relaxed">
                        Abra o aplicativo do seu banco, escolha a opção <strong>"Pagar com QR Code / Pix"</strong> e aponte a câmera para a imagem acima.
                      </p>
                    </div>

                    {/* Pix Copia e Cola Area */}
                    <div className="space-y-2">
                      <label className="block text-xs font-bold text-neutral-700 uppercase tracking-wide">Código Pix Copia e Cola</label>
                      <div className="flex gap-2">
                        <input 
                          type="text" 
                          readOnly 
                          value={getPixPayload()} 
                          className="flex-1 rounded-xl bg-neutral-50 border border-neutral-200 px-3 py-2 text-xs font-mono text-neutral-600 focus:outline-none"
                        />
                        <button 
                          onClick={() => {
                            navigator.clipboard.writeText(getPixPayload());
                            setCopiedPix(true);
                            setTimeout(() => setCopiedPix(false), 2500);
                          }}
                          className="px-4 py-2 bg-neutral-900 text-white rounded-xl text-xs font-semibold hover:bg-neutral-800 transition flex items-center gap-1 shrink-0"
                        >
                          {copiedPix ? (
                            <>
                              <Check size={14} className="text-green-400" />
                              Copiado!
                            </>
                          ) : (
                            <>
                              <Copy size={14} />
                              Copiar
                            </>
                          )}
                        </button>
                      </div>
                    </div>

                    {/* Transfer Details Card */}
                    <div className="bg-neutral-50 rounded-2xl p-4 border border-neutral-200 text-xs text-neutral-700 leading-relaxed space-y-2">
                      <p className="font-bold text-neutral-950 border-b border-neutral-100 pb-1">Instruções de Transferência</p>
                      <p className="whitespace-pre-line font-medium leading-normal text-neutral-600">
                        {plansConfig?.premium?.pixInstructions || "Efetue o pagamento via Pix utilizando a chave acima e envie o comprovante ao nosso WhatsApp."}
                      </p>
                      <div className="pt-1 flex justify-between items-center">
                        <span className="font-bold uppercase text-[10px] tracking-wider text-neutral-400">Chave Pix</span>
                        <span className="font-mono font-semibold text-neutral-800 break-all select-all">{plansConfig?.premium?.pixKey || "pix@menuflow.com"}</span>
                      </div>
                    </div>

                    {/* WhatsApp Action and System Activation */}
                    <div className="pt-2">
                      <a 
                        href={`https://wa.me/${(plansConfig?.premium?.whatsappNumber || "5585991276477").replace(/\D/g, '')}?text=${encodeURIComponent(`Olá, acabei de efetuar o PIX correspondente ao upgrade do plano para Premium. Segue o comprovante de pagamento.`)}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="w-full flex items-center justify-center gap-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white py-3 text-sm font-bold transition shadow-md shadow-emerald-100 text-center"
                      >
                        Enviar Comprovante via WhatsApp
                      </a>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Modal de Criar/Editar Aviso */}
            {isAnnouncementsModalOpen && (
              <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
                <div className="w-full max-w-lg bg-white rounded-3xl border border-neutral-200 shadow-2xl overflow-hidden flex flex-col animate-in fade-in zoom-in-95 duration-200">
                  {/* Header */}
                  <div className="px-6 py-4 border-b border-neutral-100 flex items-center justify-between bg-neutral-50">
                    <div>
                      <h3 className="font-bold text-lg text-neutral-900">
                        {announcementsForm.id ? "Editar Aviso" : "Adicionar Aviso"}
                      </h3>
                      <p className="text-xs text-neutral-500">
                        Configure seu aviso para os clientes no cardápio
                      </p>
                    </div>
                    <button 
                      onClick={() => {
                        setIsAnnouncementsModalOpen(false);
                        setAnnouncementError("");
                      }}
                      className="p-1 text-neutral-400 hover:text-neutral-600 hover:bg-neutral-100 rounded-full transition cursor-pointer w-6 h-6 flex items-center justify-center font-bold"
                    >
                      ✕
                    </button>
                  </div>

                  {/* Body */}
                  <div className="p-6 space-y-4 max-h-[80vh] overflow-y-auto text-left">
                    {announcementError && (
                      <div className="p-3 bg-red-50 border border-red-200 text-red-600 rounded-xl text-xs flex gap-2 items-center">
                        <AlertCircle size={14} className="shrink-0" />
                        <span>{announcementError}</span>
                      </div>
                    )}

                    <div>
                      <label className="block text-sm font-medium text-neutral-700 mb-1">
                        Título do Aviso (Opcional)
                      </label>
                      <input 
                        type="text" 
                        placeholder="Ex: Alerta de feriado, Promoção de hoje"
                        value={announcementsForm.title} 
                        onChange={e => setAnnouncementsForm({...announcementsForm, title: e.target.value})} 
                        className="w-full rounded-lg ring-1 ring-inset ring-neutral-300 px-3 py-2 text-sm focus:ring-2 focus:ring-orange-600 outline-none" 
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-neutral-700 mb-1">
                        Mensagem / Conteúdo <span className="text-red-500">*</span>
                      </label>
                      <textarea 
                        rows={3}
                        placeholder="Ex: Devido ao feriado, hoje não faremos entregas..."
                        value={announcementsForm.message} 
                        onChange={e => setAnnouncementsForm({...announcementsForm, message: e.target.value})} 
                        className="w-full rounded-lg ring-1 ring-inset ring-neutral-300 px-3 py-2 text-sm focus:ring-2 focus:ring-orange-600 outline-none" 
                      />
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-neutral-700 mb-1">
                          Tipo / Cor do Alerta
                        </label>
                        <select
                          value={announcementsForm.type}
                          onChange={e => setAnnouncementsForm({...announcementsForm, type: e.target.value as any})}
                          className="w-full rounded-lg ring-1 ring-inset ring-neutral-300 px-3 py-2 text-sm focus:ring-2 focus:ring-orange-600 outline-none bg-white"
                        >
                          <option value="warning">Atenção (Amarelo / Laranja)</option>
                          <option value="info">Informativo (Azul)</option>
                          <option value="success">Sucesso (Verde)</option>
                          <option value="danger">Crítico / Urgente (Vermelho)</option>
                        </select>
                      </div>

                      <div className="flex flex-col justify-end">
                        <label className="flex items-center gap-2 text-sm text-neutral-700 cursor-pointer py-2 select-none">
                          <input 
                            type="checkbox" 
                            checked={announcementsForm.hasExpiration}
                            onChange={e => setAnnouncementsForm({...announcementsForm, hasExpiration: e.target.checked})}
                            className="rounded border-neutral-300 text-orange-600 focus:ring-orange-600"
                          />
                          Possui data de expiração?
                        </label>
                      </div>
                    </div>

                    {announcementsForm.hasExpiration && (
                      <div className="p-4 bg-neutral-50 rounded-2xl border border-neutral-100 space-y-2 animate-in fade-in slide-in-from-top-1 duration-200">
                        <label className="block text-sm font-medium text-neutral-700 mb-1">
                          Data e Hora de Expiração
                        </label>
                        <input 
                          type="datetime-local" 
                          value={announcementsForm.expirationDate} 
                          onChange={e => setAnnouncementsForm({...announcementsForm, expirationDate: e.target.value})} 
                          className="w-full rounded-lg ring-1 ring-inset ring-neutral-300 px-3 py-2 text-sm focus:ring-2 focus:ring-orange-600 outline-none bg-white font-sans" 
                        />
                        <p className="text-[11px] text-neutral-500">
                          O aviso sumirá automaticamente do cardápio após o horário programado.
                        </p>
                      </div>
                    )}
                  </div>

                  {/* Footer */}
                  <div className="px-6 py-4 bg-neutral-50 border-t border-neutral-100 flex items-center justify-end gap-3 whitespace-nowrap">
                    <button 
                      onClick={() => {
                        setIsAnnouncementsModalOpen(false);
                        setAnnouncementError("");
                      }}
                      className="px-4 py-2 text-sm font-medium text-neutral-500 hover:text-neutral-700 transition cursor-pointer"
                    >
                      Cancelar
                    </button>
                    <button 
                      onClick={handleSaveAnnouncement}
                      className="px-6 py-2 text-sm font-bold text-white bg-orange-600 hover:bg-orange-700 rounded-xl transition shadow-md shadow-orange-100 cursor-pointer"
                    >
                      {announcementsForm.id ? "Atualizar Aviso" : "Salvar Aviso"}
                    </button>
                  </div>
                </div>
              </div>
            )}

          </div>
        </div>
      </main>

      {/* Toast Notifications */}
      <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2">
        {toasts.map(toast => (
          <div key={toast.id} className="animate-in slide-in-from-right-8 fade-in duration-300 pointer-events-auto">
            <div className={`flex items-center gap-3 px-4 py-3 rounded-2xl shadow-lg border-2 ${
              toast.type === "new" ? "bg-orange-600 border-orange-500 text-white" : "bg-white border-green-500 text-neutral-900"
            }`}>
              <div className={`flex items-center justify-center w-8 h-8 rounded-full ${
                toast.type === "new" ? "bg-white/20" : "bg-green-100"
              }`}>
                {toast.type === "new" ? (
                  <MessageSquare className="w-4 h-4 text-white" />
                ) : (
                  <CheckCircle2 className="w-4 h-4 text-green-600" />
                )}
              </div>
              <div className="flex-1 font-semibold text-sm">
                {toast.message}
              </div>
              <button onClick={() => setToasts(prev => prev.filter(t => t.id !== toast.id))} className="p-1 hover:bg-black/10 rounded-full transition">
                <X className={`w-4 h-4 ${toast.type === "new" ? "text-white" : "text-neutral-500"}`} />
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Custom Delete Confirmation Popout */}
      {deleteConfirm?.isOpen && (
        <div className="fixed inset-0 z-[100000] flex items-center justify-center p-4 bg-neutral-950/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="w-full max-w-sm bg-white rounded-3xl shadow-2xl overflow-hidden border border-neutral-100 animate-in zoom-in-95 duration-200">
            {/* Top caution line */}
            <div className="h-1.5 bg-rose-600 w-full" />
            <div className="p-6 flex flex-col items-center text-center text-left">
              {/* Danger/Warning Red Accent Icon */}
              <div className="p-3.5 bg-rose-50 text-rose-600 rounded-full mb-4">
                <Trash2 size={28} className="stroke-[2.5]" />
              </div>
              
              <h3 className="text-base font-black text-neutral-900 tracking-tight leading-tight">
                {deleteConfirm.title || "Confirmar Exclusão"}
              </h3>
              
              <p className="mt-2.5 text-xs text-neutral-500 font-semibold leading-relaxed">
                {deleteConfirm.message}
              </p>
              
              <div className="mt-6 flex gap-2 w-full">
                <button
                  type="button"
                  onClick={() => setDeleteConfirm(null)}
                  className="flex-1 py-3 px-4 text-xs font-bold text-neutral-400 hover:text-neutral-700 bg-neutral-50 hover:bg-neutral-100 rounded-2xl transition duration-150 cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={deleteConfirm.onConfirm}
                  className="flex-1 py-3 px-4 text-xs font-extrabold text-white bg-rose-600 hover:bg-rose-700 active:scale-[0.98] rounded-2xl transition duration-150 cursor-pointer shadow-md shadow-rose-600/15"
                >
                  Confirmar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Custom Print Confirmation Popout when saving to table */}
      {pdvTablePrintConfirm?.isOpen && (
        <div className="fixed inset-0 z-[100000] flex items-center justify-center p-4 bg-neutral-950/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="w-full max-w-sm bg-white rounded-3xl shadow-2xl overflow-hidden border border-neutral-100 animate-in zoom-in-95 duration-200">
            <div className="h-1.5 bg-orange-500 w-full" />
            <div className="p-6 flex flex-col items-center text-center">
              <div className="p-3.5 bg-orange-50 text-orange-600 rounded-full mb-4">
                <Printer size={28} className="stroke-[2.5]" />
              </div>
              
              <h3 className="text-base font-black text-neutral-900 tracking-tight leading-tight">
                Imprimir Comanda?
              </h3>
              
              <p className="mt-2.5 text-xs text-neutral-500 font-semibold leading-relaxed">
                Os itens foram salvos na mesa com sucesso. Deseja imprimir a comanda de consumo/acréscimo?
              </p>
              
              <div className="mt-6 flex gap-2 w-full">
                <button
                  type="button"
                  onClick={() => {
                    pdvTablePrintConfirm.onDone();
                    setPdvTablePrintConfirm(null);
                  }}
                  className="flex-1 py-3 px-4 text-xs font-bold text-neutral-500 hover:text-neutral-700 bg-neutral-50 hover:bg-neutral-100 rounded-2xl transition duration-150 cursor-pointer"
                >
                  Não Imprimir
                </button>
                <button
                  type="button"
                  onClick={() => {
                    handlePrintBoth(pdvTablePrintConfirm.partialOrder);
                    pdvTablePrintConfirm.onDone();
                    setPdvTablePrintConfirm(null);
                  }}
                  className="flex-1 py-3 px-4 text-xs font-extrabold text-white bg-orange-600 hover:bg-orange-700 active:scale-[0.98] rounded-2xl transition duration-150 cursor-pointer shadow-md shadow-orange-600/15"
                >
                  Sim, Imprimir
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Popout de confirmação ao finalizar mesa: Pergunta se deseja imprimir via */}
      {finalizeTablePrintModal?.isOpen && (
        <div className="fixed inset-0 z-[100000] flex items-center justify-center p-4 bg-neutral-950/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="w-full max-w-sm bg-white rounded-3xl shadow-2xl overflow-hidden border border-neutral-100 animate-in zoom-in-95 duration-200">
            <div className="h-1.5 bg-emerald-500 w-full" />
            <div className="p-6 flex flex-col items-center text-center">
              <div className="p-3.5 bg-emerald-50 text-emerald-600 rounded-full mb-3">
                <Printer size={28} className="stroke-[2.5]" />
              </div>
              
              <h3 className="text-base font-black text-neutral-900 tracking-tight leading-tight">
                {formatTableName(finalizeTablePrintModal.tableName)} Finalizada!
              </h3>
              
              <p className="mt-2 text-xs text-neutral-500 font-medium leading-relaxed">
                O pedido foi finalizado com sucesso. <strong>Deseja imprimir a via (comprovante/comanda)?</strong>
              </p>

              <div className="mt-5 space-y-2 w-full">
                <button
                  type="button"
                  onClick={() => {
                    handlePrintBoth(finalizeTablePrintModal.order);
                    setFinalizeTablePrintModal(null);
                  }}
                  className="w-full py-3 px-4 text-xs font-black text-white bg-emerald-600 hover:bg-emerald-700 active:scale-[0.98] rounded-2xl transition duration-150 cursor-pointer shadow-md shadow-emerald-600/15 flex items-center justify-center gap-2"
                >
                  <Printer size={15} />
                  <span>Sim, Imprimir Ambas as Vias</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    handlePrintOrder(finalizeTablePrintModal.order, 'balcao');
                    setFinalizeTablePrintModal(null);
                  }}
                  className="w-full py-2.5 px-4 text-xs font-bold text-neutral-700 bg-neutral-100 hover:bg-neutral-200 active:scale-[0.98] rounded-2xl transition duration-150 cursor-pointer flex items-center justify-center gap-2"
                >
                  <span>Imprimir Apenas Via Balcão</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setFinalizeTablePrintModal(null);
                  }}
                  className="w-full py-2 px-4 text-xs font-bold text-neutral-400 hover:text-neutral-600 rounded-xl transition duration-150 cursor-pointer"
                >
                  Não Imprimir Via
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Popout de confirmação ao registrar pedido PDV: Pergunta se deseja imprimir via */}
      {pdvOrderPrintConfirm?.isOpen && (
        <div className="fixed inset-0 z-[100000] flex items-center justify-center p-4 bg-neutral-950/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="w-full max-w-sm bg-white rounded-3xl shadow-2xl overflow-hidden border border-neutral-100 animate-in zoom-in-95 duration-200">
            <div className="h-1.5 bg-orange-500 w-full" />
            <div className="p-6 flex flex-col items-center text-center">
              <div className="p-3.5 bg-orange-50 text-orange-600 rounded-full mb-3">
                <Printer size={28} className="stroke-[2.5]" />
              </div>
              
              <h3 className="text-base font-black text-neutral-900 tracking-tight leading-tight">
                Pedido Registrado!
              </h3>
              
              <p className="mt-2 text-xs text-neutral-500 font-medium leading-relaxed">
                {pdvOrderPrintConfirm.successMessage} <strong>Deseja imprimir a via (comprovante/comanda)?</strong>
              </p>

              <div className="mt-5 space-y-2 w-full">
                <button
                  type="button"
                  onClick={() => {
                    handlePrintBoth(pdvOrderPrintConfirm.order);
                    setPdvOrderPrintConfirm(null);
                  }}
                  className="w-full py-3 px-4 text-xs font-black text-white bg-orange-600 hover:bg-orange-700 active:scale-[0.98] rounded-2xl transition duration-150 cursor-pointer shadow-md shadow-orange-600/15 flex items-center justify-center gap-2"
                >
                  <Printer size={15} />
                  <span>Sim, Imprimir Ambas as Vias</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    handlePrintOrder(pdvOrderPrintConfirm.order, 'balcao');
                    setPdvOrderPrintConfirm(null);
                  }}
                  className="w-full py-2.5 px-4 text-xs font-bold text-neutral-700 bg-neutral-100 hover:bg-neutral-200 active:scale-[0.98] rounded-2xl transition duration-150 cursor-pointer flex items-center justify-center gap-2"
                >
                  <span>Imprimir Apenas Via Balcão</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setPdvOrderPrintConfirm(null);
                  }}
                  className="w-full py-2 px-4 text-xs font-bold text-neutral-400 hover:text-neutral-600 rounded-xl transition duration-150 cursor-pointer"
                >
                  Não Imprimir Via
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Bottom Tab Bar for Waiters on Mobile */}
      {false && user?.isWaiter && (
        <div className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-neutral-250 z-[45] flex items-center justify-around py-3 px-4 shadow-xl pb-safe">
          <button
            type="button"
            onClick={() => setActiveTab("pdv")}
            className={`flex flex-col items-center gap-1 py-1 px-4 rounded-2xl transition duration-150 active:scale-95 text-center shrink-0 ${
              activeTab === "pdv" ? "text-orange-600 font-black scale-102" : "text-neutral-400 font-semibold"
            }`}
          >
            <Store size={20} className={activeTab === "pdv" ? "text-orange-600 stroke-[2.5]" : "text-neutral-400 stroke-2"} />
            <span className="text-[10px] tracking-tight mt-1">PDV</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("tables")}
            className={`flex flex-col items-center gap-1 py-1 px-4 rounded-2xl transition duration-150 active:scale-95 text-center shrink-0 ${
              activeTab === "tables" ? "text-orange-600 font-black scale-102" : "text-neutral-400 font-semibold"
            }`}
          >
            <Users size={20} className={activeTab === "tables" ? "text-orange-600 stroke-[2.5]" : "text-neutral-400 stroke-2"} />
            <span className="text-[10px] tracking-tight mt-1">Mesas</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("orders")}
            className={`flex flex-col items-center gap-1 py-1 px-4 rounded-2xl transition duration-150 active:scale-95 text-center shrink-0 ${
              activeTab === "orders" ? "text-orange-600 font-black scale-102" : "text-neutral-400 font-semibold"
            }`}
          >
            <ClipboardList size={20} className={activeTab === "orders" ? "text-orange-600 stroke-[2.5]" : "text-neutral-400 stroke-2"} />
            <span className="text-[10px] tracking-tight mt-1">Pedidos</span>
          </button>
      {/* USB Access Denied Troubleshooting Modal */}
      {showUsbAccessDeniedGuide && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="w-full max-w-2xl bg-white rounded-3xl border border-neutral-200 shadow-2xl overflow-hidden flex flex-col animate-in fade-in zoom-in-95 duration-200">
            {/* Modal Header */}
            <div className="px-6 py-4 border-b border-neutral-100 flex items-center justify-between bg-neutral-50">
              <div>
                <h3 className="font-bold text-lg text-neutral-900 flex items-center gap-2">
                  <span className="p-1 bg-red-100 text-red-700 rounded-lg">⚠️</span>
                  Resolução de Erro: Acesso Negado à Impressora USB
                </h3>
                <p className="text-xs text-neutral-500">Siga os passos abaixo para liberar o acesso USB no seu computador</p>
              </div>
              <button 
                onClick={() => setShowUsbAccessDeniedGuide(false)}
                className="rounded-full p-1 text-neutral-400 hover:text-neutral-600 hover:bg-neutral-100 transition font-sans text-sm font-extrabold w-6 h-6 flex items-center justify-center"
              >
                ✕
              </button>
            </div>

            {/* Modal Content */}
            <div className="p-6 overflow-y-auto max-h-[80vh] space-y-6">
              <div className="bg-red-50 border border-red-100 rounded-2xl p-4">
                <p className="text-xs font-bold text-red-800 uppercase tracking-wider">Causa do Erro</p>
                <p className="text-sm text-neutral-700 mt-1 font-medium">
                  O erro <code className="bg-red-100 text-red-800 px-1.5 py-0.5 rounded font-mono text-xs">{usbErrorDetails || "failed to execute open on usbdevice access denied"}</code> ocorre porque o seu Sistema Operacional (Windows, Mac ou Linux) bloqueia o navegador de acessar a impressora diretamente, pois ela já está em uso por outro driver ou spooler de impressão do sistema.
                </p>
              </div>

              <div className="space-y-4">
                <h4 className="font-bold text-neutral-850 text-sm border-b border-neutral-100 pb-2">Como resolver no Windows (Mais comum)</h4>
                <p className="text-xs text-neutral-600 leading-relaxed">
                  O Windows atribui o driver padrão de impressão à impressora térmica. Para o navegador poder imprimir diretamente por WebUSB, você precisa trocar esse driver para o driver USB genérico (<strong className="text-neutral-900">WinUSB</strong>).
                </p>
                <div className="bg-neutral-50 rounded-2xl border border-neutral-150 p-4 space-y-3">
                  <div className="flex gap-2.5">
                    <span className="flex items-center justify-center bg-orange-600 text-white w-5 h-5 rounded-full text-xs font-bold shrink-0">1</span>
                    <p className="text-xs text-neutral-700 leading-normal">
                      Baixe o utilitário gratuito <a href="https://zadig.akeo.ie" target="_blank" rel="noopener noreferrer" className="text-orange-600 font-bold hover:underline">Zadig (clique para baixar)</a>. Ele é seguro e serve exatamente para isso.
                    </p>
                  </div>
                  <div className="flex gap-2.5">
                    <span className="flex items-center justify-center bg-orange-600 text-white w-5 h-5 rounded-full text-xs font-bold shrink-0">2</span>
                    <p className="text-xs text-neutral-700 leading-normal">
                      Abra o Zadig, clique no menu superior <strong className="text-neutral-900">Options</strong> e selecione <strong className="text-neutral-900">List All Devices</strong>.
                    </p>
                  </div>
                  <div className="flex gap-2.5">
                    <span className="flex items-center justify-center bg-orange-600 text-white w-5 h-5 rounded-full text-xs font-bold shrink-0">3</span>
                    <p className="text-xs text-neutral-700 leading-normal">
                      No menu suspenso central, selecione sua impressora térmica (costuma chamar-se <strong className="text-neutral-900">USB Printing Support</strong>, <strong className="text-neutral-900">POS-58</strong>, <strong className="text-neutral-900 font-semibold">POS-80</strong> ou o nome do modelo).
                    </p>
                  </div>
                  <div className="flex gap-2.5">
                    <span className="flex items-center justify-center bg-orange-600 text-white w-5 h-5 rounded-full text-xs font-bold shrink-0">4</span>
                    <p className="text-xs text-neutral-700 leading-normal">
                      No campo do driver à direita da seta verde, certifique-se de selecionar <strong className="text-neutral-900 font-bold">WinUSB</strong>.
                    </p>
                  </div>
                  <div className="flex gap-2.5">
                    <span className="flex items-center justify-center bg-orange-600 text-white w-5 h-5 rounded-full text-xs font-bold shrink-0">5</span>
                    <p className="text-xs text-neutral-700 leading-normal">
                      Clique no botão grande <strong className="text-neutral-900">Replace Driver</strong> (ou <strong className="text-neutral-900">Reinstall Driver</strong>). Aguarde alguns segundos a instalação terminar.
                    </p>
                  </div>
                  <div className="flex gap-2.5">
                    <span className="flex items-center justify-center bg-orange-600 text-white w-5 h-5 rounded-full text-xs font-bold shrink-0">6</span>
                    <p className="text-xs text-neutral-700 leading-normal">
                      Retorne aqui ao MenuFlow, certifique-se de que a impressora está ligada ao computador e clique em <strong className="text-neutral-900 font-bold">USB</strong> para conectá-la de novo com sucesso!
                    </p>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <h4 className="font-bold text-neutral-850 text-xs border-b border-neutral-100 pb-1.5">Como resolver no Linux</h4>
                  <p className="text-[11px] text-neutral-600 leading-relaxed">
                    Você precisa dar permissão para o usuário do navegador acessar portas USB de impressão. Crie um arquivo de regras udev executando no terminal:<br/>
                    <code className="block bg-neutral-100 p-2 rounded text-[10px] font-mono mt-1 select-all">
                      {"sudo echo 'SUBSYSTEM==\"usb\", ATTR{idVendor}==\"*\", ATTR{idProduct}==\"*\", MODE=\"0666\"\' > /etc/udev/rules.d/99-printer.rules"}
                    </code>
                    <span className="block mt-1">Depois, recarregue executando <code className="bg-neutral-100 px-1 py-0.5 rounded font-mono text-[10px]">sudo udevadm control --reload-rules</code> e reconecte o cabo USB.</span>
                  </p>
                </div>
                <div className="space-y-2">
                  <h4 className="font-bold text-neutral-850 text-xs border-b border-neutral-100 pb-1.5">Como resolver no macOS</h4>
                  <p className="text-[11px] text-neutral-600 leading-relaxed font-medium">
                    Remova a impressora térmica das suas impressoras ativas do sistema em <strong className="text-neutral-900">Preferências do Sistema &gt; Impressoras e Scanners</strong> para que o sistema libere o acesso exclusivo à porta USB para o navegador Chrome/Edge.
                  </p>
                </div>
              </div>

              <div className="bg-orange-50 border border-orange-100 rounded-2xl p-4 flex gap-3">
                <span className="text-orange-600 text-base">💡</span>
                <div>
                  <p className="text-xs font-bold text-orange-900">Dica Alternativa Sem Modificar Drivers</p>
                  <p className="text-[11px] text-orange-850 leading-relaxed mt-0.5 font-medium">
                    Se não quiser alterar nada, você ainda pode imprimir perfeitamente! Quando você imprime um pedido no painel do MenuFlow, se a impressora direta não estiver pareada, <strong className="text-orange-950">ele abrirá automaticamente a janela de impressão nativa do navegador</strong>. Basta escolher sua impressora térmica ali na lista e confirmar a impressão!
                  </p>
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="px-6 py-4 bg-neutral-50 border-t border-neutral-100 flex justify-end">
              <button 
                onClick={() => setShowUsbAccessDeniedGuide(false)}
                className="px-4 py-2 bg-neutral-900 text-white text-xs font-bold rounded-xl hover:bg-neutral-850 transition cursor-pointer"
              >
                Entendi, fechar guia
              </button>
            </div>
          </div>
        </div>
      )}

        </div>
      )}

      {/* Modal de QR Code da Mesa individual */}
      {selectedTableForQr && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl p-6 max-w-md w-full shadow-2xl border border-neutral-100 relative animate-in zoom-in-95">
            <button
              onClick={() => setSelectedTableForQr(null)}
              className="absolute top-4 right-4 p-2 text-neutral-400 hover:text-neutral-700 hover:bg-neutral-100 rounded-full transition cursor-pointer"
            >
              <X size={20} />
            </button>

            <div className="text-center space-y-4">
              <div className="inline-flex items-center gap-2 px-3 py-1 bg-orange-100 text-orange-800 rounded-full text-xs font-black uppercase tracking-wider">
                <Store size={14} />
                {formatTableName(selectedTableForQr.name)}
              </div>

              <h3 className="text-xl font-black text-neutral-900 tracking-tight">QR Code da {formatTableName(selectedTableForQr.name)}</h3>
              <p className="text-xs text-neutral-500 max-w-xs mx-auto leading-relaxed">
                Imprima ou disponibilize este QR Code nesta mesa para que os clientes abram o cardápio e façam pedidos diretamente!
              </p>

              <div className="p-4 bg-neutral-50 rounded-2xl border border-neutral-200 inline-block my-2 shadow-inner">
                <img
                  src={`https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${encodeURIComponent(
                    `${window.location.origin}/${restaurant?.slug || user?.uid}?mesa=${encodeURIComponent(selectedTableForQr.name)}`
                  )}`}
                  alt={`QR Code ${formatTableName(selectedTableForQr.name)}`}
                  className="w-48 h-48 mx-auto mix-blend-multiply"
                />
              </div>

              <div className="p-3 bg-neutral-100/80 rounded-xl text-left border border-neutral-200/60">
                <div className="text-[10px] font-extrabold text-neutral-400 uppercase tracking-widest mb-1">Link Direto da Mesa</div>
                <div className="font-mono text-xs text-orange-600 truncate select-all font-bold">
                  {`${window.location.origin}/${restaurant?.slug || user?.uid}?mesa=${encodeURIComponent(selectedTableForQr.name)}`}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    const url = `${window.location.origin}/${restaurant?.slug || user?.uid}?mesa=${encodeURIComponent(selectedTableForQr.name)}`;
                    navigator.clipboard.writeText(url);
                    alert("Link da mesa copiado para a área de transferência!");
                  }}
                  className="py-2.5 px-3 bg-neutral-100 hover:bg-neutral-200 text-neutral-800 text-xs font-bold rounded-xl flex items-center justify-center gap-1.5 transition cursor-pointer"
                >
                  <Copy size={14} />
                  <span>Copiar</span>
                </button>

                <a
                  href={`${window.location.origin}/${restaurant?.slug || user?.uid}?mesa=${encodeURIComponent(selectedTableForQr.name)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="py-2.5 px-3 bg-neutral-100 hover:bg-neutral-200 text-neutral-800 text-xs font-bold rounded-xl flex items-center justify-center gap-1.5 transition text-center cursor-pointer"
                >
                  <ExternalLink size={14} />
                  <span>Testar</span>
                </a>

                <button
                  type="button"
                  onClick={() => handleGenerateSingleTableQRPDF(selectedTableForQr)}
                  className="py-2.5 px-3 bg-orange-600 hover:bg-orange-700 text-white text-xs font-bold rounded-xl flex items-center justify-center gap-1.5 transition shadow-sm cursor-pointer"
                >
                  <FileDown size={14} />
                  <span>PDF (A4)</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  )
}
