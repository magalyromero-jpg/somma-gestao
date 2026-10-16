import { Fragment, useMemo, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import JSZip from "jszip";
import { Upload } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Bloco } from "@/components/operacional/Shared";
import { tableClasses } from "@/components/locacoes/tabela";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { dt } from "@/lib/locacoes";

const db = supabase as any;
const BUCKET = "loc-docs";
const SEM = "_sem_contrato";

const nomeArquivo = (p: string) => p.split("/").pop() ?? p;
const semExt = (n: string) => n.replace(/\.[^.]+$/, "");
/** Nome seguro para o armazenamento (que não aceita acentos e alguns símbolos). */
const chaveSegura = (n: string) =>
  n.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^A-Za-z0-9._\-() ]+/g, "_").replace(/\s+/g, " ").trim();
const normBusca = (s: string) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[.\s]/g, "");

type Arquivo = { caminho: string; pasta: string; nome: string; enviadoEm: string | null; docId: string | null; titulo: string; visivel: boolean };
type Imovel = { k: string; rotulo: string };
type Fila = { id: number; nome: string; blob: Blob; imovel: string; estado: "aguardando" | "enviando" | "enviado" | "existia" | "erro"; erro?: string };

async function carregar(edificioId: string, pastas: string[]): Promise<Arquivo[]> {
  const { data: regs } = await db.from("loc_documentos").select("id,storage_path,titulo,visivel_cliente").eq("edificio_id", edificioId);
  const porCaminho = new Map<string, any>((regs ?? []).map((r: any) => [r.storage_path, r]));
  const out: Arquivo[] = [];
  await Promise.all(pastas.map(async (p) => {
    const { data: arqs } = await supabase.storage.from(BUCKET).list(`${edificioId}/${p}`, { limit: 1000 });
    for (const a of arqs ?? []) {
      if (!a.id) continue; // subpasta
      const caminho = `${edificioId}/${p}/${a.name}`;
      const r = porCaminho.get(caminho);
      out.push({ caminho, pasta: p, nome: a.name, enviadoEm: a.created_at ?? null, docId: r?.id ?? null,
        titulo: r?.titulo ?? semExt(a.name), visivel: !!r?.visivel_cliente });
    }
  }));
  return out;
}

function Card({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="rounded-md border bg-card p-5">
    <div className="text-[11px] font-bold uppercase tracking-[0.06em] text-secondary">{label}</div>
    <div className="mt-3 text-[32px] font-extralight leading-none tabular-nums text-foreground">{children}</div>
  </div>;
}

export function Documentos({ data, admin }: { data: any; admin: boolean }) {
  const qc = useQueryClient();
  const { toast } = useToast();
  const edificioId = data.edificio.id;
  const refInput = useRef<HTMLInputElement>(null);
  const seq = useRef(0);
  const [fila, setFila] = useState<Fila[]>([]);

  const imoveis: Imovel[] = useMemo(() => {
    const arr = (data.contratosInfo ?? []).map((c: any) => ({ k: c.id as string, rotulo: `${c.unidades ?? "—"} · ${c.locatario ?? "—"}` }));
    arr.sort((a: Imovel, b: Imovel) => a.rotulo.localeCompare(b.rotulo, "pt-BR", { numeric: true }));
    return [...arr, { k: SEM, rotulo: "Garagens e Estacionamento" }];
  }, [data.contratosInfo]);

  const chave = ["loc-documentos", edificioId, imoveis.length];
  const { data: arquivos, isLoading } = useQuery({ queryKey: chave, queryFn: () => carregar(edificioId, imoveis.map((i) => i.k)) });

  const visiveis = (arquivos ?? []).filter((a) => admin || a.visivel);
  const blocos = imoveis.map((i) => ({ ...i, lista: visiveis.filter((a) => a.pasta === i.k).sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR", { numeric: true })) }))
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
      const caminho = `${edificioId}/${imovel}/${chaveSegura(item.nome)}`;
      const { error } = await supabase.storage.from(BUCKET).upload(caminho, item.blob, { upsert: false });
      if (error) {
        if (/already exists|Duplicate/i.test(error.message)) return atualizar(item.id, { estado: "existia" });
        throw error;
      }
      const { error: e2 } = await db.from("loc_documentos").insert({
        edificio_id: edificioId, contrato_id: imovel === SEM ? null : imovel, tipo: "outro",
        titulo: semExt(item.nome), storage_path: caminho, revisado: true, visivel_cliente: false,
      });
      if (e2) throw e2;
      atualizar(item.id, { estado: "enviado" });
      qc.invalidateQueries({ queryKey: ["loc-documentos", edificioId] });
    } catch (e) {
      atualizar(item.id, { estado: "erro", erro: (e as Error).message });
    }
  };

  const aplicarTodos = (imovel: string) => { for (const it of fila) if (it.estado === "aguardando") enviar(it, imovel); };

  const abrir = async (a: Arquivo) => {
    const { data: s, error } = await supabase.storage.from(BUCKET).createSignedUrl(a.caminho, 300);
    if (error) return toast({ title: "Não foi possível abrir", description: error.message, variant: "destructive" });
    window.open(s.signedUrl, "_blank");
  };

  const alternarVisivel = async (a: Arquivo, v: boolean) => {
    const { error } = a.docId
      ? await db.from("loc_documentos").update({ visivel_cliente: v }).eq("id", a.docId)
      : await db.from("loc_documentos").insert({ edificio_id: edificioId, contrato_id: a.pasta === SEM ? null : a.pasta, tipo: "outro",
          titulo: a.titulo, storage_path: a.caminho, revisado: true, visivel_cliente: v });
    if (error) return toast({ title: "Não foi possível alterar", description: error.message, variant: "destructive" });
    qc.invalidateQueries({ queryKey: ["loc-documentos", edificioId] });
  };

  if (isLoading) return <p className="text-sm text-muted-foreground">Carregando documentos…</p>;

  const ESTADO: Record<Fila["estado"], string> = { aguardando: "", enviando: "Enviando…", enviado: "Enviado", existia: "Já existia", erro: "Erro" };

  return <div className="space-y-4">
    <div className="grid gap-4 sm:grid-cols-2">
      <Card label="Documentos Anexados">{visiveis.length}</Card>
      <Card label="Imóveis com Documento">{blocos.length}</Card>
    </div>

    {admin && <Bloco titulo="Anexar Arquivos">
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
        {fila.some((f) => f.estado === "aguardando") && <div className="flex flex-wrap items-center gap-2">
          <span className="font-medium">Aplicar o Mesmo Imóvel a Todos:</span>
          <SeletorImovel imoveis={imoveis} onEscolher={aplicarTodos} />
        </div>}
        {fila.map((f) => <div key={f.id} className="flex flex-wrap items-center gap-2">
          <span className="break-all">{f.nome}</span>
          {f.estado === "aguardando"
            ? <SeletorImovel imoveis={imoveis} onEscolher={(k) => enviar(f, k)} />
            : <span className={cn("op-tag", f.estado === "enviado" ? "op-tag-green" : f.estado === "erro" ? "op-tag-red" : "op-tag-gray")}>
                {ESTADO[f.estado]}{f.imovel ? ` · ${imoveis.find((i) => i.k === f.imovel)?.rotulo ?? ""}` : ""}{f.erro ? ` · ${f.erro}` : ""}
              </span>}
        </div>)}
      </div>}
    </Bloco>}

    <Bloco titulo="Documentos por Imóvel">
      {blocos.length === 0 ? <p className="text-sm text-muted-foreground">Nenhum documento.</p> :
      <div className={tableClasses.wrap}><table className={tableClasses.table}><thead><tr className={tableClasses.head}>
        {["Nome", "Data de Envio", ...(admin ? ["Visível ao Cliente"] : []), "Arquivo"].map((h) => <th key={h} className={tableClasses.th}>{h}</th>)}
      </tr></thead><tbody>
        {blocos.map((b) => <Fragment key={b.k}>
          <tr><td colSpan={admin ? 4 : 3} className="border-b bg-muted/40 px-[10px] py-2 text-xs font-medium text-muted-foreground">
            {b.rotulo} · {b.lista.length} {b.lista.length === 1 ? "documento" : "documentos"}
          </td></tr>
          {b.lista.map((a) => <tr key={a.caminho}>
            <td className={cn(tableClasses.td, "font-medium")}>{a.titulo}</td>
            <td className={cn(tableClasses.td, "tabular-nums")}>{a.enviadoEm ? dt(a.enviadoEm.slice(0, 10)) : "—"}</td>
            {admin && <td className={tableClasses.td}><Switch checked={a.visivel} onCheckedChange={(v) => alternarVisivel(a, v)} /></td>}
            <td className={tableClasses.td}><button className="text-xs font-medium text-foreground underline-offset-2 hover:underline" onClick={() => abrir(a)}>Abrir</button></td>
          </tr>)}
        </Fragment>)}
      </tbody></table></div>}
    </Bloco>
  </div>;
}

function SeletorImovel({ imoveis, onEscolher }: { imoveis: Imovel[]; onEscolher: (k: string) => void }) {
  const [busca, setBusca] = useState("");
  const filtrados = imoveis.filter((i) => !busca || normBusca(i.rotulo).includes(normBusca(busca)));
  const cls = "rounded border border-input bg-card px-2 py-1 text-xs text-foreground";
  return <>
    <input name="imovel-busca" autoComplete="off" placeholder="Buscar imóvel" value={busca} onChange={(e) => setBusca(e.target.value)} className={cn(cls, "w-[120px]")} />
    <select name="imovel-destino" autoComplete="off" value="" onChange={(e) => e.target.value && onEscolher(e.target.value)} className={cls}>
      <option value="">Imóvel…</option>
      {filtrados.map((i) => <option key={i.k} value={i.k}>{i.rotulo}</option>)}
    </select>
  </>;
}
