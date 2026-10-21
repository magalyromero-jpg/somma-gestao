import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import JSZip from "jszip";
import { Upload } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Bloco } from "@/components/operacional/Shared";
import { tableClasses } from "@/components/locacoes/tabela";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { VisorPdf } from "@/components/locacoes/VisorPdf";
import { Button } from "@/components/ui/button";
import { PropostaDocumento } from "@/components/locacoes/PropostaDocumento";
import { Leitura, lerAutomaticamente } from "@/lib/leituraDocumento";
import { dt } from "@/lib/locacoes";

const db = supabase as any;
const BUCKET = "loc-docs";
const SEM = "_sem_contrato";

const nomeArquivo = (p: string) => p.split("/").pop() ?? p;
/** Nome seguro para o armazenamento (que não aceita acentos e alguns símbolos). */
const chaveSegura = (n: string) =>
  n.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^A-Za-z0-9._\-() ]+/g, "_").replace(/\s+/g, " ").trim();
const normBusca = (s: string) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[.\s]/g, "");
/** Lojas primeiro, depois Salas em ordem numérica; o bloco sem contrato vai por último. */
const grupo = (i: Imovel) => (i.k === SEM ? 2 : /^\s*loja/i.test(i.cabecalho) ? 0 : 1);
const primeiroNum = (s: string) => Number((s.match(/\d+/) ?? ["0"])[0]);
/** Data no início do nome do arquivo (AAAA.MM.DD) → { iso, br }. */
const dataDoNome = (n: string) => {
  const m = n.match(/^(\d{4})[._-](\d{2})[._-](\d{2})/);
  return m ? { iso: `${m[1]}-${m[2]}-${m[3]}`, br: `${m[3]}/${m[2]}/${m[1]}` } : null;
};
/** Nome legível a partir do nome do arquivo no armazenamento. */
const nomeLegivel = (n: string) => {
  const ext = (n.match(/\.[^.]+$/) ?? [""])[0];
  let b = n.slice(0, n.length - ext.length).replace(/^\d{4}[._-]\d{2}[._-]\d{2}/, "");
  b = b.replace(/([A-Za-z])__([A-Za-z])/g, "$1$2").replace(/_-_/g, " - ").replace(/_/g, " ").replace(/\s+/g, " ").replace(/^\s*-\s*/, "").trim();
  return b + ext;
};
const ordemImovel = (a: Imovel, b: Imovel) =>
  grupo(a) - grupo(b) || primeiroNum(a.cabecalho) - primeiroNum(b.cabecalho) || a.cabecalho.localeCompare(b.cabecalho, "pt-BR", { numeric: true });


type Arquivo = { documentoId?: string; caminho: string; pasta: string; nome: string; data: string; exibido: string; salvarComo: string };
type Imovel = { k: string; cabecalho: string; rotulo: string };
type Fila = { id: number; nome: string; blob: Blob; imovel: string; estado: "aguardando" | "enviando" | "enviado" | "existia" | "erro"; erro?: string };

async function carregar(edificioId: string, pastas: string[]): Promise<Arquivo[]> {
  const { data: regs } = await db.from("loc_documentos").select("id,storage_path,titulo").eq("edificio_id", edificioId);
  const porCaminho = new Map<string, any>((regs ?? []).map((r: any) => [r.storage_path, r]));
  const out: Arquivo[] = [];
  await Promise.all(pastas.map(async (p) => {
    const { data: arqs } = await supabase.storage.from(BUCKET).list(`${edificioId}/${p}`, { limit: 1000 });
    for (const a of arqs ?? []) {
      if (!a.id) continue; // subpasta
      const caminho = `${edificioId}/${p}/${a.name}`;
      const r = porCaminho.get(caminho);
      const d = dataDoNome(a.name);
      const base = r?.titulo ? String(r.titulo) : nomeLegivel(a.name);
      out.push({ documentoId: r?.id, caminho, pasta: p, nome: a.name, data: d?.iso ?? "", exibido: d ? `${d.br} · ${base}` : base,
        salvarComo: r?.titulo && /\.[a-z0-9]+$/i.test(String(r.titulo)) ? String(r.titulo) : a.name });
    }
  }));
  return out;
}

export function Documentos({ data, admin }: { data: any; admin: boolean }) {
  const qc = useQueryClient();
  const { toast } = useToast();
  const edificioId = data.edificio.id;
  const refInput = useRef<HTMLInputElement>(null);
  const seq = useRef(0);
  const [fila, setFila] = useState<Fila[]>([]);
  const [visor, setVisor] = useState<{ titulo: string; blob: Blob } | null>(null);
  const [movendo, setMovendo] = useState<Arquivo | null>(null);
  const [apagando, setApagando] = useState<Arquivo | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const [revisando, setRevisando] = useState<{ leitura: Leitura; arquivo: Arquivo } | null>(null);
  const [iniciando, setIniciando] = useState<Set<string>>(new Set());
  const { data: leituras = [] } = useQuery<Leitura[]>({
    queryKey: ["loc-leituras", edificioId], enabled: admin,
    queryFn: async () => {
      const r = await db.from("loc_leituras_documento").select("*").eq("edificio_id", edificioId).order("criado_em", { ascending: false });
      if (r.error) throw r.error;
      return r.data ?? [];
    },
    refetchInterval: q => (q.state.data?.some(l => l.status === "lendo") || iniciando.size > 0) ? 3000 : false,
  });
  const ultimaLeitura = new Map<string, Leitura>();
  for (const l of leituras) if (!ultimaLeitura.has(l.documento_id)) ultimaLeitura.set(l.documento_id, l);
  const ler = async (documentoId: string) => {
    if (iniciando.has(documentoId)) return;
    setIniciando(s => new Set(s).add(documentoId));
    try {
      const { data: resposta, error } = await supabase.functions.invoke("ler-documento-locacao", { body: { documento_id: documentoId } });
      if (error) {
        const context = (error as unknown as { context?: Response }).context;
        const details = context ? await context.json().catch(() => null) : null;
        throw new Error(details?.erro ?? error.message);
      }
      if (!(resposta instanceof ReadableStream)) throw new Error(resposta?.erro ?? "A leitura não retornou resposta");
      const reader = resposta.getReader(), decoder = new TextDecoder();
      let buffer = "";
      while (true) {
        const { done, value } = await reader.read(); if (done) break;
        buffer += decoder.decode(value, { stream: true });
        let i: number;
        while ((i = buffer.indexOf("\n\n")) >= 0) {
          const part = buffer.slice(0, i); buffer = buffer.slice(i + 2);
          const line = part.split("\n").find(l => l.startsWith("data: "));
          if (!line) continue;
          const event = JSON.parse(line.slice(6));
          if (part.startsWith("event: error")) throw new Error(event.erro);
          if (part.startsWith("event: started") || part.startsWith("event: complete")) qc.invalidateQueries({ queryKey: ["loc-leituras", edificioId] });
        }
      }
    } catch (e) {
      toast({ title: "Não foi possível ler", description: (e as Error).message, variant: "destructive" });
    } finally {
      setIniciando(s => { const next = new Set(s); next.delete(documentoId); return next; });
      qc.invalidateQueries({ queryKey: ["loc-leituras", edificioId] });
    }
  };

  const imoveis: Imovel[] = useMemo(() => {
    const arr = (data.contratosInfo ?? []).map((c: any) => {
      const unidades = String(c.unidades ?? "—");
      return { k: c.id as string, cabecalho: unidades, rotulo: unidades };
    });
    arr.sort(ordemImovel);
    return [...arr, { k: SEM, cabecalho: "Garagens e Estacionamento", rotulo: "Garagens e Estacionamento" }];
  }, [data.contratosInfo]);


  const chave = ["loc-documentos", edificioId, imoveis.length];
  const { data: arquivos, isLoading } = useQuery({ queryKey: chave, queryFn: () => carregar(edificioId, imoveis.map((i) => i.k)) });

  const visiveis = arquivos ?? [];
  const blocos = imoveis.map((i) => ({ ...i, lista: visiveis.filter((a) => a.pasta === i.k).sort((a, b) => (a.data || "9999").localeCompare(b.data || "9999") || a.nome.localeCompare(b.nome, "pt-BR", { numeric: true })) }))
    .filter((b) => b.lista.length);

  const adicionar = async (files: File[]) => {
    const novos: Fila[] = [];
    for (const f of files) {
      if (/\.zip$/i.test(f.name)) {
        const zip = await JSZip.loadAsync(f);
        for (const [caminho, e] of Object.entries(zip.files)) {
          const nome = nomeArquivo(caminho);
          if (e.dir || !/\.(pdf|docx)$/i.test(nome) || nome.startsWith("._")) continue;
          novos.push({ id: ++seq.current, nome, blob: await e.async("blob"), imovel: "", estado: "aguardando" });
        }
      } else if (/\.(pdf|docx)$/i.test(f.name)) novos.push({ id: ++seq.current, nome: f.name, blob: f, imovel: "", estado: "aguardando" });
    }
    setFila((q) => [...q, ...novos]);
  };

  const atualizar = (id: number, p: Partial<Fila>) => setFila((q) => q.map((x) => (x.id === id ? { ...x, ...p } : x)));

  const enviar = async (item: Fila, imovel: string) => {
    if (!imovel || item.estado === "enviado" || item.estado === "existia" || item.estado === "enviando") return;
    atualizar(item.id, { imovel, estado: "enviando" });
    try {
      const nomeSeguro = chaveSegura(item.nome);
      const caminho = `${edificioId}/${imovel}/${nomeSeguro}`;
      const { data: ja } = await supabase.storage.from(BUCKET).list(`${edificioId}/${imovel}`, { limit: 1000, search: nomeSeguro });
      if ((ja ?? []).some((x) => x.id && x.name === nomeSeguro)) return atualizar(item.id, { estado: "existia" });
      const { error } = await supabase.storage.from(BUCKET).upload(caminho, item.blob, { upsert: false });
      if (error) {
        if (/already exists|Duplicate/i.test(error.message)) return atualizar(item.id, { estado: "existia" });
        throw error;
      }
      const { data: criado, error: e2 } = await db.from("loc_documentos").insert({
        edificio_id: edificioId, contrato_id: imovel === SEM ? null : imovel, tipo: "outro",
        titulo: item.nome, storage_path: caminho, revisado: true, visivel_cliente: true,
      }).select("id").single();
      if (e2) throw e2;
      atualizar(item.id, { estado: "enviado" });
      qc.invalidateQueries({ queryKey: ["loc-documentos", edificioId] });
      if (admin && criado?.id && lerAutomaticamente(item.nome, imovel === SEM ? null : imovel)) void ler(criado.id);
    } catch (e) {
      atualizar(item.id, { estado: "erro", erro: (e as Error).message });
    }
  };

  const aplicarTodos = (imovel: string) => { for (const it of fila) if (it.estado === "aguardando") enviar(it, imovel); };

  const baixarBytes = async (a: Arquivo) => {
    const { data: blob, error } = await supabase.storage.from(BUCKET).download(a.caminho);
    if (error || !blob) {
      toast({ title: "Não foi possível abrir o arquivo", description: error?.message ?? "Arquivo não encontrado", variant: "destructive" });
      return null;
    }
    return blob;
  };

  const baixar = async (a: Arquivo) => {
    const blob = await baixarBytes(a);
    if (!blob) return;
    try {
      const url = URL.createObjectURL(blob);
      const el = document.createElement("a");
      el.href = url; el.download = a.salvarComo; document.body.appendChild(el); el.click(); el.remove();
      setTimeout(() => URL.revokeObjectURL(url), 60000);
    } catch {
      toast({ title: "Seu navegador bloqueou o download. Libere downloads para este site ou use outro navegador.", variant: "destructive" });
    }
  };

  const ver = async (a: Arquivo) => {
    const blob = await baixarBytes(a);
    if (blob) setVisor({ titulo: a.exibido, blob });
  };

  const limparVinculos = async (docId: string) => {
    const { error: e1 } = await db.from("loc_vigencias").update({ documento_id: null }).eq("documento_id", docId);
    if (e1) throw e1;
    const { error: e2 } = await db.from("loc_documentos_esperados").update({ documento_id: null }).eq("documento_id", docId);
    if (e2) throw e2;
  };

  const registroDo = async (caminho: string) => {
    const { data } = await db.from("loc_documentos").select("id").eq("storage_path", caminho).maybeSingle();
    return data?.id as string | undefined;
  };

  const mover = async (a: Arquivo, destino: string) => {
    setOcupado(true);
    try {
      const caminhoNovo = `${edificioId}/${destino}/${a.nome}`;
      const { data: ja } = await supabase.storage.from(BUCKET).list(`${edificioId}/${destino}`, { limit: 1000, search: a.nome });
      if ((ja ?? []).some((x) => x.id && x.name === a.nome)) {
        toast({ title: "Já existe um arquivo com esse nome nesse imóvel", variant: "destructive" });
        return;
      }
      const { error } = await supabase.storage.from(BUCKET).move(a.caminho, caminhoNovo);
      if (error) throw error;
      const docId = await registroDo(a.caminho);
      if (docId) {
        await limparVinculos(docId);
        const { error: e2 } = await db.from("loc_documentos").update({
          contrato_id: destino === SEM ? null : destino, storage_path: caminhoNovo,
        }).eq("id", docId);
        if (e2) throw e2;
      }
      setMovendo(null);
      toast({ title: `Documento movido para ${imoveis.find((i) => i.k === destino)?.cabecalho ?? destino}` });
      qc.invalidateQueries({ queryKey: ["loc-documentos", edificioId] });
    } catch (e) {
      toast({ title: "Não foi possível mover", description: (e as Error).message, variant: "destructive" });
    } finally {
      setOcupado(false);
    }
  };

  const apagar = async (a: Arquivo) => {
    setOcupado(true);
    try {
      const docId = await registroDo(a.caminho);
      if (docId) {
        await limparVinculos(docId);
        const { error: e1 } = await db.from("loc_documentos").delete().eq("id", docId);
        if (e1) throw e1;
      }
      const { error } = await supabase.storage.from(BUCKET).remove([a.caminho]);
      if (error) throw error;
      setApagando(null);
      toast({ title: "Documento apagado" });
      qc.invalidateQueries({ queryKey: ["loc-documentos", edificioId] });
    } catch (e) {
      toast({ title: "Não foi possível apagar", description: (e as Error).message, variant: "destructive" });
    } finally {
      setOcupado(false);
    }
  };

  if (isLoading) return <p className="text-sm text-muted-foreground">Carregando documentos…</p>;

  const ESTADO: Record<Fila["estado"], string> = { aguardando: "", enviando: "Enviando…", enviado: "Enviado", existia: "Já existia", erro: "Erro" };

  return <div className="space-y-4">
    {admin && <Bloco titulo="Anexar Arquivos" className="overflow-visible">
      <div role="button" tabIndex={0}
        onClick={() => refInput.current?.click()} onKeyDown={(e) => e.key === "Enter" && refInput.current?.click()}
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => { e.preventDefault(); adicionar([...e.dataTransfer.files]); }}
        className="flex cursor-pointer flex-col items-center gap-2 rounded-md border border-dashed border-input bg-card px-6 py-8 text-center">
        <Upload className="h-5 w-5 text-muted-foreground" strokeWidth={1.5} />
        <div className="text-sm font-medium">Solte aqui os arquivos (.pdf, .docx ou .zip)</div>
        <input ref={refInput} type="file" accept=".zip,.pdf,.docx" multiple className="hidden"
          onChange={(e) => { adicionar([...(e.target.files ?? [])]); e.target.value = ""; }} />
      </div>
      {fila.length > 0 && <div className="mt-3 space-y-2 text-xs">
        {fila.length >= 2 && fila.some((f) => f.estado === "aguardando") && <div className="flex flex-wrap items-center gap-2">
          <span className="font-medium">Aplicar o Mesmo Imóvel a Todos:</span>
          <SeletorImovel imoveis={imoveis} onEscolher={aplicarTodos} />
        </div>}
        {fila.map((f) => <div key={f.id} className="flex flex-wrap items-center gap-2">
          <span className="break-all">{f.nome}</span>
          {f.estado === "aguardando"
            ? <SeletorImovel imoveis={imoveis} onEscolher={(k) => enviar(f, k)} />
            : <span className={cn("op-tag", f.estado === "enviado" ? "op-tag-green" : f.estado === "erro" ? "op-tag-red" : f.estado === "existia" ? "op-tag-amber" : "op-tag-gray")}>
                {ESTADO[f.estado]}{f.imovel ? ` · ${imoveis.find((i) => i.k === f.imovel)?.rotulo ?? ""}` : ""}{f.erro ? ` · ${f.erro}` : ""}
              </span>}
        </div>)}
        {fila.some((f) => ["enviado", "existia", "erro"].includes(f.estado)) && <div className="pt-1 text-muted-foreground">
          Enviados: {fila.filter((f) => f.estado === "enviado").length} · Já existiam: {fila.filter((f) => f.estado === "existia").length}
          {fila.some((f) => f.estado === "existia") && ` (${fila.filter((f) => f.estado === "existia").map((f) => f.nome).join(", ")})`}
          {" "}· Com erro: {fila.filter((f) => f.estado === "erro").length}
        </div>}
      </div>}
    </Bloco>}

    <Bloco titulo="Documentos por Imóvel">
      {blocos.length === 0 ? <p className="text-sm text-muted-foreground">Nenhum documento.</p> :
      <div className={tableClasses.wrap}><table className={tableClasses.table}><thead><tr className={tableClasses.head}>
        {["Nome", "Arquivo"].map((h) => <th key={h} className={tableClasses.th}>{h}</th>)}
      </tr></thead><tbody>
        {blocos.map((b) => <Fragment key={b.k}>
          <tr><td colSpan={2} className="border-b bg-muted/40 px-[10px] py-2 text-xs font-medium text-muted-foreground">
            {b.cabecalho} · {b.lista.length} {b.lista.length === 1 ? "documento" : "documentos"}
          </td></tr>
          {b.lista.map((a) => <tr key={a.caminho}>
            <td className={cn(tableClasses.td, "font-medium")}>{a.exibido}</td>
            <td className={tableClasses.td}><div className="flex flex-wrap items-center gap-3">
              {/\.pdf$/i.test(a.nome) && <button className="text-xs font-medium text-foreground underline-offset-2 hover:underline" onClick={() => ver(a)}>Ver</button>}
              <button className="text-xs font-medium text-foreground underline-offset-2 hover:underline" onClick={() => baixar(a)}>Baixar</button>
              {admin && <button className="text-xs font-medium text-foreground underline-offset-2 hover:underline" onClick={() => setMovendo(a)}>Mover</button>}
              {admin && <button className="text-xs font-medium text-destructive underline-offset-2 hover:underline" onClick={() => setApagando(a)}>Apagar</button>}
              {admin && a.pasta !== SEM && (a.documentoId ? (() => {
                const l = ultimaLeitura.get(a.documentoId);
                if (!/\.pdf$/i.test(a.nome)) return <span className="text-xs text-muted-foreground">Leitura automática disponível somente para PDF</span>;
                if (iniciando.has(a.documentoId) || l?.status === "lendo") return <span className="text-xs text-muted-foreground">Lendo…</span>;
                if (l?.status === "pendente") return <Button size="sm" onClick={() => setRevisando({ leitura: l, arquivo: a })}>Revisar Proposta</Button>;
                if (l?.status === "aplicada") return <span className="text-xs text-success">Aplicado em {dt(l.aplicado_em)}</span>;
                return <>{l?.status === "erro" && <span className="text-xs text-destructive">Não foi possível ler: {l.erro}</span>}<Button variant="outline" size="sm" onClick={() => a.documentoId && ler(a.documentoId)}>{l?.status === "erro" ? "Tentar de Novo" : "Ler"}</Button></>;
              })() : <span className="text-xs text-muted-foreground">Documento sem registro vinculado</span>)}
            </div></td>
          </tr>)}
        </Fragment>)}
      </tbody></table></div>}
    </Bloco>
    <VisorPdf titulo={visor?.titulo ?? ""} blob={visor?.blob ?? null} onFechar={() => setVisor(null)} />
    {admin && revisando && <PropostaDocumento key={revisando.leitura.id} leitura={revisando.leitura} nome={revisando.arquivo.nome}
      imovel={imoveis.find(i => i.k === revisando.arquivo.pasta)?.cabecalho ?? "—"} data={data} onFechar={() => setRevisando(null)} />}

    {movendo && <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/40 p-4" onClick={() => !ocupado && setMovendo(null)}>
      <div className="w-full max-w-md rounded-lg border bg-card p-5 shadow-lg" onClick={(e) => e.stopPropagation()}>
        <h3 className="text-sm font-semibold">Mover Documento</h3>
        <p className="mt-1 break-all text-xs text-muted-foreground">{movendo.nome}</p>
        <ListaMover imoveis={imoveis.filter((i) => i.k !== movendo.pasta)} ocupado={ocupado}
          onMover={(k) => mover(movendo, k)} onCancelar={() => setMovendo(null)} />
      </div>
    </div>}

    {apagando && <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/40 p-4" onClick={() => !ocupado && setApagando(null)}>
      <div className="w-full max-w-md rounded-lg border bg-card p-5 shadow-lg" onClick={(e) => e.stopPropagation()}>
        <h3 className="text-sm font-semibold">Apagar Documento</h3>
        <p className="mt-2 break-all text-sm">Apagar este documento? <span className="font-medium">{apagando.nome}</span>. Esta ação não pode ser desfeita.</p>
        <div className="mt-4 flex justify-end gap-2">
          <button className="rounded border border-input px-3 py-1.5 text-xs font-medium" disabled={ocupado} onClick={() => setApagando(null)}>Cancelar</button>
          <button className="rounded bg-destructive px-3 py-1.5 text-xs font-medium text-destructive-foreground" disabled={ocupado} onClick={() => apagar(apagando)}>{ocupado ? "Apagando…" : "Apagar"}</button>
        </div>
      </div>
    </div>}
  </div>;
}

function ListaMover({ imoveis, ocupado, onMover, onCancelar }: { imoveis: Imovel[]; ocupado: boolean; onMover: (k: string) => void; onCancelar: () => void }) {
  const [texto, setTexto] = useState("");
  const [filtro, setFiltro] = useState("");
  const [escolhido, setEscolhido] = useState<string | null>(null);
  const [aberto, setAberto] = useState(false);
  const [ativo, setAtivo] = useState(-1);
  const caixaRef = useRef<HTMLDivElement>(null);
  const listaRef = useRef<HTMLDivElement>(null);
  const filtrados = imoveis.filter((i) => !filtro || normBusca(i.rotulo).includes(normBusca(filtro)));

  useEffect(() => {
    if (!aberto) return;
    const fora = (e: MouseEvent) => { if (caixaRef.current && !caixaRef.current.contains(e.target as Node)) setAberto(false); };
    document.addEventListener("mousedown", fora);
    return () => document.removeEventListener("mousedown", fora);
  }, [aberto]);

  useEffect(() => {
    if (ativo < 0 || !listaRef.current) return;
    (listaRef.current.children[ativo] as HTMLElement | undefined)?.scrollIntoView({ block: "nearest" });
  }, [ativo]);

  const abrir = () => { if (!aberto) { setAberto(true); setFiltro(""); setAtivo(-1); } };
  const escolher = (i: Imovel) => { setEscolhido(i.k); setTexto(i.rotulo); setFiltro(""); setAberto(false); setAtivo(-1); };
  const teclas = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Escape") { if (aberto) { e.preventDefault(); e.stopPropagation(); setAberto(false); } return; }
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      if (!aberto) { abrir(); return; }
      if (!filtrados.length) return;
      setAtivo((a) => e.key === "ArrowDown" ? Math.min(a + 1, filtrados.length - 1) : Math.max(a - 1, 0));
      return;
    }
    if (e.key === "Enter" && aberto && ativo >= 0 && filtrados[ativo]) { e.preventDefault(); escolher(filtrados[ativo]); }
  };

  return <>
    <div ref={caixaRef}>
      <input name="imovel-destino" autoComplete="off" placeholder="Imóvel…" value={texto}
        onClick={abrir} onFocus={abrir} onKeyDown={teclas}
        onChange={(e) => { setTexto(e.target.value); setFiltro(e.target.value); setEscolhido(null); setAberto(true); setAtivo(-1); }}
        className="mt-3 w-full rounded border border-input bg-card px-2 py-1.5 text-xs" />
      {aberto && <div ref={listaRef} role="listbox" onMouseDown={(e) => e.preventDefault()}
        className="mt-2 max-h-[240px] overflow-y-auto rounded border border-input">
        {filtrados.length === 0 ? <p className="px-2 py-2 text-xs text-muted-foreground">Nenhum imóvel encontrado</p> :
          filtrados.map((i, idx) => <button key={i.k} type="button" role="option" aria-selected={idx === ativo} disabled={ocupado} tabIndex={-1}
            onClick={() => escolher(i)} onMouseEnter={() => setAtivo(idx)}
            className={cn("block w-full px-2 py-1.5 text-left text-xs hover:bg-muted", idx === ativo && "bg-muted")}>{i.rotulo}</button>)}
      </div>}
    </div>
    <div className="mt-4 flex justify-end gap-2">
      <button className="rounded border border-input px-3 py-1.5 text-xs font-medium" disabled={ocupado} onClick={onCancelar}>Cancelar</button>
      <button className="rounded bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground disabled:opacity-50"
        disabled={!escolhido || ocupado} onClick={() => escolhido && onMover(escolhido)}>{ocupado ? "Movendo…" : "Mover"}</button>
    </div>
  </>;
}

function SeletorImovel({ imoveis, onEscolher, desabilitado }: { imoveis: Imovel[]; onEscolher: (k: string) => void; desabilitado?: boolean }) {
  const [busca, setBusca] = useState("");
  const [aberto, setAberto] = useState(false);
  const filtrados = imoveis.filter((i) => !busca || normBusca(i.rotulo).includes(normBusca(busca)));
  return <Popover open={aberto} onOpenChange={setAberto}>
    <PopoverTrigger asChild>
      <button type="button" disabled={desabilitado} className="w-[320px] rounded border border-input bg-card px-2 py-1 text-left text-xs text-muted-foreground disabled:opacity-50">Imóvel…</button>
    </PopoverTrigger>
    <PopoverContent align="start" className="z-[120] w-[max(320px,var(--radix-popover-trigger-width))] p-0">
      <Command shouldFilter={false}>
        <CommandInput name="imovel-destino" autoComplete="off" placeholder="Digite para buscar" value={busca} onValueChange={setBusca} />
        <CommandList className="max-h-[320px] overflow-y-auto">
          <CommandEmpty>Nenhum imóvel encontrado</CommandEmpty>
          <CommandGroup>
            {filtrados.map((i) => <CommandItem key={i.k} value={i.k} onSelect={() => { onEscolher(i.k); setBusca(""); setAberto(false); }}>{i.rotulo}</CommandItem>)}
          </CommandGroup>
        </CommandList>
      </Command>
    </PopoverContent>
  </Popover>;
}
