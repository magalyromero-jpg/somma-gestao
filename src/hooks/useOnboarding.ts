import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { LOADING_STEPS, type PatrimonialData } from "@/lib/onboarding/types";
import { mergePatrimonialPatch, type PatrimonialPatch } from "@/lib/onboarding/mergePatch";

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve((r.result as string).split(",")[1]);
    r.onerror = reject;
    r.readAsDataURL(file);
  });
}

export function useOnboarding(initialData: PatrimonialData | null = null) {
  const [loading, setLoading] = useState(false);
  const [loadingStep, setLoadingStep] = useState("");
  const [data, setData] = useState<PatrimonialData | null>(initialData);
  const [error, setError] = useState<string | null>(null);

  async function analyze(familyName: string, files: File[]): Promise<PatrimonialData | null> {
    setLoading(true);
    setError(null);
    let stepIdx = 0;
    setLoadingStep(LOADING_STEPS[0]);
    const interval = setInterval(() => {
      stepIdx = Math.min(stepIdx + 1, LOADING_STEPS.length - 1);
      setLoadingStep(LOADING_STEPS[stepIdx]);
    }, 1200);

    try {
      const filesPayload = await Promise.all(
        files.map(async (f) => ({
          name: f.name,
          mimeType: f.type || "application/pdf",
          base64: await fileToBase64(f),
        })),
      );
      const { data: resp, error: invokeErr } = await supabase.functions.invoke("extract-patrimonial", {
        body: { familyName, files: filesPayload },
      });
      if (invokeErr) throw invokeErr;
      if (resp?.error) throw new Error(resp.error);
      const result = resp.data as PatrimonialData;
      setData(result);
      return result;
    } catch (e: any) {
      setError(e?.message ?? "Erro ao processar documentos. Tente novamente.");
      return null;
    } finally {
      clearInterval(interval);
      setLoading(false);
    }
  }

  async function enrich(newFile: File): Promise<PatrimonialData | null> {
    if (!data) return null;
    setLoading(true);
    setError(null);
    setLoadingStep("Analisando novo documento...");
    try {
      const filePayload = {
        name: newFile.name,
        mimeType: newFile.type || "application/pdf",
        base64: await fileToBase64(newFile),
      };
      const { data: resp, error: invokeErr } = await supabase.functions.invoke("enrich-patrimonial", {
        body: { currentData: data, file: filePayload },
      });
      if (invokeErr) throw invokeErr;
      if (resp?.error) throw new Error(resp.error);
      const patch = resp.patch as PatrimonialPatch;
      const updated = mergePatrimonialPatch(data, patch);
      setData(updated);
      return updated;
    } catch (e: any) {
      setError(e?.message ?? "Erro ao processar documento. Tente novamente.");
      return null;
    } finally {
      setLoading(false);
    }
  }

  return { loading, loadingStep, data, setData, error, analyze, enrich };
}
