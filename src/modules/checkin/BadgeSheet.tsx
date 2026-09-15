import { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import type { Guest } from '@/data/types';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';

/**
 * Badge preview and print.
 *
 * The QR is generated locally from the guest's stable token, so badges work
 * with no network and nothing about the guest leaves the device.
 */
export function BadgeSheet({
  guest,
  eventName,
  onClose,
}: {
  guest: Guest | null;
  eventName: string;
  onClose: () => void;
}) {
  const [qr, setQr] = useState<string | null>(null);

  useEffect(() => {
    if (!guest) {
      setQr(null);
      return;
    }
    void QRCode.toDataURL(guest.qrToken, { margin: 0, width: 240, errorCorrectionLevel: 'M' }).then(setQr);
  }, [guest]);

  return (
    <Dialog open={Boolean(guest)} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Badge</DialogTitle>
        </DialogHeader>
        {guest && (
          <div
            className="badge-print mx-auto flex aspect-[4/3] w-full max-w-[320px] flex-col items-center justify-center gap-3 rounded-lg border bg-card p-5 text-center"
            data-testid="badge"
          >
            <p className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">{eventName}</p>
            <p className="text-xl font-medium leading-tight">{guest.name}</p>
            {guest.company && <p className="text-sm text-muted-foreground">{guest.company}</p>}
            {qr && <img src={qr} alt={`Badge code for ${guest.name}`} className="size-24" />}
            <p className="font-mono text-[10px] tracking-widest text-muted-foreground">{guest.qrToken}</p>
          </div>
        )}
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>
            Close
          </Button>
          <Button onClick={() => window.print()}>Print badge</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
