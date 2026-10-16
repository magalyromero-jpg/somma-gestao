import { useEffect, useRef, useState } from "react";
import * as pdfjsLib from "pdfjs-dist";
import workerUrl from "pdfjs-dist/build/pdf.worker.min.mjs?url";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

pdfjsLib.GlobalWorkerOptions.workerSrc = workerUrl;

/** Mostra um PDF dentro da página, desenhado em canvas (sem aba nova nem URL de arquivo). */
export function VisorPdf({ titulo, blob, onFechar }: { titulo: string; blob: Blob | null; onFechar: () => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [carregando, setCarregando] = useState(true);

  useEffect(() => {
    if (!blob) return;
    let cancelado = false;
    setErro(null); setCarregando(true);
    (async () => {
      try {
        const pdf = await pdfjsLib.getDocument({ data: new Uint8Array(await blob.arrayBuffer()) }).promise;
        const box = ref.current;
        if (!box || cancelado) return;
        box.innerHTML = "";
        const largura = box.clientWidth || 900;
        for (let n = 1; n <= pdf.numPages && !cancelado; n++) {
          const page = await pdf.getPage(n);
          const base = page.getViewport({ scale: 1 });
          const escala = largura / base.width;
          const vp = page.getViewport({ scale: escala * (window.devicePixelRatio || 1) });
          const c = document.createElement("canvas");
          c.width = vp.width; c.height = vp.height;
          c.style.width = "100%"; c.style.display = "block"; c.style.marginBottom = "12px";
          c.className = "border bg-card";
          box.appendChild(c);
          await page.render({ canvasContext: c.getContext("2d")!, viewport: vp }).promise;
          if (n === 1) setCarregando(false);
        }
        setCarregando(false);
      } catch (e) {
        if (!cancelado) { setErro((e as Error).message); setCarregando(false); }
      }
    })();
    return () => { cancelado = true; };
  }, [blob]);

  return <Dialog open={!!blob} onOpenChange={(o) => !o && onFechar()}>
    <DialogContent className="flex h-[90vh] max-w-5xl flex-col gap-3">
      <DialogHeader><DialogTitle className="pr-8 text-sm">{titulo}</DialogTitle></DialogHeader>
      <div className="min-h-0 flex-1 overflow-y-auto">
        {carregando && <p className="text-sm text-muted-foreground">Carregando…</p>}
        {erro && <p className="text-sm text-destructive">Não foi possível abrir o arquivo: {erro}</p>}
        <div ref={ref} />
      </div>
      <div className="flex justify-end"><Button variant="outline" onClick={onFechar}>Fechar</Button></div>
    </DialogContent>
  </Dialog>;
}
