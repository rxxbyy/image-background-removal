import { useRef, useEffect, useState, useCallback } from "react";
import { Button } from "@/components/ui/button";

interface MaskEditorProps {
  originalUrl: string;
  resultUrl: string;
  onSave: (blob: Blob) => void;
}

type BrushMode = "keep" | "remove";

export function MaskEditor({ originalUrl, resultUrl, onSave }: MaskEditorProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [brushSize, setBrushSize] = useState(20);
  const [mode, setMode] = useState<BrushMode>("keep");
  const [painting, setPainting] = useState(false);
  const [canvasReady, setCanvasReady] = useState(false);

  // Store image data in refs to avoid re-renders
  const originalImg = useRef<HTMLImageElement | null>(null);
  const resultImg = useRef<HTMLImageElement | null>(null);
  const originalData = useRef<ImageData | null>(null);
  const displayScale = useRef(1);

  // Load both images and initialize canvas
  useEffect(() => {
    setCanvasReady(false);
    const origImg = new Image();
    const resImg = new Image();
    let loaded = 0;

    const onLoad = () => {
      loaded++;
      if (loaded < 2) return;

      originalImg.current = origImg;
      resultImg.current = resImg;

      const canvas = canvasRef.current;
      const container = containerRef.current;
      if (!canvas || !container) return;

      const w = resImg.naturalWidth;
      const h = resImg.naturalHeight;

      // Fit canvas into container while keeping aspect ratio
      const maxW = container.clientWidth;
      const maxH = window.innerHeight * 0.55;
      const scale = Math.min(maxW / w, maxH / h, 1);
      displayScale.current = scale;

      canvas.width = w;
      canvas.height = h;
      canvas.style.width = `${w * scale}px`;
      canvas.style.height = `${h * scale}px`;

      // Draw the result (background-removed) image
      const ctx = canvas.getContext("2d")!;
      ctx.clearRect(0, 0, w, h);
      ctx.drawImage(resImg, 0, 0);

      // Cache original image pixel data for "keep" brush
      const tmpCanvas = document.createElement("canvas");
      tmpCanvas.width = w;
      tmpCanvas.height = h;
      const tmpCtx = tmpCanvas.getContext("2d")!;
      tmpCtx.drawImage(origImg, 0, 0, w, h);
      originalData.current = tmpCtx.getImageData(0, 0, w, h);

      setCanvasReady(true);
    };

    origImg.crossOrigin = "anonymous";
    resImg.crossOrigin = "anonymous";
    origImg.onload = onLoad;
    resImg.onload = onLoad;
    origImg.src = originalUrl;
    resImg.src = resultUrl;
  }, [originalUrl, resultUrl]);

  const getCanvasPos = useCallback(
    (e: React.MouseEvent | React.TouchEvent) => {
      const canvas = canvasRef.current;
      if (!canvas) return null;
      const rect = canvas.getBoundingClientRect();
      const scale = displayScale.current;
      const clientX = "touches" in e ? e.touches[0].clientX : e.clientX;
      const clientY = "touches" in e ? e.touches[0].clientY : e.clientY;
      return {
        x: (clientX - rect.left) / scale,
        y: (clientY - rect.top) / scale,
      };
    },
    []
  );

  const paint = useCallback(
    (x: number, y: number) => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext("2d")!;
      const r = brushSize / displayScale.current;

      if (mode === "remove") {
        // Erase pixels (make transparent)
        ctx.save();
        ctx.globalCompositeOperation = "destination-out";
        ctx.beginPath();
        ctx.arc(x, y, r, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      } else {
        // Restore original pixels in the brushed area
        const origPixels = originalData.current;
        if (!origPixels) return;

        const w = canvas.width;
        const h = canvas.height;
        const imgData = ctx.getImageData(0, 0, w, h);

        const startX = Math.max(0, Math.floor(x - r));
        const endX = Math.min(w - 1, Math.ceil(x + r));
        const startY = Math.max(0, Math.floor(y - r));
        const endY = Math.min(h - 1, Math.ceil(y + r));

        for (let py = startY; py <= endY; py++) {
          for (let px = startX; px <= endX; px++) {
            const dx = px - x;
            const dy = py - y;
            if (dx * dx + dy * dy <= r * r) {
              const i = (py * w + px) * 4;
              imgData.data[i] = origPixels.data[i];
              imgData.data[i + 1] = origPixels.data[i + 1];
              imgData.data[i + 2] = origPixels.data[i + 2];
              imgData.data[i + 3] = origPixels.data[i + 3];
            }
          }
        }
        ctx.putImageData(imgData, 0, 0);
      }
    },
    [mode, brushSize]
  );

  const handlePointerDown = useCallback(
    (e: React.MouseEvent | React.TouchEvent) => {
      e.preventDefault();
      setPainting(true);
      const pos = getCanvasPos(e);
      if (pos) paint(pos.x, pos.y);
    },
    [getCanvasPos, paint]
  );

  const handlePointerMove = useCallback(
    (e: React.MouseEvent | React.TouchEvent) => {
      if (!painting) return;
      e.preventDefault();
      const pos = getCanvasPos(e);
      if (pos) paint(pos.x, pos.y);
    },
    [painting, getCanvasPos, paint]
  );

  const handlePointerUp = useCallback(() => {
    setPainting(false);
  }, []);

  const handleSave = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.toBlob((blob) => {
      if (blob) onSave(blob);
    }, "image/png");
  }, [onSave]);

  const handleReset = useCallback(() => {
    const canvas = canvasRef.current;
    const img = resultImg.current;
    if (!canvas || !img) return;
    const ctx = canvas.getContext("2d")!;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, 0, 0);
  }, []);

  return (
    <div className="space-y-3">
      {/* Toolbar */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex gap-1">
          <Button
            variant={mode === "keep" ? "default" : "outline"}
            size="sm"
            onClick={() => setMode("keep")}
          >
            Keep
          </Button>
          <Button
            variant={mode === "remove" ? "default" : "outline"}
            size="sm"
            onClick={() => setMode("remove")}
          >
            Remove
          </Button>
        </div>

        <div className="flex items-center gap-2 flex-1 min-w-[140px]">
          <span className="text-xs text-muted-foreground whitespace-nowrap">
            Brush: {brushSize}px
          </span>
          <input
            type="range"
            min={5}
            max={100}
            step={1}
            value={brushSize}
            onChange={(e) => setBrushSize(Number(e.target.value))}
            className="flex-1"
          />
        </div>

        <Button variant="outline" size="sm" onClick={handleReset}>
          Reset
        </Button>
      </div>

      {/* Canvas */}
      <div
        ref={containerRef}
        className="checkerboard rounded-lg flex justify-center"
      >
        <canvas
          ref={canvasRef}
          className={canvasReady ? "cursor-crosshair" : ""}
          onMouseDown={handlePointerDown}
          onMouseMove={handlePointerMove}
          onMouseUp={handlePointerUp}
          onMouseLeave={handlePointerUp}
          onTouchStart={handlePointerDown}
          onTouchMove={handlePointerMove}
          onTouchEnd={handlePointerUp}
        />
      </div>

      {/* Actions */}
      <div className="flex gap-2">
        <Button onClick={handleSave} className="flex-1">
          Done
        </Button>
      </div>
    </div>
  );
}
