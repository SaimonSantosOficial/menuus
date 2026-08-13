import React, { useState, useEffect } from "react";
import { 
  Menu,
  BarChart3, 
  Users as UsersIcon, 
  CreditCard, 
  DollarSign,
  Package,
  LogOut,
  ChevronDown,
  ShieldAlert,
  Search,
  Store,
  ExternalLink,
  Trash2,
  TrendingUp,
  MapPin,
  CheckCircle,
  ToggleLeft,
  ClipboardList,
  FileText,
  Box,
  Tags,
  Users,
  Palette,
  QrCode,
  Printer,
  Plus,
  FileJson,
  Upload,
  Edit3,
  Check,
  AlertCircle,
  X,
  Clock,
  Megaphone,
  User,
  Activity
} from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { auth, db } from "../lib/firebase";
import { onAuthStateChanged, signOut, getAuth, createUserWithEmailAndPassword } from "firebase/auth";
import { initializeApp, deleteApp } from "firebase/app";
import firebaseConfig from "../firebase-applet-config.json";
import { collection, onSnapshot, doc, updateDoc, deleteDoc, getDoc, setDoc, query, where, addDoc } from "firebase/firestore";
import { 
  PASTELARIA_MENU_TEMPLATE, 
  ESPETINHO_MENU_TEMPLATE, 
  HAMBURGUERIA_MENU_TEMPLATE, 
  ACAI_MENU_TEMPLATE, 
  getMenuTemplateBySegment 
} from "../data/menuTemplates";

type Tab = "dashboard" | "clientes" | "funcoes" | "cardapio" | "planos" | "assinaturas" | "financeiro" | "molduras" | "avisos" | "logs";

const RESTAURANT_TYPES = [
  "Pastelaria",
  "Macarrões",
  "Marmitaria",
  "Açaíteria",
  "Hamburgueria",
  "Pizzaria",
  "Comida Japonesa",
  "Sorveteria",
  "Churrascaria / Espetaria",
  "Lanchonete / Salgados",
  "Cafeteria / Doceria",
  "Outro / Geral"
];

export default function SuperAdmin() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<Tab>("dashboard");
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  // Auth / Permissions States
  const [user, setUser] = useState<any>(null);
  const [authChecking, setAuthChecking] = useState(true);
  const [isAuthorized, setIsAuthorized] = useState(false);

  // Firestore Real Data
  const [restaurants, setRestaurants] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [payments, setPayments] = useState<any[]>([]);
  const [logs, setLogs] = useState<any[]>([]);
  const [loadingData, setLoadingData] = useState(true);

  // Frames / Molduras States
  const [frames, setFrames] = useState<any[]>([]);
  const [editingFrameId, setEditingFrameId] = useState<string | null>(null);
  const [frameForm, setFrameForm] = useState({
    name: "",
    imageUrl: "",
    commemorativeType: "", // christmas, newyear, halloween, valentines, junina, easter, mothers, fathers, none
    specificDates: [] as string[],
  });
  const [newSpecificDate, setNewSpecificDate] = useState("");

  // Selected Restaurant ID for Function Control Group
  const [selectedRestaurantId, setSelectedRestaurantId] = useState<string>("");

  // Filters
  const [searchTerm, setSearchTerm] = useState("");
  const [logSearch, setLogSearch] = useState("");
  const [logSectorFilter, setLogSectorFilter] = useState("all");

  const tabs = [
    { id: "dashboard", label: "Dashboard", icon: BarChart3 },
    { id: "clientes", label: "Clientes", icon: UsersIcon },
    { id: "funcoes", label: "Controle de Funções", icon: ToggleLeft },
    { id: "cardapio", label: "Cardápios", icon: ClipboardList },
    { id: "planos", label: "Planos", icon: Package },
    { id: "assinaturas", label: "Assinaturas", icon: CreditCard },
    { id: "financeiro", label: "Financeiro", icon: DollarSign },
    { id: "molduras", label: "Molduras", icon: Palette },
    { id: "avisos", label: "Avisos Globais", icon: Megaphone },
    { id: "logs", label: "Logs de Atividade", icon: Activity },
  ] as const;

  const tabGroups = [
    {
      title: "Visão Geral",
      items: [
        { id: "dashboard", label: "Dashboard", icon: BarChart3 },
      ]
    },
    {
      title: "Comercial & Faturamento",
      items: [
        { id: "clientes", label: "Clientes", icon: UsersIcon },
        { id: "planos", label: "Planos", icon: Package },
        { id: "assinaturas", label: "Assinaturas", icon: CreditCard },
        { id: "financeiro", label: "Financeiro", icon: DollarSign },
      ]
    },
    {
      title: "Customização & Cardápios",
      items: [
        { id: "cardapio", label: "Cardápios", icon: ClipboardList },
        { id: "molduras", label: "Molduras", icon: Palette },
      ]
    },
    {
      title: "Administração & Avisos",
      items: [
        { id: "funcoes", label: "Controle de Funções", icon: ToggleLeft },
        { id: "avisos", label: "Avisos Globais", icon: Megaphone },
        { id: "logs", label: "Logs de Atividade", icon: Activity },
      ]
    }
  ] as const;

  // Cardapio (Products & Categories) States
  const [selectedCategories, setSelectedCategories] = useState<any[]>([]);
  const [selectedProducts, setSelectedProducts] = useState<any[]>([]);
  const [loadingActiveMenu, setLoadingActiveMenu] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState("");
  const [isAddingProduct, setIsAddingProduct] = useState(false);
  const [editingProduct, setEditingProduct] = useState<any>(null);
  const [productSearch, setProductSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  
  // Create / Edit Product Form
  const [productForm, setProductForm] = useState<{
    name: string;
    description: string;
    price: string;
    category: string;
    imageUrl: string;
    addons: { name: string; price: number }[];
    complements: { name: string }[];
    availableDays: string[];
    isOutOfStock: boolean;
  }>({
    name: "",
    description: "",
    price: "",
    category: "",
    imageUrl: "",
    addons: [],
    complements: [],
    availableDays: [],
    isOutOfStock: false
  });

  const [newAddonName, setNewAddonName] = useState("");
  const [newAddonPrice, setNewAddonPrice] = useState("");
  const [newComplementName, setNewComplementName] = useState("");

  // Category editing state
  const [editingCategoryId, setEditingCategoryId] = useState<string | null>(null);
  const [editingCategoryName, setEditingCategoryName] = useState("");

  // JSON Import states
  const [showJsonImportModal, setShowJsonImportModal] = useState(false);
  const [jsonInput, setJsonInput] = useState("");
  const [importStatus, setImportStatus] = useState<{ type: "success" | "error" | "info" | null; message: string }>({ type: null, message: "" });
  const [importProgress, setImportProgress] = useState({ current: 0, total: 0 });
  const [importing, setImporting] = useState(false);

  // Dynamic Plans Settings State
  const [plansConfig, setPlansConfig] = useState<any>({
    free: {
      name: "Plano Gratuito",
      price: 0,
      limitProducts: 30,
      hasThemes: false,
      customAppearance: "Parcial",
      features: "Até 30 produtos, Suporte padrão, Aparência padrão"
    },
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
  const [savingPlans, setSavingPlans] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
  } | null>(null);

  const [editingSubscription, setEditingSubscription] = useState<any>(null);
  const [subForm, setSubForm] = useState({ paymentDay: '', discount: '' });

  const [adminAnnouncement, setAdminAnnouncement] = useState<any>({
    title: '',
    message: '',
    isActive: false,
    theme: 'blue',
    icon: 'megaphone',
    targetAudience: 'all',
    showCta: false,
    ctaText: '',
    ctaLink: '',
    allowDismiss: true
  });
  const [savingAnnouncement, setSavingAnnouncement] = useState(false);

  // New Restaurant creation states
  const [showCreateRestaurantModal, setShowCreateRestaurantModal] = useState(false);
  const [createForm, setCreateForm] = useState({
    restaurantName: "",
    ownerName: "",
    email: "",
    password: "",
    restaurantType: "Pastelaria"
  });
  const [creatingRestaurant, setCreatingRestaurant] = useState(false);
  const [createError, setCreateError] = useState("");

  const updatePlanFeature = (planKey: "free" | "premium", field: string, val: any) => {
    setPlansConfig((prev: any) => ({
      ...prev,
      [planKey]: {
        ...prev[planKey],
        [field]: val
      }
    }));
  };

  const createLog = async (action: string, details: string, sector: string) => {
    try {
      await addDoc(collection(db, "superadmin_logs"), {
        action,
        details,
        sector,
        adminEmail: user?.email || auth.currentUser?.email || "Admin",
        adminId: user?.uid || auth.currentUser?.uid || "admin-id",
        createdAt: new Date().toISOString()
      });
    } catch (e) {
      console.error("Erro ao criar log de atividade:", e);
    }
  };

  // 1. Authenticate & Verify Admin Status
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (currentUser) => {
      if (!currentUser) {
        setAuthChecking(false);
        setIsAuthorized(false);
        navigate("/auth");
        return;
      }

      setUser(currentUser);

      // Check if user has admin privileges
      const isMasterAdminEmail = currentUser.email === "dexgamer277@gmail.com" || currentUser.email === "admin@menuflow.com" || currentUser.email === "saimonsantosofficial@gmail.com";

      let hasAdminFlagInDb = false;
      try {
        const userDocRef = doc(db, "users", currentUser.uid);
        const userDocSnap = await getDoc(userDocRef);
        if (userDocSnap.exists()) {
          const uData = userDocSnap.data();
          if (uData?.isAdmin || uData?.role === "admin") {
            hasAdminFlagInDb = true;
          } else if (isMasterAdminEmail) {
            // Self-heal: the user is a master admin but doesn't have the DB flag yet. Write it!
            await setDoc(userDocRef, { isAdmin: true, role: "admin" }, { merge: true });
            hasAdminFlagInDb = true;
          }
        } else if (isMasterAdminEmail) {
          // Self-heal: the user doc doesn't exist, create it!
          await setDoc(userDocRef, {
            uid: currentUser.uid,
            email: currentUser.email,
            isAdmin: true,
            role: "admin",
            createdAt: Date.now()
          });
          hasAdminFlagInDb = true;
        }
      } catch (err) {
        console.error("Erro ao verificar/atualizar flag admin:", err);
      }

      if (isMasterAdminEmail || hasAdminFlagInDb) {
        setIsAuthorized(true);
      } else {
        setIsAuthorized(false);
      }
      setAuthChecking(false);
    });

    return unsub;
  }, [navigate]);

  // 2. Fetch Live Firestore Collections
  useEffect(() => {
    if (!isAuthorized) return;

    // Listen to all restaurants
    const unsubRestaurants = onSnapshot(collection(db, "restaurants"), (snap) => {
      setRestaurants(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    }, (err) => {
      console.error("Erro ao escutar coleção de restaurantes:", err);
    });

    // Listen to all users
    const unsubUsers = onSnapshot(collection(db, "users"), (snap) => {
      setUsers(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      setLoadingData(false);
    }, (err) => {
      console.error("Erro ao escutar coleção de usuários:", err);
      setLoadingData(false);
    });

    const unsubPlans = onSnapshot(doc(db, "configs", "plans"), (snap) => {
      if (snap.exists()) {
        setPlansConfig(snap.data());
      } else {
        // Initialize default plans config if not present
        setDoc(doc(db, "configs", "plans"), {
          free: {
            name: "Plano Gratuito",
            price: 0,
            limitProducts: 30,
            hasThemes: false,
            customAppearance: "Parcial",
            features: "Até 30 produtos, Suporte padrão, Aparência padrão"
          },
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
        }).catch(err => console.error("Erro ao inicializar planos:", err));
      }
    });

    const unsubFrames = onSnapshot(collection(db, "frames"), (snap) => {
      setFrames(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    }, (err) => {
      console.error("Erro ao escutar molduras:", err);
    });

    const unsubAnnouncement = onSnapshot(doc(db, "configs", "admin_announcement"), (snap) => {
      if (snap.exists()) {
        setAdminAnnouncement((prev: any) => ({ ...prev, ...snap.data() }));
      }
    });

    const unsubPayments = onSnapshot(collection(db, "subscription_payments"), (snap) => {
      setPayments(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    }, (err) => {
      console.error("Erro ao escutar faturamentos:", err);
    });

    const unsubLogs = onSnapshot(collection(db, "superadmin_logs"), (snap) => {
      const logsList = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      // Sort by date descending
      logsList.sort((a: any, b: any) => {
        const dateA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
        const dateB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
        return dateB - dateA;
      });
      setLogs(logsList);
    }, (err) => {
      console.error("Erro ao escutar logs de segurança:", err);
    });

    return () => {
      unsubRestaurants();
      unsubUsers();
      unsubPlans();
      unsubFrames();
      unsubAnnouncement();
      unsubPayments();
      unsubLogs();
    };
  }, [isAuthorized]);

  useEffect(() => {
    if (restaurants.length > 0 && !selectedRestaurantId) {
      setSelectedRestaurantId(restaurants[0].id);
    }
  }, [restaurants, selectedRestaurantId]);

  // Fetch Selected Restaurant's Categories and Products
  useEffect(() => {
    if (!isAuthorized || !selectedRestaurantId) {
      setSelectedCategories([]);
      setSelectedProducts([]);
      return;
    }

    const selectedRest = restaurants.find(r => r.id === selectedRestaurantId);
    if (!selectedRest) return;

    const targetOwnerId = selectedRest.ownerId || selectedRest.id;
    setLoadingActiveMenu(true);

    const qCat = query(collection(db, "categories"), where("restaurantId", "==", targetOwnerId));
    const unsubCats = onSnapshot(qCat, (snap) => {
      const catsList = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      catsList.sort((a: any, b: any) => {
        const orderA = a.order !== undefined ? a.order : 9999;
        const orderB = b.order !== undefined ? b.order : 9999;
        if (orderA !== orderB) return orderA - orderB;
        return (a.createdAt || 0) - (b.createdAt || 0);
      });
      setSelectedCategories(catsList);
    }, (err) => {
      console.error("Erro ao escutar categorias do restaurante:", err);
    });

    const qProd = query(collection(db, "products"), where("restaurantId", "==", targetOwnerId));
    const unsubProds = onSnapshot(qProd, (snap) => {
      setSelectedProducts(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      setLoadingActiveMenu(false);
    }, (err) => {
      console.error("Erro ao escutar produtos do restaurante:", err);
      setLoadingActiveMenu(false);
    });

    return () => {
      unsubCats();
      unsubProds();
    };
  }, [isAuthorized, selectedRestaurantId, restaurants]);

  // CRUD actions for Categories
  const handleAddCategorySuper = async () => {
    if (!newCategoryName.trim()) {
      alert("Por favor, digite o nome da categoria.");
      return;
    }
    const selectedRest = restaurants.find(r => r.id === selectedRestaurantId);
    if (!selectedRest) {
      alert("Selecione um restaurante primeiro.");
      return;
    }
    const targetOwnerId = selectedRest.ownerId || selectedRest.id;
    try {
      const maxOrder = selectedCategories.reduce((max, cat) => Math.max(max, cat.order ?? 0), -1);
      await addDoc(collection(db, "categories"), {
        restaurantId: targetOwnerId,
        name: newCategoryName.trim(),
        order: maxOrder + 1,
        createdAt: Date.now()
      });
      await createLog("Adicionar Categoria", `Adicionada categoria "${newCategoryName.trim()}" no restaurante "${selectedRest?.name || selectedRestaurantId}".`, "Cardápios");
      setNewCategoryName("");
    } catch (err: any) {
      alert("Erro ao adicionar categoria: " + err.message);
    }
  };

  const handleSaveCategoryEdit = async (catId: string) => {
    if (!editingCategoryName.trim()) {
      alert("Nome não pode ser vazio.");
      return;
    }
    try {
      await updateDoc(doc(db, "categories", catId), {
        name: editingCategoryName.trim()
      });
      
      const oldCat = selectedCategories.find(c => c.id === catId);
      const selectedRest = restaurants.find(r => r.id === selectedRestaurantId);
      if (oldCat) {
        const oldName = oldCat.name;
        const newName = editingCategoryName.trim();
        const prodsToUpdate = selectedProducts.filter(p => p.category === oldName);
        for (const prod of prodsToUpdate) {
          updateDoc(doc(db, "products", prod.id), { category: newName }).catch(err => {
            console.error("Erro ao atualizar categoria do produto:", err);
          });
        }
      }
      await createLog("Editar Categoria", `Editado nome da categoria para "${editingCategoryName.trim()}" (antes "${oldCat?.name || ""}") no restaurante "${selectedRest?.name || selectedRestaurantId}".`, "Cardápios");
      setEditingCategoryId(null);
      setEditingCategoryName("");
    } catch (err: any) {
      alert("Erro ao atualizar categoria: " + err.message);
    }
  };

  const handleDeleteCategorySuper = async (catId: string, catName: string) => {
    setDeleteConfirm({
      isOpen: true,
      title: "Excluir Categoria",
      message: `Tem certeza que deseja excluir a categoria "${catName}"? Os produtos continuam no banco, mas ficarão sem categoria associada.`,
      onConfirm: async () => {
        try {
          const selectedRest = restaurants.find(r => r.id === selectedRestaurantId);
          await deleteDoc(doc(db, "categories", catId));
          await createLog("Excluir Categoria", `Excluída categoria "${catName}" no restaurante "${selectedRest?.name || selectedRestaurantId}".`, "Cardápios");
        } catch (err: any) {
          alert("Erro ao excluir categoria: " + err.message);
        } finally {
          setDeleteConfirm(null);
        }
      }
    });
  };

  // CRUD actions for Products
  const handleSaveProductSuper = async () => {
    if (!productForm.name.trim() || !productForm.price || !productForm.category) {
      alert("Por favor, preencha nome, preço e categoria.");
      return;
    }
    const selectedRest = restaurants.find(r => r.id === selectedRestaurantId);
    if (!selectedRest) {
      alert("Selecione um restaurante primeiro.");
      return;
    }
    const targetOwnerId = selectedRest.ownerId || selectedRest.id;

    try {
      const productData = {
        restaurantId: targetOwnerId,
        name: productForm.name.trim(),
        description: productForm.description.trim(),
        price: parseFloat(productForm.price),
        category: productForm.category,
        imageUrl: productForm.imageUrl.trim() || "https://images.unsplash.com/photo-1546069901-ba9599a7e63c?q=80&w=300&auto=format&fit=crop",
        addons: productForm.addons || [],
        complements: productForm.complements || [],
        availableDays: productForm.availableDays || [],
        isOutOfStock: !!productForm.isOutOfStock,
        updatedAt: Date.now()
      };

      if (editingProduct) {
        await updateDoc(doc(db, "products", editingProduct.id), productData);
        await createLog("Editar Produto", `Editado produto "${productForm.name.trim()}" (R$ ${productData.price}) do restaurante "${selectedRest?.name || selectedRestaurantId}".`, "Cardápios");
      } else {
        await addDoc(collection(db, "products"), {
          ...productData,
          createdAt: Date.now()
        });
        await createLog("Adicionar Produto", `Adicionado produto "${productForm.name.trim()}" (R$ ${productData.price}) no restaurante "${selectedRest?.name || selectedRestaurantId}".`, "Cardápios");
      }

      setIsAddingProduct(false);
      setEditingProduct(null);
      setProductForm({
        name: "",
        description: "",
        price: "",
        category: "",
        imageUrl: "",
        addons: [],
        complements: [],
        availableDays: [],
        isOutOfStock: false
      });
    } catch (err: any) {
      alert("Erro ao salvar produto: " + err.message);
    }
  };

  const handleStartEditProductSuper = (product: any) => {
    setEditingProduct(product);
    setProductForm({
      name: product.name || "",
      description: product.description || "",
      price: product.price?.toString() || "",
      category: product.category || "",
      imageUrl: product.imageUrl || "",
      addons: product.addons || [],
      complements: product.complements || [],
      availableDays: product.availableDays || [],
      isOutOfStock: !!product.isOutOfStock
    });
    setIsAddingProduct(true);
  };

  const handleDeleteProductSuper = async (pId: string, pName: string) => {
    setDeleteConfirm({
      isOpen: true,
      title: "Excluir Produto",
      message: `Tem certeza que deseja excluir o produto "${pName}"? Esta ação é irreversível.`,
      onConfirm: async () => {
        try {
          const selectedRest = restaurants.find(r => r.id === selectedRestaurantId);
          await deleteDoc(doc(db, "products", pId));
          await createLog("Excluir Produto", `Excluído produto "${pName}" do restaurante "${selectedRest?.name || selectedRestaurantId}".`, "Cardápios");
        } catch (err: any) {
          alert("Erro ao excluir produto: " + err.message);
        } finally {
          setDeleteConfirm(null);
        }
      }
    });
  };

  // --- Frame / Moldura Handlers ---
  const [isUploadingFrame, setIsUploadingFrame] = useState(false);
  const [frameUploadError, setFrameUploadError] = useState("");

  const handleFrameImageUpload = async (file: File) => {
    if (!file) return;

    setIsUploadingFrame(true);
    setFrameUploadError("");

    try {
      const reader = new FileReader();
      reader.onload = (event) => {
        const img = new Image();
        img.onload = async () => {
          let hasSucceeded = false;
          let compressedBase64 = "";

          try {
            // Compress and resize image
            const canvas = document.createElement("canvas");
            const MAX_WIDTH = 800;
            const MAX_HEIGHT = 800;
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

            // Export to WEBP to keep transparency and save big on size for firestore
            compressedBase64 = canvas.toDataURL("image/webp", 0.9);

            // Save directly as base64 to ensure it persists in Firestore regardless of ephemeral Cloud Run filesystems
            setFrameForm(prev => ({ ...prev, imageUrl: compressedBase64 }));
          } catch (err: any) {
            console.warn("Erro ao processar imagem da moldura no canvas.", err);
            setFrameUploadError("Erro ao processar moldura.");
          }

          setIsUploadingFrame(false);
        };
        img.onerror = () => {
          setFrameUploadError("Erro ao processar imagem para moldura.");
          setIsUploadingFrame(false);
        };
        img.src = event.target?.result as string;
      };
      reader.onerror = () => {
        setFrameUploadError("Erro ao ler o arquivo.");
        setIsUploadingFrame(false);
      };
      reader.readAsDataURL(file);
    } catch (e: any) {
      console.error("Erro no upload da moldura", e);
      setFrameUploadError("Erro ao preparar upload da moldura.");
      setIsUploadingFrame(false);
    }
  };

  const handleSaveFrame = async () => {
    if (!frameForm.name.trim() || !frameForm.imageUrl.trim()) {
      alert("Por favor, preencha o nome e o link da moldura.");
      return;
    }

    try {
      const data = {
        name: frameForm.name.trim(),
        imageUrl: frameForm.imageUrl.trim(),
        commemorativeType: frameForm.commemorativeType || "",
        specificDates: frameForm.specificDates || [],
        updatedAt: Date.now()
      };

      if (editingFrameId) {
        await updateDoc(doc(db, "frames", editingFrameId), data);
        await createLog("Editar Moldura", `Editada moldura "${frameForm.name.trim()}" (Tipo: ${frameForm.commemorativeType || "Nenhum"}).`, "Molduras");
      } else {
        await addDoc(collection(db, "frames"), {
          ...data,
          createdAt: Date.now()
        });
        await createLog("Adicionar Moldura", `Adicionada nova moldura "${frameForm.name.trim()}" (Tipo: ${frameForm.commemorativeType || "Nenhum"}).`, "Molduras");
      }

      // Reset form
      setFrameForm({
        name: "",
        imageUrl: "",
        commemorativeType: "",
        specificDates: []
      });
      setEditingFrameId(null);
      setNewSpecificDate("");
    } catch (err: any) {
      alert("Erro ao salvar moldura: " + err.message);
    }
  };

  const handleStartEditFrame = (frame: any) => {
    setEditingFrameId(frame.id);
    setFrameForm({
      name: frame.name || "",
      imageUrl: frame.imageUrl || "",
      commemorativeType: frame.commemorativeType || "",
      specificDates: frame.specificDates || []
    });
    setNewSpecificDate("");
  };

  const handleDeleteFrame = async (frameId: string, frameName: string) => {
    setDeleteConfirm({
      isOpen: true,
      title: "Excluir Moldura",
      message: `Tem certeza que deseja excluir a moldura "${frameName}"? Ela deixará de ser exibida nas fotos de perfil correspondentes.`,
      onConfirm: async () => {
        try {
          await deleteDoc(doc(db, "frames", frameId));
          await createLog("Excluir Moldura", `Removida a moldura "${frameName}" (ID: ${frameId}) permanentemente.`, "Molduras");
        } catch (err: any) {
          alert("Erro ao excluir moldura: " + err.message);
        } finally {
          setDeleteConfirm(null);
        }
      }
    });
  };

  const handleAddFrameSpecificDate = () => {
    if (!newSpecificDate) {
      alert("Por favor, selecione uma data.");
      return;
    }
    if (frameForm.specificDates.includes(newSpecificDate)) {
      alert("Esta data já foi adicionada.");
      return;
    }
    setFrameForm(prev => ({
      ...prev,
      specificDates: [...prev.specificDates, newSpecificDate]
    }));
    setNewSpecificDate("");
  };

  const handleRemoveFrameSpecificDate = (dateToRemove: string) => {
    setFrameForm(prev => ({
      ...prev,
      specificDates: prev.specificDates.filter(d => d !== dateToRemove)
    }));
  };

  // Robust parsing and bulk importing products and categories from JSON
  const handleJsonImportSuper = async () => {
    if (!jsonInput.trim()) {
      setImportStatus({ type: "error", message: "Insira o conteúdo JSON para importar." });
      return;
    }

    const selectedRest = restaurants.find(r => r.id === selectedRestaurantId);
    if (!selectedRest) {
      setImportStatus({ type: "error", message: "Selecione um restaurante primeiro." });
      return;
    }
    const targetOwnerId = selectedRest.ownerId || selectedRest.id;

    let parsed: any;
    try {
      parsed = JSON.parse(jsonInput);
    } catch (e: any) {
      setImportStatus({ type: "error", message: "JSON Inválido: " + e.message });
      return;
    }

    let productsToImport: any[] = [];
    if (Array.isArray(parsed)) {
      productsToImport = parsed;
    } else if (parsed && typeof parsed === "object") {
      if (Array.isArray(parsed.products)) {
        productsToImport = parsed.products;
      } else if (Array.isArray(parsed.itens)) {
        productsToImport = parsed.itens;
      } else {
        setImportStatus({ type: "error", message: "Não foi localizado nenhum array de produtos no JSON." });
        return;
      }
    } else {
      setImportStatus({ type: "error", message: "Formato de JSON não suportado." });
      return;
    }

    if (productsToImport.length === 0) {
      setImportStatus({ type: "error", message: "Nenhum produto para importar." });
      return;
    }

    setImporting(true);
    setImportStatus({ type: "info", message: "Analisando categorias e preparando importação..." });
    setImportProgress({ current: 0, total: productsToImport.length });

    try {
      const existingCatNames = new Set(selectedCategories.map(c => c.name?.toLowerCase().trim() || ""));
      
      const catsToCreate = Array.from(new Set(
        productsToImport
          .map((p: any) => {
            const catField = p.category || p.categoria || "Geral";
            return typeof catField === "string" ? catField.trim() : "Geral";
          })
          .filter((cName: string) => cName && !existingCatNames.has(cName.toLowerCase()))
      )) as string[];

      let catsCreatedCount = 0;
      for (let i = 0; i < catsToCreate.length; i++) {
        const catName = catsToCreate[i];
        try {
          await addDoc(collection(db, "categories"), {
            restaurantId: targetOwnerId,
            name: catName,
            order: selectedCategories.length + i,
            createdAt: Date.now()
          });
          catsCreatedCount++;
        } catch (err) {
          console.error("Erro ao criar a categoria " + catName, err);
        }
      }

      let prodsCreatedCount = 0;
      let prodsUpdatedCount = 0;
      for (let i = 0; i < productsToImport.length; i++) {
        const p = productsToImport[i];
        if (!p.name && !p.nome) continue;

        const nameField = (p.name || p.nome || "").trim();
        const descField = (p.description || p.descricao || "").trim();
        const catField = (p.category || p.categoria || "Geral").trim();
        const imgField = p.imageUrl || p.imagem || "https://images.unsplash.com/photo-1546069901-ba9599a7e63c?q=80&w=300&auto=format&fit=crop";
        const isOutOfStockField = !!(p.isOutOfStock || p.esgotado);
        
        let priceNum = 0;
        const rawPrice = p.price !== undefined ? p.price : p.preco;
        if (typeof rawPrice === "number") {
          priceNum = rawPrice;
        } else if (typeof rawPrice === "string") {
          const parsedPrice = parseFloat(rawPrice.replace(/[^\d.,]/g, "").replace(",", "."));
          if (!isNaN(parsedPrice)) {
            priceNum = parsedPrice;
          }
        }

        let daysToSet = ["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"];
        const rawDays = p.availableDays || p.diasDisponiveis;
        if (Array.isArray(rawDays)) {
          const dayMapping: { [key: string]: string } = {
            "0": "Dom", "1": "Seg", "2": "Ter", "3": "Qua", "4": "Qui", "5": "Sex", "6": "Sáb", "7": "Dom",
            "dom": "Dom", "seg": "Seg", "ter": "Ter", "qua": "Qua", "qui": "Qui", "sex": "Sex", "sab": "Sáb", "sáb": "Sáb",
            "domingo": "Dom", "segunda": "Seg", "terça": "Ter", "quarta": "Qua", "quinta": "Qui", "sexta": "Sex", "sábado": "Sáb",
            "segunda-feira": "Seg", "terça-feira": "Ter", "quarta-feira": "Qua", "quinta-feira": "Qui", "sexta-feira": "Sex"
          };
          const mappedDays = rawDays.map((d: any) => {
            const s = String(d).toLowerCase().trim();
            return dayMapping[s] || d;
          }).filter((d: any) => typeof d === "string" && ["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"].includes(d));
          if (mappedDays.length > 0) {
            daysToSet = mappedDays;
          }
        }

        const rawAddons = Array.isArray(p.addons) ? p.addons : Array.isArray(p.adicionais) ? p.adicionais : [];
        const parsedAddons = rawAddons.map((a: any) => {
          if (typeof a === "string") return { name: a, price: 0 };
          return { name: String(a.name || a.nome || "").trim(), price: Number(a.price || a.preco || 0) };
        }).filter((a: any) => a.name);

        const rawComplements = Array.isArray(p.complements) ? p.complements : Array.isArray(p.complementos) ? p.complementos : [];
        const parsedComplements = rawComplements.map((c: any) => {
          if (typeof c === "string") return { name: c };
          return { name: String(c.name || c.nome || c.texto || c.text || c.descricao || c.title || "").trim() };
        }).filter((c: any) => c.name);

        const rawFlavors = Array.isArray(p.flavors) ? p.flavors : Array.isArray(p.sabores) ? p.sabores : [];
        const parsedFlavors = rawFlavors.map((f: any) => {
          if (typeof f === "string") return { name: f };
          return { name: String(f.name || f.nome || "").trim() };
        }).filter((f: any) => f.name);

        const rawSauces = Array.isArray(p.sauces) ? p.sauces : Array.isArray(p.molhos) ? p.molhos : [];
        const parsedSauces = rawSauces.map((s: any) => {
          if (typeof s === "string") return { name: s };
          return { name: String(s.name || s.nome || s.texto || s.text || s.descricao || s.title || "").trim() };
        }).filter((s: any) => s.name);

        const existingProd = selectedProducts.find(ep => ep.name?.toLowerCase().trim() === nameField?.toLowerCase());

        if (existingProd) {
          const mergedAddons = [...(existingProd.addons || [])];
          for (const newA of parsedAddons) {
            if (!mergedAddons.find(ma => ma.name?.toLowerCase() === newA.name?.toLowerCase())) {
              mergedAddons.push(newA);
            }
          }

          const mergedComplements = [...(existingProd.complements || [])];
          for (const newC of parsedComplements) {
            if (!mergedComplements.find(mc => mc.name?.toLowerCase() === newC.name?.toLowerCase())) {
              mergedComplements.push(newC);
            }
          }

          const mergedFlavors = [...(existingProd.flavors || [])];
          for (const newF of parsedFlavors) {
            if (!mergedFlavors.find(mf => mf.name?.toLowerCase() === newF.name?.toLowerCase())) {
              mergedFlavors.push(newF);
            }
          }

          const mergedSauces = [...(existingProd.sauces || [])];
          for (const newS of parsedSauces) {
            if (!mergedSauces.find(ms => ms.name?.toLowerCase() === newS.name?.toLowerCase())) {
              mergedSauces.push(newS);
            }
          }

          await updateDoc(doc(db, "products", existingProd.id), {
            addons: mergedAddons,
            complements: mergedComplements,
            flavors: mergedFlavors,
            sauces: mergedSauces,
            description: existingProd.description ? existingProd.description : descField,
            price: existingProd.price > 0 ? existingProd.price : priceNum,
            category: existingProd.category ? existingProd.category : catField,
            imageUrl: (existingProd.imageUrl && existingProd.imageUrl !== "https://images.unsplash.com/photo-1546069901-ba9599a7e63c?q=80&w=300&auto=format&fit=crop") ? existingProd.imageUrl : imgField,
            updatedAt: Date.now()
          });
          prodsUpdatedCount++;
        } else {
          await addDoc(collection(db, "products"), {
            restaurantId: targetOwnerId,
            name: nameField,
            description: descField,
            price: priceNum,
            category: catField,
            imageUrl: imgField,
            addons: parsedAddons,
            complements: parsedComplements,
            flavors: parsedFlavors,
            sauces: parsedSauces,
            availableDays: daysToSet,
            isOutOfStock: isOutOfStockField,
            createdAt: Date.now(),
            updatedAt: Date.now()
          });
          prodsCreatedCount++;
        }

        setImportProgress({ current: i + 1, total: productsToImport.length });
      }

      setImportStatus({
        type: "success",
        message: `Importação concluída! ${catsCreatedCount} categorias novas. ${prodsCreatedCount} produtos novos criados e ${prodsUpdatedCount} mesclados.`
      });
      setJsonInput("");
    } catch (err: any) {
      setImportStatus({ type: "error", message: "Erro durante a importação: " + err.message });
    } finally {
      setImporting(false);
    }
  };

  const handleSignOut = async () => {
    await signOut(auth);
    navigate("/auth");
  };

  const handleTogglePlan = async (restaurantId: string, currentPlan: string) => {
    try {
      const targetPlan = currentPlan === "Premium" ? "Gratuito" : "Premium";
      const restObj = restaurants.find(r => r.id === restaurantId);
      await updateDoc(doc(db, "restaurants", restaurantId), { plan: targetPlan });
      await createLog("Alterar Plano", `Plano do restaurante "${restObj?.name || restaurantId}" alterado de ${currentPlan} para ${targetPlan}.`, "Clientes");
    } catch (err) {
      alert("Erro ao alterar o plano da loja.");
    }
  };

  const handleUpdateRestaurantType = async (restaurantId: string, newType: string) => {
    try {
      const restObj = restaurants.find(r => r.id === restaurantId);
      await updateDoc(doc(db, "restaurants", restaurantId), { 
        restaurantType: newType,
        updatedAt: new Date().toISOString()
      });
      await createLog(
        "Alterar Tipo de Restaurante",
        `Tipo do restaurante "${restObj?.name || restaurantId}" alterado para "${newType}".`,
        "Clientes"
      );
    } catch (err) {
      console.error("Erro ao atualizar o tipo do restaurante:", err);
      alert("Erro ao alterar o tipo da loja.");
    }
  };

  const handleDeleteRestaurant = async (restaurantId: string) => {
    setDeleteConfirm({
      isOpen: true,
      title: "Remover Restaurante",
      message: "Tem certeza de que deseja remover permanentemente este restaurante do sistema? Esta ação é irreversível.",
      onConfirm: async () => {
        try {
          const restObj = restaurants.find(r => r.id === restaurantId);
          await deleteDoc(doc(db, "restaurants", restaurantId));
          await createLog("Excluir Restaurante", `Removido restaurante "${restObj?.name || restaurantId}" (ID: ${restaurantId}) permanentemente.`, "Clientes");
        } catch (err) {
          alert("Erro ao remover o restaurante.");
        } finally {
          setDeleteConfirm(null);
        }
      }
    });
  };

  const handleSaveSubscription = async () => {
    if (!editingSubscription) return;
    try {
      const restRef = doc(db, "restaurants", editingSubscription.id);
      await updateDoc(restRef, {
        paymentDay: subForm.paymentDay ? Number(subForm.paymentDay) : null,
        subscriptionDiscount: subForm.discount ? Number(subForm.discount) : 0
      });
      await createLog("Atualizar Assinatura", `Configuração de assinatura do restaurante "${editingSubscription.name}" atualizada: Dia Faturamento: ${subForm.paymentDay || "Não definido"}, Desconto: R$ ${subForm.discount || 0}.`, "Assinaturas");
      alert("Assinatura atualizada com sucesso!");
      setEditingSubscription(null);
    } catch (e) {
      console.error(e);
      alert("Erro ao atualizar assinatura.");
    }
  };

  const handleApprovePayment = async (paymentId: string) => {
    try {
      const payObj = payments.find(p => p.id === paymentId);
      await updateDoc(doc(db, "subscription_payments", paymentId), {
        status: "Pago"
      });
      await createLog("Aprovar Pagamento", `Compensado/baixado pagamento do restaurante "${payObj?.restaurantName}" no valor de R$ ${payObj?.amount || 0} (${payObj?.reference || "Mensalidade"}).`, "Financeiro");
      alert("Sucesso! Pagamento aprovado e faturamento baixado.");
    } catch (err: any) {
      console.error("Erro ao aprovar pagamento:", err);
      alert("Erro ao aprovar pagamento: " + err.message);
    }
  };

  const handleCancelPayment = async (paymentId: string) => {
    try {
      const payObj = payments.find(p => p.id === paymentId);
      await updateDoc(doc(db, "subscription_payments", paymentId), {
        status: "Cancelado"
      });
      await createLog("Rejeitar Pagamento", `Faturamento/pagamento cancelado para o restaurante "${payObj?.restaurantName}" no valor de R$ ${payObj?.amount || 0} (${payObj?.reference || "Mensalidade"}).`, "Financeiro");
      alert("Faturamento rejeitado / cancelado com sucesso.");
    } catch (err: any) {
      console.error("Erro ao rejeitar pagamento:", err);
      alert("Erro ao rejeitar pagamento: " + err.message);
    }
  };

  const handleDeletePayment = async (paymentId: string) => {
    if (!confirm("Deseja realmente remover esta fatura do histórico permanentemente?")) return;
    try {
      const payObj = payments.find(p => p.id === paymentId);
      await deleteDoc(doc(db, "subscription_payments", paymentId));
      await createLog("Excluir Pagamento", `Excluído registro de pagamento do restaurante "${payObj?.restaurantName || "N/A"}" no valor de R$ ${payObj?.amount || 0} (${payObj?.reference || "Mensalidade"}).`, "Financeiro");
      alert("Registro excluído com sucesso.");
    } catch (err: any) {
      console.error("Erro ao excluir faturamento:", err);
      alert("Erro ao excluir faturamento: " + err.message);
    }
  };

  const handleSaveAnnouncement = async () => {
    setSavingAnnouncement(true);
    try {
      await setDoc(doc(db, "configs", "admin_announcement"), adminAnnouncement);
      await createLog("Salvar Aviso", `Atualizado aviso global com título "${adminAnnouncement.title}" (Exibição: ${adminAnnouncement.isActive ? "Ativado" : "Desativado"}).`, "Avisos Globais");
      alert("Aviso salvo e publicado com sucesso!");
    } catch (err: any) {
      console.error(err);
      alert("Erro ao salvar aviso: " + err.message);
    } finally {
      setSavingAnnouncement(false);
    }
  };

  const handleCreateRestaurantSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreatingRestaurant(true);
    setCreateError("");

    const { restaurantName, ownerName, email, password } = createForm;

    if (!restaurantName.trim() || !ownerName.trim() || !email.trim() || !password.trim()) {
      setCreateError("Todos os campos são obrigatórios.");
      setCreatingRestaurant(false);
      return;
    }

    if (password.length < 6) {
      setCreateError("A senha deve conter no mínimo 6 caracteres.");
      setCreatingRestaurant(false);
      return;
    }

    let tempApp: any = null;
    try {
      const secondaryAppName = `temp-app-${Date.now()}`;
      tempApp = initializeApp(firebaseConfig, secondaryAppName);
      const tempAuth = getAuth(tempApp);

      const userCredential = await createUserWithEmailAndPassword(tempAuth, email, password);
      const newUid = userCredential.user.uid;

      await setDoc(doc(db, "users", newUid), {
        email: email,
        name: ownerName,
        createdAt: new Date().toISOString()
      });

      const slug = restaurantName
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/(^-|-$)+/g, '');

      const restaurantData = {
        ownerId: newUid,
        name: restaurantName,
        slug,
        restaurantType: createForm.restaurantType || "Pastelaria",
        phone: "",
        hours: "Terça a Domingo, das 18h às 23h",
        services: {
          delivery: true,
          pickup: true,
          dineIn: true,
        },
        deliveryZones: [],
        logoUrl: "https://images.unsplash.com/photo-1590947132387-155cc02f3212?q=80&w=200&auto=format&fit=crop",
        bannerUrl: "https://images.unsplash.com/photo-1513104890138-7c749659a591?q=80&w=1200&auto=format&fit=crop",
        primaryColor: "#ea580c",
        plan: "Premium",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      await setDoc(doc(db, "restaurants", newUid), restaurantData);

      await createLog(
        "Criar Restaurante",
        `Restaurante "${restaurantName}" (${createForm.restaurantType || "Pastelaria"}) criado com sucesso para o proprietário "${ownerName}" (${email}).`,
        "Clientes"
      );

      setCreateForm({ restaurantName: "", ownerName: "", email: "", password: "", restaurantType: "Pastelaria" });
      setShowCreateRestaurantModal(false);
      alert("Restaurante e usuário criados com sucesso!");

    } catch (err: any) {
      console.error("Erro ao criar restaurante/proprietário:", err);
      let errorMsg = err.message || "Ocorreu um erro ao criar o restaurante.";
      if (err.code === "auth/email-already-in-use") {
        errorMsg = "Este e-mail já está sendo utilizado por outro usuário.";
      } else if (err.code === "auth/invalid-email") {
        errorMsg = "O formato do e-mail é inválido.";
      } else if (err.code === "auth/weak-password") {
        errorMsg = "A senha fornecida é muito fraca.";
      }
      setCreateError(errorMsg);
    } finally {
      if (tempApp) {
        try {
          await deleteApp(tempApp);
        } catch (appErr) {
          console.warn("Aviso ao deletar app temporário:", appErr);
        }
      }
      setCreatingRestaurant(false);
    }
  };

  // Helper mapping helper to match restaurants to owners' details
  const getOwnerDetails = (ownerId: string) => {
    const owner = users.find(u => u.id === ownerId);
    return {
      email: owner?.email || "N/A",
      name: owner?.name || "Sem Nome"
    };
  };

  // Filtered list
  const filteredRestaurants = restaurants.filter(r => {
    const owner = getOwnerDetails(r.ownerId);
    const rType = r.restaurantType || r.type || r.segment || "";
    return (
      r.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      r.slug?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      rType.toLowerCase().includes(searchTerm.toLowerCase()) ||
      owner.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      owner.email.toLowerCase().includes(searchTerm.toLowerCase())
    );
  });

  // Calculating Premium values dynamically
  const premiumCount = restaurants.filter(r => r.plan === "Premium").length;
  const freeCount = restaurants.length - premiumCount;
  const premiumPrice = plansConfig?.premium?.price !== undefined ? plansConfig.premium.price : 59.90;
  
  const estimatedRevenue = restaurants.filter(r => r.plan === "Premium").reduce((acc, r) => {
    const discount = r.subscriptionDiscount || 0;
    const finalPrice = Math.max(0, premiumPrice - discount);
    return acc + finalPrice;
  }, 0);

  // Show generic loading screen
  if (authChecking) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-neutral-900 font-sans text-neutral-400">
        <div className="text-center space-y-4">
          <div className="w-12 h-12 rounded-full border-4 border-orange-600 border-t-transparent animate-spin mx-auto"></div>
          <p className="text-sm font-medium tracking-wide">Mantendo conexão segura...</p>
        </div>
      </div>
    );
  }

  // Show "Acesso Negado" if logged in but unauthorized as super admin
  if (!isAuthorized) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-neutral-900 font-sans p-6 text-white text-center">
        <div className="max-w-md bg-neutral-800 rounded-3xl p-8 border border-neutral-700 shadow-2xl space-y-6">
          <div className="w-16 h-16 rounded-2xl bg-red-500/10 text-red-500 flex items-center justify-center mx-auto mb-4 border border-red-500/20">
            <ShieldAlert size={36} />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Acesso de Administrador Necessário</h1>
            <p className="text-neutral-400 mt-3 text-sm leading-relaxed">
              O seu email logado <strong className="text-neutral-200">({user?.email})</strong> não faz parte do grupo de super-administradores do MenuFlow.
            </p>
          </div>
          <div className="pt-2 flex flex-col gap-2">
            <button 
              onClick={handleSignOut}
              className="w-full bg-orange-600 hover:bg-orange-700 font-semibold text-sm py-3 px-4 rounded-xl transition shadow-lg shadow-orange-950/20"
            >
              Conectar com Outra Conta
            </button>
            <Link 
              to="/admin" 
              className="w-full bg-neutral-700 hover:bg-neutral-600 font-semibold text-sm py-3 px-4 rounded-xl transition block"
            >
              Acessar Meu Painel Pessoal
            </Link>
          </div>
        </div>
      </div>
    );
  }

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
      <aside className={`fixed inset-y-0 left-0 z-50 w-64 transform border-r border-neutral-200 bg-neutral-900 text-white transition-transform lg:sticky lg:top-0 lg:h-screen lg:translate-x-0 ${isMobileMenuOpen ? "translate-x-0" : "-translate-x-full"} overflow-hidden flex flex-col`}>
        <div className="flex h-16 items-center px-6 border-b border-neutral-800 shrink-0">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-orange-600 text-white font-bold">
              M
            </div>
            <span className="text-xl font-bold tracking-tight">SuperAdmin</span>
          </div>
        </div>

        <div className="p-4 space-y-5 flex-1 overflow-y-auto">
          {tabGroups.map((group) => (
            <div key={group.title} className="space-y-1.5 animate-in fade-in duration-200">
              <span className="block px-3 text-[10px] font-extrabold text-neutral-500 uppercase tracking-widest leading-none mb-1">
                {group.title}
              </span>
              <div className="space-y-0.5">
                {group.items.map((tab) => {
                  const Icon = tab.icon;
                  const isActive = activeTab === tab.id;
                  return (
                    <button
                      key={tab.id}
                      onClick={() => {
                        setActiveTab(tab.id as any);
                        setIsMobileMenuOpen(false);
                      }}
                      className={`flex w-full items-center gap-3 rounded-xl px-3 py-2 text-sm font-semibold transition-all duration-150 ${
                        isActive
                          ? "bg-orange-600/10 text-orange-500"
                          : "text-neutral-400 hover:bg-neutral-800/50 hover:text-white"
                      }`}
                    >
                      <Icon size={18} className={isActive ? "text-orange-500" : "text-neutral-400"} />
                      <span>{tab.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>

        <div className="p-4 border-t border-neutral-800 space-y-1 shrink-0 bg-neutral-900">
          <Link 
            to="/admin"
            className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-orange-400 hover:bg-neutral-800 hover:text-orange-300 transition"
          >
            <Store size={18} />
            Minha Loja
          </Link>
          <button 
            onClick={handleSignOut}
            className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-neutral-400 hover:bg-neutral-800 hover:text-white transition"
          >
            <LogOut size={18} />
            Sair
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Mobile Header */}
        <header className="flex h-16 items-center justify-between border-b border-neutral-200 bg-white px-4 lg:hidden">
          <button 
            onClick={() => setIsMobileMenuOpen(true)}
            className="p-2 -ml-2 text-neutral-600 hover:text-neutral-900"
          >
            <Menu size={24} />
          </button>
          <span className="font-semibold text-neutral-900">
            {tabs.find(t => t.id === activeTab)?.label}
          </span>
          <div className="w-8" />
        </header>

        {/* Top Header Desktop */}
        <header className="hidden h-16 items-center justify-between border-b border-neutral-200 bg-white px-8 lg:flex">
          <h1 className="text-xl font-semibold text-neutral-900">
             {tabs.find(t => t.id === activeTab)?.label}
          </h1>
          <div className="flex items-center gap-4">
             <div className="text-xs bg-orange-100 text-orange-800 px-3 py-1.5 rounded-full font-mono font-medium">
               SUPERADMIN COMPACT
             </div>
             <Link 
               to="/admin" 
               className="text-xs text-neutral-600 hover:text-neutral-900 flex items-center gap-1 font-medium bg-neutral-100 px-3 py-1.5 rounded-full transition"
             >
               Meu Painel Loja <ExternalLink size={12} />
             </Link>
          </div>
        </header>

        <div className="flex-1 overflow-auto p-4 sm:p-8">
          <div className="mx-auto max-w-6xl">
            
            {/* If still loading Firestore collections */}
            {loadingData ? (
              <div className="p-12 text-center text-neutral-500 font-medium">
                Carregando registros do banco de dados real...
              </div>
            ) : (
              <>
                {/* --- Dashboard TAB --- */}
                {activeTab === "dashboard" && (
                  <div className="space-y-6">
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                      <div className="rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm">
                        <p className="text-sm font-medium text-neutral-500">Total de Lojas</p>
                        <p className="mt-2 text-3xl font-bold text-neutral-900">{restaurants.length}</p>
                        <p className="mt-1 text-sm text-green-600 font-medium">+ Real-time Sync</p>
                      </div>
                      <div className="rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm">
                        <p className="text-sm font-medium text-neutral-500">Assinantes Premium</p>
                        <p className="mt-2 text-3xl font-bold text-neutral-900">{premiumCount}</p>
                        <p className="mt-1 text-sm text-green-600 font-medium">
                          {restaurants.length ? `${Math.round((premiumCount / restaurants.length) * 100)}% de taxa` : "0% de taxa"}
                        </p>
                      </div>
                      <div className="rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm">
                        <p className="text-sm font-medium text-neutral-500 font-sans">Lojas Gratuitas</p>
                        <p className="mt-2 text-3xl font-bold text-neutral-900">{freeCount}</p>
                        <p className="mt-1 text-sm text-neutral-500 font-medium">No plano padrão</p>
                      </div>
                      <div className="rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm">
                        <p className="text-sm font-medium text-neutral-500">MRR Mensal Estimado</p>
                        <p className="mt-2 text-3xl font-bold text-neutral-900">R$ {estimatedRevenue.toFixed(2)}</p>
                        <p className="mt-1 text-sm text-green-600 font-medium">R$ {(plansConfig?.premium?.price ?? 59.90).toFixed(2).replace('.', ',')} por premium</p>
                      </div>
                    </div>

                    {/* Quick overview layout of recent stores */}
                    <div className="bg-white rounded-2xl border border-neutral-200 p-6 shadow-sm space-y-4">
                      <h3 className="font-bold text-lg text-neutral-900">Visão Geral Rápida do Sistema</h3>
                      <p className="text-sm text-neutral-500 leading-relaxed">
                        Este painel reflete em tempo real os clientes cadastrados no banco de dados do Firestore. À medida que novos estabelecimentos realizam o Onboarding, as informações são adicionadas instantaneamente a este módulo central. O faturamento e o controle do limite dos produtos reagem imediatamente a qualquer modificação de plano feita aqui.
                      </p>
                    </div>
                  </div>
                )}

                {/* --- Clientes TAB --- */}
                {activeTab === "clientes" && (
                  <div className="space-y-6">
                    <div className="flex justify-between items-center gap-4">
                      <h2 className="text-lg font-bold text-neutral-900">Gerenciamento de Lojas</h2>
                      <button
                        onClick={() => setShowCreateRestaurantModal(true)}
                        className="flex items-center gap-2 rounded-xl bg-orange-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-orange-700 transition cursor-pointer"
                      >
                        <Plus size={18} />
                        <span>Novo Restaurante</span>
                      </button>
                    </div>

                    <div className="overflow-hidden rounded-xl border border-neutral-200 bg-white shadow-sm">
                      <div className="p-4 border-b border-neutral-200 bg-neutral-50 flex items-center gap-2">
                        <Search size={18} className="text-neutral-400" />
                        <input 
                          type="text" 
                          placeholder="Buscar por nome, slug, tipo/segmento, email do dono..." 
                          value={searchTerm}
                          onChange={(e) => setSearchTerm(e.target.value)}
                          className="w-full max-w-md rounded-lg border-neutral-300 ring-1 ring-inset ring-neutral-200 py-2 px-3 text-sm focus:ring-2 focus:ring-orange-600 outline-none bg-white"
                        />
                      </div>
                      <div className="overflow-x-auto">
                        {filteredRestaurants.length === 0 ? (
                          <div className="p-8 text-center text-neutral-500">
                             Nenhum restaurante encontrado.
                          </div>
                        ) : (
                          <table className="min-w-full divide-y divide-neutral-200 text-sm text-left">
                            <thead className="bg-white text-neutral-500 font-medium text-xs uppercase">
                              <tr>
                                <th className="px-6 py-4">Restaurante / Slug</th>
                                <th className="px-6 py-4">Tipo / Segmento</th>
                                <th className="px-6 py-4">WhatsApp</th>
                                <th className="px-6 py-4">Dono / E-mail</th>
                                <th className="px-6 py-4">Status / Plano</th>
                                <th className="px-6 py-3 text-right">Ações</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-neutral-200 bg-white">
                              {filteredRestaurants.map((restaurantItem) => {
                                const ownerInfo = getOwnerDetails(restaurantItem.ownerId);
                                const isPremium = restaurantItem.plan === "Premium";
                                const currentType = restaurantItem.restaurantType || restaurantItem.type || restaurantItem.segment || "Pastelaria";
                                return (
                                  <tr key={restaurantItem.id} className="hover:bg-neutral-50/50 transition">
                                    <td className="px-6 py-4">
                                      <div className="font-semibold text-neutral-900 capitalize">{restaurantItem.name}</div>
                                      <div className="text-neutral-500 text-xs font-mono font-medium">/{restaurantItem.slug}</div>
                                    </td>
                                    <td className="px-6 py-4">
                                      <select
                                        value={currentType}
                                        onChange={(e) => handleUpdateRestaurantType(restaurantItem.id, e.target.value)}
                                        className="px-2.5 py-1.5 rounded-xl text-xs font-bold bg-orange-50/80 border border-orange-200 text-orange-950 hover:bg-orange-100 focus:ring-2 focus:ring-orange-500 outline-none cursor-pointer transition shadow-2xs"
                                      >
                                        {!RESTAURANT_TYPES.includes(currentType) && (
                                          <option value={currentType}>{currentType}</option>
                                        )}
                                        {RESTAURANT_TYPES.map(t => (
                                          <option key={t} value={t}>{t}</option>
                                        ))}
                                      </select>
                                    </td>
                                    <td className="px-6 py-4 text-neutral-600 font-mono text-xs">{restaurantItem.phone || "Não informado"}</td>
                                    <td className="px-6 py-4">
                                      <div className="text-sm font-medium text-neutral-800">{ownerInfo.name}</div>
                                      <div className="text-xs text-neutral-500">{ownerInfo.email}</div>
                                    </td>
                                    <td className="px-6 py-4">
                                      <div className="flex items-center gap-2">
                                        <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold ring-1 ring-inset bg-green-50 text-green-700 ring-green-600/20">
                                          Premium
                                        </span>
                                      </div>
                                    </td>
                                    <td className="px-6 py-4 text-right">
                                      <div className="flex justify-end items-center gap-3">
                                        <button 
                                          onClick={() => {
                                            setSelectedRestaurantId(restaurantItem.id);
                                            setActiveTab("funcoes");
                                          }}
                                          className="p-1 px-2.5 text-xs font-medium text-amber-700 bg-amber-50 rounded-lg hover:bg-amber-100 transition inline-flex items-center gap-1.5"
                                          title="Gerenciar funções/recursos"
                                        >
                                          <ToggleLeft size={16} />
                                          Funções
                                        </button>
                                        <a 
                                          href={`${window.location.origin}/${restaurantItem.slug}`}
                                          target="_blank"
                                          rel="noopener noreferrer"
                                          className="p-1 px-2.5 text-xs font-medium text-orange-600 bg-orange-50 rounded-lg hover:bg-orange-100 transition inline-flex items-center gap-1.5"
                                        >
                                          Ver Cardápio
                                          <ExternalLink size={12} />
                                        </a>
                                        <button 
                                          onClick={() => handleDeleteRestaurant(restaurantItem.id)}
                                          className="p-2 text-neutral-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition"
                                          title="Deletar loja"
                                        >
                                          <Trash2 size={16} />
                                        </button>
                                      </div>
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                {/* --- Recursos/Funções TAB --- */}
                {activeTab === "funcoes" && (() => {
                  const selectedRest = restaurants.find(r => r.id === selectedRestaurantId);
                  const disabledFeatures = selectedRest?.disabledFeatures || [];

                  const adminFeatures = [
                    { id: "overview", label: "Resumo", icon: BarChart3, description: "Gráficos de vendas, faturamento diário, tíquete médio e visitas em tempo real." },
                    { id: "pdv", label: "PDV (Frente de Caixa)", icon: Store, description: "Faturamento manual de balcão, entregas ou retiradas pelo painel interno." },
                    { id: "orders", label: "Pedidos", icon: ClipboardList, description: "Controle do status do fluxo operacional e som de novos pedidos." },
                    { id: "products", label: "Produtos", icon: Box, description: "Cadastro e gerenciamento do catálogo de itens com fotos e preços." },
                    { id: "categories", label: "Categorias", icon: Tags, description: "Organização do cardápio e definição da ordem das seções." },
                    { id: "tables", label: "Mesas", icon: Users, description: "Gerenciamento de mesas e atribuição de comandas em andamento." },
                    { id: "waiters", label: "Atendentes", icon: User, description: "Cadastro e gerenciamento de atendentes/garçons com permissões de comanda." },
                    { id: "appearance", label: "Aparência", icon: Palette, description: "Logo, Banner, cor principal, e horário de funcionamento." },
                    { id: "store_settings", label: "Funcionamento", icon: Clock, description: "Configuração do horário de funcionamento e status de abertura da loja." },
                    { id: "announcements", label: "Avisos", icon: Megaphone, description: "Criação de avisos ou anúncios importantes no topo do cardápio digital." },
                    { id: "qrcode", label: "QR Code", icon: QrCode, description: "Geração de PDFs diagramados para mesas com QR Codes de acesso." },
                    { id: "printer", label: "Impressora", icon: Printer, description: "Integração e pareamento USB/Bluetooth com impressoras térmicas." },
                    { id: "subscription", label: "Assinatura", icon: CreditCard, description: "Visualização do faturamento, controle de plano e Pix." },
                  ];

                  const handleToggleFeature = async (featureId: string) => {
                    if (!selectedRest) return;
                    try {
                      let newDisabled = [...disabledFeatures];
                      const isDisabling = !newDisabled.includes(featureId);
                      if (newDisabled.includes(featureId)) {
                        newDisabled = newDisabled.filter(f => f !== featureId);
                      } else {
                        newDisabled.push(featureId);
                      }
                      await updateDoc(doc(db, "restaurants", selectedRest.id), {
                        disabledFeatures: newDisabled
                      });
                      const featureLabel = adminFeatures.find(f => f.id === featureId)?.label || featureId;
                      await createLog("Privilégios de Funções", `${isDisabling ? "Desativou" : "Ativou"} o recurso "${featureLabel}" no restaurante "${selectedRest.name}".`, "Controle de Funções");
                    } catch (e: any) {
                      alert("Erro ao alterar função: " + e.message);
                    }
                  };

                  const handleToggleAllFeatures = async (action: "enable" | "disable") => {
                    if (!selectedRest) return;
                    try {
                      const newDisabled = action === "enable" ? [] : adminFeatures.map(f => f.id);
                      await updateDoc(doc(db, "restaurants", selectedRest.id), {
                        disabledFeatures: newDisabled
                      });
                      await createLog("Privilégios de Funções", `${action === "enable" ? "Ativou" : "Desativou"} TODOS os recursos do restaurante "${selectedRest.name}".`, "Controle de Funções");
                    } catch (e: any) {
                      alert("Erro ao aplicar alteração global: " + e.message);
                    }
                  };

                  const ownerDetails = selectedRest ? getOwnerDetails(selectedRest.ownerId) : null;

                  return (
                    <div className="space-y-6 animate-in fade-in duration-200">
                      {/* Control Panel Header with select dropdown */}
                      <div className="rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm">
                        <div className="flex flex-col md:flex-row gap-4 items-start md:items-center justify-between">
                          <div>
                            <h3 className="text-lg font-bold text-neutral-900">Selecione o Estabelecimento</h3>
                            <p className="text-sm text-neutral-550 mt-1">Escolha uma loja abaixo para personalizar quais abas e ferramentas estarão visíveis no painel.</p>
                          </div>
                          
                          <div className="relative w-full max-w-md">
                            <select
                              value={selectedRestaurantId}
                              onChange={(e) => setSelectedRestaurantId(e.target.value)}
                              className="w-full rounded-xl border border-neutral-300 ring-1 ring-inset ring-neutral-200 py-3 px-4 pr-10 text-sm font-semibold focus:ring-2 focus:ring-orange-600 outline-none bg-white text-neutral-800 cursor-pointer shadow-sm appearance-none"
                            >
                              <option value="">-- Selecione uma loja --</option>
                              {restaurants.map(r => (
                                <option key={r.id} value={r.id}>
                                  {r.name} (/{r.slug}) - {r.plan || "Premium"}
                                </option>
                              ))}
                            </select>
                            <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-4 text-neutral-500">
                              <ChevronDown size={18} />
                            </div>
                          </div>
                        </div>

                        {selectedRest && (
                          <div className="mt-6 pt-6 border-t border-neutral-150 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                            <div className="flex items-center gap-4">
                              <div className="w-12 h-12 rounded-xl bg-orange-100 text-orange-700 flex items-center justify-center font-bold text-lg select-none">
                                {selectedRest.name ? selectedRest.name.substring(0, 2).toUpperCase() : "SL"}
                              </div>
                              <div>
                                <div className="text-base font-bold text-neutral-900 flex items-center gap-2">
                                  {selectedRest.name}
                                  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ring-1 ring-inset bg-green-50 text-green-700 ring-green-600/20">
                                    {selectedRest.plan || "Premium"}
                                  </span>
                                </div>
                                <div className="text-xs text-neutral-500 mt-0.5 font-mono">
                                  Slug: /{selectedRest.slug} • Criado por: {ownerDetails?.name} ({ownerDetails?.email})
                                </div>
                              </div>
                            </div>
                            
                            <div className="flex gap-2 w-full sm:w-auto">
                              <button
                                onClick={() => handleToggleAllFeatures("enable")}
                                className="flex-1 sm:flex-none py-2 px-4 text-xs font-bold text-green-700 bg-green-50 hover:bg-green-100 rounded-lg transition hover:shadow-xs"
                              >
                                Ativar Tudo
                              </button>
                              <button
                                onClick={() => handleToggleAllFeatures("disable")}
                                className="flex-1 sm:flex-none py-2 px-4 text-xs font-bold text-red-700 bg-red-50 hover:bg-red-100 rounded-lg transition hover:shadow-xs"
                              >
                                Bloquear Tudo
                              </button>
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Features Toggle Grid */}
                      {selectedRest ? (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                          {adminFeatures.map((feat) => {
                            const FeatIcon = feat.icon;
                            const isEnabled = !disabledFeatures.includes(feat.id);
                            return (
                              <div 
                                key={feat.id}
                                className={`rounded-2xl border p-5 bg-white shadow-xs transition flex gap-4 ${
                                  isEnabled ? "border-neutral-200" : "border-neutral-200/60 opacity-80"
                                }`}
                              >
                                <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                                  isEnabled ? "bg-orange-50 text-orange-600" : "bg-neutral-100 text-neutral-400"
                                }`}>
                                  <FeatIcon size={20} />
                                </div>

                                <div className="flex-1 space-y-1.5">
                                  <div className="flex items-center justify-between">
                                    <h4 className="font-bold text-sm text-neutral-900">{feat.label}</h4>
                                    
                                    {/* Toggle Switch Button */}
                                    <button
                                      type="button"
                                      onClick={() => handleToggleFeature(feat.id)}
                                      className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                                        isEnabled ? "bg-orange-600" : "bg-neutral-200"
                                      }`}
                                    >
                                      <span
                                        className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-sm ring-0 transition duration-200 ease-in-out ${
                                          isEnabled ? "translate-x-5" : "translate-x-0"
                                        }`}
                                      />
                                    </button>
                                  </div>
                                  <p className="text-xs text-neutral-500 leading-relaxed font-normal">
                                    {feat.description}
                                  </p>
                                  <div className="pt-1 flex items-center gap-1.5 text-[11px] font-bold">
                                    {isEnabled ? (
                                      <span className="text-green-600">Disponível no painel</span>
                                    ) : (
                                      <span className="text-red-600">Escondido / Desativado</span>
                                    )}
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      ) : (
                        <div className="rounded-2xl bg-neutral-100 border border-neutral-200 p-8 text-center text-neutral-500 font-medium">
                          Nenhum restaurante cadastrado ou selecionado no sistema de onboarding.
                        </div>
                      )}
                    </div>
                  );
                })()}

                {/* --- Cardápios (Products & Categories) TAB --- */}
                {activeTab === "cardapio" && (
                  <div className="space-y-6 animate-in fade-in duration-200">
                    {/* Selected Restaurant Selector */}
                    <div className="rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm">
                      <div className="flex flex-col md:flex-row gap-4 items-start md:items-center justify-between">
                        <div>
                          <h3 className="text-lg font-bold text-neutral-900">Selecione o Restaurante</h3>
                          <p className="text-sm text-neutral-550 mt-1">Configure o cardápio (produtos e categorias) de uma loja específica.</p>
                        </div>
                        
                        <div className="relative w-full max-w-md">
                          <select
                            value={selectedRestaurantId}
                            onChange={(e) => {
                              setSelectedRestaurantId(e.target.value);
                              setIsAddingProduct(false);
                              setEditingProduct(null);
                            }}
                            className="w-full rounded-xl border border-neutral-300 ring-1 ring-inset ring-neutral-200 py-3 px-4 pr-10 text-sm font-semibold focus:ring-2 focus:ring-orange-600 outline-none bg-white text-neutral-800 cursor-pointer shadow-sm appearance-none"
                          >
                            <option value="">-- Selecione uma loja --</option>
                            {restaurants.map(r => (
                              <option key={r.id} value={r.id}>
                                {r.name} (/{r.slug})
                              </option>
                            ))}
                          </select>
                          <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-4 text-neutral-500">
                            <ChevronDown size={18} />
                          </div>
                        </div>
                      </div>
                    </div>

                    {selectedRestaurantId ? (
                      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                        {/* Categories Panel */}
                        <div className="space-y-6">
                          <div className="rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm">
                            <h3 className="font-bold text-base text-neutral-900 flex items-center gap-2 mb-4">
                              <Tags size={18} className="text-orange-600" />
                              Categorias ({selectedCategories.length})
                            </h3>

                            {/* Add Category Form */}
                            <div className="flex gap-2 mb-6">
                              <input
                                type="text"
                                placeholder="Nova categoria..."
                                value={newCategoryName}
                                onChange={(e) => setNewCategoryName(e.target.value)}
                                onKeyDown={(e) => e.key === "Enter" && handleAddCategorySuper()}
                                className="flex-1 rounded-lg ring-1 ring-inset ring-neutral-300 px-3 py-2 text-sm focus:ring-2 focus:ring-orange-600 outline-none bg-white font-sans"
                              />
                              <button
                                onClick={handleAddCategorySuper}
                                className="bg-orange-600 hover:bg-orange-700 text-white rounded-lg px-3 py-2 text-sm font-semibold flex items-center gap-1 transition"
                              >
                                <Plus size={16} />
                                Criar
                              </button>
                            </div>

                            {/* Categories List */}
                            <div className="space-y-2 max-h-[400px] overflow-auto pr-1">
                              {loadingActiveMenu && selectedCategories.length === 0 ? (
                                <p className="text-center py-4 text-xs font-medium text-neutral-400">Carregando...</p>
                              ) : selectedCategories.length === 0 ? (
                                <p className="text-center py-4 text-xs font-medium text-neutral-400">Nenhuma categoria cadastrada.</p>
                              ) : (
                                selectedCategories.map((c) => (
                                  <div key={c.id} className="flex items-center justify-between p-3 rounded-xl bg-neutral-50 border border-neutral-150 hover:bg-neutral-100/50 transition">
                                    {editingCategoryId === c.id ? (
                                      <div className="flex items-center gap-1.5 w-full">
                                        <input
                                          type="text"
                                          value={editingCategoryName}
                                          onChange={(e) => setEditingCategoryName(e.target.value)}
                                          onKeyDown={(e) => e.key === "Enter" && handleSaveCategoryEdit(c.id)}
                                          className="flex-1 rounded-md ring-1 ring-inset ring-neutral-300 px-2 py-1 text-xs focus:ring-2 focus:ring-orange-600 outline-none bg-white font-sans"
                                        />
                                        <button
                                          onClick={() => handleSaveCategoryEdit(c.id)}
                                          className="p-1 text-green-600 hover:bg-green-50 rounded"
                                        >
                                          <Check size={14} />
                                        </button>
                                        <button
                                          onClick={() => {
                                            setEditingCategoryId(null);
                                            setEditingCategoryName("");
                                          }}
                                          className="p-1 text-neutral-400 hover:bg-neutral-100 rounded"
                                        >
                                          <X size={14} />
                                        </button>
                                      </div>
                                    ) : (
                                      <>
                                        <span className="text-sm font-semibold text-neutral-800 truncate">{c.name}</span>
                                        <div className="flex items-center gap-1 shrink-0">
                                          <button
                                            onClick={() => {
                                              setEditingCategoryId(c.id);
                                              setEditingCategoryName(c.name);
                                            }}
                                            className="p-1 text-neutral-400 hover:text-neutral-700 hover:bg-neutral-100 rounded transition"
                                            title="Editar nome"
                                          >
                                            <Edit3 size={14} />
                                          </button>
                                          <button
                                            onClick={() => handleDeleteCategorySuper(c.id, c.name)}
                                            className="p-1 text-neutral-400 hover:text-red-600 hover:bg-red-50 rounded transition"
                                            title="Excluir categoria"
                                          >
                                            <Trash2 size={14} />
                                          </button>
                                        </div>
                                      </>
                                    )}
                                  </div>
                                ))
                              )}
                            </div>
                          </div>

                          {/* Quick JSON Import triggers card */}
                          <div className="rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm space-y-4">
                            <h3 className="font-bold text-base text-neutral-900 flex items-center gap-2">
                              <FileJson size={18} className="text-orange-600" />
                              Carga em Lote (JSON)
                            </h3>
                            <p className="text-xs text-neutral-500 leading-relaxed">
                              Importe categorias e dezenas de produtos instantaneamente a partir de uma estrutura de dados JSON estruturada.
                            </p>
                            <button
                              onClick={() => {
                                const selectedRest = restaurants.find(r => r.id === selectedRestaurantId);
                                const seg = selectedRest?.restaurantType || selectedRest?.genre || selectedRest?.type || selectedRest?.segment || "Pastelaria";
                                const templateData = getMenuTemplateBySegment(seg);
                                setJsonInput(JSON.stringify(templateData, null, 2));
                                setImportStatus({ type: "info", message: `Modelo adaptado para o segmento "${seg}" pré-carregado!` });
                                setShowJsonImportModal(true);
                              }}
                              className="w-full border border-orange-600 text-orange-600 hover:bg-orange-50 font-semibold text-sm py-2.5 px-4 rounded-xl transition flex items-center justify-center gap-2 cursor-pointer"
                            >
                              <Upload size={16} />
                              Importar via JSON
                            </button>
                          </div>
                        </div>

                        {/* Products Panel (Middle/Right columns) */}
                        <div className="lg:col-span-2 space-y-6">
                          {isAddingProduct ? (
                            /* Create / Edit Product Form Card */
                            <div className="rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm space-y-4">
                              <div className="flex justify-between items-center pb-4 border-b border-neutral-100">
                                <h3 className="font-bold text-base text-neutral-900">
                                  {editingProduct ? "Editar Produto" : "Novo Produto Manual"}
                                </h3>
                                <button
                                  onClick={() => {
                                    setIsAddingProduct(false);
                                    setEditingProduct(null);
                                  }}
                                  className="text-neutral-400 hover:text-neutral-600"
                                >
                                  <X size={18} />
                                </button>
                              </div>

                              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="space-y-1.5 col-span-1 md:col-span-2">
                                  <label className="text-xs font-semibold text-neutral-600 block">Nome do Produto *</label>
                                  <input
                                    type="text"
                                    placeholder="Ex: Hambúrguer Clássico, Suco de Laranja..."
                                    value={productForm.name}
                                    onChange={(e) => setProductForm({ ...productForm, name: e.target.value })}
                                    className="w-full rounded-lg ring-1 ring-inset ring-neutral-300 px-3 py-2 text-sm focus:ring-2 focus:ring-orange-600 outline-none bg-white font-sans"
                                  />
                                </div>

                                <div className="space-y-1.5 col-span-1 md:col-span-2">
                                  <label className="text-xs font-semibold text-neutral-600 block">Descrição</label>
                                  <textarea
                                    rows={2}
                                    placeholder="Ex: Hambúrguer artesanal de 150g, queijo cheddar, maionese grill..."
                                    value={productForm.description}
                                    onChange={(e) => setProductForm({ ...productForm, description: e.target.value })}
                                    className="w-full rounded-lg ring-1 ring-inset ring-neutral-300 px-3 py-2 text-sm focus:ring-2 focus:ring-orange-600 outline-none bg-white font-sans resize-none"
                                  />
                                </div>

                                <div className="space-y-1.5">
                                  <label className="text-xs font-semibold text-neutral-600 block">Preço (R$) *</label>
                                  <input
                                    type="number"
                                    step="0.01"
                                    placeholder="29.90"
                                    value={productForm.price}
                                    onChange={(e) => setProductForm({ ...productForm, price: e.target.value })}
                                    className="w-full rounded-lg ring-1 ring-inset ring-neutral-300 px-3 py-2 text-sm focus:ring-2 focus:ring-orange-600 outline-none bg-white font-sans"
                                  />
                                </div>

                                <div className="space-y-1.5">
                                  <label className="text-xs font-semibold text-neutral-600 block">Categoria *</label>
                                  <div className="relative">
                                    <select
                                      value={productForm.category}
                                      onChange={(e) => setProductForm({ ...productForm, category: e.target.value })}
                                      className="w-full appearance-none rounded-lg ring-1 ring-inset ring-neutral-300 px-3 py-2 text-sm focus:ring-2 focus:ring-orange-600 outline-none bg-white text-neutral-800 cursor-pointer"
                                    >
                                      <option value="" disabled>Selecione...</option>
                                      {selectedCategories.map((c) => (
                                        <option key={c.id} value={c.name}>{c.name}</option>
                                      ))}
                                      {selectedCategories.length === 0 && (
                                        <option value="Geral">Geral (Adicione categorias primeiro)</option>
                                      )}
                                    </select>
                                    <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-3 text-neutral-500">
                                      <ChevronDown size={14} />
                                    </div>
                                  </div>
                                </div>

                                <div className="space-y-1.5 col-span-1 md:col-span-2">
                                  <label className="text-xs font-semibold text-neutral-600 block">URL da Foto (ilustrativa)</label>
                                  <input
                                    type="text"
                                    placeholder="https://images.unsplash.com/... (Deixe em branco para imagem padrão)"
                                    value={productForm.imageUrl}
                                    onChange={(e) => setProductForm({ ...productForm, imageUrl: e.target.value })}
                                    className="w-full rounded-lg ring-1 ring-inset ring-neutral-300 px-3 py-2 text-sm focus:ring-2 focus:ring-orange-600 outline-none bg-white font-sans text-xs"
                                  />
                                </div>

                                <div className="col-span-1 md:col-span-2 py-2">
                                  <label className="flex items-center gap-2 cursor-pointer select-none">
                                    <input
                                      type="checkbox"
                                      checked={productForm.isOutOfStock}
                                      onChange={(e) => setProductForm({ ...productForm, isOutOfStock: e.target.checked })}
                                      className="rounded text-orange-600 focus:ring-orange-600 focus:ring-offset-0 h-4 w-4"
                                    />
                                    <span className="text-sm font-medium text-neutral-700">Item esgotado / indisponível para pedidos no momento</span>
                                  </label>
                                </div>

                                {/* --- DISPONIBILIDADE --- */}
                                <div className="col-span-1 md:col-span-2 border-t border-neutral-100 pt-4 space-y-2">
                                  <label className="text-xs font-bold text-neutral-800 block uppercase tracking-wider">Dias de Disponibilidade</label>
                                  <p className="text-xs text-neutral-500">Selecione em quais dias este produto ficará ativo no cardápio.</p>
                                  <div className="flex flex-wrap gap-1.5 pt-1">
                                    {[
                                      { id: "Seg", label: "Segunda" },
                                      { id: "Ter", label: "Terça" },
                                      { id: "Qua", label: "Quarta" },
                                      { id: "Qui", label: "Quinta" },
                                      { id: "Sex", label: "Sexta" },
                                      { id: "Sáb", label: "Sábado" },
                                      { id: "Dom", label: "Domingo" }
                                    ].map((day) => {
                                      const isSelected = productForm.availableDays?.includes(day.id);
                                      return (
                                        <button
                                          key={day.id}
                                          type="button"
                                          onClick={() => {
                                            const currentDays = productForm.availableDays || [];
                                            let newDays;
                                            if (currentDays.includes(day.id)) {
                                              newDays = currentDays.filter(d => d !== day.id);
                                            } else {
                                              newDays = [...currentDays, day.id];
                                            }
                                            setProductForm({ ...productForm, availableDays: newDays });
                                          }}
                                          className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition cursor-pointer select-none ${
                                            isSelected 
                                              ? "bg-orange-600 text-white border-orange-600 shadow-sm" 
                                              : "bg-neutral-50 hover:bg-neutral-100 text-neutral-700 border-neutral-200"
                                          }`}
                                        >
                                          {day.id}
                                        </button>
                                      );
                                    })}
                                  </div>
                                </div>

                                {/* --- ADICIONAIS COM PREÇO --- */}
                                <div className="col-span-1 md:col-span-2 border-t border-neutral-100 pt-4 space-y-3">
                                  <div className="flex justify-between items-center">
                                    <div>
                                      <label className="text-xs font-bold text-neutral-800 block uppercase tracking-wider">Adicionais Extras (Com Preço Adicional)</label>
                                      <p className="text-xs text-neutral-500">Configure ingredientes ou itens extras pagos para este produto.</p>
                                    </div>
                                  </div>
                                  
                                  <div className="flex flex-col sm:flex-row gap-2">
                                    <input 
                                      type="text" 
                                      placeholder="Ex: Hambúrguer Extra" 
                                      value={newAddonName}
                                      onChange={e => setNewAddonName(e.target.value)}
                                      className="flex-1 rounded-lg ring-1 ring-inset ring-neutral-300 px-3 py-2 text-sm focus:ring-2 focus:ring-orange-600 outline-none bg-white font-sans"
                                    />
                                    <div className="flex gap-2">
                                      <input 
                                        type="number" 
                                        step="0.01"
                                        placeholder="Preço R$ (ex: 5.00)" 
                                        value={newAddonPrice}
                                        onChange={e => setNewAddonPrice(e.target.value)}
                                        className="w-32 rounded-lg ring-1 ring-inset ring-neutral-300 px-3 py-2 text-sm focus:ring-2 focus:ring-orange-600 outline-none bg-white font-sans"
                                      />
                                      <button
                                        type="button"
                                        onClick={() => {
                                          if (!newAddonName.trim()) return;
                                          const priceVal = parseFloat(newAddonPrice) || 0;
                                          setProductForm(prev => ({
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

                                  {productForm.addons && productForm.addons.length > 0 && (
                                    <div className="bg-orange-50/25 rounded-xl p-3 border border-orange-100 divide-y divide-orange-100 max-h-36 overflow-y-auto">
                                      {productForm.addons.map((ad, idx) => (
                                        <div key={idx} className="flex justify-between items-center py-2 first:pt-0 last:pb-0 text-xs">
                                          <span className="font-semibold text-neutral-850">{ad.name}</span>
                                          <div className="flex items-center gap-3">
                                            <span className="font-mono text-orange-600 font-bold bg-orange-50 px-2 py-0.5 rounded">
                                              + R$ {ad.price.toFixed(2)}
                                            </span>
                                            <button
                                              type="button"
                                              onClick={() => {
                                                setProductForm(prev => ({
                                                  ...prev,
                                                  addons: prev.addons.filter((_, i) => i !== idx)
                                                }));
                                              }}
                                              className="text-red-550 hover:text-red-700 font-semibold transition"
                                            >
                                              Remover
                                            </button>
                                          </div>
                                        </div>
                                      ))}
                                    </div>
                                  )}
                                </div>

                                {/* --- COMPLEMENTOS GRÁTIS --- */}
                                <div className="col-span-1 md:col-span-2 border-t border-neutral-100 pt-4 space-y-3">
                                  <div>
                                    <label className="text-xs font-bold text-neutral-800 block uppercase tracking-wider">Complementos (Opções / Grátis)</label>
                                    <p className="text-xs text-neutral-500">Defina opções de escolha ou observações grátis para este produto (ex: Sem Maionese ou Bem Passado).</p>
                                  </div>
                                  
                                  <div className="flex gap-2">
                                    <input 
                                      type="text" 
                                      placeholder="Ex: Ponto da carne: Bem passado" 
                                      value={newComplementName}
                                      onChange={e => setNewComplementName(e.target.value)}
                                      className="flex-1 rounded-lg ring-1 ring-inset ring-neutral-300 px-3 py-2 text-sm focus:ring-2 focus:ring-orange-600 outline-none bg-white font-sans"
                                    />
                                    <button
                                      type="button"
                                      onClick={() => {
                                        if (!newComplementName.trim()) return;
                                        setProductForm(prev => ({
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

                                  {productForm.complements && productForm.complements.length > 0 && (
                                    <div className="bg-neutral-50 rounded-xl p-3 border border-neutral-200/50 divide-y divide-neutral-100 max-h-36 overflow-y-auto">
                                      {productForm.complements.map((cp, idx) => (
                                        <div key={idx} className="flex justify-between items-center py-2 first:pt-0 last:pb-0 text-xs font-sans">
                                          <span className="font-semibold text-neutral-800">{cp.name}</span>
                                          <div className="flex items-center gap-3">
                                            <span className="font-semibold text-neutral-500 bg-neutral-100 px-2 py-0.5 rounded text-[10px]">
                                              Grátis
                                            </span>
                                            <button
                                              type="button"
                                              onClick={() => {
                                                setProductForm(prev => ({
                                                  ...prev,
                                                  complements: prev.complements.filter((_, i) => i !== idx)
                                                }));
                                              }}
                                              className="text-red-550 hover:text-red-700 font-semibold transition"
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

                              <div className="flex justify-end gap-3 pt-4 border-t border-neutral-100">
                                <button
                                  onClick={() => {
                                    setIsAddingProduct(false);
                                    setEditingProduct(null);
                                  }}
                                  className="py-2 px-4 border border-neutral-300 text-neutral-700 hover:bg-neutral-50 text-sm font-semibold rounded-xl transition"
                                >
                                  Cancelar
                                </button>
                                <button
                                  onClick={handleSaveProductSuper}
                                  className="py-2 px-5 bg-orange-600 hover:bg-orange-700 text-white text-sm font-semibold rounded-xl transition shadow-md shadow-orange-900/10"
                                >
                                  {editingProduct ? "Salvar Alterações" : "Adicionar Produto"}
                                </button>
                              </div>
                            </div>
                          ) : (
                            /* Products List / Grid Dashboard View */
                            <div className="rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm space-y-6">
                              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 pb-2">
                                <div>
                                  <h3 className="font-bold text-base text-neutral-900 flex items-center gap-2">
                                    <Box size={18} className="text-orange-600" />
                                    Produtos Cadastrados ({selectedProducts.length})
                                  </h3>
                                  <p className="text-xs text-neutral-500 mt-1">Gerenciamento manual do catálogo da loja selecionada.</p>
                                </div>

                                <button
                                  onClick={() => {
                                    setEditingProduct(null);
                                    setProductForm({
                                      name: "",
                                      description: "",
                                      price: "",
                                      category: selectedCategories[0]?.name || "Geral",
                                      imageUrl: "",
                                      addons: [],
                                      complements: [],
                                      availableDays: ["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"],
                                      isOutOfStock: false
                                    });
                                    setIsAddingProduct(true);
                                  }}
                                  className="bg-orange-600 hover:bg-orange-700 text-white font-semibold text-xs py-2 px-4 rounded-xl flex items-center gap-1.5 transition whitespace-nowrap self-stretch sm:self-auto justify-center"
                                >
                                  <Plus size={16} />
                                  Novo Produto
                                </button>
                              </div>

                              {/* Search and filter bars */}
                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 bg-neutral-50 p-3 rounded-xl border border-neutral-150">
                                <div className="relative">
                                  <Search size={14} className="text-neutral-400 absolute left-3 top-1/2 -translate-y-1/2" />
                                  <input
                                    type="text"
                                    placeholder="Filtrar por nome..."
                                    value={productSearch}
                                    onChange={(e) => setProductSearch(e.target.value)}
                                    className="w-full rounded-lg ring-1 ring-inset ring-neutral-300 pl-8 pr-3 py-1.5 text-xs focus:ring-2 focus:ring-orange-600 outline-none bg-white font-sans"
                                  />
                                </div>

                                <div className="relative">
                                  <select
                                    value={categoryFilter}
                                    onChange={(e) => setCategoryFilter(e.target.value)}
                                    className="w-full appearance-none rounded-lg ring-1 ring-inset ring-neutral-300 px-3 py-1.5 text-xs focus:ring-2 focus:ring-orange-600 outline-none bg-white text-neutral-800 cursor-pointer"
                                  >
                                    <option value="all">Todas as Categorias</option>
                                    {selectedCategories.map((c) => (
                                      <option key={c.id} value={c.name}>{c.name}</option>
                                    ))}
                                  </select>
                                  <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-3 text-neutral-500">
                                    <ChevronDown size={14} />
                                  </div>
                                </div>
                              </div>

                              {/* Active Products List */}
                              <div className="space-y-3 max-h-[600px] overflow-auto pr-1">
                                {loadingActiveMenu && selectedProducts.length === 0 ? (
                                  <div className="text-center py-12 text-neutral-400 text-sm">Carregando catálogo de produtos...</div>
                                ) : selectedProducts.length === 0 ? (
                                  <div className="text-center py-12 text-neutral-400 border border-dashed border-neutral-200 rounded-xl bg-neutral-50/50 space-y-2">
                                    <p className="font-semibold text-sm">Nenhum produto cadastrado</p>
                                    <p className="text-xs text-neutral-400 max-w-sm mx-auto">Adicione produtos manualmente usando o formulário ou importe-os em lote utilizando um arquivo JSON.</p>
                                  </div>
                                ) : (() => {
                                  // filter
                                  const listToShow = selectedProducts.filter((p) => {
                                    const matchSearch = p.name?.toLowerCase().includes(productSearch.toLowerCase()) || p.description?.toLowerCase().includes(productSearch.toLowerCase());
                                    const matchCat = categoryFilter === "all" || p.category === categoryFilter;
                                    return matchSearch && matchCat;
                                  });

                                  if (listToShow.length === 0) {
                                    return <div className="text-center py-12 text-neutral-400 text-sm">Nenhum produto atendeu aos critérios de busca.</div>;
                                  }

                                  return listToShow.map((p) => (
                                    <div key={p.id} className="flex gap-4 p-4 rounded-xl border border-neutral-150 hover:bg-neutral-50/30 transition items-center font-sans">
                                      <img
                                        src={p.imageUrl || "https://images.unsplash.com/photo-1546069901-ba9599a7e63c?q=80&w=300&auto=format&fit=crop"}
                                        alt={p.name}
                                        referrerPolicy="no-referrer"
                                        className="w-12 h-12 rounded-lg object-cover bg-neutral-100 shrink-0"
                                      />

                                      <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2">
                                          <span className="font-semibold text-sm text-neutral-800 truncate">{p.name}</span>
                                          <span className="text-[10px] font-bold bg-neutral-100 text-neutral-600 px-2 py-0.5 rounded-full capitalize shrink-0">{p.category || "Geral"}</span>
                                          {p.isOutOfStock && (
                                            <span className="text-[9px] font-bold bg-red-100 ring-1 ring-red-400/20 text-red-600 px-1.5 py-0.5 rounded shrink-0 leading-none">Indisponível</span>
                                          )}
                                        </div>
                                        <p className="text-xs text-neutral-400 line-clamp-1 mt-0.5 leading-relaxed">{p.description || "Sem descrição cadastrada."}</p>
                                        <span className="text-sm font-bold text-orange-600 block mt-1">R$ {parseFloat(p.price || 0).toFixed(2)}</span>
                                      </div>

                                      <div className="flex items-center gap-1.5 shrink-0">
                                        <button
                                          onClick={() => handleStartEditProductSuper(p)}
                                          className="p-2 text-neutral-400 hover:text-neutral-700 hover:bg-neutral-100 rounded-lg transition"
                                          title="Editar produto"
                                        >
                                          <Edit3 size={16} />
                                        </button>
                                        <button
                                          onClick={() => handleDeleteProductSuper(p.id, p.name)}
                                          className="p-2 text-neutral-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition"
                                          title="Excluir produto"
                                        >
                                          <Trash2 size={16} />
                                        </button>
                                      </div>
                                    </div>
                                  ));
                                })()}
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    ) : (
                      <div className="rounded-2xl border border-dashed border-neutral-300 bg-neutral-50/50 p-12 text-center text-neutral-500 font-medium">
                        Selecione um restaurante no topo para gerenciar suas categorias e itens de cardápio.
                      </div>
                    )}

                    {/* JSON Import Modal */}
                    {showJsonImportModal && (
                      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200 font-sans">
                        <div className="w-full max-w-2xl bg-white rounded-2xl border border-neutral-200 shadow-2xl p-6 sm:p-8 space-y-6 max-h-[90vh] overflow-auto">
                          <div className="flex justify-between items-center pb-4 border-b border-neutral-100">
                            <div>
                              <h3 className="text-lg font-bold text-neutral-900 flex items-center gap-2">
                                <Upload size={20} className="text-orange-600" />
                                Carga de Produtos via JSON
                              </h3>
                              <p className="text-xs text-neutral-400 mt-1">Crie categorias e produtos em escala colando um payload no formulário.</p>
                            </div>
                            <button
                              onClick={() => {
                                setShowJsonImportModal(false);
                                setJsonInput("");
                                setImportStatus({ type: null, message: "" });
                              }}
                              className="text-neutral-400 hover:text-neutral-600 p-1 bg-neutral-50 hover:bg-neutral-100 rounded-lg transition"
                            >
                              <X size={18} />
                            </button>
                          </div>

                          <div className="space-y-4 font-sans">
                            <div className="text-xs text-neutral-500 leading-relaxed bg-neutral-50 p-4 rounded-xl border border-neutral-200">
                              💡 <strong>Estrutura Suportada:</strong> Aceitamos uma lista simples de produtos (array bruto) ou um objeto englobando <code>{"{\"products\": [...]}"}</code>. Chaves opcionais/portuguesas (<code>nome</code>, <code>descricao</code>, <code>preco</code>, <code>categoria</code>) são resolvidas automaticamente. Exemplo prático:
                              <pre className="mt-2 text-[10px] font-mono text-neutral-600 bg-white border border-neutral-150 p-2.5 rounded-lg overflow-x-auto leading-normal">
{`[
  {
    "name": "Super Hamburgão Duo",
    "description": "Double blend 150g, queijo cheddar artesanal",
    "price": 34.90,
    "category": "Hambúrgueres",
    "imageUrl": ""
  },
  {
    "name": "Coca-Cola Lata 350ml",
    "price": 6.50,
    "category": "Bebidas"
  }
]`}
                              </pre>
                            </div>

                            <div className="space-y-3">
                              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                                <label className="text-xs font-semibold text-neutral-600 block">Cole o Payload JSON:</label>
                                <div className="flex flex-wrap items-center gap-1.5">
                                  <span className="text-[10px] text-neutral-400 font-medium mr-1">Carregar Modelo:</span>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setJsonInput(JSON.stringify(PASTELARIA_MENU_TEMPLATE, null, 2));
                                      setImportStatus({ type: "info", message: "Modelo da Pastelaria (29 itens) carregado com sucesso!" });
                                    }}
                                    className="text-[11px] bg-orange-50 hover:bg-orange-100 text-orange-700 font-bold px-2.5 py-1 rounded-lg border border-orange-200 transition"
                                    title="Carregar cardápio completo de Pastelaria"
                                  >
                                    🥟 Pastelaria
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setJsonInput(JSON.stringify(ESPETINHO_MENU_TEMPLATE, null, 2));
                                      setImportStatus({ type: "info", message: "Modelo de Espetinhos carregado com sucesso!" });
                                    }}
                                    className="text-[11px] bg-neutral-100 hover:bg-neutral-200 text-neutral-700 font-bold px-2.5 py-1 rounded-lg border border-neutral-200 transition"
                                    title="Carregar cardápio de Espetaria / Espetinho"
                                  >
                                    🍢 Espetinho
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setJsonInput(JSON.stringify(HAMBURGUERIA_MENU_TEMPLATE, null, 2));
                                      setImportStatus({ type: "info", message: "Modelo de Hamburgueria carregado!" });
                                    }}
                                    className="text-[11px] bg-neutral-100 hover:bg-neutral-200 text-neutral-700 font-bold px-2.5 py-1 rounded-lg border border-neutral-200 transition"
                                  >
                                    🍔 Hamburgueria
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setJsonInput(JSON.stringify(ACAI_MENU_TEMPLATE, null, 2));
                                      setImportStatus({ type: "info", message: "Modelo de Açaí carregado!" });
                                    }}
                                    className="text-[11px] bg-neutral-100 hover:bg-neutral-200 text-neutral-700 font-bold px-2.5 py-1 rounded-lg border border-neutral-200 transition"
                                  >
                                    🍹 Açaí
                                  </button>
                                </div>
                              </div>
                              <textarea
                                rows={8}
                                placeholder="Coloque o conteúdo JSON de teste aqui ou escolha um modelo acima..."
                                value={jsonInput}
                                onChange={(e) => setJsonInput(e.target.value)}
                                className="w-full rounded-xl border border-neutral-300 hover:border-neutral-400 ring-1 ring-inset ring-neutral-200 p-3 text-xs font-mono focus:ring-2 focus:ring-orange-600 outline-none bg-white lg:max-h-[280px]"
                                disabled={importing}
                              />
                            </div>

                            {/* Status notifications bar inside the modal */}
                            {importStatus.type && (
                              <div className={`p-4 rounded-xl border text-xs leading-relaxed flex gap-3 items-start select-none ${
                                importStatus.type === "success" ? "bg-green-50 border-green-200 text-green-800" :
                                importStatus.type === "error" ? "bg-red-50 border-red-200 text-red-800" :
                                "bg-neutral-50 border-neutral-200 text-neutral-800"
                              }`}>
                                <AlertCircle size={16} className="shrink-0 mt-0.5" />
                                <div>
                                  <span className="font-semibold block mb-0.5">{importStatus.type === "success" ? "Sucesso!" : importStatus.type === "error" ? "Falha na Importação:" : "Processando..."}</span>
                                  {importStatus.message}
                                </div>
                              </div>
                            )}

                            {/* Circular/Linear progress loading bar during active bulk load */}
                            {importing && (
                              <div className="space-y-2 select-none">
                                <div className="flex justify-between items-center text-xs text-neutral-600 font-medium">
                                  <span>Injetando dados no Firestore real...</span>
                                  <span>{importProgress.current} de {importProgress.total}</span>
                                </div>
                                <div className="w-full h-2 bg-neutral-150 rounded-full overflow-hidden">
                                  <div 
                                    className="h-full bg-orange-600 rounded-full transition-all duration-300"
                                    style={{ width: `${(importProgress.current / (importProgress.total || 1)) * 100}%` }}
                                  />
                                </div>
                              </div>
                            )}
                          </div>

                          <div className="flex justify-end gap-3 pt-4 border-t border-neutral-100">
                            <button
                              onClick={() => {
                                setShowJsonImportModal(false);
                                setJsonInput("");
                                setImportStatus({ type: null, message: "" });
                              }}
                              className="py-2 px-4 border border-neutral-300 text-neutral-700 hover:bg-neutral-50 text-sm font-semibold rounded-xl transition"
                              disabled={importing}
                            >
                              Fechar
                            </button>
                            <button
                              onClick={handleJsonImportSuper}
                              disabled={importing}
                              className="py-2 px-5 bg-orange-600 hover:bg-orange-700 text-white text-sm font-semibold rounded-xl transition shadow-md shadow-orange-950/25 flex items-center gap-1.5 disabled:opacity-50"
                            >
                              {importing ? (
                                <>
                                  <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent animate-spin rounded-full" />
                                  Importando...
                                </>
                              ) : (
                                "Iniciar Carga"
                              )}
                            </button>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* --- Planos TAB --- */}
                {activeTab === "planos" && (
                  <div className="space-y-6">
                    <div className="flex justify-between items-center flex-wrap gap-4 bg-white rounded-2xl border border-neutral-200 p-6 shadow-sm">
                      <div>
                        <h2 className="text-xl font-bold text-neutral-900 leading-tight">Configurações Base de Planos do Sistema</h2>
                        <p className="text-sm text-neutral-500 mt-1">Configure valores, limitações de produtos e instruções de transação via Pix.</p>
                      </div>
                      <button
                        onClick={async () => {
                          setSavingPlans(true);
                          try {
                            await setDoc(doc(db, "configs", "plans"), plansConfig);
                            alert("Configurações dos planos salvas com sucesso!");
                          } catch (err: any) {
                            console.error("Erro ao salvar planos:", err);
                            alert("Erro ao salvar configurações dos planos: " + err.message);
                          } finally {
                            setSavingPlans(false);
                          }
                        }}
                        disabled={savingPlans}
                        className="flex items-center gap-2 rounded-xl bg-orange-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-orange-700 transition shadow-sm disabled:opacity-50"
                      >
                        {savingPlans ? (
                          <>
                            <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent animate-spin rounded-full" />
                            Salvando...
                          </>
                        ) : (
                          "Salvar Configurações"
                        )}
                      </button>
                    </div>

                    <div className="grid grid-cols-1 max-w-2xl mx-auto gap-8">
                      <div className="rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm space-y-6">
                        <div className="flex justify-between items-center border-b border-neutral-100 pb-4">
                          <h3 className="text-lg font-bold text-neutral-900 flex items-center gap-2">
                            <span className="w-3 h-3 rounded-full bg-orange-500 animate-pulse"></span>
                            {plansConfig.premium.name}
                          </h3>
                          <span className="text-xs font-bold text-orange-700 bg-orange-100 px-3 py-1 rounded-full uppercase">VIP / Completo</span>
                        </div>

                        <div className="space-y-4">
                          <div>
                            <label className="block text-sm font-semibold text-neutral-700 mb-1">Nome do Plano</label>
                            <input
                              type="text"
                              value={plansConfig.premium.name || ""}
                              onChange={(e) => updatePlanFeature("premium", "name", e.target.value)}
                              className="w-full rounded-xl border border-neutral-200 px-4 py-2.5 text-sm focus:border-orange-500 focus:ring-1 focus:ring-orange-500 outline-none text-neutral-900 font-medium bg-neutral-50"
                            />
                          </div>

                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div>
                              <label className="block text-sm font-semibold text-neutral-700 mb-1">Preço Mensal (R$)</label>
                              <input
                                type="number"
                                step="0.01"
                                value={plansConfig.premium.price !== undefined ? plansConfig.premium.price : 59.90}
                                onChange={(e) => updatePlanFeature("premium", "price", parseFloat(e.target.value) || 0)}
                                className="w-full rounded-xl border border-neutral-200 px-4 py-2.5 text-sm focus:border-orange-500 focus:ring-1 focus:ring-orange-500 outline-none text-neutral-900 font-bold text-orange-600 animate-pulse bg-orange-50/20"
                              />
                            </div>
                            <div>
                              <label className="block text-sm font-semibold text-neutral-700 mb-1">Limite Máximo de Produtos</label>
                              <input
                                type="number"
                                value={plansConfig.premium.limitProducts !== undefined ? plansConfig.premium.limitProducts : 999999}
                                onChange={(e) => updatePlanFeature("premium", "limitProducts", parseInt(e.target.value) || 0)}
                                className="w-full rounded-xl border border-neutral-200 px-4 py-2.5 text-sm focus:border-orange-500 focus:ring-1 focus:ring-orange-500 outline-none text-neutral-900 font-medium"
                              />
                            </div>
                          </div>

                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div>
                              <label className="block text-sm font-semibold text-neutral-700 mb-1">Aparência Customizada</label>
                              <select
                                value={plansConfig.premium.customAppearance || "Completo"}
                                onChange={(e) => updatePlanFeature("premium", "customAppearance", e.target.value)}
                                className="w-full rounded-xl border border-neutral-200 px-4 py-2.5 text-sm focus:border-orange-500 focus:ring-1 focus:ring-orange-500 outline-none text-neutral-900 font-medium bg-white"
                              >
                                <option value="Parcial">Parcial (Restrito)</option>
                                <option value="Completo">Completo (Total)</option>
                                <option value="Não Disponível">Não Disponível</option>
                              </select>
                            </div>
                            <div className="flex items-center pt-6">
                              <label className="flex items-center gap-3 cursor-pointer select-none">
                                <input
                                  type="checkbox"
                                  checked={!!plansConfig.premium.hasThemes}
                                  onChange={(e) => updatePlanFeature("premium", "hasThemes", e.target.checked)}
                                  className="rounded border-neutral-300 text-orange-600 focus:ring-orange-600 h-5 w-5"
                                />
                                <span className="text-sm font-semibold text-neutral-700">Permitir Temas Customizados</span>
                              </label>
                            </div>
                          </div>

                          <div>
                            <label className="block text-sm font-semibold text-neutral-700 mb-1">Instruções para Transação com Pix</label>
                            <textarea
                              rows={2}
                              value={plansConfig.premium.pixInstructions || ""}
                              onChange={(e) => updatePlanFeature("premium", "pixInstructions", e.target.value)}
                              placeholder="Efetue o pagamento..."
                              className="w-full rounded-xl border border-neutral-200 px-4 py-2.5 text-sm focus:border-orange-500 focus:ring-1 focus:ring-orange-500 outline-none text-neutral-900 placeholder-neutral-400 font-medium"
                            />
                          </div>

                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div>
                              <label className="block text-sm font-semibold text-neutral-700 mb-1">Chave Copia e Cola Pix / Chave Pix</label>
                              <input
                                type="text"
                                value={plansConfig.premium.pixKey || ""}
                                onChange={(e) => updatePlanFeature("premium", "pixKey", e.target.value)}
                                placeholder="CPF, E-mail ou UUID"
                                className="w-full rounded-xl border border-neutral-200 px-4 py-2.5 text-sm focus:border-orange-500 focus:ring-1 focus:ring-orange-500 outline-none text-neutral-900 font-mono text-xs font-semibold"
                              />
                            </div>
                            <div>
                              <label className="block text-sm font-semibold text-neutral-700 mb-1">Número WhatsApp p/ Envio (DDI+DDD+Num)</label>
                              <input
                                type="text"
                                value={plansConfig.premium.whatsappNumber || ""}
                                onChange={(e) => updatePlanFeature("premium", "whatsappNumber", e.target.value)}
                                placeholder="Apenas números, ex: 5585991276477"
                                className="w-full rounded-xl border border-neutral-200 px-4 py-2.5 text-sm focus:border-orange-500 focus:ring-1 focus:ring-orange-500 outline-none text-neutral-900 font-medium"
                              />
                            </div>
                          </div>

                          <div>
                            <label className="block text-sm font-semibold text-neutral-700 mb-1">Recursos / Características (Separados por vírgula)</label>
                            <textarea
                              rows={3}
                              value={plansConfig.premium.features || ""}
                              onChange={(e) => updatePlanFeature("premium", "features", e.target.value)}
                              placeholder="Ex: Produtos ilimitados, Temas Customizados, Suporte prioritário"
                              className="w-full rounded-xl border border-neutral-200 px-4 py-2.5 text-sm focus:border-orange-500 focus:ring-1 focus:ring-orange-500 outline-none text-neutral-900 placeholder-neutral-400 font-medium"
                            />
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* --- Assinaturas TAB --- */}
                {activeTab === "assinaturas" && (
                  <div className="space-y-6">
                    <div className="flex gap-4 mb-6">
                      <div className="rounded-xl border border-neutral-200 bg-white p-4 flex-1">
                        <p className="text-sm font-medium text-neutral-500">Assinaturas Premium Concedidas</p>
                        <p className="mt-1 text-2xl font-bold text-orange-600">{premiumCount}</p>
                      </div>
                      <div className="rounded-xl border border-neutral-200 bg-white p-4 flex-1">
                        <p className="text-sm font-medium text-neutral-500">Média Faturamento por Loja</p>
                        <p className="mt-1 text-2xl font-bold text-neutral-700">R$ {(plansConfig?.premium?.price ?? 59.90).toFixed(2).replace('.', ',')}</p>
                      </div>
                    </div>

                    <div className="overflow-hidden rounded-xl border border-neutral-200 bg-white shadow-sm">
                      <table className="min-w-full divide-y divide-neutral-200 text-sm text-left">
                        <thead className="bg-neutral-50 text-neutral-500 font-medium text-xs uppercase">
                          <tr>
                            <th className="px-6 py-4">Nome do Restaurante</th>
                            <th className="px-6 py-4">Dono / E-mail</th>
                            <th className="px-6 py-4">Valor Regular</th>
                            <th className="px-6 py-4">Vencimento</th>
                            <th className="px-6 py-4">Desconto</th>
                            <th className="px-6 py-4">Valor Líquido</th>
                            <th className="px-6 py-4">Ações</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-neutral-200">
                          {restaurants.filter(r => r.plan === "Premium").length === 0 ? (
                            <tr>
                              <td colSpan={7} className="px-6 py-8 text-center text-neutral-500">No momento não há nenhum usuário no plano Premium.</td>
                            </tr>
                          ) : (
                            restaurants.filter(r => r.plan === "Premium").map((sub, idx) => {
                              const owner = getOwnerDetails(sub.ownerId);
                              const basePrice = plansConfig?.premium?.price ?? 59.90;
                              const disc = sub.subscriptionDiscount || 0;
                              const finalPrice = Math.max(0, basePrice - disc);
                              return (
                                <tr key={sub.id} className="hover:bg-neutral-50/50 transition">
                                  <td className="px-6 py-4 font-semibold text-neutral-900 capitalize">{sub.name}</td>
                                  <td className="px-6 py-4">
                                    <div className="font-medium text-neutral-800">{owner.name}</div>
                                    <div className="text-xs text-neutral-400">{owner.email}</div>
                                  </td>
                                  <td className="px-6 py-4 text-neutral-600 font-mono text-xs">R$ {basePrice.toFixed(2).replace('.', ',')}</td>
                                  <td className="px-6 py-4 text-neutral-600">
                                    {sub.paymentDay ? `Dia ${sub.paymentDay}` : <span className="text-neutral-400 italic">Não definido</span>}
                                  </td>
                                  <td className="px-6 py-4 text-neutral-600 font-mono text-xs">
                                    {disc > 0 ? `- R$ ${disc.toFixed(2).replace('.', ',')}` : <span className="text-neutral-400 italic">Sem desconto</span>}
                                  </td>
                                  <td className="px-6 py-4 text-green-700 font-bold font-mono text-xs">
                                    R$ {finalPrice.toFixed(2).replace('.', ',')}
                                  </td>
                                  <td className="px-6 py-4 text-right">
                                    <button 
                                      onClick={() => {
                                        setEditingSubscription(sub);
                                        setSubForm({ paymentDay: sub.paymentDay?.toString() || '', discount: sub.subscriptionDiscount?.toString() || '' });
                                      }}
                                      className="text-orange-600 hover:text-orange-700 font-semibold text-xs border border-orange-200 bg-orange-50 hover:bg-orange-100 rounded-lg px-3 py-1.5 transition"
                                    >
                                      Editar Fatura
                                    </button>
                                  </td>
                                </tr>
                              );
                            })
                          )}
                        </tbody>
                      </table>
                    </div>

                    {/* Moderation Section for receipts */}
                    <div className="rounded-xl border border-neutral-200 bg-white p-6 shadow-sm space-y-4">
                      <div className="flex justify-between items-center pb-2 border-b border-neutral-100">
                        <h4 className="text-sm font-extrabold text-neutral-900 uppercase tracking-wider flex items-center gap-2">
                          <FileText size={18} className="text-orange-500" />
                          Moderação de Pagamentos e Comprovantes Recebidos
                        </h4>
                        <span className="text-[10px] uppercase font-bold text-neutral-400 bg-neutral-100 px-2 py-0.5 rounded-lg font-mono">
                          {payments.length} faturas/avisos
                        </span>
                      </div>

                      {payments.length === 0 ? (
                        <div className="text-center py-12 text-neutral-500 space-y-2">
                          <ClipboardList className="w-10 h-10 text-neutral-300 mx-auto" />
                          <p className="text-sm font-semibold">Nenhum aviso ou histórico registrado no banco de dados.</p>
                          <p className="text-xs text-neutral-400">À medida que os proprietários de lojas informarem os pagamentos de mensalidade, eles constarão nesta fila para compensação manual.</p>
                        </div>
                      ) : (
                        <div className="overflow-x-auto">
                          <table className="min-w-full divide-y divide-neutral-200 text-sm text-left">
                            <thead className="bg-neutral-50 text-neutral-500 font-medium text-xs uppercase">
                              <tr>
                                <th className="px-6 py-3">Restaurante / ID</th>
                                <th className="px-6 py-3">Descrição da Fatura</th>
                                <th className="px-6 py-3">Valor</th>
                                <th className="px-6 py-3">Data Envio</th>
                                <th className="px-6 py-3">Método</th>
                                <th className="px-6 py-3">Status</th>
                                <th className="px-6 py-3 text-right">Ações</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-neutral-100">
                              {payments.map((p) => {
                                const payDate = p.createdAt ? new Date(p.createdAt).toLocaleDateString('pt-BR') : '-';
                                return (
                                  <tr key={p.id} className="hover:bg-neutral-50/50 transition">
                                    <td className="px-6 py-4">
                                      <div className="font-semibold text-neutral-900 capitalize">{p.restaurantName || "Estabelecimento"}</div>
                                      <div className="text-[10px] text-neutral-400 font-mono truncate max-w-xs">{p.restaurantId}</div>
                                    </td>
                                    <td className="px-6 py-4 font-medium text-neutral-600">{p.reference || "Mensalidade"}</td>
                                    <td className="px-6 py-4 font-mono font-bold text-neutral-900">R$ {Number(p.amount || 0).toFixed(2).replace('.', ',')}</td>
                                    <td className="px-6 py-4 text-neutral-500 text-xs">{payDate}</td>
                                    <td className="px-6 py-4 text-neutral-500 text-xs">{p.method || "Pix"}</td>
                                    <td className="px-6 py-4">
                                      <span className={`inline-block px-2.5 py-1 text-[10px] font-bold rounded-lg uppercase tracking-wide ${
                                        p.status === "Pago" ? "bg-green-100 text-green-800" :
                                        p.status === "Pendente" ? "bg-orange-100 text-orange-800 animate-pulse" :
                                        "bg-red-100 text-red-800"
                                      }`}>
                                        {p.status || "Pendente"}
                                      </span>
                                    </td>
                                    <td className="px-6 py-4 text-right space-x-2 whitespace-nowrap opacity-100">
                                      {p.status === "Pendente" ? (
                                        <div className="flex gap-2 justify-end">
                                          <button
                                            onClick={() => handleApprovePayment(p.id)}
                                            className="px-2.5 py-1 text-[10px] font-bold text-white bg-green-600 hover:bg-green-700 rounded-lg transition shadow-sm"
                                          >
                                            Confirmar / Baixar
                                          </button>
                                          <button
                                            onClick={() => handleCancelPayment(p.id)}
                                            className="px-2.5 py-1 text-[10px] font-bold text-white bg-red-600 hover:bg-red-700 rounded-lg transition"
                                          >
                                            Rejeitar
                                          </button>
                                        </div>
                                      ) : (
                                        <button
                                          onClick={() => handleDeletePayment(p.id)}
                                          className="text-neutral-400 hover:text-red-650 px-2.5 py-1.5 transition ml-auto block"
                                          title="Excluir do Histórico"
                                        >
                                          <Trash2 size={15} />
                                        </button>
                                      )}
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
                )}

                {/* --- Financeiro TAB --- */}
                {activeTab === "financeiro" && (
                  <div className="space-y-6">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                      <div className="rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm">
                        <p className="text-sm font-medium text-neutral-500">Receita Recorrente Mensal (MRR)</p>
                        <p className="mt-2 text-3xl font-bold text-neutral-900">R$ {estimatedRevenue.toFixed(2).replace('.', ',')}</p>
                        <p className="mt-1 text-sm text-green-600 font-medium">Baseado em {premiumCount} assinantes Premium</p>
                      </div>
                      <div className="rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm">
                        <p className="text-sm font-medium text-neutral-500">Total de Estabelecimentos Atendidos</p>
                        <p className="mt-2 text-3xl font-bold text-neutral-900">{restaurants.length} Lojas</p>
                        <p className="mt-1 text-sm text-neutral-500 font-medium">Sincronizado via Firebase real</p>
                      </div>
                    </div>

                    <div className="rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm py-12 text-center text-neutral-600 space-y-4">
                      <TrendingUp className="w-12 h-12 text-orange-500 mx-auto" />
                      <h3 className="text-lg font-bold text-neutral-900">Painel Financeiro Consolidado</h3>
                      <p className="text-sm text-neutral-500 max-w-lg mx-auto">
                        O faturamento atualizado reflete a soma do valor líquido pago pelos {premiumCount} estabelecimentos Premium, deduzindo os eventuais descontos mensais aplicados de forma individual. À medida que novas lojas atualizarem suas assinaturas, os balanços serão sincronizados no mesmo instante.
                      </p>
                    </div>
                  </div>
                )}

                {/* --- Molduras TAB --- */}
                {activeTab === "molduras" && (
                  <div className="space-y-6">
                    <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white p-6 rounded-2xl border border-neutral-200 shadow-sm animate-in fade-in duration-200">
                      <div>
                        <h3 className="text-xl font-black text-neutral-900">Gerenciador de Molduras</h3>
                        <p className="text-xs text-neutral-500 mt-1">
                          Adicione e configure molduras decorativas para as fotos de perfil de todos os restaurantes. Elas serão aplicadas automaticamente de acordo com as datas ativas.
                        </p>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                      {/* Form Card */}
                      <div className="lg:col-span-1 rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm self-start space-y-6">
                        <h4 className="text-base font-bold text-neutral-900 border-b border-neutral-100 pb-3 flex items-center gap-2">
                          <Palette size={18} className="text-orange-500" />
                          {editingFrameId ? "Editar Moldura" : "Nova Moldura"}
                        </h4>

                        <div className="space-y-4">
                          <div>
                            <label className="block text-xs font-bold text-neutral-700 uppercase tracking-wider mb-1.5">Nome da Moldura</label>
                            <input
                              type="text"
                              value={frameForm.name}
                              onChange={e => setFrameForm(prev => ({ ...prev, name: e.target.value }))}
                              placeholder="Ex: Natalino, Festa Junina, etc."
                              className="w-full rounded-xl border border-neutral-200 px-4 py-2.5 text-sm focus:border-orange-500 focus:ring-1 focus:ring-orange-500 outline-none text-neutral-900 font-medium"
                            />
                          </div>

                          <div>
                            <label className="block text-xs font-bold text-neutral-700 uppercase tracking-wider mb-1.5">URL da Moldura (PNG Transparente)</label>
                            <div className="flex gap-2">
                              <input
                                type="text"
                                value={frameForm.imageUrl}
                                onChange={e => setFrameForm(prev => ({ ...prev, imageUrl: e.target.value }))}
                                placeholder="https://i.imgur.com/z1Qwfef.png"
                                className="flex-1 rounded-xl border border-neutral-200 px-4 py-2.5 text-sm focus:border-orange-500 focus:ring-1 focus:ring-orange-500 outline-none text-neutral-900 font-mono text-xs"
                                referrerPolicy="no-referrer"
                              />
                              <label className="px-3 py-2 bg-neutral-100 hover:bg-neutral-200 text-neutral-700 text-xs font-bold rounded-xl cursor-pointer transition border border-neutral-200 flex items-center justify-center shrink-0">
                                {isUploadingFrame ? "Enviando..." : "Upload..."}
                                <input
                                  type="file"
                                  accept="image/png"
                                  className="hidden"
                                  disabled={isUploadingFrame}
                                  onChange={(e) => {
                                    if (e.target.files && e.target.files[0]) {
                                      handleFrameImageUpload(e.target.files[0]);
                                    }
                                  }}
                                />
                              </label>
                            </div>
                            {frameUploadError && <p className="text-xs text-red-500 mt-1 font-semibold">{frameUploadError}</p>}
                            <p className="text-[10px] text-neutral-400 mt-1">Recomendamos usar imagens em proporção 1:1 e com transparência (PNG).</p>
                          </div>

                          <div className="border-t border-neutral-100 pt-4">
                            <h5 className="text-xs font-black text-neutral-800 uppercase tracking-wider mb-3">Condições de Exibição</h5>
                            
                            {/* Commemorative Date Dropdown */}
                            <div className="mb-4">
                              <label className="block text-xs font-semibold text-neutral-500 mb-1.5">Data Comemorativa Fixa (Opcional)</label>
                              <select
                                value={frameForm.commemorativeType}
                                onChange={e => setFrameForm(prev => ({ ...prev, commemorativeType: e.target.value }))}
                                className="w-full rounded-xl border border-neutral-200 px-3 py-2.5 text-sm focus:border-orange-500 focus:ring-1 focus:ring-orange-500 outline-none text-neutral-800 font-medium"
                              >
                                <option value="">Nenhuma (Ficar sem moldura a menos que combine as datas)</option>
                                <option value="christmas">Natal (15/12 a 26/12)</option>
                                <option value="newyear">Ano Novo (27/12 a 05/01)</option>
                                <option value="halloween">Halloween (25/10 a 31/10)</option>
                                <option value="valentines">Dia dos Namorados (12/06)</option>
                                <option value="junina">Festa Junina (Todo mês de Junho)</option>
                                <option value="easter">Páscoa (01/04 a 20/04)</option>
                                <option value="mothers">Dia das Mães (Maio)</option>
                                <option value="fathers">Dia dos Pais (Agosto)</option>
                              </select>
                            </div>

                            {/* Specific Dates (Multiple Days) */}
                            <div className="space-y-3">
                              <label className="block text-xs font-semibold text-neutral-500">Datas Específicas (+ de 1 data)</label>
                              
                              <div className="flex gap-2">
                                <input
                                  type="date"
                                  value={newSpecificDate}
                                  onChange={e => setNewSpecificDate(e.target.value)}
                                  className="flex-1 rounded-xl border border-neutral-200 px-3 py-2 text-sm focus:border-orange-500 focus:ring-1 focus:ring-orange-500 outline-none text-neutral-800"
                                />
                                <button
                                  type="button"
                                  onClick={handleAddFrameSpecificDate}
                                  className="px-4 py-2 bg-neutral-900 hover:bg-neutral-800 text-white rounded-xl text-xs font-bold transition flex items-center justify-center gap-1 shrink-0"
                                >
                                  <Plus size={14} />
                                  Add
                                </button>
                              </div>

                              {/* Multi-dates listing */}
                              {frameForm.specificDates.length > 0 ? (
                                <div className="flex flex-wrap gap-1.5 p-3 rounded-xl bg-neutral-50 border border-neutral-200/60 max-h-32 overflow-y-auto">
                                  {frameForm.specificDates.map((d: string) => {
                                    const parts = d.split("-");
                                    const formattedDate = parts.length === 3 ? `${parts[2]}/${parts[1]}/${parts[0]}` : d;
                                    return (
                                      <span key={d} className="inline-flex items-center gap-1 bg-white border border-neutral-200 text-neutral-700 text-[11px] font-bold px-2 py-0.5 rounded-lg shadow-sm">
                                        <span>{formattedDate}</span>
                                        <button
                                          type="button"
                                          onClick={() => handleRemoveFrameSpecificDate(d)}
                                          className="text-red-500 hover:text-red-700 p-0.5"
                                        >
                                          <X size={10} />
                                        </button>
                                      </span>
                                    );
                                  })}
                                </div>
                              ) : (
                                <p className="text-[11px] text-neutral-400 italic">Nenhuma data específica adicionada.</p>
                              )}
                            </div>
                          </div>
                        </div>

                        {/* Preview section */}
                        {frameForm.imageUrl && (
                          <div className="border-t border-neutral-100 pt-4 flex flex-col items-center">
                            <span className="text-xs font-bold text-neutral-500 mb-2">Visualização da Moldura</span>
                            <div className="relative w-24 h-24 flex items-center justify-center rounded-full bg-neutral-50 overflow-hidden border border-neutral-200">
                              <span className="text-[10px] text-neutral-400 font-bold z-0 font-sans font-medium">LOGO (MEIO)</span>
                              <img
                                src={frameForm.imageUrl}
                                alt="Frame Preview"
                                className="absolute inset-0 w-full h-full object-contain pointer-events-none z-10"
                                referrerPolicy="no-referrer"
                                onError={(e) => {
                                  (e.target as any).src = "https://placehold.co/100/png?text=Erro+Imagem";
                                }}
                              />
                            </div>
                          </div>
                        )}

                        <div className="flex gap-2 border-t border-neutral-100 pt-4">
                          {editingFrameId && (
                            <button
                              type="button"
                              onClick={() => {
                                setEditingFrameId(null);
                                setFrameForm({
                                  name: "",
                                  imageUrl: "",
                                  commemorativeType: "",
                                  specificDates: []
                                });
                                setNewSpecificDate("");
                              }}
                              className="flex-1 py-2.5 border border-neutral-250 text-neutral-500 hover:bg-neutral-50 rounded-xl text-xs font-bold transition"
                            >
                              Cancelar
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={handleSaveFrame}
                            className="flex-1 py-3 bg-orange-600 hover:bg-orange-700 text-white rounded-xl text-xs font-black transition shadow-sm animate-in fade-in duration-100"
                          >
                            {editingFrameId ? "Atualizar" : "Salvar Moldura"}
                          </button>
                        </div>
                      </div>

                      {/* Display / List Grid Card */}
                      <div className="lg:col-span-2 rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm self-start space-y-6">
                        <h4 className="text-base font-bold text-neutral-900 border-b border-neutral-100 pb-3">
                          Molduras Cadastradas ({frames.length})
                        </h4>

                        {frames.length === 0 ? (
                          <div className="text-center py-12 text-neutral-400 text-sm">
                            Nenhuma moldura cadastrada até o momento. Cadastre-a acima e configure suas datas estruturais.
                          </div>
                        ) : (
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {frames.map((frame: any) => {
                              return (
                                <div key={frame.id} className="border border-neutral-200 p-4 rounded-xl hover:shadow-md transition bg-white flex items-center gap-4">
                                  {/* Frame image box */}
                                  <div className="relative w-16 h-16 shrink-0 flex items-center justify-center bg-neutral-150 border border-neutral-200 rounded-xl overflow-hidden shadow-sm">
                                    <span className="text-[8px] text-neutral-300 font-bold z-0 font-medium">LOGO</span>
                                    <img 
                                      src={frame.imageUrl} 
                                      alt={frame.name} 
                                      className="absolute inset-0 w-full h-full object-contain pointer-events-none z-10"
                                      referrerPolicy="no-referrer"
                                    />
                                  </div>

                                  {/* Info and action buttons */}
                                  <div className="flex-1 min-w-0">
                                    <h5 className="font-bold text-neutral-950 truncate capitalize text-sm">{frame.name}</h5>
                                    
                                    <div className="mt-1 text-xs text-neutral-500 space-y-1">
                                      {frame.commemorativeType ? (
                                        <div className="flex items-center gap-1 text-[11px] font-semibold text-neutral-850">
                                          <span className="w-1.5 h-1.5 bg-green-500 rounded-full inline-block"></span>
                                          Data: <span className="capitalize">{
                                            frame.commemorativeType === "christmas" ? "Natal (15/12 a 26/12)" :
                                            frame.commemorativeType === "newyear" ? "Ano Novo (27/12 a 05/01)" :
                                            frame.commemorativeType === "halloween" ? "Halloween (25/10 a 31/10)" :
                                            frame.commemorativeType === "valentines" ? "Dia dos Namorados (12/06)" :
                                            frame.commemorativeType === "junina" ? "Festa Junina (Mês de Junho)" :
                                            frame.commemorativeType === "easter" ? "Páscoa (01/04 a 20/04)" :
                                            frame.commemorativeType === "mothers" ? "Dia das Mães (Maio)" :
                                            frame.commemorativeType === "fathers" ? "Dia dos Pais (Agosto)" : frame.commemorativeType
                                          }</span>
                                        </div>
                                      ) : null}

                                      {Array.isArray(frame.specificDates) && frame.specificDates.length > 0 ? (
                                        <div className="flex items-center gap-1 text-[11px] font-semibold text-neutral-855 flex-wrap">
                                          <span className="w-1.5 h-1.5 bg-orange-500 rounded-full inline-block"></span>
                                          Datas específicas (+ de {frame.specificDates.length === 1 ? '1 data' : frame.specificDates.length + ' datas'}):
                                          <span className="text-[10px] text-neutral-500 font-mono">
                                            {frame.specificDates.slice(0, 3).map((d: string) => {
                                              const parts = d.split("-");
                                              return parts.length === 3 ? `${parts[2]}/${parts[1]}` : d;
                                            }).join(", ")}{frame.specificDates.length > 3 ? "..." : ""}
                                          </span>
                                        </div>
                                      ) : null}

                                      {!frame.commemorativeType && (!Array.isArray(frame.specificDates) || frame.specificDates.length === 0) ? (
                                        <div className="flex items-center gap-1 text-[11px] text-neutral-400 italic font-medium">
                                          <span className="w-1.5 h-1.5 bg-neutral-300 rounded-full inline-block font-sans"></span>
                                          Sem datas (Fica ocultada)
                                        </div>
                                      ) : null}
                                    </div>

                                    {/* Action buttons */}
                                    <div className="flex items-center gap-2 mt-3">
                                      <button
                                        type="button"
                                        onClick={() => handleStartEditFrame(frame)}
                                        className="text-xs font-bold text-neutral-700 hover:text-orange-600 hover:bg-neutral-50 px-2 py-1 rounded border border-neutral-200 transition"
                                      >
                                        Editar
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => handleDeleteFrame(frame.id, frame.name)}
                                        className="text-xs font-bold text-red-500 hover:text-red-700 hover:bg-red-50 px-2 py-1 rounded border border-red-100 transition"
                                      >
                                        Excluir
                                      </button>
                                    </div>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )}
                {/* --- Avisos Globais TAB --- */}
                {activeTab === "avisos" && (
                  <div className="space-y-6">
                    <div className="bg-white rounded-2xl border border-neutral-200 p-6 shadow-sm">
                      <div className="flex items-center gap-3 mb-6 border-b border-neutral-100 pb-4">
                        <div className="p-3 bg-blue-50 text-blue-600 rounded-full">
                          <Megaphone size={24} />
                        </div>
                        <div>
                          <h2 className="text-xl font-black text-neutral-900 tracking-tight">Aviso Global Admin</h2>
                          <p className="text-sm text-neutral-500 font-medium">Configure um aviso para aparecer no painel (/admin) de todos os estabelecimentos.</p>
                        </div>
                      </div>

                      <div className="space-y-5">
                        <label className="flex items-center justify-between p-4 bg-neutral-50 rounded-xl border border-neutral-200 cursor-pointer hover:bg-neutral-100 transition">
                          <div>
                            <span className="block text-sm font-bold text-neutral-800">Ativar Aviso Global</span>
                            <span className="block text-xs text-neutral-500 font-medium">Se ativo, o aviso será exibido para as lojas.</span>
                          </div>
                          <div className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${adminAnnouncement.isActive ? 'bg-orange-500' : 'bg-neutral-300'}`}>
                            <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${adminAnnouncement.isActive ? 'translate-x-6' : 'translate-x-1'}`} />
                          </div>
                          <input 
                            type="checkbox" 
                            className="hidden" 
                            checked={adminAnnouncement.isActive} 
                            onChange={(e) => setAdminAnnouncement(prev => ({ ...prev, isActive: e.target.checked }))} 
                          />
                        </label>

                        <div>
                          <label className="block text-xs font-black text-neutral-700 uppercase tracking-wider mb-2">
                            Título do Aviso
                          </label>
                          <input
                            type="text"
                            placeholder="Ex: Nova Funcionalidade!"
                            className="w-full rounded-2xl border border-neutral-200 px-4 py-3 text-sm focus:border-orange-500 focus:ring-1 focus:ring-orange-500 outline-none text-neutral-900 font-medium"
                            value={adminAnnouncement.title}
                            onChange={(e) => setAdminAnnouncement(prev => ({ ...prev, title: e.target.value }))}
                          />
                        </div>

                        <div>
                          <label className="block text-xs font-black text-neutral-700 uppercase tracking-wider mb-2">
                            Mensagem
                          </label>
                          <textarea
                            placeholder="Descreva o aviso aqui..."
                            rows={4}
                            className="w-full rounded-2xl border border-neutral-200 px-4 py-3 text-sm focus:border-orange-500 focus:ring-1 focus:ring-orange-500 outline-none text-neutral-900 font-medium whitespace-pre-wrap"
                            value={adminAnnouncement.message}
                            onChange={(e) => setAdminAnnouncement(prev => ({ ...prev, message: e.target.value }))}
                          />
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                          <div>
                            <label className="block text-xs font-black text-neutral-700 uppercase tracking-wider mb-2">
                              Tema (Cor)
                            </label>
                            <select
                              className="w-full rounded-2xl border border-neutral-200 px-4 py-3 text-sm focus:border-orange-500 focus:ring-1 focus:ring-orange-500 outline-none text-neutral-900 font-medium bg-white"
                              value={adminAnnouncement.theme || 'blue'}
                              onChange={(e) => setAdminAnnouncement((prev: any) => ({ ...prev, theme: e.target.value }))}
                            >
                              <option value="blue">Azul (Informação)</option>
                              <option value="green">Verde (Sucesso/Novidade)</option>
                              <option value="orange">Laranja (Atenção)</option>
                              <option value="red">Vermelho (Urgente)</option>
                            </select>
                          </div>
                          <div>
                            <label className="block text-xs font-black text-neutral-700 uppercase tracking-wider mb-2">
                              Ícone
                            </label>
                            <select
                              className="w-full rounded-2xl border border-neutral-200 px-4 py-3 text-sm focus:border-orange-500 focus:ring-1 focus:ring-orange-500 outline-none text-neutral-900 font-medium bg-white"
                              value={adminAnnouncement.icon || 'megaphone'}
                              onChange={(e) => setAdminAnnouncement((prev: any) => ({ ...prev, icon: e.target.value }))}
                            >
                              <option value="megaphone">Megafone (Anúncio)</option>
                              <option value="alert">Alerta (Urgente)</option>
                              <option value="check">Check (Sucesso)</option>
                              <option value="star">Estrela (Novidade)</option>
                            </select>
                          </div>
                        </div>

                        <div>
                          <label className="block text-xs font-black text-neutral-700 uppercase tracking-wider mb-2">
                            Público-Alvo
                          </label>
                          <select
                            className="w-full rounded-2xl border border-neutral-200 px-4 py-3 text-sm focus:border-orange-500 focus:ring-1 focus:ring-orange-500 outline-none text-neutral-900 font-medium bg-white"
                            value={adminAnnouncement.targetAudience || 'all'}
                            onChange={(e) => setAdminAnnouncement((prev: any) => ({ ...prev, targetAudience: e.target.value }))}
                          >
                            <option value="all">Todas as Contas</option>
                            <option value="free">Apenas Plano Gratuito</option>
                            <option value="premium">Apenas Plano Premium</option>
                          </select>
                        </div>

                        <div className="pt-4 border-t border-neutral-100">
                          <label className="flex items-center justify-between p-4 bg-neutral-50 rounded-xl border border-neutral-200 cursor-pointer hover:bg-neutral-100 transition">
                            <div>
                              <span className="block text-sm font-bold text-neutral-800">Botão de Ação (CTA)</span>
                              <span className="block text-xs text-neutral-500 font-medium">Adicionar um botão de link ao aviso.</span>
                            </div>
                            <div className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${adminAnnouncement.showCta ? 'bg-orange-500' : 'bg-neutral-300'}`}>
                              <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${adminAnnouncement.showCta ? 'translate-x-6' : 'translate-x-1'}`} />
                            </div>
                            <input 
                              type="checkbox" 
                              className="hidden" 
                              checked={adminAnnouncement.showCta || false} 
                              onChange={(e) => setAdminAnnouncement((prev: any) => ({ ...prev, showCta: e.target.checked }))} 
                            />
                          </label>
                        </div>

                        {adminAnnouncement.showCta && (
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-5 pl-4 ml-4 border-l-2 border-orange-200">
                            <div>
                              <label className="block text-xs font-black text-neutral-700 uppercase tracking-wider mb-2">
                                Texto do Botão
                              </label>
                              <input
                                type="text"
                                placeholder="Ex: Fazer Upgrade"
                                className="w-full rounded-2xl border border-neutral-200 px-4 py-3 text-sm focus:border-orange-500 focus:ring-1 focus:ring-orange-500 outline-none text-neutral-900 font-medium"
                                value={adminAnnouncement.ctaText || ''}
                                onChange={(e) => setAdminAnnouncement((prev: any) => ({ ...prev, ctaText: e.target.value }))}
                              />
                            </div>
                            <div>
                              <label className="block text-xs font-black text-neutral-700 uppercase tracking-wider mb-2">
                                Link de Destino
                              </label>
                              <input
                                type="text"
                                placeholder="https://..."
                                className="w-full rounded-2xl border border-neutral-200 px-4 py-3 text-sm focus:border-orange-500 focus:ring-1 focus:ring-orange-500 outline-none text-neutral-900 font-medium"
                                value={adminAnnouncement.ctaLink || ''}
                                onChange={(e) => setAdminAnnouncement((prev: any) => ({ ...prev, ctaLink: e.target.value }))}
                              />
                            </div>
                          </div>
                        )}

                        <div className="pt-2">
                          <label className="flex items-center justify-between p-4 bg-neutral-50 rounded-xl border border-neutral-200 cursor-pointer hover:bg-neutral-100 transition">
                            <div>
                              <span className="block text-sm font-bold text-neutral-800">Permitir Dispensar</span>
                              <span className="block text-xs text-neutral-500 font-medium">Permitir que as lojas fechem o aviso.</span>
                            </div>
                            <div className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${adminAnnouncement.allowDismiss !== false ? 'bg-orange-500' : 'bg-neutral-300'}`}>
                              <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${adminAnnouncement.allowDismiss !== false ? 'translate-x-6' : 'translate-x-1'}`} />
                            </div>
                            <input 
                              type="checkbox" 
                              className="hidden" 
                              checked={adminAnnouncement.allowDismiss !== false} 
                              onChange={(e) => setAdminAnnouncement((prev: any) => ({ ...prev, allowDismiss: e.target.checked }))} 
                            />
                          </label>
                        </div>
                      </div>

                      <div className="mt-8 flex justify-end">
                        <button
                          onClick={handleSaveAnnouncement}
                          disabled={savingAnnouncement}
                          className="px-6 py-3 text-sm font-extrabold text-white bg-orange-600 hover:bg-orange-700 active:scale-[0.98] rounded-2xl transition duration-150 shadow-md shadow-orange-600/20 disabled:opacity-50"
                        >
                          {savingAnnouncement ? "Salvando..." : "Salvar Aviso Global"}
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                {activeTab === "logs" && (
                  <div className="space-y-6">
                    <div className="bg-white rounded-2xl border border-neutral-200 p-6 shadow-sm">
                      <div className="flex items-center gap-3 mb-6 border-b border-neutral-100 pb-4 justify-between flex-wrap">
                        <div className="flex items-center gap-3">
                          <div className="p-3 bg-indigo-50 text-indigo-600 rounded-full">
                            <Activity size={24} />
                          </div>
                          <div>
                            <h2 className="text-xl font-black text-neutral-900 tracking-tight">Logs de Atividade</h2>
                            <p className="text-sm text-neutral-500 font-medium">Histórico e auditoria em tempo real de todas as ações executadas pelos super-administradores do sistema.</p>
                          </div>
                        </div>
                        <div className="bg-neutral-100 px-3 py-1.5 rounded-xl font-mono text-xs text-neutral-600 font-bold border border-neutral-200">
                          Total: {logs.length} registros
                        </div>
                      </div>

                      {/* Filters */}
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                        <div className="relative col-span-2">
                          <Search className="absolute left-4 top-3.5 h-4 w-4 text-neutral-400" />
                          <input
                            type="text"
                            placeholder="Buscar logs por ação, detalhes ou email..."
                            className="w-full pl-11 pr-4 py-2.5 text-sm rounded-2xl border border-neutral-200 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none text-neutral-900 font-medium bg-neutral-50 hover:bg-neutral-100/50 focus:bg-white transition"
                            value={logSearch}
                            onChange={(e) => setLogSearch(e.target.value)}
                          />
                        </div>
                        <div>
                          <select
                            className="w-full rounded-2xl border border-neutral-200 px-4 py-2.5 text-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none text-neutral-900 font-medium bg-neutral-50 pointer-events-auto transition cursor-pointer"
                            value={logSectorFilter}
                            onChange={(e) => setLogSectorFilter(e.target.value)}
                          >
                            <option value="all">Todos os Setores</option>
                            <option value="Clientes">Clientes / Lojas</option>
                            <option value="Assinaturas">Assinaturas</option>
                            <option value="Cardápios">Cardápios / Catálogos</option>
                            <option value="Financeiro">Financeiro / Faturamento</option>
                            <option value="Molduras">Molduras Personalizadas</option>
                            <option value="Avisos Globais">Avisos Globais</option>
                            <option value="Controle de Funções">Controle de Funções</option>
                          </select>
                        </div>
                      </div>

                      {(() => {
                        const filteredLogs = logs.filter(item => {
                          const matchesSector = logSectorFilter === "all" || item.sector === logSectorFilter;
                          const matchesSearch = !logSearch.trim() || 
                            item.action?.toLowerCase().includes(logSearch.toLowerCase()) || 
                            item.details?.toLowerCase().includes(logSearch.toLowerCase()) || 
                            item.adminEmail?.toLowerCase().includes(logSearch.toLowerCase());
                          return matchesSector && matchesSearch;
                        });

                        const getSectorMetadataLocal = (sectorStr: string) => {
                          switch (sectorStr) {
                            case "Clientes":
                              return { icon: UsersIcon, color: "bg-blue-50 text-blue-700 border-blue-100", iconStyle: "bg-blue-100 text-blue-600" };
                            case "Assinaturas":
                              return { icon: CreditCard, color: "bg-purple-50 text-purple-700 border-purple-100", iconStyle: "bg-purple-100 text-purple-600" };
                            case "Cardápios":
                              return { icon: ClipboardList, color: "bg-emerald-50 text-emerald-700 border-emerald-100", iconStyle: "bg-emerald-100 text-emerald-600" };
                            case "Financeiro":
                              return { icon: DollarSign, color: "bg-amber-50 text-amber-700 border-amber-100", iconStyle: "bg-amber-100 text-amber-600" };
                            case "Molduras":
                              return { icon: Palette, color: "bg-pink-50 text-pink-700 border-pink-100", iconStyle: "bg-pink-100 text-pink-600" };
                            case "Avisos Globais":
                              return { icon: Megaphone, color: "bg-orange-50 text-orange-700 border-orange-100", iconStyle: "bg-orange-100 text-orange-600" };
                            case "Controle de Funções":
                              return { icon: ToggleLeft, color: "bg-indigo-50 text-indigo-700 border-indigo-100", iconStyle: "bg-indigo-100 text-indigo-600" };
                            default:
                              return { icon: FileText, color: "bg-neutral-50 text-neutral-700 border-neutral-100", iconStyle: "bg-neutral-100 text-neutral-600" };
                          }
                        };

                        if (filteredLogs.length === 0) {
                          return (
                            <div className="text-center py-16 border rounded-2xl border-dashed border-neutral-200 bg-neutral-50/50 space-y-4">
                              <div className="p-3 bg-neutral-100 text-neutral-400 rounded-full w-12 h-12 mx-auto flex items-center justify-center">
                                <Activity size={24} />
                              </div>
                              <div className="space-y-1">
                                <p className="text-sm font-bold text-neutral-700">Nenhum registro encontrado</p>
                                <p className="text-xs text-neutral-400 max-w-md mx-auto">Nenhuma ação recente corresponde aos filtros informados. Tente alterar sua busca ou selecionar outro setor de fiscalização.</p>
                              </div>
                              {(logSearch || logSectorFilter !== "all") && (
                                <button
                                  onClick={() => { setLogSearch(""); setLogSectorFilter("all"); }}
                                  className="text-xs font-bold text-indigo-600 hover:text-indigo-800 underline transition"
                                >
                                  Limpar filtros de busca
                                </button>
                              )}
                            </div>
                          );
                        }

                        return (
                          <div className="overflow-hidden border border-neutral-200 rounded-2xl">
                            <div className="overflow-x-auto">
                              <table className="min-w-full divide-y divide-neutral-200 text-left text-sm">
                                <thead className="bg-neutral-50 text-neutral-500 font-bold text-xs uppercase tracking-wider">
                                  <tr>
                                    <th className="px-6 py-4">Data / hora</th>
                                    <th className="px-6 py-4">Setor</th>
                                    <th className="px-6 py-4">Ação executada</th>
                                    <th className="px-6 py-4">Descrição detalhada</th>
                                    <th className="px-6 py-4">Responsável</th>
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-neutral-100 bg-white">
                                  {filteredLogs.map((item) => {
                                    const meta = getSectorMetadataLocal(item.sector);
                                    const IconComponent = meta.icon;
                                    const itemDate = item.createdAt ? new Date(item.createdAt).toLocaleString('pt-BR') : '-';

                                    return (
                                      <tr key={item.id} className="hover:bg-neutral-50/40 transition">
                                        <td className="px-6 py-4 whitespace-nowrap text-xs text-neutral-500 font-mono">
                                          {itemDate}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                          <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold border ${meta.color}`}>
                                            <IconComponent size={12} />
                                            {item.sector || "Geral"}
                                          </span>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap font-bold text-neutral-800">
                                          {item.action || "Ação desconhecida"}
                                        </td>
                                        <td className="px-6 py-4 text-neutral-600 max-w-sm break-words font-medium text-xs leading-relaxed">
                                          {item.details}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                          <div className="text-xs font-bold text-neutral-700">{item.adminEmail || 'admin'}</div>
                                          <div className="text-[9px] text-neutral-400 font-mono truncate max-w-[120px]" title={item.adminId}>
                                            ID: {item.adminId || 'master'}
                                          </div>
                                        </td>
                                      </tr>
                                    );
                                  })}
                                </tbody>
                              </table>
                            </div>
                          </div>
                        );
                      })()}

                    </div>
                  </div>
                )}
              </>
            )}

          </div>
        </div>
      </main>

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

      {/* Edit Subscription Modal */}
      {editingSubscription && (
        <div className="fixed inset-0 z-[100000] flex items-center justify-center p-4 bg-neutral-950/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="w-full max-w-md bg-white rounded-3xl shadow-2xl overflow-hidden border border-neutral-100 animate-in zoom-in-95 duration-200">
            <div className="p-6 flex flex-col">
              <h3 className="text-lg font-black text-neutral-900 tracking-tight leading-tight mb-1">
                Editar Fatura Premium
              </h3>
              <p className="text-xs text-neutral-500 mb-6 font-medium">
                Modifique os dados da assinatura de {editingSubscription.name}.
              </p>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-neutral-700 uppercase tracking-wider mb-2">Dia do Vencimento</label>
                  <input
                    type="number"
                    min="1"
                    max="31"
                    placeholder="Ex: 5"
                    className="w-full rounded-2xl border border-neutral-200 px-4 py-3 text-sm focus:border-orange-500 focus:ring-1 focus:ring-orange-500 outline-none text-neutral-900 font-medium"
                    value={subForm.paymentDay}
                    onChange={(e) => setSubForm(prev => ({ ...prev, paymentDay: e.target.value }))}
                  />
                  <p className="text-[10px] text-neutral-400 mt-2 ml-1">Do dia 1 ao dia 31.</p>
                </div>
                <div>
                  <label className="block text-xs font-bold text-neutral-700 uppercase tracking-wider mb-2">Desconto Mensal (R$)</label>
                  <input
                    type="number"
                    min="0"
                    placeholder="Ex: 10"
                    className="w-full rounded-2xl border border-neutral-200 px-4 py-3 text-sm focus:border-orange-500 focus:ring-1 focus:ring-orange-500 outline-none text-neutral-900 font-medium"
                    value={subForm.discount}
                    onChange={(e) => setSubForm(prev => ({ ...prev, discount: e.target.value }))}
                  />
                  <p className="text-[10px] text-neutral-400 mt-2 ml-1">Valor fixo de desconto em R$ no pacote Premium.</p>
                </div>
              </div>

              <div className="mt-8 flex justify-end gap-3 w-full">
                <button
                  type="button"
                  onClick={() => setEditingSubscription(null)}
                  className="px-6 py-3 text-xs font-bold text-neutral-500 hover:text-neutral-800 bg-neutral-100/80 hover:bg-neutral-200 rounded-2xl transition duration-150 cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={handleSaveSubscription}
                  className="px-6 py-3 text-xs font-extrabold text-white bg-orange-600 hover:bg-orange-700 active:scale-[0.98] rounded-2xl transition duration-150 cursor-pointer shadow-md shadow-orange-600/20"
                >
                  Salvar Alterações
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Create Restaurant Modal */}
      {showCreateRestaurantModal && (
        <div className="fixed inset-0 z-[100000] flex items-center justify-center p-4 bg-neutral-950/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="w-full max-w-md bg-white rounded-3xl shadow-2xl overflow-hidden border border-neutral-100 animate-in zoom-in-95 duration-200">
            <div className="p-6 border-b border-neutral-100 flex items-center justify-between">
              <div>
                <h3 className="text-lg font-black text-neutral-900 tracking-tight leading-tight">
                  Novo Restaurante
                </h3>
                <p className="text-xs text-neutral-500 font-medium mt-0.5">
                  Cadastre um estabelecimento e seu acesso administrativo.
                </p>
              </div>
              <button 
                onClick={() => {
                  setShowCreateRestaurantModal(false);
                  setCreateError("");
                  setCreateForm({ restaurantName: "", ownerName: "", email: "", password: "", restaurantType: "Pastelaria" });
                }}
                className="text-neutral-400 hover:text-neutral-600 rounded-lg p-1.5 hover:bg-neutral-50 transition cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleCreateRestaurantSubmit} className="p-6 space-y-4">
              {createError && (
                <div className="rounded-2xl bg-red-50 border border-red-100 p-4 text-xs text-red-700 flex items-start gap-2 animate-in fade-in duration-150">
                  <AlertCircle size={16} className="shrink-0 mt-0.5 text-red-600" />
                  <span className="font-semibold leading-relaxed">{createError}</span>
                </div>
              )}

              <div>
                <label className="block text-xs font-bold text-neutral-700 uppercase tracking-wider mb-2">
                  Nome do Restaurante
                </label>
                <input
                  type="text"
                  required
                  placeholder="Ex: Pizzaria Bella Italia"
                  value={createForm.restaurantName}
                  onChange={(e) => setCreateForm({ ...createForm, restaurantName: e.target.value, ownerName: e.target.value })}
                  className="w-full rounded-2xl border border-neutral-200 px-4 py-3 text-sm focus:border-orange-500 focus:ring-1 focus:ring-orange-500 outline-none text-neutral-900 font-medium placeholder:text-neutral-400 bg-white"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-neutral-700 uppercase tracking-wider mb-2">
                  Tipo / Segmento
                </label>
                <select
                  value={createForm.restaurantType}
                  onChange={(e) => setCreateForm({ ...createForm, restaurantType: e.target.value })}
                  className="w-full rounded-2xl border border-neutral-200 px-4 py-3 text-sm focus:border-orange-500 focus:ring-1 focus:ring-orange-500 outline-none text-neutral-900 font-medium bg-white cursor-pointer"
                >
                  {RESTAURANT_TYPES.map(t => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-neutral-700 uppercase tracking-wider mb-2">
                  E-mail de Login
                </label>
                <input
                  type="email"
                  required
                  placeholder="Ex: contato@pizzaria.com"
                  value={createForm.email}
                  onChange={(e) => setCreateForm({ ...createForm, email: e.target.value })}
                  className="w-full rounded-2xl border border-neutral-200 px-4 py-3 text-sm focus:border-orange-500 focus:ring-1 focus:ring-orange-500 outline-none text-neutral-900 font-medium placeholder:text-neutral-400 bg-white"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-neutral-700 uppercase tracking-wider mb-2">
                  Senha de Acesso
                </label>
                <input
                  type="password"
                  required
                  minLength={6}
                  placeholder="No mínimo 6 caracteres"
                  value={createForm.password}
                  onChange={(e) => setCreateForm({ ...createForm, password: e.target.value })}
                  className="w-full rounded-2xl border border-neutral-200 px-4 py-3 text-sm focus:border-orange-500 focus:ring-1 focus:ring-orange-500 outline-none text-neutral-900 font-medium placeholder:text-neutral-400 bg-white"
                />
              </div>

              <div className="pt-4 flex justify-end gap-3 border-t border-neutral-100 mt-6">
                <button
                  type="button"
                  disabled={creatingRestaurant}
                  onClick={() => {
                    setShowCreateRestaurantModal(false);
                    setCreateError("");
                    setCreateForm({ restaurantName: "", ownerName: "", email: "", password: "", restaurantType: "Pastelaria" });
                  }}
                  className="px-6 py-3 text-xs font-bold text-neutral-500 hover:text-neutral-800 bg-neutral-100/80 hover:bg-neutral-200 rounded-2xl transition duration-150 cursor-pointer disabled:opacity-50"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={creatingRestaurant}
                  className="px-6 py-3 text-xs font-extrabold text-white bg-orange-600 hover:bg-orange-700 active:scale-[0.98] rounded-2xl transition duration-150 cursor-pointer shadow-md shadow-orange-600/20 inline-flex items-center gap-2 disabled:opacity-50"
                >
                  {creatingRestaurant ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                      <span>Criando...</span>
                    </>
                  ) : (
                    <span>Criar Restaurante</span>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
