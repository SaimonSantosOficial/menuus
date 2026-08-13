import { useState } from "react";
import { 
  Check, 
  Store, 
  Users, 
  Wallet, 
  ChevronDown, 
  ArrowRight, 
  Sparkles, 
  TrendingUp, 
  Printer, 
  Star, 
  Clock,
  Heart,
  QrCode,
  Smartphone,
  MessageSquare
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { Link } from "react-router-dom";

export default function LandingPage() {
  // FAQ state
  const [activeFaq, setActiveFaq] = useState<number | null>(null);

  const toggleFaq = (index: number) => {
    setActiveFaq(activeFaq === index ? null : index);
  };

  return (
    <div className="min-h-screen bg-neutral-50 font-sans text-neutral-900 selection:bg-orange-500/30 overflow-x-hidden">
      
      {/* Background radial soft shapes */}
      <div className="absolute top-0 left-1/2 -z-10 h-[600px] w-full max-w-7xl -translate-x-1/2 [background:radial-gradient(100%_60%_at_top_center,rgba(249,115,22,0.07)_0%,rgba(255,255,255,0)_100%)]" />

      {/* Header */}
      <header className="sticky top-0 z-50 border-b border-neutral-200/40 bg-white/70 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-orange-600 text-white shadow-md shadow-orange-500/20">
              <Store size={20} />
            </div>
            <span className="text-xl font-bold tracking-tight text-neutral-900">
              Menu<span className="text-orange-600">Flow</span>
            </span>
          </div>
          <nav className="flex items-center gap-6">
            <Link to="/auth" className="text-sm font-semibold text-neutral-600 hover:text-neutral-950 transition-colors">
              Entrar
            </Link>
            <a 
              href="https://wa.me/55859921493128?text=Olá!%20Gostaria%20de%20adquirir%20o%20MenuFlow%20e%20solicitar%20meu%20acesso%20ao%20sistema." 
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-full bg-neutral-950 px-5 py-2.5 text-sm font-bold text-white transition hover:bg-neutral-800 shadow-sm hover:shadow"
            >
              Solicitar Acesso
            </a>
          </nav>
        </div>
      </header>

      <main>
        {/* Hero Section */}
        <section className="relative pt-16 pb-24 lg:pt-24 lg:pb-32">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="max-w-4xl mx-auto text-center flex flex-col items-center justify-center">
              
              <motion.div
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4 }}
                className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-orange-50 text-orange-700 text-xs font-bold border border-orange-100 mb-6"
              >
                <Sparkles size={12} className="text-orange-600" />
                Cardápio Integrado & Painel de Impressão
              </motion.div>
              
              <motion.h1
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: 0.1 }}
                className="text-4xl font-extrabold tracking-tight text-neutral-900 sm:text-5xl lg:text-6xl mb-6 leading-[1.1] text-center"
              >
                O cardápio que <span className="text-orange-600">vende</span> e a comanda que <span className="text-orange-600">organiza</span>
              </motion.h1>

              <motion.p
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: 0.2 }}
                className="text-lg leading-relaxed text-neutral-600 mb-8 max-w-2xl text-center mx-auto"
              >
                Permita que seus clientes peçam com facilidade pelo celular via QR Code ou link. Receba tudo organizado no seu painel de gestor, formate comandas térmicas perfeitamente para a cozinha e expanda seu faturamento de forma profissional.
              </motion.p>

              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: 0.3 }}
                className="flex flex-col sm:flex-row items-center justify-center gap-4 w-full"
              >
                <a 
                  href="https://wa.me/55859921493128?text=Olá!%20Gostaria%20de%20adquirir%20o%20MenuFlow%20e%20solicitar%20meu%20acesso%20ao%20sistema." 
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full sm:w-auto rounded-full bg-orange-600 px-8 py-4 text-base font-bold text-white shadow-lg shadow-orange-500/20 hover:bg-orange-500 hover:scale-[1.02] active:scale-[0.98] transition-all text-center flex items-center justify-center gap-2"
                >
                  Solicitar Acesso (WhatsApp)
                  <ArrowRight size={18} />
                </a>
                <Link 
                  to="/pizzariadopedro" 
                  className="w-full sm:w-auto rounded-full bg-white px-8 py-4 text-base font-bold text-neutral-800 shadow-sm ring-1 ring-neutral-200 hover:bg-neutral-50 hover:scale-[1.01] active:scale-[0.99] transition-all text-center"
                >
                  Ver Exemplo Real
                </Link>
              </motion.div>
            </div>
          </div>
        </section>

        {/* Growth & Value Stats Bar */}
        <section className="bg-white border-y border-neutral-200/60 py-12">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="grid grid-cols-1 gap-y-10 sm:grid-cols-2 lg:grid-cols-4 gap-x-8 text-center">
              {[
                { value: "0%", label: "Taxa sobre vendas", desc: "Todo o lucro fica 100% com você", icon: <Wallet className="h-5 w-5 text-orange-600" /> },
                { value: "+42%", label: "Ticket Médio", desc: "Clientes compram adicionais com 2 cliques", icon: <TrendingUp className="h-5 w-5 text-orange-600" /> },
                { value: "58 e 80mm", label: "Formatos Térmicos", desc: "Compatível com qualquer impressora local", icon: <Printer className="h-5 w-5 text-orange-600" /> },
                { value: "3 min", label: "Tempo de Setup", desc: "Cadastre e comece a vender no mesmo dia", icon: <Clock className="h-5 w-5 text-orange-600" /> }
              ].map((stat, idx) => (
                <div key={idx} className="flex flex-col items-center p-4">
                  <div className="mb-3 h-10 w-10 rounded-full bg-orange-50 flex items-center justify-center text-orange-600">
                    {stat.icon}
                  </div>
                  <span className="text-3xl sm:text-4xl font-extrabold tracking-tight text-neutral-950 mb-1">{stat.value}</span>
                  <span className="text-sm font-bold text-neutral-800 mb-0.5">{stat.label}</span>
                  <p className="text-xs text-neutral-500 max-w-[200px]">{stat.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Bento Grid Benefits Section */}
        <section className="py-24 sm:py-32 bg-neutral-50">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="mx-auto max-w-3xl text-center mb-16 sm:mb-20">
              <span className="text-orange-600 text-sm font-extrabold tracking-wider uppercase">Vantagens Premium</span>
              <h2 className="mt-2 text-3xl font-extrabold tracking-tight text-neutral-900 sm:text-4xl">
                Tudo que seu negócio precisa para crescer organizado
              </h2>
              <p className="mt-4 text-base sm:text-lg text-neutral-600">
                Uma solução feita sob medida para facilitar a gestão do restaurante e modernizar o atendimento ao cliente.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
              {[
                {
                  icon: <Smartphone className="h-6 w-6" />,
                  title: "Cardápio Responsivo Ultra Rápido",
                  description: "Sem loops complicados ou apps para baixar. O cliente escaneia o QR Code ou clica no link e o cardápio abre instantaneamente no navegador."
                },
                {
                  icon: <QrCode className="h-6 w-6" />,
                  title: "QR Codes para Mesas e Balcão",
                  description: "Gere links individuais de mesa. Assim que o pedido chega no WhatsApp ou painel, você já sabe exatamente quem chamou e de qual mesa partiu."
                },
                {
                  icon: <MessageSquare className="h-6 w-6" />,
                  title: "Pedidos Limpos no WhatsApp",
                  description: "Esqueça aquela poluição visual ou robôs automáticos chatos. O pedido chega formatado, legível e com todas as opções de adicionais escolhidas."
                },
                {
                  icon: <Printer className="h-6 w-6" />,
                  title: "Impressão Pronta em 58mm/80mm",
                  description: "O painel abre uma janela de impressão do navegador perfeitamente formatada para bobinas térmicas. Direcione uma para o balcão e outra para a cozinha."
                },
                {
                  icon: <Wallet className="h-6 w-6" />,
                  title: "Faturamento Direto & Livre de Taxas",
                  description: "Diga adeus às comissões abusivas de plataformas de delivery. O pagamento é combinado diretamente com você: Pix, cartão na entrega ou dinheiro."
                },
                {
                  icon: <Users className="h-6 w-6" />,
                  title: "Histórico e Gestão Simplificada",
                  description: "Acompanhe suas vendas do dia, mude o status de preparação dos pedidos e tenha controle total dos produtos disponíveis com poucos cliques."
                }
              ].map((benefit, index) => (
                <motion.div
                  key={index}
                  initial={{ opacity: 0, y: 15 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, margin: "-80px" }}
                  transition={{ duration: 0.4, delay: index * 0.05 }}
                  className="bg-white p-8 rounded-3xl border border-neutral-200/60 hover:shadow-xl hover:-translate-y-1 transition-all group flex flex-col justify-between"
                >
                  <div>
                    <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-orange-50 text-orange-600 mb-6 group-hover:bg-orange-600 group-hover:text-white transition-all">
                      {benefit.icon}
                    </div>
                    <h3 className="text-lg font-bold text-neutral-900 mb-3">{benefit.title}</h3>
                    <p className="text-sm sm:text-base leading-relaxed text-neutral-600">{benefit.description}</p>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        </section>

        {/* How It Works (Como Funciona) */}
        <section className="py-24 bg-white border-t border-neutral-200/50">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="mx-auto max-w-3xl text-center mb-16 sm:mb-20">
              <span className="text-orange-600 text-sm font-extrabold tracking-wider uppercase">Fácil e Sem Segredos</span>
              <h2 className="mt-2 text-3xl font-extrabold tracking-tight text-neutral-900 sm:text-4xl">
                Como funciona o MenuFlow?
              </h2>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-12 relative">
              {[
                { step: "1", title: "Crie Seu Cardápio", desc: "Cadastre seu restaurante e organize seus produtos com fatias, complementos e adicionais em poucos minutos." },
                { step: "2", title: "Divulgue o Link ou QR Code", desc: "Imprima adesivos de QR Code para as mesas ou coloque o link exclusivo do cardápio digital no seu Instagram e WhatsApp." },
                { step: "3", title: "Imprima e Prepare os Pedidos", desc: "Acompanhe a entrada de pedidos no painel inteligente. Imprima na impressora térmica do balcão e mande para a cozinha." }
              ].map((item, idx) => (
                <div key={idx} className="relative flex flex-col items-center text-center group">
                  <div className="h-16 w-16 rounded-full bg-orange-600 text-white font-black text-xl flex items-center justify-center shadow-lg shadow-orange-500/20 mb-6 group-hover:scale-110 transition-all">
                    {item.step}
                  </div>
                  <h3 className="text-xl font-bold text-neutral-900 mb-3">{item.title}</h3>
                  <p className="text-sm sm:text-base leading-relaxed text-neutral-600 max-w-sm">{item.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Pricing Section */}
        <section className="py-24 bg-neutral-50 border-t border-neutral-200/60">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            
            <div className="mx-auto max-w-3xl text-center mb-12">
              <span className="text-orange-600 text-sm font-extrabold tracking-wider uppercase">Plano Único e Completo</span>
              <h2 className="mt-2 text-3xl font-extrabold tracking-tight text-neutral-900 sm:text-4xl">
                Tudo que você precisa em uma única assinatura mensal
              </h2>
              <p className="mt-4 text-base text-neutral-600">
                Sem taxas por pedido, sem fidelidade e sem custos ocultos. Ativação imediata via suporte.
              </p>
            </div>

            <div className="mx-auto max-w-lg">
              {/* Premium Plan Card (Only Monthly) */}
              <motion.div
                initial={{ opacity: 0, y: 15 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                className="flex flex-col justify-between rounded-3xl bg-neutral-900 p-8 shadow-xl xl:p-10 ring-2 ring-orange-500 relative overflow-hidden"
              >
                <div>
                  <div className="flex justify-between items-center mb-4">
                    <h3 className="text-xl font-bold leading-8 text-white flex items-center gap-1.5">
                      MenuFlow Premium
                      <Sparkles size={16} className="text-orange-500 animate-pulse" />
                    </h3>
                    <span className="text-xs font-semibold px-2 py-1 bg-orange-600/25 rounded text-orange-400">Mensal</span>
                  </div>

                  <p className="mt-4 flex items-baseline gap-x-1">
                    <span className="text-4xl font-extrabold tracking-tight text-white">R$ 59,90</span>
                    <span className="text-sm font-semibold text-neutral-400">/mês</span>
                  </p>

                  <p className="mt-6 text-sm sm:text-base leading-relaxed text-neutral-300">
                    Acesso completo e ilimitado a todos os recursos para escalar suas vendas e organizar suas comandas.
                  </p>

                  <div className="border-t border-neutral-800 my-6" />

                  <ul role="list" className="space-y-4 text-sm text-neutral-300">
                    <li className="flex items-center gap-x-3">
                      <Check className="h-5 w-5 text-orange-500 flex-shrink-0" />
                      <span>Produtos ativos <strong>ilimitados</strong></span>
                    </li>
                    <li className="flex items-center gap-x-3">
                      <Check className="h-5 w-5 text-orange-500 flex-shrink-0" />
                      <span>Categorias de cardápio <strong>ilimitadas</strong></span>
                    </li>
                    <li className="flex items-center gap-x-3">
                      <Check className="h-5 w-5 text-orange-500 flex-shrink-0" />
                      <span>Personalização completa de cores & temas</span>
                    </li>
                    <li className="flex items-center gap-x-3">
                      <Check className="h-5 w-5 text-orange-500 flex-shrink-0" />
                      <span>Impressão de comandas formatadas em 58mm/80mm</span>
                    </li>
                    <li className="flex items-center gap-x-3">
                      <Check className="h-5 w-5 text-orange-500 flex-shrink-0" />
                      <span>Relatório de faturamento e vendas analítico</span>
                    </li>
                    <li className="flex items-center gap-x-3">
                      <Check className="h-5 w-5 text-orange-500 flex-shrink-0" />
                      <span>Suporte VIP via WhatsApp</span>
                    </li>
                  </ul>
                </div>

                <a 
                  href="https://wa.me/55859921493128?text=Olá!%20Gostaria%20de%20adquirir%20o%20MenuFlow%20Premium%20Mensal%20e%20solicitar%20o%20meu%20acesso."
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-8 block w-full rounded-full bg-orange-600 hover:bg-orange-500 px-3 py-3.5 text-center text-sm font-bold text-white shadow-lg shadow-orange-500/20 hover:shadow-orange-500/30 transition-all hover:scale-[1.01] active:scale-[0.99]"
                >
                  Solicitar Acesso (WhatsApp)
                </a>
              </motion.div>
            </div>

          </div>
        </section>

        {/* Testimonials */}
        <section className="py-24 bg-white border-t border-neutral-200/50">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="mx-auto max-w-3xl text-center mb-16">
              <span className="text-orange-600 text-sm font-extrabold tracking-wider uppercase">Histórias de Sucesso</span>
              <h2 className="mt-2 text-3xl font-extrabold tracking-tight text-neutral-900 sm:text-4xl">
                O que dizem os parceiros do MenuFlow
              </h2>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              {[
                {
                  quote: "Nosso atendimento no WhatsApp era um caos antes do MenuFlow. Os clientes demoravam pra fechar os pedidos e vinha tudo desorganizado. Agora, com o cardápio e a impressão da comanda em 80mm no balcão, aceleramos nossa cozinha em 100%!",
                  author: "Thiago Ramos",
                  role: "Sócio do BurgerLab",
                  rating: 5,
                  initials: "TR"
                },
                {
                  quote: "Não pago mais taxas abusivas para os marketplaces de delivery. Consigo gerenciar meus lanches facilmente no celular e meus clientes adoram a experiência rápida de escaneamento de mesa.",
                  author: "Mariana Albuquerque",
                  role: "Fundadora da Pizzaria Bella Massa",
                  rating: 5,
                  initials: "MA"
                },
                {
                  quote: "O sistema de impressão direto do navegador salvou nosso restaurante. Funciona perfeitamente na nossa bobina térmica simples de 58mm. O layout é limpo e não enrola as letras. Nota 10!",
                  author: "Leandro Costa",
                  role: "Proprietário do Cantinho do Pastel",
                  rating: 5,
                  initials: "LC"
                }
              ].map((test, idx) => (
                <div key={idx} className="bg-neutral-50 p-8 rounded-3xl border border-neutral-200/60 flex flex-col justify-between">
                  <div>
                    <div className="flex items-center gap-1 text-amber-500 mb-4">
                      {[...Array(test.rating)].map((_, i) => <Star key={i} size={15} fill="currentColor" />)}
                    </div>
                    <p className="text-sm sm:text-base leading-relaxed text-neutral-600 italic">"{test.quote}"</p>
                  </div>
                  <div className="mt-6 flex items-center gap-3">
                    <span className="flex h-10 w-10 items-center justify-center rounded-full bg-orange-100 text-sm font-bold text-orange-700">
                      {test.initials}
                    </span>
                    <div>
                      <h4 className="text-sm font-bold text-neutral-900">{test.author}</h4>
                      <p className="text-xs text-neutral-500">{test.role}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Dynamic FAQ Section Accordion */}
        <section className="py-24 bg-neutral-50 border-t border-neutral-200/60">
          <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-16">
              <span className="text-orange-600 text-sm font-extrabold tracking-wider uppercase">Dúvidas Frequentes</span>
              <h2 className="mt-2 text-3xl font-extrabold tracking-tight text-neutral-900 sm:text-4xl">
                FAQ — Tire suas Dúvidas
              </h2>
            </div>

            <div className="space-y-4">
              {[
                {
                  q: "Preciso baixar algum aplicativo para gerenciar?",
                  a: "Não! O MenuFlow é 100% online. Você pode acessar e administrar todo o seu restaurante de forma extremamente responsiva direto pelo navegador do seu celular, tablet ou computador."
                },
                {
                  q: "Como o pedido chega formatado no meu WhatsApp?",
                  a: "O cliente navega pelo cardápio digital, escolhe as variações e tamanhos e, ao finalizar, o sistema formata uma mensagem limpa e super legível contendo a comanda com todos os dados do pedido. O cliente clica em enviar e a mensagem chega formatada pra você."
                },
                {
                  q: "O sistema de impressão funciona com qualquer impressora?",
                  a: "Sim! Nosso sistema abre um preview de impressão otimizado para bobinas térmicas de 58mm e 80mm. Se a sua impressora estiver instalada no seu sistema operacional, ela vai imprimir perfeitamente através de qualquer navegador."
                },
                {
                  q: "Pago comissão por cada pedido que eu fizer?",
                  a: "Absolutamente nada! Todo o lucro das suas vendas é totalmente seu. Não cobramos nenhuma taxa ou comissão sobre os pedidos realizados no cardápio."
                },
                {
                  q: "Posso cancelar minha assinatura quando eu quiser?",
                  a: "Sim! Não há qualquer contrato de fidelidade no plano mensal ou anual. Você pode assinar, usufruir de todas as vantagens e cancelar a renovação automática a qualquer momento, sem taxas ocultas."
                }
              ].map((faq, index) => {
                const isOpen = activeFaq === index;
                return (
                  <div key={index} className="bg-white rounded-2xl border border-neutral-200/60 overflow-hidden">
                    <button
                      onClick={() => toggleFaq(index)}
                      className="w-full px-6 py-5 text-left font-bold text-neutral-900 flex items-center justify-between gap-4 text-sm sm:text-base hover:bg-neutral-50 transition"
                    >
                      <span>{faq.q}</span>
                      <ChevronDown className={`h-5 w-5 text-neutral-500 transition-transform duration-200 ${isOpen ? "transform rotate-180" : ""}`} />
                    </button>
                    
                    <AnimatePresence>
                      {isOpen && (
                        <motion.div
                          initial={{ height: 0 }}
                          animate={{ height: "auto" }}
                          exit={{ height: 0 }}
                          className="overflow-hidden"
                        >
                          <div className="px-6 pb-5 pt-1 text-sm sm:text-base leading-relaxed text-neutral-600 border-t border-neutral-100">
                            {faq.a}
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        {/* CTA Hero Final */}
        <section className="relative overflow-hidden py-24 bg-orange-600 text-white">
          {/* Subtle bg noise or patterns */}
          <div className="absolute inset-0 opacity-10 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-white via-orange-600 to-orange-800" />
          
          <div className="relative mx-auto max-w-5xl px-4 sm:px-6 lg:px-8 text-center">
            <motion.div
              initial={{ opacity: 0, y: 15 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              className="max-w-2xl mx-auto"
            >
              <Store size={44} className="mx-auto text-white mb-6 animate-pulse" />
              <h2 className="text-3xl font-extrabold tracking-tight sm:text-4xl lg:text-5xl mb-6">
                Leve seu restaurante para o próximo nível hoje
              </h2>
              <p className="text-lg text-orange-100 mb-10">
                Entre em contato pelo WhatsApp e ative seu painel e cardápio em menos de 3 minutos.
              </p>
              <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
                <a 
                  href="https://wa.me/55859921493128?text=Olá!%20Quero%20ativar%20meu%20acesso%20ao%20MenuFlow%20e%20configurar%20meu%20cardápio."
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full sm:w-auto rounded-full bg-white px-8 py-4 text-base font-bold text-orange-600 shadow-md hover:bg-neutral-50 hover:scale-[1.02] active:scale-[0.98] transition-all text-center"
                >
                  Solicitar Acesso via WhatsApp
                </a>
                <Link 
                  to="/pizzariadopedro" 
                  className="w-full sm:w-auto rounded-full bg-orange-700/60 hover:bg-orange-700/80 px-8 py-4 text-base font-bold text-white border border-orange-500/30 transition-all text-center"
                >
                  Experimentar como Cliente
                </Link>
              </div>
            </motion.div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="bg-white border-t border-neutral-200/50 py-12">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col md:flex-row items-center justify-between gap-6 border-b border-neutral-100 pb-8 mb-8">
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-orange-600 text-white shadow">
                <Store size={18} />
              </div>
              <span className="text-lg font-black tracking-tight text-neutral-900">
                Menu<span className="text-orange-600">Flow</span>
              </span>
            </div>
            <p className="text-xs sm:text-sm text-neutral-500 flex items-center gap-1">
              Desenvolvido com <Heart size={12} className="text-red-500 fill-current" /> para impulsionar a gastronomia local.
            </p>
          </div>
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            <p className="text-xs text-neutral-400">
              2026 MenuFlow
            </p>
            <div className="flex gap-6 text-xs text-neutral-400">
              <span className="hover:text-neutral-600 cursor-pointer">Termos de Uso</span>
              <span className="hover:text-neutral-600 cursor-pointer">Privacidade</span>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
