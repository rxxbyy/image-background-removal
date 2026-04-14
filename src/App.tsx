import { useState, useCallback, useRef } from "react";
import { removeBackground } from "@imgly/background-removal";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { MaskEditor } from "@/components/MaskEditor";

function App() {
  const [processing, setProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [originalUrl, setOriginalUrl] = useState<string | null>(null);
  const [resultUrl, setResultUrl] = useState<string | null>(null);
  const [finalUrl, setFinalUrl] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [fileName, setFileName] = useState("result.png");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const processImage = useCallback(async (file: File) => {
    setProcessing(true);
    setProgress(0);
    setResultUrl(null);
    setFinalUrl(null);
    setEditing(false);

    const origUrl = URL.createObjectURL(file);
    setOriginalUrl(origUrl);

    try {
      const blob = await removeBackground(file, {
        model: "isnet",
        device: "gpu",
        output: { format: "image/png", quality: 1 },
        progress: (_key: string, current: number, total: number) => {
          if (total > 0) {
            setProgress(Math.round((current / total) * 100));
          }
        },
      });
      const url = URL.createObjectURL(blob);
      setResultUrl(url);
      setFinalUrl(url);
      setFileName(file.name.replace(/\.[^.]+$/, "") + "-no-bg.png");
      setDialogOpen(true);
    } catch (err) {
      console.error(err);
      alert("Failed to remove background. Check console for details.");
    } finally {
      setProcessing(false);
    }
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragOver(false);
      const file = e.dataTransfer.files[0];
      if (file?.type.startsWith("image/")) {
        processImage(file);
      }
    },
    [processImage]
  );

  const handleFileChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) {
        processImage(file);
      }
      e.target.value = "";
    },
    [processImage]
  );

  const handleDownload = useCallback(() => {
    const url = finalUrl ?? resultUrl;
    if (!url) return;
    const a = document.createElement("a");
    a.href = url;
    a.download = fileName;
    a.click();
  }, [finalUrl, resultUrl, fileName]);

  const handleEditorSave = useCallback(
    (blob: Blob) => {
      if (finalUrl && finalUrl !== resultUrl) {
        URL.revokeObjectURL(finalUrl);
      }
      const url = URL.createObjectURL(blob);
      setFinalUrl(url);
      setEditing(false);
    },
    [finalUrl, resultUrl]
  );

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="w-full max-w-md space-y-4">
        <h1 className="text-2xl font-bold text-center">Background Remover</h1>

        <div
          onDragOver={(e) => {
            e.preventDefault();
            setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={handleDrop}
          onClick={() => !processing && fileInputRef.current?.click()}
          className={`border-2 border-dashed rounded-lg p-12 text-center cursor-pointer transition-colors ${
            dragOver
              ? "border-primary bg-primary/5"
              : "border-muted-foreground/25 hover:border-primary/50"
          } ${processing ? "pointer-events-none opacity-50" : ""}`}
        >
          <p className="text-muted-foreground">
            {processing
              ? "Processing..."
              : "Drag & drop an image here, or click to upload"}
          </p>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleFileChange}
            className="hidden"
          />
        </div>

        {processing && (
          <div className="space-y-2">
            <Progress value={progress} />
            <p className="text-sm text-muted-foreground text-center">
              {progress}%
            </p>
          </div>
        )}

        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>{editing ? "Refine Mask" : "Result"}</DialogTitle>
            </DialogHeader>

            {editing && originalUrl && resultUrl ? (
              <MaskEditor
                originalUrl={originalUrl}
                resultUrl={resultUrl}
                onSave={handleEditorSave}
              />
            ) : (
              finalUrl && (
                <div className="space-y-4">
                  <div className="bg-[url('data:image/svg+xml;charset=utf-8,<svg xmlns=%22http://www.w3.org/2000/svg%22 width=%2220%22 height=%2220%22><rect width=%2210%22 height=%2210%22 fill=%22%23ccc%22/><rect x=%2210%22 y=%2210%22 width=%2210%22 height=%2210%22 fill=%22%23ccc%22/></svg>')] rounded-lg">
                    <img
                      src={finalUrl}
                      alt="Result"
                      className="max-h-[60vh] w-full object-contain"
                    />
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      onClick={() => setEditing(true)}
                      className="flex-1"
                    >
                      Refine
                    </Button>
                    <Button onClick={handleDownload} className="flex-1">
                      Download
                    </Button>
                  </div>
                </div>
              )
            )}
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}

export default App;
