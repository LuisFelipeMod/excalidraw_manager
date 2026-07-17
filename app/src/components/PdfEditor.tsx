import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Excalidraw } from "@excalidraw/excalidraw";
import * as pdfjsLib from "pdfjs-dist";
// Worker do pdf.js servido pelo próprio bundle (CSP: worker-src 'self').
import PdfWorkerUrl from "pdfjs-dist/build/pdf.worker.min.mjs?url";

pdfjsLib.GlobalWorkerOptions.workerSrc = PdfWorkerUrl;

// Escala lógica das páginas na cena (1 = 72dpi). Acima disso ocupam mais
// espaço/ficam maiores; o raster é gerado em resolução ainda maior para nitidez.
const DISPLAY_SCALE = 1.5;
const RASTER_MULTIPLIER = 2;
// Espaço vertical entre páginas (em unidades da cena).
const PAGE_GAP = 40;
// Fundo cinza típico de leitores de PDF, para destacar a área das páginas.
const PDF_BACKGROUND = "#525659";

// Prefixos dos elementos/arquivos gerados a partir do PDF. As anotações do
// usuário nunca usam esses prefixos, então conseguimos separá-las na hora de
// salvar (só as anotações vão para o sidecar; as páginas são regeneradas).
const PAGE_ID_PREFIX = "pdf-page-";
const PAGE_FILE_PREFIX = "pdf-file-";

export type AnnotScene = {
  elements: readonly any[];
  appState: any;
  files: any;
};

type BuiltPdf = { elements: any[]; files: Record<string, any> };

function base64ToUint8(base64: string): Uint8Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

/** Elemento de imagem "travado" (não editável) para uma página do PDF. */
function makePageElement(
  index: number,
  x: number,
  y: number,
  width: number,
  height: number,
  fileId: string,
): any {
  return {
    id: `${PAGE_ID_PREFIX}${index}`,
    type: "image",
    x,
    y,
    width,
    height,
    angle: 0,
    strokeColor: "transparent",
    backgroundColor: "transparent",
    fillStyle: "solid",
    strokeWidth: 1,
    strokeStyle: "solid",
    roughness: 0,
    opacity: 100,
    roundness: null,
    // seed determinístico para a cena não "mudar" a cada abertura
    seed: 1_000_000 + index,
    version: 1,
    versionNonce: 1,
    isDeleted: false,
    groupIds: [],
    frameId: null,
    boundElements: null,
    updated: 1,
    link: null,
    locked: true, // impede seleção/movimentação/edição do conteúdo do PDF
    fileId,
    status: "saved",
    scale: [1, 1],
    crop: null,
  };
}

/** Renderiza cada página do PDF numa imagem e monta os elementos travados. */
async function renderPdf(base64: string): Promise<BuiltPdf> {
  const doc = await pdfjsLib.getDocument({ data: base64ToUint8(base64) })
    .promise;
  const elements: any[] = [];
  const files: Record<string, any> = {};
  let y = 0;
  try {
    for (let i = 1; i <= doc.numPages; i++) {
      const page = await doc.getPage(i);
      const display = page.getViewport({ scale: DISPLAY_SCALE });
      const raster = page.getViewport({
        scale: DISPLAY_SCALE * RASTER_MULTIPLIER,
      });
      const canvas = document.createElement("canvas");
      canvas.width = Math.ceil(raster.width);
      canvas.height = Math.ceil(raster.height);
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("Canvas 2D indisponível");
      await page.render({ canvas, canvasContext: ctx, viewport: raster })
        .promise;
      const dataURL = canvas.toDataURL("image/png");

      const idx = i - 1;
      const fileId = `${PAGE_FILE_PREFIX}${idx}`;
      files[fileId] = {
        id: fileId,
        mimeType: "image/png",
        dataURL,
        created: Date.now(),
      };
      elements.push(
        makePageElement(idx, 0, y, display.width, display.height, fileId),
      );
      y += display.height + PAGE_GAP;
      page.cleanup();
    }
  } finally {
    doc.destroy();
  }
  return { elements, files };
}

type Props = {
  path: string;
  /** Conteúdo do PDF em base64. */
  pdfBase64: string;
  /** Anotações previamente salvas (sidecar), ou null na primeira abertura. */
  initialAnnots: AnnotScene | null;
  theme: "light" | "dark";
  /** Chamado a cada alteração, já sem as páginas do PDF (só anotações). */
  onChange: (scene: AnnotScene) => void;
};

export function PdfEditor({
  path,
  pdfBase64,
  initialAnnots,
  theme,
  onChange,
}: Props) {
  const [pdf, setPdf] = useState<BuiltPdf | null>(null);
  const [error, setError] = useState<string | null>(null);
  const apiRef = useRef<any>(null);

  // mantém o callback atual acessível sem quebrar a estabilidade das props do
  // <Excalidraw> (o componente é memoizado com comparação rasa)
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  useEffect(() => {
    let cancelled = false;
    setPdf(null);
    setError(null);
    renderPdf(pdfBase64)
      .then((built) => {
        if (!cancelled) setPdf(built);
      })
      .catch((err) => {
        if (!cancelled) setError(err?.message ?? String(err));
      });
    return () => {
      cancelled = true;
    };
  }, [pdfBase64]);

  const handleApi = useCallback((api: any) => {
    apiRef.current = api;
  }, []);

  // separa as anotações do usuário das páginas do PDF antes de propagar
  const handleChange = useCallback(
    (elements: readonly any[], appState: any, files: any) => {
      const annotElements = elements.filter(
        (el) => !String(el?.id).startsWith(PAGE_ID_PREFIX),
      );
      const annotFiles: Record<string, any> = {};
      for (const [id, file] of Object.entries(files ?? {})) {
        if (!id.startsWith(PAGE_FILE_PREFIX)) annotFiles[id] = file;
      }
      onChangeRef.current({
        elements: annotElements,
        appState,
        files: annotFiles,
      });
    },
    [],
  );

  const initialData = useMemo(() => {
    if (!pdf) return null;
    const appState: any = {
      ...(initialAnnots?.appState ?? {}),
      viewBackgroundColor: PDF_BACKGROUND,
    };
    delete appState.collaborators;
    return {
      elements: [...pdf.elements, ...(initialAnnots?.elements ?? [])],
      files: { ...pdf.files, ...(initialAnnots?.files ?? {}) },
      appState,
      scrollToContent: !initialAnnots,
    };
    // recalcula só quando o PDF (re)renderiza; annots são apenas o estado inicial
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pdf]);

  if (error) {
    return (
      <div className="pdf-status pdf-status-error">
        <h2>Não foi possível abrir o PDF</h2>
        <p>{error}</p>
      </div>
    );
  }

  if (!pdf || !initialData) {
    return (
      <div className="pdf-status">
        <div className="pdf-spinner" />
        <p>Carregando PDF…</p>
      </div>
    );
  }

  return (
    <Excalidraw
      key={path}
      onExcalidrawAPI={handleApi}
      theme={theme}
      langCode="pt-BR"
      initialData={initialData}
      onChange={handleChange}
    />
  );
}
