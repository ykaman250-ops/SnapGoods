import React, { useEffect, useRef, useState } from 'react';
import { Html5QrcodeScanner } from 'html5-qrcode';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from './ui/dialog';

interface AssetScannerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onScanResult: (result: string) => void;
}

export function AssetScanner({ open, onOpenChange, onScanResult }: AssetScannerProps) {
  const scannerRef = useRef<Html5QrcodeScanner | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setError(null);
      
      const onScanSuccess = (decodedText: string, decodedResult: any) => {
        // Only trigger once
        if (scannerRef.current) {
          scannerRef.current.clear().catch(console.error);
        }
        onScanResult(decodedText);
      };

      const onScanFailure = (error: any) => {
        // handle scan failure, usually better to ignore and keep scanning
      };

      // small delay to let DOM render
      setTimeout(() => {
        try {
          const config = {
            fps: 10,
            qrbox: { width: 250, height: 250 },
            aspectRatio: 1.0,
          };
          
          scannerRef.current = new Html5QrcodeScanner(
            "reader",
            config,
            /* verbose= */ false
          );
          
          scannerRef.current.render(onScanSuccess, onScanFailure);
        } catch (err: any) {
          setError(err.message || "Failed to initialize scanner.");
        }
      }, 100);

    } else {
      if (scannerRef.current) {
        scannerRef.current.clear().catch(console.error);
        scannerRef.current = null;
      }
    }
    
    return () => {
      if (scannerRef.current) {
        scannerRef.current.clear().catch(console.error);
      }
    };
  }, [open, onScanResult]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[400px]">
        <DialogHeader>
          <DialogTitle>Scan Asset QR Code</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col items-center justify-center p-4">
          {error && <div className="text-red-500 text-sm mb-4">{error}</div>}
          <div id="reader" className="w-full"></div>
          <p className="text-sm text-muted-foreground mt-4 text-center">
            Point your camera at the asset's QR code.
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
