export interface SegmentConfig {
  segmentName: string;
  badgeEmoji: string;
  flavorLabel: string;
  flavorSubtitle: string;
  flavorBadge: string;
  addonLabel: string;
  addonSubtitle: string;
  complementLabel: string;
  complementSubtitle: string;
  sauceLabel: string;
  sauceSubtitle: string;
  cardBadgeText: string;
  emptyNotice: string;
  themeGradient: string;
  themeAccentBg: string;
  themeTextColor: string;
}

export function getSegmentConfig(genreRaw: string): SegmentConfig {
  const g = (genreRaw || "").toLowerCase().trim();

  if (g.includes("bebida") || g.includes("bar") || g.includes("adega") || g.includes("drink") || g.includes("distribuidora") || g.includes("cerveja") || g.includes("suco") || g.includes("gelada") || g.includes("refrigerante")) {
    return {
      segmentName: "Bebidas & Drinks",
      badgeEmoji: "🥤",
      flavorLabel: "Sabores da Bebida",
      flavorSubtitle: "Escolha o sabor de sua preferência",
      flavorBadge: "Sabores",
      addonLabel: "Adicionais Pagos (Gelo, Doses & Extras)",
      addonSubtitle: "Gelo especial, leite condensado, dose extra ou acompanhamentos",
      complementLabel: "Acompanhamentos Grátis",
      complementSubtitle: "Gelo tradicional, limão, canudo ou copo descartável",
      sauceLabel: "Caldas & Coberturas",
      sauceSubtitle: "Caldas e complementos para sua bebida",
      cardBadgeText: "Gelada & Pronta",
      emptyNotice: "Selecione o sabor e adicionais desejados.",
      themeGradient: "from-blue-600 to-cyan-500",
      themeAccentBg: "bg-blue-50 text-blue-700 border-blue-200",
      themeTextColor: "text-blue-600",
    };
  }

  if (g.includes("pastel") || g.includes("salgado")) {
    return {
      segmentName: "Pastelaria & Salgados",
      badgeEmoji: "🥟",
      flavorLabel: "Sabores & Recheios do Pastel",
      flavorSubtitle: "Escolha os sabores de sua preferência",
      flavorBadge: "Sabores",
      addonLabel: "Recheios Extras (Pagos)",
      addonSubtitle: "Adicione recheios extras para caprichar no seu pastel",
      complementLabel: "Saladas, Queijos & Acompanhamentos Grátis",
      complementSubtitle: "Escolha as opções gratuitas para incluir",
      sauceLabel: "Molhos Especiais da Casa",
      sauceSubtitle: "Maionese temperada, ketchup e molhos da casa",
      cardBadgeText: "Monte seu Pastel",
      emptyNotice: "Selecione a quantidade e sabores desejados.",
      themeGradient: "from-amber-500 to-orange-600",
      themeAccentBg: "bg-amber-50 text-amber-700 border-amber-200",
      themeTextColor: "text-amber-600",
    };
  }

  if (g.includes("espet") || g.includes("churrasco") || g.includes("churrascaria")) {
    return {
      segmentName: "Espetinho & Churrasco",
      badgeEmoji: "🍢",
      flavorLabel: "Ponto da Carne / Opções",
      flavorSubtitle: "Escolha como deseja o ponto da carne na brasa",
      flavorBadge: "Ponto",
      addonLabel: "Acompanhamentos Pagos (Extras)",
      addonSubtitle: "Farofa extra, pão de alho e porções adicionais",
      complementLabel: "Acompanhamentos Grátis",
      complementSubtitle: "Farofa crocante, vinagrete e alho da casa",
      sauceLabel: "Molhos Especiais",
      sauceSubtitle: "Molho verde, molho de alho e pimenta artesanal",
      cardBadgeText: "Assado na Brasa",
      emptyNotice: "Escolha o ponto da carne e acompanhamentos.",
      themeGradient: "from-red-600 to-amber-600",
      themeAccentBg: "bg-red-50 text-red-700 border-red-200",
      themeTextColor: "text-red-600",
    };
  }

  if (g.includes("açaí") || g.includes("acai") || g.includes("sorvet")) {
    return {
      segmentName: "Açaíteria & Gelados",
      badgeEmoji: "🍧",
      flavorLabel: "Cremes & Sabores Base",
      flavorSubtitle: "Escolha a massa base do seu copo ou tigela",
      flavorBadge: "Cremes / Base",
      addonLabel: "Adicionais Pagos (Nutella, Frutas & Coberturas)",
      addonSubtitle: "Turbine seu açaí com adicionais premium",
      complementLabel: "Complementos Grátis",
      complementSubtitle: "Leite em pó, granola, paçoca e leite condensado",
      sauceLabel: "Caldas & Coberturas",
      sauceSubtitle: "Caldas doces e toppings",
      cardBadgeText: "Cremoso & Gelado",
      emptyNotice: "Monte seu copo com frutas e adicionais.",
      themeGradient: "from-purple-600 to-fuchsia-600",
      themeAccentBg: "bg-purple-50 text-purple-700 border-purple-200",
      themeTextColor: "text-purple-600",
    };
  }

  if (g.includes("hamburg") || g.includes("burger")) {
    return {
      segmentName: "Hamburgueria Artesanal",
      badgeEmoji: "🍔",
      flavorLabel: "Tipo de Queijo & Pão",
      flavorSubtitle: "Escolha o tipo de pão e queijo de sua preferência",
      flavorBadge: "Pão / Queijo",
      addonLabel: "Adicionais Pagos (Bacon, Carne Extra, Onion Rings)",
      addonSubtitle: "Incremente o hambúrguer com adicionais deliciosos",
      complementLabel: "Retirar Ingredientes & Opções Grátis",
      complementSubtitle: "Especifique o que deseja retirar ou alterar sem custo",
      sauceLabel: "Molhos Especiais",
      sauceSubtitle: "Barbecue, Maionese temperada, Ketchup da casa",
      cardBadgeText: "100% Artesanal",
      emptyNotice: "Personalize seu burger com pão, queijos e adicionais.",
      themeGradient: "from-orange-600 to-red-600",
      themeAccentBg: "bg-orange-50 text-orange-700 border-orange-200",
      themeTextColor: "text-orange-600",
    };
  }

  if (g.includes("marmit") || g.includes("refeicao") || g.includes("quentinha")) {
    return {
      segmentName: "Marmitaria & Refeições",
      badgeEmoji: "🍱",
      flavorLabel: "Opção de Carne / Proteína Principal",
      flavorSubtitle: "Escolha a carne principal da refeição",
      flavorBadge: "Proteína",
      addonLabel: "Misturas Extras (Pagas)",
      addonSubtitle: "Ovo frito, calabresa extra, torresmo ou vinagrete",
      complementLabel: "Acompanhamentos Grátis",
      complementSubtitle: "Arroz branco, feijão caseiro, macarrão e salada",
      sauceLabel: "Caldos & Temperos",
      sauceSubtitle: "Farofa caseira e molho de pimenta",
      cardBadgeText: "Comida Caseira",
      emptyNotice: "Monte sua marmita com acompanhamentos completos.",
      themeGradient: "from-emerald-600 to-teal-600",
      themeAccentBg: "bg-emerald-50 text-emerald-700 border-emerald-200",
      themeTextColor: "text-emerald-600",
    };
  }

  if (g.includes("macarr") || g.includes("massa") || g.includes("italiana")) {
    return {
      segmentName: "Massas & Macarronada",
      badgeEmoji: "🍝",
      flavorLabel: "Tipos de Massa",
      flavorSubtitle: "Escolha a massa (Espaguete, Penne, Talharim, etc.)",
      flavorBadge: "Tipo de Massa",
      addonLabel: "Proteínas & Adicionais Pagos",
      addonSubtitle: "Bacon, Frango desfiado, Camarão ou Parmesão",
      complementLabel: "Ingredientes & Temperos Grátis",
      complementSubtitle: "Azeitona, milho, ervilha, oregano",
      sauceLabel: "Molhos Principais",
      sauceSubtitle: "Bolonhesa, Molho Branco, Quatro Queijos",
      cardBadgeText: "Massa Fresca",
      emptyNotice: "Escolha a massa, o molho e ingredientes.",
      themeGradient: "from-amber-600 to-red-600",
      themeAccentBg: "bg-amber-50 text-amber-700 border-amber-200",
      themeTextColor: "text-amber-600",
    };
  }

  if (g.includes("japa") || g.includes("sushi") || g.includes("oriental")) {
    return {
      segmentName: "Culinária Japonesa",
      badgeEmoji: "🍣",
      flavorLabel: "Opção do Prato / Combinado",
      flavorSubtitle: "Escolha a variação de peixe ou estilo de preparo",
      flavorBadge: "Peixe / Estilo",
      addonLabel: "Adicionais Pagos",
      addonSubtitle: "Molho Tarê, Shoyu extra, Wasabi, Cream Cheese",
      complementLabel: "Complementos Grátis",
      complementSubtitle: "Gengibre, adaptadores, noz-moscada",
      sauceLabel: "Molhos & Caldos",
      sauceSubtitle: "Shoyu tradicional, Tarê e Agri-doce",
      cardBadgeText: "Fresco & Selecionado",
      emptyNotice: "Escolha as opções de corte e molhos.",
      themeGradient: "from-zinc-800 to-red-600",
      themeAccentBg: "bg-red-50 text-red-700 border-red-200",
      themeTextColor: "text-red-600",
    };
  }

  if (g.includes("pizza")) {
    return {
      segmentName: "Pizzaria",
      badgeEmoji: "🍕",
      flavorLabel: "Sabores da Pizza",
      flavorSubtitle: "Escolha os sabores para compor sua pizza",
      flavorBadge: "Sabores",
      addonLabel: "Bordas Recheadas & Extras (Pagos)",
      addonSubtitle: "Borda de catupiry, cheddar, chocolate ou bacon extra",
      complementLabel: "Ajustes de Ingredientes Grátis",
      complementSubtitle: "Sem cebola, orégano extra, bem assada",
      sauceLabel: "Acompanhamentos",
      sauceSubtitle: "Ketchup, maionese temperada e azeite",
      cardBadgeText: "Assada no Forno",
      emptyNotice: "Escolha o tamanho, sabores e borda da pizza.",
      themeGradient: "from-red-600 to-orange-500",
      themeAccentBg: "bg-red-50 text-red-700 border-red-200",
      themeTextColor: "text-red-600",
    };
  }

  // Default / Geral
  return {
    segmentName: "Cardápio Geral",
    badgeEmoji: "🍽️",
    flavorLabel: "Sabores & Opções",
    flavorSubtitle: "Escolha a opção de sua preferência",
    flavorBadge: "Opções",
    addonLabel: "Adicionais Pagos (Extras)",
    addonSubtitle: "Adicione itens extras ao seu produto",
    complementLabel: "Complementos Grátis",
    complementSubtitle: "Escolha opções de acompanhamento sem custo",
    sauceLabel: "Molhos & Acompanhamentos",
    sauceSubtitle: "Molhos para acompanhar seu pedido",
    cardBadgeText: "Especial",
    emptyNotice: "Monte seu pedido com as opções do cardápio.",
    themeGradient: "from-orange-500 to-amber-600",
    themeAccentBg: "bg-orange-50 text-orange-700 border-orange-200",
    themeTextColor: "text-orange-600",
  };
}

export function getProductSegmentConfig(categoryRaw?: string, baseConfig?: SegmentConfig): SegmentConfig {
  const cat = (categoryRaw || "").toLowerCase().trim();
  const defaultBase = baseConfig || getSegmentConfig("");

  if (cat.includes("bebida") || cat.includes("vitamina") || cat.includes("drink") || cat.includes("suco") || cat.includes("cerveja") || cat.includes("refrigerante") || cat.includes("gelada") || cat.includes("chopp") || cat.includes("chope") || cat.includes("vinho") || cat.includes("coquetel") || cat.includes("milkshake") || cat.includes("shake") || cat.includes("smoothie") || cat.includes("adega") || cat.includes("bar") || cat.includes("destilado") || cat.includes("dose") || cat.includes("lata") || cat.includes("long neck") || cat.includes("energetico") || cat.includes("água") || cat.includes("agua")) {
    const isVitamina = cat.includes("vitamina") || cat.includes("shake") || cat.includes("smoothie");
    return {
      ...defaultBase,
      badgeEmoji: isVitamina ? "🥤" : "🥤",
      flavorLabel: isVitamina ? "Sabores da Vitamina" : "Sabores da Bebida",
      flavorSubtitle: "Escolha o sabor de sua preferência",
      flavorBadge: "Sabores",
      addonLabel: "Adicionais Pagos (Gelo, Doses & Extras)",
      addonSubtitle: "Adicione frutas, gelo especial, leite condensado ou doses extras",
      complementLabel: "Opções & Acompanhamentos Grátis",
      complementSubtitle: "Escolha gelo, limão, canudo ou opção sem custo",
      cardBadgeText: isVitamina ? "Vitamina Feita na Hora" : "Bebida Gelada",
    };
  }

  return defaultBase;
}
