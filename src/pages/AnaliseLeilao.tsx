import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Area,
  Bar,
  BarChart,
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  Building2,
  CheckCircle2,
  ShieldAlert,
  TrendingUp,
  AlertTriangle,
  Menu,
  X,
  RotateCcw,
  ArrowLeft,
  Pencil,
} from "lucide-react";
import { RISCOS } from "@/data/analiseLeilao";
import {
  DadosImovel,
  capRateNominal,
  cdiCurva,
  ipcaCurva,
  precoPorM2,
  PREMISSAS_LABELS,
} from "@/lib/analiseLeilao/types";
import { getAtual } from "@/lib/analiseLeilao/storage";

const fmtBRL = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
const fmtBRLM = (v: number) =>
  "R$ " + (v / 1000).toLocaleString("pt-BR", { maximumFractionDigits: 2 }) + "M";
const fmtPct = (v: number) => v.toLocaleString("pt-BR", { maximumFractionDigits: 1 }) + "%";

const SECTIONS = [
  { id: "ficha", label: "Ficha do imóvel" },
  { id: "preco", label: "Preço vs mercado" },
  { id: "renda", label: "Renda e locação" },
  { id: "correcao", label: "Risco de correção" },
  { id: "riscos", label: "Mapa de riscos" },
  { id: "comparativo", label: "Comparativo interativo" },
  { id: "resumo", label: "Resumo executivo" },
];

const Badge = ({ children, className = "" }: { children: React.ReactNode; className?: string }) => (
  <span className={`inline-flex items-center text-xs font-medium px-2.5 py-1 rounded-full ${className}`}>
    {children}
  </span>
);

const Card = ({ children, className = "" }: { children: React.ReactNode; className?: string }) => (
  <div className={`bg-white border border-slate-200 rounded-xl shadow-sm p-5 ${className}`}>{children}</div>
);

const SectionWrap = ({ id, children }: { id: string; children: React.ReactNode }) => {
  const ref = useRef<HTMLElement>(null);
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(([e]) => e.isIntersecting && setVisible(true), { threshold: 0.1 });
    obs.observe(el);
    return () => obs.disconnect();
  }, []);
  return (
    <section
      id={id}
      ref={ref}
      className={`scroll-mt-20 transition-all duration-700 ${
        visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"
      }`}
    >
      {children}
    </section>
  );
};

// ---------- Comparativo ----------
function Comparativo({ d }: { d: DadosImovel }) {
  const cdiArr = useMemo(() => cdiCurva(d), [d]);
  const ipcaArr = useMemo(() => ipcaCurva(d), [d]);
  const cap = capRateNominal(d) / 100;
  const investDefault = d.investimentoTotalMil || d.lanceMinimoMil * 1.075;

  const [inv, setInv] = useState(investDefault);
  const [valim, setValim] = useState(0.06);
  const [reaj, setReaj] = useState(0.03);

  useEffect(() => {
    setInv(investDefault);
  }, [investDefault]);

  const reset = () => {
    setInv(investDefault);
    setValim(0.06);
    setReaj(0.03);
  };

  const data = useMemo(() => {
    const anos = Array.from({ length: 11 }, (_, i) => i);
    let rendaAcum = 0;
    const imPatr = anos.map((i) => {
      if (i > 0) rendaAcum += inv * cap * Math.pow(1 + reaj, i - 1);
      return inv * Math.pow(1 + valim, i) + rendaAcum;
    });
    const cdiPatr = anos.map((i) => {
      let v = inv;
      for (let j = 0; j < i; j++) v *= 1 + (cdiArr[Math.min(j, cdiArr.length - 1)] / 100) * 0.85;
      return v;
    });
    const ntnbPatr = anos.map((i) => {
      let v = inv;
      for (let j = 0; j < i; j++) {
        const rate = (ipcaArr[Math.min(j, ipcaArr.length - 1)] / 100 + 0.06) * 0.85;
        v *= 1 + rate;
      }
      return v;
    });
    const ipcaPatr = anos.map((i) => {
      let v = inv;
      for (let j = 0; j < i; j++) v *= 1 + ipcaArr[Math.min(j, ipcaArr.length - 1)] / 100;
      return v;
    });
    const ipcaAcum = (i: number) => {
      let v = 1;
      for (let j = 0; j < i; j++) v *= 1 + ipcaArr[Math.min(j, ipcaArr.length - 1)] / 100;
      return v;
    };
    const evol = anos.map((i) => ({
      label: i === 0 ? "Hoje" : `Ano ${i}`,
      Imovel: imPatr[i],
      CDI: cdiPatr[i],
      NTNB: ntnbPatr[i],
      IPCA: ipcaPatr[i],
    }));
    const real = anos.map((i) => ({
      label: i === 0 ? "Hoje" : `Ano ${i}`,
      Imovel: (imPatr[i] / inv / ipcaAcum(i) - 1) * 100,
      CDI: (cdiPatr[i] / inv / ipcaAcum(i) - 1) * 100,
      NTNB: (ntnbPatr[i] / inv / ipcaAcum(i) - 1) * 100,
    }));
    let breakeven: string | null = null;
    for (let v = 0; v <= 20; v += 0.1) {
      let rA = 0;
      let p10 = 0;
      for (let i = 0; i <= 10; i++) {
        if (i > 0) rA += inv * cap * Math.pow(1 + reaj, i - 1);
        p10 = inv * Math.pow(1 + v / 100, i) + rA;
      }
      if (p10 >= cdiPatr[10]) {
        breakeven = v.toFixed(1);
        break;
      }
    }
    return { evol, real, imPatr, cdiPatr, ntnbPatr, ipcaPatr, breakeven };
  }, [inv, valim, reaj, cap, cdiArr, ipcaArr]);

  const cdiBars = [
    { label: "Atual", v: d.cdiAtual },
    { label: "2026", v: d.cdiProjeto2026 },
    { label: "2027", v: d.cdiProjeto2027 },
    { label: "2028", v: d.cdiProjeto2028plus },
    { label: "2029", v: d.cdiProjeto2028plus },
    { label: "2030+", v: d.cdiProjeto2028plus },
  ];

  const final = data.imPatr[10];
  const finalCdi = data.cdiPatr[10];
  const winnerIm = final >= finalCdi;

  const premissas = PREMISSAS_LABELS(d);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <TrendingUp className="text-slate-700" />
        <h2 className="text-2xl font-bold text-slate-900">Comparativo: Imóvel vs CDI vs NTN-B</h2>
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-1">
          <h3 className="font-semibold text-slate-900 mb-3">Premissas macro</h3>
          <div className="text-xs">
            <div className="grid grid-cols-12 font-medium text-slate-500 border-b pb-1 mb-1">
              <div className="col-span-6">Parâmetro</div>
              <div className="col-span-3">Valor</div>
              <div className="col-span-3">Fonte</div>
            </div>
            {premissas.map((p) => (
              <div key={p.p} className="grid grid-cols-12 py-1 border-b border-slate-100">
                <div className="col-span-6 text-slate-700">{p.p}</div>
                <div className="col-span-3 font-medium">{p.v}</div>
                <div className="col-span-3 text-slate-500">{p.f}</div>
              </div>
            ))}
          </div>
        </Card>

        <Card className="lg:col-span-2">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold text-slate-900">Sliders de sensibilidade</h3>
            <button onClick={reset} className="inline-flex items-center gap-1 text-xs text-slate-600 hover:text-slate-900">
              <RotateCcw size={12} /> Resetar premissas
            </button>
          </div>
          <div className="space-y-4">
            <SliderRow
              label="Investimento inicial"
              value={fmtBRLM(inv)}
              min={Math.max(100, inv * 0.5)}
              max={Math.max(inv * 1.5, inv + 1000)}
              step={10}
              v={inv}
              onChange={setInv}
            />
            <SliderRow
              label="Valorização imóvel a.a."
              value={fmtPct(valim * 100)}
              min={0}
              max={14}
              step={0.5}
              v={valim * 100}
              onChange={(x) => setValim(x / 100)}
            />
            <SliderRow
              label="Reajuste aluguel a.a. ⚠"
              value={fmtPct(reaj * 100)}
              min={0}
              max={8}
              step={0.5}
              v={reaj * 100}
              onChange={(x) => setReaj(x / 100)}
            />
          </div>
          <div className="mt-4 p-3 rounded-lg bg-slate-900 text-white text-sm">
            Valorização mínima para empatar com CDI:{" "}
            <span className="font-bold text-green-400">{data.breakeven ? `${data.breakeven}% a.a.` : "—"}</span>
          </div>
        </Card>
      </div>

      <Card>
        <h3 className="font-semibold text-slate-900 mb-3">Evolução patrimonial (10 anos)</h3>
        <ResponsiveContainer width="100%" height={340}>
          <ComposedChart data={data.evol}>
            <CartesianGrid stroke="#f1f5f9" />
            <XAxis dataKey="label" tick={{ fontSize: 12 }} />
            <YAxis tick={{ fontSize: 12 }} tickFormatter={(v) => `R$ ${(v / 1000).toFixed(1)}M`} />
            <Tooltip formatter={(v: number) => fmtBRLM(v)} contentStyle={{ background: "#fff", border: "1px solid #e2e8f0" }} />
            <Legend />
            <Area type="monotone" dataKey="Imovel" fill="#86efac" stroke="#16a34a" strokeWidth={2} name="Imóvel" />
            <Line type="monotone" dataKey="CDI" stroke="#2563eb" strokeDasharray="6 3" strokeWidth={2} dot={false} name="CDI líquido" />
            <Line type="monotone" dataKey="NTNB" stroke="#d97706" strokeDasharray="3 3" strokeWidth={2} dot={false} name="NTN-B" />
            <Line type="monotone" dataKey="IPCA" stroke="#94a3b8" strokeDasharray="2 4" strokeWidth={2} dot={false} name="IPCA puro" />
          </ComposedChart>
        </ResponsiveContainer>
      </Card>

      <div className="grid lg:grid-cols-2 gap-6">
        <Card>
          <h3 className="font-semibold text-slate-900 mb-3">CDI ano a ano</h3>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={cdiBars}>
              <CartesianGrid stroke="#f1f5f9" />
              <XAxis dataKey="label" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 12 }} domain={[0, 17]} />
              <Tooltip formatter={(v: number) => `${v}%`} />
              <Bar dataKey="v" fill="#2563eb" label={{ position: "top", fontSize: 11 }} />
            </BarChart>
          </ResponsiveContainer>
          <p className="text-xs text-slate-500 mt-2">
            Curva do Boletim Focus. CDI alto agora, mas cai — reduz sua vantagem no longo prazo.
          </p>
        </Card>

        <Card>
          <h3 className="font-semibold text-slate-900 mb-3">Retorno real acumulado (acima da inflação)</h3>
          <ResponsiveContainer width="100%" height={260}>
            <LineChart data={data.real}>
              <CartesianGrid stroke="#f1f5f9" />
              <XAxis dataKey="label" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 12 }} tickFormatter={(v) => `${v.toFixed(0)}%`} />
              <Tooltip formatter={(v: number) => `${v.toFixed(1)}%`} />
              <ReferenceLine y={0} stroke="#94a3b8" strokeDasharray="3 3" />
              <Legend />
              <Line type="monotone" dataKey="Imovel" stroke="#16a34a" strokeWidth={2} name="Imóvel real" />
              <Line type="monotone" dataKey="CDI" stroke="#2563eb" strokeDasharray="6 3" strokeWidth={2} name="CDI real" />
              <Line type="monotone" dataKey="NTNB" stroke="#d97706" strokeDasharray="3 3" strokeWidth={2} name="NTN-B real" />
            </LineChart>
          </ResponsiveContainer>
        </Card>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className={winnerIm ? "border-2 border-green-500" : ""}>
          <p className="text-xs text-slate-500">Imóvel (10 anos)</p>
          <p className="text-xl font-bold text-green-700">{fmtBRLM(final)}</p>
        </Card>
        <Card className={!winnerIm ? "border-2 border-blue-500" : ""}>
          <p className="text-xs text-slate-500">CDI líquido</p>
          <p className="text-xl font-bold text-blue-700">{fmtBRLM(finalCdi)}</p>
        </Card>
        <Card>
          <p className="text-xs text-slate-500">NTN-B</p>
          <p className="text-xl font-bold text-amber-700">{fmtBRLM(data.ntnbPatr[10])}</p>
        </Card>
        <Card>
          <p className="text-xs text-slate-500">IPCA puro</p>
          <p className="text-xl font-bold text-slate-600">{fmtBRLM(data.ipcaPatr[10])}</p>
        </Card>
      </div>
    </div>
  );
}

const SliderRow = ({
  label, value, min, max, step, v, onChange,
}: {
  label: string; value: string; min: number; max: number; step: number; v: number; onChange: (x: number) => void;
}) => (
  <div>
    <div className="flex justify-between text-sm mb-1">
      <span className="text-slate-700">{label}</span>
      <span className="font-semibold text-slate-900">{value}</span>
    </div>
    <input
      type="range"
      min={min}
      max={max}
      step={step}
      value={v}
      onChange={(e) => onChange(parseFloat(e.target.value))}
      className="w-full accent-green-600"
    />
  </div>
);

// ---------- Page ----------
export default function AnaliseLeilao() {
  const nav = useNavigate();
  const [d, setD] = useState<DadosImovel | null>(() => getAtual());
  const [active, setActive] = useState("ficha");
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    if (!d) {
      nav("/analise-leilao", { replace: true });
    }
  }, [d, nav]);

  useEffect(() => {
    if (!d) return;
    const obs = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) setActive(e.target.id);
        });
      },
      { rootMargin: "-30% 0px -60% 0px" },
    );
    SECTIONS.forEach((s) => {
      const el = document.getElementById(s.id);
      if (el) obs.observe(el);
    });
    return () => obs.disconnect();
  }, [d]);

  if (!d) return null;

  const go = (id: string) => {
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth" });
    setMenuOpen(false);
  };

  const novaAnalise = () => {
    if (confirm("Deseja iniciar uma nova análise? Os dados atuais serão perdidos.")) {
      localStorage.removeItem("analiseLeilao_atual_v1");
      nav("/analise-leilao");
    }
  };
  const editar = () => nav("/analise-leilao");

  const cap = capRateNominal(d);
  const rendaAnual = d.aluguelMensalInicial * 12;
  const investTotal = (d.investimentoTotalMil || d.lanceMinimoMil * 1.075) * 1000;
  const payback = rendaAnual > 0 ? investTotal / rendaAnual : 0;
  const pm2 = precoPorM2(d);

  const rendaAcumData = Array.from({ length: 5 }, (_, i) => {
    let acum = 0;
    for (let j = 0; j <= i; j++) acum += rendaAnual * Math.pow(1.03, j);
    return { ano: `Ano ${i + 1}`, Renda: acum / 1000, Lance: d.lanceMinimoMil };
  });

  const correcaoData = Array.from({ length: 5 }, (_, i) => {
    let ipca = 0, igpm = 0, sem = 0;
    for (let j = 0; j <= i; j++) {
      ipca += rendaAnual * Math.pow(1.05, j);
      igpm += rendaAnual * Math.pow(1.04, j);
      sem += rendaAnual;
    }
    return { ano: `Ano ${i + 1}`, "IPCA 5%": ipca / 1000, "IGPM 4%": igpm / 1000, "Sem reajuste": sem / 1000 };
  });
  const realData = Array.from({ length: 6 }, (_, i) => ({
    ano: i === 0 ? "Hoje" : `Ano ${i}`,
    "Com IPCA": d.aluguelMensalInicial,
    "Sem reajuste": d.aluguelMensalInicial / Math.pow(1.05, i),
  }));

  const mostraVenal = d.valorVenalMil > 0;
  const mostraMercado = d.valorMercadoMinMil > 0 || d.valorMercadoMaxMil > 0;
  const descontoMin = mostraMercado && d.valorMercadoMaxMil > 0
    ? ((d.valorMercadoMaxMil - d.lanceMinimoMil) / d.valorMercadoMaxMil) * 100 : null;
  const descontoMax = mostraMercado && d.valorMercadoMinMil > 0
    ? ((d.valorMercadoMinMil - d.lanceMinimoMil) / d.valorMercadoMinMil) * 100 : null;

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="lg:hidden sticky top-0 z-40 bg-white border-b flex items-center justify-between p-3">
        <span className="font-semibold text-slate-900 text-sm">Análise Leilão</span>
        <button onClick={() => setMenuOpen((o) => !o)}>
          {menuOpen ? <X size={20} /> : <Menu size={20} />}
        </button>
      </div>
      {menuOpen && (
        <div className="lg:hidden bg-white border-b p-3 space-y-2">
          <button onClick={novaAnalise} className="block w-full text-left text-sm py-1 text-primary font-medium">
            ← Nova análise
          </button>
          <button onClick={editar} className="block w-full text-left text-sm py-1 text-slate-700">
            Editar dados
          </button>
          {SECTIONS.map((s) => (
            <button key={s.id} onClick={() => go(s.id)} className="block w-full text-left text-sm py-1 text-slate-700">
              {s.label}
            </button>
          ))}
        </div>
      )}

      <div className="flex max-w-[1400px] mx-auto">
        <aside className="hidden lg:block w-60 sticky top-0 self-start h-screen p-6 border-r border-slate-200 bg-white">
          <button
            onClick={novaAnalise}
            className="flex items-center gap-1 text-xs text-slate-600 hover:text-slate-900 mb-4"
          >
            <ArrowLeft size={12} /> Nova análise
          </button>
          <div className="text-sm font-bold text-slate-900 mb-4">Análise de Investimento</div>
          <nav className="space-y-1">
            {SECTIONS.map((s) => (
              <button
                key={s.id}
                onClick={() => go(s.id)}
                className={`block w-full text-left text-sm py-2 pl-3 border-l-2 transition-colors ${
                  active === s.id
                    ? "border-green-600 text-slate-900 font-semibold bg-slate-50"
                    : "border-transparent text-slate-600 hover:text-slate-900"
                }`}
              >
                {s.label}
              </button>
            ))}
          </nav>
          <button
            onClick={editar}
            className="mt-6 inline-flex items-center gap-1 text-xs text-slate-600 hover:text-slate-900"
          >
            <Pencil size={12} /> Editar dados
          </button>
        </aside>

        <main className="flex-1 min-w-0 p-4 lg:p-8 space-y-12">
          <SectionWrap id="ficha">
            <div className="rounded-2xl bg-slate-900 text-white p-8 lg:p-10 grid lg:grid-cols-3 gap-6">
              <div className="lg:col-span-2 space-y-4">
                <div className="flex items-center gap-2 flex-wrap">
                  <Badge className="bg-green-500/20 text-green-300 border border-green-500/40">
                    Oportunidade de Leilão
                  </Badge>
                  <button
                    onClick={editar}
                    className="ml-auto inline-flex items-center gap-1 text-xs bg-white/10 hover:bg-white/20 text-white px-3 py-1.5 rounded-full"
                  >
                    <Pencil size={12} /> Editar dados
                  </button>
                </div>
                <h1 className="text-3xl lg:text-4xl font-bold">{d.nome || "—"}</h1>
                <p className="text-slate-300">{d.endereco}</p>
                {d.leilao && <p className="text-xs text-slate-400">{d.leilao}</p>}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-4">
                  {[
                    ["Área construída", d.areaConst ? `${d.areaConst} m²` : "—"],
                    ["Área do lote", d.areaLote ? `${d.areaLote} m²` : "—"],
                    ["Testada", d.testada ? `${d.testada} m` : "—"],
                    ["Tipo", d.tipo || "—"],
                    ["Estrutura", d.estrutura],
                    ["Conservação", d.estadoConservacao],
                    ["Matrícula", d.matricula || "—"],
                    ["Locatário", d.locatario || "—"],
                  ].map(([k, v]) => (
                    <div key={k}>
                      <p className="text-xs text-slate-400">{k}</p>
                      <p className="text-sm font-medium">{v}</p>
                    </div>
                  ))}
                </div>
                <div className="flex flex-wrap gap-2 pt-2">
                  <Badge className="bg-blue-500/20 text-blue-300">Locação simultânea</Badge>
                  {d.prazoLocacaoMeses > 0 && (
                    <Badge className="bg-green-500/20 text-green-300">
                      Renda garantida {d.prazoLocacaoMeses} meses
                    </Badge>
                  )}
                  <Badge className="bg-amber-500/20 text-amber-300">Pagamento à vista</Badge>
                </div>
              </div>
              <div className="bg-slate-700/50 rounded-xl flex items-center justify-center min-h-[200px]">
                <Building2 size={80} className="text-slate-500" />
              </div>
            </div>
          </SectionWrap>

          <SectionWrap id="preco">
            <h2 className="text-2xl font-bold text-slate-900 mb-4">Preço: leilão vs mercado</h2>
            <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
              <Card>
                <p className="text-xs text-slate-500">Lance mínimo</p>
                <p className="text-2xl font-bold text-slate-900">{fmtBRLM(d.lanceMinimoMil * 1000)}</p>
                {pm2 > 0 && <p className="text-xs text-slate-500 mt-1">≈ {fmtBRL(pm2)}/m²</p>}
              </Card>
              {mostraVenal && (
                <Card>
                  <p className="text-xs text-slate-500">Valor venal (IPTU)</p>
                  <p className="text-2xl font-bold text-slate-900">{fmtBRLM(d.valorVenalMil * 1000)}</p>
                </Card>
              )}
              {mostraMercado && (
                <Card>
                  <p className="text-xs text-slate-500">Valor de mercado estimado</p>
                  <p className="text-2xl font-bold text-slate-900">
                    {d.valorMercadoMinMil > 0 && d.valorMercadoMaxMil > 0
                      ? `${fmtBRLM(d.valorMercadoMinMil * 1000)} – ${fmtBRLM(d.valorMercadoMaxMil * 1000)}`
                      : fmtBRLM(((d.valorMercadoMinMil || d.valorMercadoMaxMil) * 1000))}
                  </p>
                </Card>
              )}
              {descontoMin !== null && descontoMin > 0 && (
                <Card>
                  <p className="text-xs text-slate-500">Desconto vs mercado</p>
                  <p className="text-2xl font-bold text-green-700">
                    {descontoMin && descontoMax
                      ? `~${descontoMin.toFixed(0)}–${descontoMax.toFixed(0)}%`
                      : `~${descontoMin?.toFixed(0)}%`}
                  </p>
                  <Badge className="bg-green-100 text-green-700 mt-2">Margem de segurança</Badge>
                </Card>
              )}
            </div>
          </SectionWrap>

          <SectionWrap id="renda">
            <h2 className="text-2xl font-bold text-slate-900 mb-4">Renda e locação simultânea</h2>
            <Card className="border-2 border-green-500">
              <Badge className="bg-green-100 text-green-700 mb-3">Renda contratada pelo edital</Badge>
              <div className="grid md:grid-cols-3 gap-6 mt-2">
                <div>
                  <p className="text-xs text-slate-500">Aluguel mensal</p>
                  <p className="text-2xl font-bold text-slate-900">{fmtBRL(d.aluguelMensalInicial)}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-500">Renda anual bruta</p>
                  <p className="text-2xl font-bold text-slate-900">{fmtBRL(rendaAnual)}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-500">Cap rate nominal</p>
                  <p className="text-2xl font-bold text-green-700">{fmtPct(cap)} a.a.</p>
                </div>
              </div>
              <p className="text-xs text-slate-500 mt-4 border-t pt-3">
                Locatário: {d.locatario || "—"} | Prazo: até {d.prazoLocacaoMeses} meses
              </p>
            </Card>
            <Card className="mt-6">
              <h3 className="font-semibold text-slate-900 mb-3">Renda acumulada por ano (R$ mil)</h3>
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={rendaAcumData}>
                  <CartesianGrid stroke="#f1f5f9" />
                  <XAxis dataKey="ano" />
                  <YAxis tickFormatter={(v) => `${(v / 1000).toFixed(1)}M`} />
                  <Tooltip formatter={(v: number) => `R$ ${(v / 1000).toFixed(2)}M`} />
                  <Legend />
                  <ReferenceLine
                    y={d.lanceMinimoMil}
                    stroke="#64748b"
                    strokeDasharray="4 4"
                    label={{ value: "Lance mínimo", fontSize: 11, fill: "#64748b" }}
                  />
                  <Bar dataKey="Renda" fill="#16a34a" name="Renda acumulada" />
                </BarChart>
              </ResponsiveContainer>
            </Card>
          </SectionWrap>

          <SectionWrap id="correcao">
            <h2 className="text-2xl font-bold text-slate-900 mb-4">Risco crítico: correção monetária</h2>
            <div className="bg-red-50 border border-red-300 rounded-xl p-4 flex gap-3 mb-6">
              <AlertTriangle className="text-red-600 shrink-0" />
              <p className="text-sm text-red-900">
                Contratos com entes estatais frequentemente têm reajuste limitado por processo interno
                ou simplesmente omissão. O reajuste depende de prévia manifestação formal do locador
                — se o locatário não solicitar, caduca sem retroatividade.
              </p>
            </div>
            <div className="grid lg:grid-cols-2 gap-6">
              <Card>
                <h3 className="font-semibold text-slate-900 mb-3">Renda acumulada por cenário</h3>
                <ResponsiveContainer width="100%" height={260}>
                  <BarChart data={correcaoData}>
                    <CartesianGrid stroke="#f1f5f9" />
                    <XAxis dataKey="ano" />
                    <YAxis tickFormatter={(v) => `${(v / 1000).toFixed(1)}M`} />
                    <Tooltip formatter={(v: number) => `R$ ${(v / 1000).toFixed(2)}M`} />
                    <Legend />
                    <Bar dataKey="IPCA 5%" fill="#16a34a" />
                    <Bar dataKey="IGPM 4%" fill="#2563eb" />
                    <Bar dataKey="Sem reajuste" fill="#dc2626" />
                  </BarChart>
                </ResponsiveContainer>
              </Card>
              <Card>
                <h3 className="font-semibold text-slate-900 mb-3">Aluguel real deflacionado</h3>
                <ResponsiveContainer width="100%" height={260}>
                  <LineChart data={realData}>
                    <CartesianGrid stroke="#f1f5f9" />
                    <XAxis dataKey="ano" />
                    <YAxis tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
                    <Tooltip formatter={(v: number) => fmtBRL(v)} />
                    <Legend />
                    <Line dataKey="Com IPCA" stroke="#16a34a" strokeWidth={2} />
                    <Line dataKey="Sem reajuste" stroke="#dc2626" strokeWidth={2} strokeDasharray="5 5" />
                  </LineChart>
                </ResponsiveContainer>
              </Card>
            </div>
          </SectionWrap>

          <SectionWrap id="riscos">
            <h2 className="text-2xl font-bold text-slate-900 mb-4 flex items-center gap-2">
              <ShieldAlert /> Mapa de riscos
            </h2>
            <div className="space-y-3">
              {RISCOS.map((r) => {
                const sev = r.severidade;
                const borderC = sev === "Alto" ? "border-red-500" : sev === "Médio" ? "border-yellow-500" : "border-green-500";
                const badgeC = sev === "Alto" ? "bg-red-100 text-red-700" : sev === "Médio" ? "bg-yellow-100 text-yellow-700" : "bg-green-100 text-green-700";
                const dot = sev === "Alto" ? "🔴" : sev === "Médio" ? "🟡" : "🟢";
                return (
                  <Card key={r.titulo} className={`border-l-4 ${borderC}`}>
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <h4 className="font-semibold text-slate-900">{r.titulo}</h4>
                        <p className="text-sm text-slate-600 mt-1">{r.descricao}</p>
                      </div>
                      <Badge className={badgeC}>{dot} {sev}</Badge>
                    </div>
                  </Card>
                );
              })}
            </div>
          </SectionWrap>

          <SectionWrap id="comparativo">
            <Comparativo d={d} />
          </SectionWrap>

          <SectionWrap id="resumo">
            <h2 className="text-2xl font-bold text-slate-900 mb-4">Resumo executivo</h2>
            <Card className="border-2 border-green-500">
              <div className="grid md:grid-cols-3 gap-6">
                <div>
                  <p className="text-xs text-slate-500">Investimento total</p>
                  <p className="text-xl font-bold">{fmtBRLM(investTotal)}</p>
                  <p className="text-xs text-slate-500">lance + custos estimados</p>
                </div>
                <div>
                  <p className="text-xs text-slate-500">Renda bruta anual</p>
                  <p className="text-xl font-bold text-green-700">{fmtBRL(rendaAnual)}</p>
                  <p className="text-xs text-slate-500">contratada</p>
                </div>
                <div>
                  <p className="text-xs text-slate-500">Payback (renda pura)</p>
                  <p className="text-xl font-bold">{payback > 0 ? `~${payback.toFixed(1)} anos` : "—"}</p>
                  <p className="text-xs text-slate-500">sem valorização</p>
                </div>
              </div>
              <div className="mt-6 space-y-2">
                {[
                  `Cap rate de ${fmtPct(cap)} a.a. com renda contratada no ato da compra`,
                  `Locatário: ${d.locatario || "—"}`,
                  `Estado de conservação: ${d.estadoConservacao}`,
                  `Prazo de locação: ${d.prazoLocacaoMeses} meses`,
                ].map((t) => (
                  <div key={t} className="flex items-start gap-2 text-sm">
                    <CheckCircle2 className="text-green-600 shrink-0 mt-0.5" size={16} />
                    <span className="text-slate-700">{t}</span>
                  </div>
                ))}
              </div>
              <p className="text-xs text-slate-500 mt-6 border-t pt-3">
                Atualização das informações recomendada antes de qualquer decisão de investimento.
                Premissas macroeconômicas baseadas no Boletim Focus do Banco Central.
              </p>
            </Card>
          </SectionWrap>
        </main>
      </div>
    </div>
  );
}
