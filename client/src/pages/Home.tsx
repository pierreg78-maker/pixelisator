/**
 * Chambre claire — un établi photo à la hiérarchie éditoriale suisse : graphite, ivoire,
 * repères de calibration et vermillon réservé aux gestes d'anonymisation.
 */
import { useEffect, useRef, useState } from "react";
import {
  ArrowDownToLine,
  Brush,
  CheckCircle2,
  Download,
  FileImage,
  Hand,
  ImageUp,
  Info,
  LockKeyhole,
  RectangleHorizontal,
  RotateCcw,
  ShieldCheck,
  Trash2,
  Undo2,
  Upload,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

type Tool = "freehand" | "rectangle";
type Effect = "pixelate" | "blur";
type ExportFormat = "image/png" | "image/jpeg";

type Point = { x: number; y: number };
type Zone = {
  id: string;
  kind: Tool;
  points: Point[];
  effect: Effect;
  strength: number;
};

type ImageMeta = {
  name: string;
  width: number;
  height: number;
  size: number;
};

const logoUrl = "https://files.manuscdn.com/user_upload_by_module/session_file/310519663132515727/CuUGZjlQXPbxiPmE.png";
const lightTableUrl = "https://files.manuscdn.com/user_upload_by_module/session_file/310519663132515727/AyNeGFzCxwuRaZPo.jpg";
const gridUrl = "https://files.manuscdn.com/user_upload_by_module/session_file/310519663132515727/TIzmlTSAaiRXBAsc.jpg";
const patternUrl = "https://files.manuscdn.com/user_upload_by_module/session_file/310519663132515727/gOlnRZxLKpaxiiHk.jpg";

function formatBytes(bytes: number) {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} Ko`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} Mo`;
}

function getBounds(zone: Pick<Zone, "kind" | "points">) {
  const xs = zone.points.map((point) => point.x);
  const ys = zone.points.map((point) => point.y);
  const x = Math.min(...xs);
  const y = Math.min(...ys);
  return {
    x,
    y,
    w: Math.max(1, Math.max(...xs) - x),
    h: Math.max(1, Math.max(...ys) - y),
  };
}

function traceZone(ctx: CanvasRenderingContext2D, zone: Pick<Zone, "kind" | "points">) {
  if (!zone.points.length) return;
  ctx.beginPath();
  if (zone.kind === "rectangle" && zone.points.length >= 2) {
    const { x, y, w, h } = getBounds(zone);
    ctx.rect(x, y, w, h);
    return;
  }

  ctx.moveTo(zone.points[0].x, zone.points[0].y);
  zone.points.slice(1).forEach((point) => ctx.lineTo(point.x, point.y));
  if (zone.points.length > 2) ctx.closePath();
}

function drawEffect(
  ctx: CanvasRenderingContext2D,
  base: HTMLCanvasElement,
  zone: Zone,
) {
  ctx.save();
  traceZone(ctx, zone);
  ctx.clip();

  if (zone.effect === "blur") {
    ctx.filter = `blur(${zone.strength}px)`;
    ctx.drawImage(base, 0, 0);
  } else {
    const { x, y, w, h } = getBounds(zone);
    const cell = Math.max(3, Math.round(zone.strength));
    const sample = document.createElement("canvas");
    sample.width = Math.max(1, Math.floor(w / cell));
    sample.height = Math.max(1, Math.floor(h / cell));
    const sampleCtx = sample.getContext("2d");

    if (sampleCtx) {
      sampleCtx.imageSmoothingEnabled = true;
      sampleCtx.drawImage(base, x, y, w, h, 0, 0, sample.width, sample.height);
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(sample, 0, 0, sample.width, sample.height, x, y, w, h);
      ctx.imageSmoothingEnabled = true;
    }
  }

  ctx.restore();
}

export default function Home() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const baseCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const imageRef = useRef<HTMLImageElement | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const activePointerId = useRef<number | null>(null);

  const [imageMeta, setImageMeta] = useState<ImageMeta | null>(null);
  const [tool, setTool] = useState<Tool>("freehand");
  const [effect, setEffect] = useState<Effect>("pixelate");
  const [strength, setStrength] = useState(16);
  const [zones, setZones] = useState<Zone[]>([]);
  const [draft, setDraft] = useState<Zone | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [format, setFormat] = useState<ExportFormat>("image/png");

  const paint = (includeGuide = true, target = canvasRef.current) => {
    const base = baseCanvasRef.current;
    if (!target || !base || !imageMeta) return;
    target.width = imageMeta.width;
    target.height = imageMeta.height;
    const ctx = target.getContext("2d");
    if (!ctx) return;

    ctx.clearRect(0, 0, target.width, target.height);
    ctx.drawImage(base, 0, 0);
    zones.forEach((zone) => drawEffect(ctx, base, zone));

    if (includeGuide) {
      zones.forEach((zone) => {
        ctx.save();
        traceZone(ctx, zone);
        ctx.fillStyle = "rgba(237, 74, 47, 0.14)";
        ctx.fill();
        ctx.lineWidth = Math.max(2, imageMeta.width / 650);
        ctx.strokeStyle = "rgba(237, 74, 47, 0.96)";
        ctx.setLineDash([Math.max(8, imageMeta.width / 85), Math.max(5, imageMeta.width / 130)]);
        ctx.stroke();
        ctx.restore();
      });

      if (draft) {
        ctx.save();
        traceZone(ctx, draft);
        ctx.fillStyle = "rgba(237, 74, 47, 0.17)";
        ctx.fill();
        ctx.lineWidth = Math.max(2, imageMeta.width / 520);
        ctx.strokeStyle = "#ED4A2F";
        ctx.setLineDash([Math.max(7, imageMeta.width / 95), Math.max(5, imageMeta.width / 150)]);
        ctx.stroke();
        ctx.restore();
      }
    }
  };

  useEffect(() => {
    paint(true);
  }, [imageMeta, zones, draft]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "z") {
        event.preventDefault();
        setZones((current) => current.slice(0, -1));
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  const sourcePoint = (event: React.PointerEvent<HTMLCanvasElement>): Point | null => {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    const rect = canvas.getBoundingClientRect();
    return {
      x: Math.max(0, Math.min(canvas.width, (event.clientX - rect.left) * (canvas.width / rect.width))),
      y: Math.max(0, Math.min(canvas.height, (event.clientY - rect.top) * (canvas.height / rect.height))),
    };
  };

  const importFile = (file?: File) => {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast.error("Choisissez une image valide.");
      return;
    }

    const url = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => {
      const base = document.createElement("canvas");
      base.width = image.naturalWidth;
      base.height = image.naturalHeight;
      const context = base.getContext("2d");
      context?.drawImage(image, 0, 0);
      imageRef.current = image;
      baseCanvasRef.current = base;
      setImageMeta({
        name: file.name.replace(/\.[^.]+$/, ""),
        width: image.naturalWidth,
        height: image.naturalHeight,
        size: file.size,
      });
      setZones([]);
      setDraft(null);
      URL.revokeObjectURL(url);
      toast.success("Image prête à être anonymisée.");
    };
    image.onerror = () => {
      URL.revokeObjectURL(url);
      toast.error("Cette image n’a pas pu être lue dans ce navigateur.");
    };
    image.src = url;
  };

  const finishDraft = () => {
    if (!draft) return;
    const bounds = getBounds(draft);
    const hasEnoughPath = draft.kind === "freehand" && draft.points.length > 4 && bounds.w > 3 && bounds.h > 3;
    const hasEnoughRectangle = draft.kind === "rectangle" && bounds.w > 3 && bounds.h > 3;
    if (hasEnoughPath || hasEnoughRectangle) {
      setZones((current) => [...current, draft]);
    }
    setDraft(null);
    setIsDragging(false);
    activePointerId.current = null;
  };

  const onPointerDown = (event: React.PointerEvent<HTMLCanvasElement>) => {
    const point = sourcePoint(event);
    if (!point || !imageMeta) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    activePointerId.current = event.pointerId;
    setIsDragging(true);
    setDraft({
      id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
      kind: tool,
      points: [point],
      effect,
      strength,
    });
  };

  const onPointerMove = (event: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isDragging || activePointerId.current !== event.pointerId) return;
    const point = sourcePoint(event);
    if (!point) return;
    setDraft((current) => {
      if (!current) return current;
      return current.kind === "rectangle"
        ? { ...current, points: [current.points[0], point] }
        : { ...current, points: [...current.points, point] };
    });
  };

  const resetImage = () => {
    setZones([]);
    setDraft(null);
    toast.message("Toutes les zones ont été retirées.");
  };

  const exportImage = () => {
    if (!imageMeta || !baseCanvasRef.current) return;
    const output = document.createElement("canvas");
    output.width = imageMeta.width;
    output.height = imageMeta.height;
    paint(false, output);
    output.toBlob(
      (blob) => {
        if (!blob) {
          toast.error("L’export a échoué. Réessayez avec une image plus petite.");
          return;
        }
        const suffix = format === "image/png" ? "png" : "jpg";
        const link = document.createElement("a");
        link.href = URL.createObjectURL(blob);
        link.download = `${imageMeta.name || "photo"}-anonymisee.${suffix}`;
        link.click();
        setTimeout(() => URL.revokeObjectURL(link.href), 500);
        toast.success("Image anonymisée téléchargée.");
      },
      format,
      0.94,
    );
  };

  const isEmpty = !imageMeta;
  const currentStrengthLabel = effect === "pixelate" ? `${strength} px` : `${strength} px`;

  return (
    <div className="min-h-screen overflow-x-hidden bg-[#f4f0e8] text-[#202321]">
      <header className="border-b border-[#202321]/15 bg-[#f8f5ee]/92 backdrop-blur-md">
        <div className="mx-auto flex h-[78px] max-w-[1600px] items-center justify-between px-4 sm:px-7 lg:px-10">
          <div className="flex items-center gap-3.5">
            <div className="grid h-11 w-11 place-items-center border border-[#202321]/20 bg-[#ebe6dc] shadow-[3px_3px_0_#202321]">
              <img className="h-8 w-8 object-contain" src={logoUrl} alt="Symbole Atelier Masque" />
            </div>
            <div>
              <p className="font-mono text-[10px] font-bold uppercase tracking-[0.19em] text-[#69706b]">Atelier local</p>
              <h1 className="font-display text-xl font-extrabold leading-tight tracking-[-0.045em]">Atelier Masque</h1>
            </div>
          </div>

          <div className="hidden items-center gap-2 border border-[#202321]/12 bg-white/60 px-3 py-2 text-[11px] font-bold uppercase tracking-[0.11em] text-[#4e5651] sm:flex">
            <LockKeyhole className="h-3.5 w-3.5 text-[#ed4a2f]" />
            Traitement dans le navigateur
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-[1600px] px-4 py-5 sm:px-7 sm:py-7 lg:px-10 lg:py-9">
        <div className="mb-6 grid gap-3 lg:grid-cols-[1fr_auto] lg:items-end">
          <div>
            <p className="mb-2 font-mono text-[11px] font-bold uppercase tracking-[0.17em] text-[#ed4a2f]">Masquage d’image / sans envoi</p>
            <h2 className="max-w-3xl font-display text-3xl font-extrabold leading-[0.94] tracking-[-0.055em] sm:text-4xl">Protégez ce qui doit le rester.</h2>
          </div>
          <p className="max-w-[390px] border-l-2 border-[#ed4a2f] pl-3 text-sm leading-6 text-[#59605b]">
            Dessinez une zone, choisissez <strong className="font-bold text-[#202321]">pixelisation</strong> ou <strong className="font-bold text-[#202321]">flou</strong>, puis exportez l’original retouché.
          </p>
        </div>

        <section className="atelier-shell">
          <aside className="atelier-tools" aria-label="Outils de sélection">
            <div className="tool-section">
              <p className="section-kicker"><span>01</span> Sélection</p>
              <div className="mt-3 grid grid-cols-2 gap-2 lg:grid-cols-1">
                <button
                  className={`tool-button ${tool === "freehand" ? "is-active" : ""}`}
                  onClick={() => setTool("freehand")}
                  type="button"
                >
                  <Hand className="h-[18px] w-[18px]" />
                  <span><strong>Main libre</strong><small>Visages, silhouettes</small></span>
                </button>
                <button
                  className={`tool-button ${tool === "rectangle" ? "is-active" : ""}`}
                  onClick={() => setTool("rectangle")}
                  type="button"
                >
                  <RectangleHorizontal className="h-[19px] w-[19px]" />
                  <span><strong>Rectangle</strong><small>Plaques, documents</small></span>
                </button>
              </div>
            </div>

            <div className="tool-section border-t border-[#202321]/12 pt-5">
              <p className="section-kicker"><span>02</span> Rendu</p>
              <div className="mt-3 grid grid-cols-2 gap-2 lg:grid-cols-1">
                <button
                  type="button"
                  onClick={() => setEffect("pixelate")}
                  className={`effect-button ${effect === "pixelate" ? "is-active" : ""}`}
                >
                  <span className="pixel-icon" aria-hidden="true"><i /><i /><i /><i /></span>
                  Pixeliser
                </button>
                <button
                  type="button"
                  onClick={() => setEffect("blur")}
                  className={`effect-button ${effect === "blur" ? "is-active" : ""}`}
                >
                  <span className="blur-icon" aria-hidden="true" />
                  Flouter
                </button>
              </div>

              <label className="mt-5 block" htmlFor="intensity">
                <span className="mb-2 flex items-center justify-between font-mono text-[10px] font-bold uppercase tracking-[0.13em] text-[#59605b]">
                  Intensité <b className="text-[#202321]">{currentStrengthLabel}</b>
                </span>
                <input
                  id="intensity"
                  className="atelier-range"
                  type="range"
                  min={effect === "pixelate" ? 5 : 2}
                  max={effect === "pixelate" ? 40 : 28}
                  value={strength}
                  onChange={(event) => setStrength(Number(event.target.value))}
                />
              </label>
              <p className="mt-3 text-xs leading-5 text-[#68706a]">Réglage appliqué à la prochaine zone dessinée.</p>
            </div>

            <div className="tool-section mt-auto border-t border-[#202321]/12 pt-5">
              <p className="section-kicker"><span>03</span> Corrections</p>
              <div className="mt-3 flex gap-2 lg:flex-col">
                <button
                  className="quiet-action"
                  type="button"
                  disabled={!zones.length}
                  onClick={() => setZones((current) => current.slice(0, -1))}
                >
                  <Undo2 className="h-4 w-4" /> Annuler la dernière
                </button>
                <button className="quiet-action" type="button" disabled={!zones.length} onClick={resetImage}>
                  <Trash2 className="h-4 w-4" /> Tout retirer
                </button>
              </div>
              <p className="mt-3 font-mono text-[10px] uppercase tracking-[0.12em] text-[#7c837e]">⌘ / Ctrl + Z pour annuler</p>
            </div>
          </aside>

          <div className="atelier-stage">
            <div className="stage-topbar">
              <div className="flex items-center gap-3">
                <span className={`status-dot ${imageMeta ? "is-ready" : ""}`} />
                <span className="font-mono text-[10px] font-bold uppercase tracking-[0.14em] text-[#646b66]">
                  {imageMeta ? `Plan de travail / ${zones.length.toString().padStart(2, "0")} zone${zones.length === 1 ? "" : "s"}` : "Plan de travail / en attente"}
                </span>
              </div>
              {imageMeta && (
                <span className="font-mono text-[10px] font-bold uppercase tracking-[0.12em] text-[#646b66]">
                  {imageMeta.width} × {imageMeta.height}
                </span>
              )}
            </div>

            {isEmpty ? (
              <div
                className="empty-stage"
                onDragOver={(event) => event.preventDefault()}
                onDrop={(event) => {
                  event.preventDefault();
                  importFile(event.dataTransfer.files?.[0]);
                }}
              >
                <img className="empty-stage-image" src={lightTableUrl} alt="Texture de table lumineuse abstraite" />
                <div className="empty-stage-content">
                  <div className="mb-6 grid h-16 w-16 place-items-center border border-[#202321]/25 bg-[#f8f5ee] shadow-[5px_5px_0_#ed4a2f]">
                    <ImageUp className="h-7 w-7 text-[#202321]" />
                  </div>
                  <p className="font-mono text-[10px] font-bold uppercase tracking-[0.2em] text-[#ed4a2f]">01 — Importer</p>
                  <h3 className="mt-3 max-w-md font-display text-3xl font-extrabold leading-[0.96] tracking-[-0.05em] sm:text-4xl">Déposez votre photo sur la table.</h3>
                  <p className="mt-4 max-w-md text-sm leading-6 text-[#555c57]">JPG, PNG, WebP ou GIF. L’image est lue et traitée uniquement sur cet appareil.</p>
                  <Button className="upload-button mt-7" type="button" onClick={() => inputRef.current?.click()}>
                    <Upload className="h-4 w-4" /> Choisir une photo
                  </Button>
                  <p className="mt-4 font-mono text-[10px] uppercase tracking-[0.13em] text-[#626963]">ou glissez-la ici</p>
                </div>
                <div className="empty-calibration" aria-hidden="true"><span>000</span><span>075</span><span>150</span><span>225</span></div>
              </div>
            ) : (
              <div className="canvas-viewport">
                <div className="canvas-mat">
                  <canvas
                    ref={canvasRef}
                    className={`photo-canvas ${tool === "freehand" ? "cursor-freehand" : "cursor-crosshair"}`}
                    aria-label="Image à anonymiser. Dessinez une zone à traiter."
                    onPointerDown={onPointerDown}
                    onPointerMove={onPointerMove}
                    onPointerUp={finishDraft}
                    onPointerCancel={finishDraft}
                  />
                  <span className="corner-mark corner-tl" /><span className="corner-mark corner-tr" />
                  <span className="corner-mark corner-bl" /><span className="corner-mark corner-br" />
                </div>
                <div className="canvas-caption">
                  <span><Brush className="h-3.5 w-3.5" /> {tool === "freehand" ? "Dessinez directement sur la zone à masquer" : "Tracez un cadre autour de la zone à masquer"}</span>
                  <span className="hidden sm:inline">Guides visibles, non exportés</span>
                </div>
              </div>
            )}
          </div>

          <aside className="atelier-inspector" aria-label="Informations et export">
            <div className="inspector-card privacy-card">
              <img src={patternUrl} alt="Trame d’anonymisation abstraite" className="privacy-pattern" />
              <div className="relative z-10">
                <div className="mb-5 flex items-center justify-between">
                  <span className="stamp"><ShieldCheck className="h-4 w-4" /> Local</span>
                  <CheckCircle2 className="h-5 w-5 text-[#ed4a2f]" />
                </div>
                <h3 className="font-display text-xl font-extrabold leading-tight tracking-[-0.035em]">Aucun téléversement.</h3>
                <p className="mt-2 text-sm leading-5 text-[#5e655f]">Vos pixels ne quittent ni le navigateur, ni votre appareil.</p>
              </div>
            </div>

            <div className="inspector-card file-card">
              <p className="section-kicker"><span>Fiche</span> image</p>
              {imageMeta ? (
                <div className="mt-4 space-y-3">
                  <div className="flex items-start gap-3">
                    <div className="grid h-9 w-9 shrink-0 place-items-center bg-[#202321] text-[#f7f3ec]"><FileImage className="h-4 w-4" /></div>
                    <div className="min-w-0"><p className="truncate font-semibold">{imageMeta.name}</p><p className="mt-0.5 font-mono text-[10px] uppercase tracking-[0.1em] text-[#747b75]">{formatBytes(imageMeta.size)}</p></div>
                  </div>
                  <div className="grid grid-cols-2 border-y border-[#202321]/10 py-3 font-mono text-[10px] uppercase tracking-[0.12em]">
                    <span className="text-[#747b75]">Définition</span><b className="text-right text-[#202321]">{imageMeta.width} × {imageMeta.height}</b>
                  </div>
                  <div className="flex items-center justify-between font-mono text-[10px] uppercase tracking-[0.12em]"><span className="text-[#747b75]">Masques</span><b>{zones.length.toString().padStart(2, "0")}</b></div>
                  <button type="button" onClick={() => inputRef.current?.click()} className="replace-image"><RotateCcw className="h-3.5 w-3.5" /> Remplacer l’image</button>
                </div>
              ) : (
                <p className="mt-4 text-sm leading-6 text-[#6d746e]">Importez une image pour afficher sa définition et contrôler les zones anonymisées.</p>
              )}
            </div>

            <div className="relative overflow-hidden border border-[#202321] bg-[#202321] p-5 text-[#f8f5ee] shadow-[5px_5px_0_#ed4a2f]">
              <img src={gridUrl} alt="Mosaïque abstraite en arrière-plan" className="absolute inset-0 h-full w-full object-cover opacity-20 mix-blend-screen" />
              <div className="relative z-10">
                <p className="font-mono text-[10px] font-bold uppercase tracking-[0.16em] text-[#ed8c7d]">03 — Exporter</p>
                <h3 className="mt-2 font-display text-xl font-extrabold tracking-[-0.04em]">Image prête ?</h3>
                <label className="mt-5 block" htmlFor="export-format">
                  <span className="mb-2 block font-mono text-[10px] uppercase tracking-[0.12em] text-[#c7cdc7]">Format</span>
                  <select id="export-format" value={format} onChange={(event) => setFormat(event.target.value as ExportFormat)} className="export-select">
                    <option value="image/png">PNG — sans perte</option>
                    <option value="image/jpeg">JPEG — léger</option>
                  </select>
                </label>
                <Button disabled={!imageMeta} onClick={exportImage} className="export-button mt-4 w-full" type="button">
                  <Download className="h-4 w-4" /> Télécharger
                </Button>
                <p className="mt-3 text-[11px] leading-5 text-[#ccd1cc]">Les repères rouges restent dans l’atelier : ils ne sont pas présents dans le fichier téléchargé.</p>
              </div>
            </div>

            <div className="flex gap-2 text-xs leading-5 text-[#69716b]"><Info className="mt-0.5 h-4 w-4 shrink-0 text-[#ed4a2f]" /> Une zone reste modifiable jusqu’à l’export : annulez simplement la dernière sélection si nécessaire.</div>
          </aside>
        </section>
      </main>

      <input
        ref={inputRef}
        className="hidden"
        type="file"
        accept="image/jpeg,image/png,image/webp,image/gif"
        onChange={(event) => {
          importFile(event.target.files?.[0]);
          event.currentTarget.value = "";
        }}
      />

      <footer className="mx-auto max-w-[1600px] px-4 pb-7 pt-2 sm:px-7 lg:px-10">
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[#202321]/12 pt-5 font-mono text-[10px] uppercase tracking-[0.12em] text-[#737a74]">
          <span>Atelier Masque — confidentialité par conception</span>
          <span className="flex items-center gap-2"><ArrowDownToLine className="h-3.5 w-3.5 text-[#ed4a2f]" /> Export en pleine définition</span>
        </div>
      </footer>
    </div>
  );
}
