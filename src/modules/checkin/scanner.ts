/**
 * Badge scanning.
 *
 * Chrome ships a native BarcodeDetector; Safari and Firefox do not, so a
 * ZXing fallback is loaded on demand only where it is needed. Both paths hand
 * back the same decoded string, and neither requires a network.
 */
export type ScanHandler = (value: string) => void;

export interface ScannerHandle {
  stop: () => void;
  method: 'native' | 'zxing';
}

interface BarcodeDetectorLike {
  detect(source: CanvasImageSource): Promise<Array<{ rawValue: string }>>;
}

declare global {
  interface Window {
    BarcodeDetector?: new (options?: { formats?: string[] }) => BarcodeDetectorLike;
  }
}

export function scannerSupported(): boolean {
  return typeof navigator !== 'undefined' && Boolean(navigator.mediaDevices?.getUserMedia);
}

export async function startScanner(video: HTMLVideoElement, onScan: ScanHandler): Promise<ScannerHandle> {
  const stream = await navigator.mediaDevices.getUserMedia({
    video: { facingMode: 'environment' },
    audio: false,
  });
  video.srcObject = stream;
  video.setAttribute('playsinline', 'true');
  await video.play();

  let stopped = false;
  const stopStream = () => {
    stopped = true;
    for (const track of stream.getTracks()) track.stop();
  };

  if (window.BarcodeDetector) {
    const detector = new window.BarcodeDetector({ formats: ['qr_code', 'code_128', 'ean_13'] });
    const tick = async () => {
      if (stopped) return;
      try {
        const results = await detector.detect(video);
        if (results[0]?.rawValue) onScan(results[0].rawValue);
      } catch {
        /* a dropped frame is not an error worth surfacing */
      }
      if (!stopped) requestAnimationFrame(() => void tick());
    };
    void tick();
    return { stop: stopStream, method: 'native' };
  }

  const { BrowserMultiFormatReader } = await import('@zxing/browser');
  const reader = new BrowserMultiFormatReader();
  const controls = await reader.decodeFromVideoElement(video, (result) => {
    if (result) onScan(result.getText());
  });
  return {
    stop: () => {
      controls.stop();
      stopStream();
    },
    method: 'zxing',
  };
}
