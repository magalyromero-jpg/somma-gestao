import { useEffect, useMemo, useRef, useState } from "react";
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

const TIPO_LABEL: Record<string, string> = { contrato: "Contrato", aditivo: "Aditivo", garagem: "Garagem", encerramento: "Encerramento", outro: "Outro" };
const TIPO_DOC: Record<string, string> = { contrato: "contrato", aditivo: "aditivo", garagem: "outro", encerramento: "distrato", outro: "outro" };

const nomeArquivo = (p: string) => p.split("/").pop() ?? p;
const pastaDe = (p: string) => p.split("/").slice(0, -1).join("/");
const normNome = (s: string) => s.toLowerCase();
export const chaveNome = (nome: string) =>
  nomeArquivo(nome).replace(/\.(pdf|docx)$/i, "").normalize("NFC").toLowerCase().replace(/[^a-z0-9]/g, "");
const slugArquivo = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^A-Za-z0-9]+/g, "_").replace(/^_+|_+$/g, "");

type Item = {
  id: string; contrato_id: string | null; grupo: string; descricao: string; data_ref: string | null;
  situacao: string; detalhe: string | null; documento_id: string | null;
  storage_path: string | null; titulo: string | null;
};

async function carregarDocumentos(edificioId: string) {
  const { data: itens, error } = await db.from("loc_documentos_esperados")
    .select("id,contrato_id,grupo,descricao,data_ref,situacao,detalhe,documento_id,loc_documentos(storage_path,titulo)")
    .eq("edificio_id", edificioId);
  if (error) throw error;
  const lista: Item[] = (itens ?? []).map((e: any) => ({
    id: e.id, contrato_id: e.contrato_id, grupo: e.grupo, descricao: e.descricao, data_ref: e.data_ref,
    situacao: e.situacao, detalhe: e.detalhe, documento_id: e.documento_id,
    storage_path: e.loc_documentos?.storage_path ?? null, titulo: e.loc_documentos?.titulo ?? null,
  }));
  // verifica quais arquivos existem de fato no armazenamento
  const pastas = [...new Set(lista.filter((i) => i.storage_path).map((i) => pastaDe(i.storage_path!)))];
  const existentes = new Set<string>();
  await Promise.all(pastas.map(async (pasta) => {
    const { data: arqs } = await supabase.storage.from(BUCKET).list(pasta, { limit: 1000 });
    for (const a of arqs ?? []) existentes.add(`${pasta}/${normNome(a.name)}`);
  }));
  return lista.map((i) => ({ ...i, existe: !!i.storage_path && existentes.has(pastaDe(i.storage_path) + "/" + normNome(nomeArquivo(i.storage_path))) }));
}

type ItemComFlag = Item & { existe: boolean };

const situacaoDe = (i: ItemComFlag) =>
  i.documento_id && i.existe ? "Anexado" : i.situacao === "a_confirmar" && !i.existe ? "A Confirmar" : "Pendente";

const SIT_CLS: Record<string, string> = { Anexado: "op-tag-green", Pendente: "op-tag-amber", "A Confirmar": "op-tag-gray" };

function Card({ label, children, dica }: { label: string; children: React.ReactNode; dica?: string }) {
  return <div title={dica} className="rounded-md border bg-card p-5">
    <div className="text-[11px] font-bold uppercase tracking-[0.06em] text-secondary">{label}</div>
    <div className="mt-3 text-[32px] font-extralight leading-none tabular-nums text-foreground">{children}</div>
  </div>;
}

export function Documentos({ data, admin }: { data: any; admin: boolean }) {
  const qc = useQueryClient();
  const { toast } = useToast();
  const edificioId = data.edificio.id;
  const { data: itens, isLoading } = useQuery({ queryKey: ["loc-documentos", edificioId], queryFn: () => carregarDocumentos(edificioId) });
  const [soPendentes, setSoPendentes] = useState(false);
  const [progresso, setProgresso] = useState<{ feitos: number; total: number } | null>(null);
  const [resumo, setResumo] = useState<{ enviados: number; existentes: number; semCadastro: { nome: string; blob: Blob }[] } | null>(null);
  const refZip = useRef<HTMLInputElement>(null);
  const refRow = useRef<HTMLInputElement>(null);
  const [alvoRow, setAlvoRow] = useState<ItemComFlag | null>(null);

  const info = useMemo(() => new Map<string, any>((data.contratosInfo ?? []).map((c: any) => [c.id, c])), [data.contratosInfo]);

  const grupos = useMemo(() => {
    const mapa = new Map<string, ItemComFlag[]>();
    for (const i of itens ?? []) {
      if (soPendentes && situacaoDe(i) === "Anexado") continue;
      const k = i.contrato_id ?? "_sem";
      if (!mapa.has(k)) mapa.set(k, []);
      mapa.get(k)!.push(i);
    }
    const arr = [...mapa.entries()].map(([k, lista]) => {
      const c = info.get(k);
      const rotulo = k === "_sem" ? "Garagens e Estacionamento" : `${c?.unidades ?? "—"} · ${c?.locatario ?? "—"}`;
      lista.sort((a, b) => (a.data_ref ?? "9999").localeCompare(b.data_ref ?? "9999") || a.descricao.localeCompare(b.descricao));
      return { k, rotulo, lista, anexados: lista.filter((i) => situacaoDe(i) === "Anexado").length };
    });
    arr.sort((a, b) => (a.k === "_sem" ? 1 : b.k === "_sem" ? -1 : a.rotulo.localeCompare(b.rotulo, "pt-BR", { numeric: true })));
    return arr;
  }, [itens, info, soPendentes]);

  const contagens = useMemo(() => {
    const l = itens ?? [];
    return {
      esperados: l.length,
      anexados: l.filter((i) => situacaoDe(i) === "Anexado").length,
      pendentes: l.filter((i) => situacaoDe(i) === "Pendente").length,
      aConfirmar: l.filter((i) => situacaoDe(i) === "A Confirmar").length,
    };
  }, [itens]);

  const enviar = async (caminho: string, arquivo: Blob | File) => {
    const { error } = await supabase.storage.from(BUCKET).upload(caminho, arquivo, { upsert: false });
    if (error && !/already exists|Duplicate/i.test(error.message)) throw error;
    return !error ? "enviado" : "existente";
  };

  const importar = async (files: File[]) => {
    if (!files.length) return;
    const docs: ItemComFlag[] = (itens ?? []).filter((i) => i.storage_path);
    const porNome = new Map<string, ItemComFlag>();
    for (const d of docs) porNome.set(chaveNome(d.storage_path!), d);
    let enviados = 0, existentes = 0;
    const semCadastro: { nome: string; blob: Blob }[] = [];
    const fila: { caminho: string; blob: Blob; nome: string }[] = [];

    for (const f of files) {
      if (/\.zip$/i.test(f.name)) {
        const zip = await JSZip.loadAsync(f);
        for (const [caminho, entrada] of Object.entries(zip.files)) {
          if (entrada.dir) continue;
          const nome = nomeArquivo(caminho);
          if (!/\.(pdf|docx)$/i.test(nome)) continue;
          const alvo = porNome.get(chaveNome(nome));
          fila.push({ caminho: alvo ? alvo.storage_path! : `${edificioId}/${caminho.replace(/^\/+/, "")}`, blob: await entrada.async("blob"), nome });
        }
      } else if (/\.(pdf|docx)$/i.test(f.name)) {
        const alvo = porNome.get(chaveNome(f.name));
        if (!alvo) { semCadastro.push({ nome: f.name, blob: f }); continue; }
        fila.push({ caminho: alvo.storage_path!, blob: f, nome: f.name });
      }
    }
    setResumo(null);
    setProgresso({ feitos: 0, total: fila.length });
    for (const item of fila) {
      try {
        const r = await enviar(item.caminho, item.blob);
        if (r === "enviado") enviados++; else existentes++;
      } catch { semCadastro.push({ nome: item.nome, blob: item.blob }); }
      setProgresso((p) => (p ? { ...p, feitos: p.feitos + 1 } : p));
    }
    setProgresso(null);
    setResumo({ enviados, existentes, semCadastro });
    qc.invalidateQueries({ queryKey: ["loc-documentos", edificioId] });
  };

  const imoveis = useMemo(() => {
    const arr = (data.contratosInfo ?? []).map((c: any) => ({ k: c.id as string, rotulo: `${c.unidades ?? "—"} · ${c.locatario ?? "—"}` }));
    arr.sort((a: any, b: any) => a.rotulo.localeCompare(b.rotulo, "pt-BR", { numeric: true }));
    return [...arr, { k: "_sem", rotulo: "Garagens e Estacionamento" }] as { k: string; rotulo: string }[];
  }, [data.contratosInfo]);

  const tirarDaLista = (idx: number) =>
    setResumo((r) => r ? { ...r, enviados: r.enviados + 1, semCadastro: r.semCadastro.filter((_, j) => j !== idx) } : r);

  const vincular = async (idx: number, itemId: string) => {
    const s = resumo?.semCadastro[idx];
    const item = (itens ?? []).find((i) => i.id === itemId);
    if (!s || !item) return;
    const ok = await anexarNaLinha(item, new File([s.blob], s.nome));
    if (ok) tirarDaLista(idx);
  };

  const vincularNovo = async (idx: number, contratoKey: string, grupo: string, descricao: string, dataRef: string | null) => {
    const s = resumo?.semCadastro[idx];
    if (!s) return;
    try {
      const contratoId = contratoKey === "_sem" ? null : contratoKey;
      const ext = s.nome.split(".").pop();
      const prefixo = dataRef ? dataRef.replace(/-/g, ".") : "sem-data";
      const caminho = `${edificioId}/${contratoId ?? "_sem_contrato"}/${prefixo}_-_${slugArquivo(descricao)}.${ext}`;
      const r = await enviar(caminho, new File([s.blob], s.nome));
      if (r === "existente") { toast({ title: "Arquivo já existia", description: nomeArquivo(caminho) }); return; }
      const { data: novo, error } = await db.from("loc_documentos").insert({
        edificio_id: edificioId, contrato_id: contratoId, tipo: TIPO_DOC[grupo] ?? "outro",
        titulo: descricao, storage_path: caminho, revisado: true,
        visivel_cliente: !(grupo === "encerramento" || grupo === "outro"),
      }).select("id").single();
      if (error) throw error;
      const { error: e2 } = await db.from("loc_documentos_esperados").insert({
        edificio_id: edificioId, contrato_id: contratoId, grupo, descricao, data_ref: dataRef,
        situacao: "necessario", documento_id: novo.id,
      });
      if (e2) throw e2;
      qc.invalidateQueries({ queryKey: ["loc-documentos", edificioId] });
      toast({ title: "Documento anexado" });
      tirarDaLista(idx);
    } catch (e) {
      toast({ title: "Não foi possível anexar", description: (e as Error).message, variant: "destructive" });
    }
  };

  const anexarNaLinha = async (item: ItemComFlag, file: File): Promise<boolean> => {
    try {
      let docId = item.documento_id;
      let caminho = item.storage_path;
      if (docId && caminho) {
        if (chaveNome(caminho) !== chaveNome(file.name)) toast({ title: "Nome diferente do esperado", description: `Enviado como ${nomeArquivo(caminho)}.` });
      } else {
        const ext = file.name.split(".").pop();
        const dataRef = item.data_ref ?? new Date().toISOString().slice(0, 10);
        caminho = `${edificioId}/${item.contrato_id ?? "_sem_contrato"}/${dataRef.replace(/-/g, ".")}_-_${slugArquivo(item.descricao)}.${ext}`;
        const { data: novo, error } = await db.from("loc_documentos").insert({
          edificio_id: edificioId, contrato_id: item.contrato_id, tipo: TIPO_DOC[item.grupo] ?? "outro",
          titulo: item.descricao, storage_path: caminho, revisado: true,
          visivel_cliente: !(item.grupo === "encerramento" || item.grupo === "outro"),
        }).select("id").single();
        if (error) throw error;
        docId = novo.id;
        await db.from("loc_documentos_esperados").update({ documento_id: docId }).eq("id", item.id);
        // vincula à vigência: contrato → seq 0; aditivo → vigência com início mais próximo (até 45 dias)
        if (item.contrato_id && (item.grupo === "contrato" || item.grupo === "aditivo")) {
          const { data: vigs } = await db.from("loc_vigencias").select("id,seq,inicio").eq("contrato_id", item.contrato_id).is("documento_id", null);
          let alvo: any = null;
          if (item.grupo === "contrato") alvo = (vigs ?? []).find((v: any) => v.seq === 0);
          else if (item.data_ref) {
            const ref = new Date(item.data_ref).getTime();
            alvo = (vigs ?? []).map((v: any) => ({ ...v, dif: Math.abs(new Date(v.inicio).getTime() - ref) }))
              .filter((v: any) => v.dif <= 45 * 86400000).sort((a: any, b: any) => a.dif - b.dif)[0] ?? null;
          }
          if (alvo) await db.from("loc_vigencias").update({ documento_id: docId }).eq("id", alvo.id);
        }
      }
      await enviar(caminho!, file);
      qc.invalidateQueries({ queryKey: ["loc-documentos", edificioId] });
      toast({ title: "Documento anexado" });
      return true;
    } catch (e) {
      toast({ title: "Não foi possível anexar", description: (e as Error).message, variant: "destructive" });
      return false;
    }
  };

  const abrir = async (item: ItemComFlag) => {
    if (!item.storage_path) return;
    const { data: s, error } = await supabase.storage.from(BUCKET).createSignedUrl(item.storage_path, 300);
    if (error) return toast({ title: "Não foi possível abrir", description: error.message, variant: "destructive" });
    window.open(s.signedUrl, "_blank");
  };

  const naoExiste = async (item: ItemComFlag) => {
    if (!window.confirm(`Remover "${item.descricao}" da lista de documentos esperados?`)) return;
    const { error } = await db.from("loc_documentos_esperados").delete().eq("id", item.id);
    if (error) return toast({ title: "Não foi possível remover", description: error.message, variant: "destructive" });
    qc.invalidateQueries({ queryKey: ["loc-documentos", edificioId] });
  };

  if (isLoading) return <p className="text-sm text-muted-foreground">Carregando documentos…</p>;

  return <div className="space-y-4">
    <div className={cn("grid gap-4", admin ? "sm:grid-cols-4" : "sm:grid-cols-1")}>
      {admin && <Card label="Documentos Esperados">{contagens.esperados}</Card>}
      <Card label="Documentos Anexados">{contagens.anexados}</Card>
      {admin && <Card label="Pendentes">{contagens.pendentes}</Card>}
      {admin && <Card label="A Confirmar">{contagens.aConfirmar}</Card>}
    </div>

    {admin && <Bloco titulo="Anexar Arquivos">
      <div
        role="button" tabIndex={0}
        onClick={() => refZip.current?.click()} onKeyDown={(e) => e.key === "Enter" && refZip.current?.click()}
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => { e.preventDefault(); importar([...e.dataTransfer.files]); }}
        className="flex cursor-pointer flex-col items-center gap-2 rounded-md border border-dashed border-input bg-card px-6 py-8 text-center">
        <Upload className="h-5 w-5 text-muted-foreground" strokeWidth={1.5} />
        <div className="text-sm font-medium">{progresso ? `Enviando ${progresso.feitos} de ${progresso.total}…` : "Solte aqui os arquivos (.zip, .pdf ou .docx)"}</div>
        <div className="text-xs text-muted-foreground">Arquivos soltos entram no cadastro com o mesmo nome; dentro de um .zip vale a pasta do contrato.</div>
        <input ref={refZip} type="file" accept=".zip,.pdf,.docx" multiple className="hidden" onChange={(e) => { importar([...(e.target.files ?? [])]); e.target.value = ""; }} />
      </div>
      {progresso && <div className="mt-3 h-1.5 w-full rounded bg-muted"><div className="h-1.5 rounded bg-gold transition-all" style={{ width: `${progresso.total ? (progresso.feitos / progresso.total) * 100 : 0}%` }} /></div>}
      {resumo && <div className="mt-3 text-xs text-muted-foreground">
        <p>Enviados: {resumo.enviados} · Já existiam: {resumo.existentes} · Sem cadastro: {resumo.semCadastro.length}</p>
        {resumo.semCadastro.map((s, idx) => <Vincular key={idx + s.nome} nome={s.nome} imoveis={imoveis} itens={itens ?? []}
          onPendente={(itemId) => vincular(idx, itemId)} onNovo={(c, t, d, dr) => vincularNovo(idx, c, t, d, dr)} />)}
      </div>}
    </Bloco>}

    <Bloco titulo="Documentos por Unidade" acao={admin ? <label className="flex items-center gap-2 text-xs text-muted-foreground"><Switch checked={soPendentes} onCheckedChange={setSoPendentes} />Só Pendentes</label> : undefined}>
      <div className={tableClasses.wrap}><table className={tableClasses.table}><thead><tr className={tableClasses.head}>
        {["Documento", "Tipo", "Data", "Situação", "Detalhe", "Arquivo"].map((h) => <th key={h} className={tableClasses.th}>{h}</th>)}
      </tr></thead><tbody>
        {grupos.map((g) => <FragmentGroup key={g.k} g={g} admin={admin} abrir={abrir} naoExiste={naoExiste}
          pedirArquivo={(item) => { setAlvoRow(item); refRow.current?.click(); }} />)}
      </tbody></table></div>
      <input ref={refRow} type="file" accept=".pdf,.docx" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f && alvoRow) anexarNaLinha(alvoRow, f); e.target.value = ""; }} />
    </Bloco>
  </div>;
}

function FragmentGroup({ g, admin, abrir, naoExiste, pedirArquivo }: {
  g: { k: string; rotulo: string; lista: ItemComFlag[]; anexados: number };
  admin: boolean; abrir: (i: ItemComFlag) => void; naoExiste: (i: ItemComFlag) => void; pedirArquivo: (i: ItemComFlag) => void;
}) {
  return <>
    <tr><td colSpan={6} className="border-b bg-muted/40 px-[10px] py-2 text-xs font-medium text-muted-foreground">
      {g.rotulo} · {g.anexados} de {g.lista.length} anexados
    </td></tr>
    {g.lista.map((i) => {
      const sit = situacaoDe(i);
      return <tr key={i.id}>
        <td className={cn(tableClasses.td, "font-medium")}>{i.descricao}</td>
        <td className={tableClasses.td}>{TIPO_LABEL[i.grupo] ?? i.grupo}</td>
        <td className={cn(tableClasses.td, "tabular-nums")}>{i.data_ref ? dt(i.data_ref) : "—"}</td>
        <td className={tableClasses.td}><span className={cn("op-tag", SIT_CLS[sit])}>{sit}</span></td>
        <td className={cn(tableClasses.td, "text-xs text-muted-foreground")}>{i.detalhe ?? "—"}</td>
        <td className={tableClasses.td}><div className="flex flex-wrap gap-2 text-xs">
          {sit === "Anexado" && <button className="font-medium text-foreground underline-offset-2 hover:underline" onClick={() => abrir(i)}>Abrir</button>}
          {admin && sit !== "Anexado" && <>
            <button className="font-medium text-foreground underline-offset-2 hover:underline" onClick={() => pedirArquivo(i)}>Anexar</button>
            <button className="text-muted-foreground underline-offset-2 hover:underline" onClick={() => naoExiste(i)}>Não Existe</button>
          </>}
        </div></td>
      </tr>;
    })}
  </>;
}

const TIPOS_NOVO = [
  { v: "contrato", l: "Contrato" }, { v: "aditivo", l: "Aditivo" }, { v: "encerramento", l: "Distrato" },
  { v: "encerramento_termo", l: "Termo de Encerramento" }, { v: "outro", l: "Outro" },
];
const normBusca = (s: string) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[.\s]/g, "");

function Vincular({ nome, imoveis, itens, onPendente, onNovo }: {
  nome: string; imoveis: { k: string; rotulo: string }[]; itens: ItemComFlag[];
  onPendente: (itemId: string) => void; onNovo: (contrato: string, grupo: string, descricao: string, dataRef: string | null) => void;
}) {
  const [busca, setBusca] = useState("");
  const [imovel, setImovel] = useState("");
  const [doc, setDoc] = useState("");
  const [tipo, setTipo] = useState("");
  const [desc, setDesc] = useState(() => nome.replace(/\.[^.]+$/, "").replace(/^\d{4}[.\-_ ]\d{2}[.\-_ ]\d{2}\s*[·\-_ ]*\s*/, "").trim());
  const [dataTxt, setDataTxt] = useState("");
  const filtrados = imoveis.filter((i) => !busca || normBusca(i.rotulo).includes(normBusca(busca)));
  const pendentes = itens.filter((i) => (i.contrato_id ?? "_sem") === imovel && situacaoDe(i) !== "Anexado")
    .sort((a, b) => (a.data_ref ?? "9999").localeCompare(b.data_ref ?? "9999"));
  const m = dataTxt.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  const dataOk = !dataTxt || !!m;
  const cls = "rounded border border-input bg-card px-2 py-1 text-xs text-foreground";
  const confirmar = () => {
    if (!tipo || !desc.trim() || !dataOk) return;
    onNovo(imovel, tipo === "encerramento_termo" ? "encerramento" : tipo, desc.trim(), m ? `${m[3]}-${m[2]}-${m[1]}` : null);
  };
  return <div className="mt-2 flex flex-wrap items-center gap-2">
    <span className="break-all">{nome}</span>
    <input name="vincular-busca" autoComplete="off" placeholder="Vincular a… (buscar imóvel)" value={busca}
      onChange={(e) => setBusca(e.target.value)} className={cls} />
    <select name="vincular-imovel" autoComplete="off" value={imovel} onChange={(e) => { setImovel(e.target.value); setDoc(""); }} className={cls}>
      <option value="">Imóvel…</option>
      {filtrados.map((i) => <option key={i.k} value={i.k}>{i.rotulo}</option>)}
    </select>
    {imovel && <select name="vincular-doc" autoComplete="off" value={doc}
      onChange={(e) => { const v = e.target.value; setDoc(v); if (v && v !== "_novo") onPendente(v); }} className={cls}>
      <option value="">Documento…</option>
      {pendentes.map((i) => <option key={i.id} value={i.id}>{i.descricao} · {i.data_ref ? dt(i.data_ref) : "—"} · {situacaoDe(i)}</option>)}
      <option value="_novo">Outro documento deste imóvel…</option>
    </select>}
    {doc === "_novo" && <>
      <select name="vincular-tipo" autoComplete="off" value={tipo} onChange={(e) => setTipo(e.target.value)} className={cls}>
        <option value="">Tipo…</option>
        {TIPOS_NOVO.map((t) => <option key={t.v} value={t.v}>{t.l}</option>)}
      </select>
      <input name="vincular-descricao" autoComplete="off" placeholder="Descrição" value={desc} onChange={(e) => setDesc(e.target.value)} className={cn(cls, "min-w-[200px]")} />
      <input name="vincular-data" autoComplete="off" placeholder="dd/mm/aaaa" value={dataTxt} onChange={(e) => setDataTxt(e.target.value)} className={cn(cls, "w-[100px]", !dataOk && "border-destructive")} />
      <button className="font-medium text-foreground underline-offset-2 hover:underline disabled:opacity-50"
        disabled={!tipo || !desc.trim() || !dataOk} onClick={confirmar}>Confirmar</button>
    </>}
  </div>;
}
