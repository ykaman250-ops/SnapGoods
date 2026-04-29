import React, { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { api } from '../lib/api';
import { QRCodeSVG } from 'qrcode.react';
import type { Asset } from '../lib/types';
import { useAuth } from '../lib/auth';

export default function AssetPrint() {
  const [searchParams] = useSearchParams();
  const ids = searchParams.get('ids')?.split(',') || [];
  const [assets, setAssets] = useState<Asset[]>([]);
  const [loading, setLoading] = useState(true);
  const { organization } = useAuth();

  useEffect(() => {
    async function loadAssets() {
      if (ids.length === 0) {
        setLoading(false);
        return;
      }
      
      try {
        const loaded: Asset[] = [];
        for (const id of ids) {
           const asset = await api.get('assets', id);
           if (asset) loaded.push(asset as Asset);
        }
        setAssets(loaded);
      } catch (error) {
        console.error('Failed to load assets for printing', error);
      } finally {
        setLoading(false);
        setTimeout(() => {
          if (ids.length > 0) window.print();
        }, 500);
      }
    }
    loadAssets();
  }, [ids.join(',')]);

  if (loading) {
    return <div className="p-8">Loading labels for generating...</div>;
  }

  if (assets.length === 0) {
    return <div className="p-8">No assets found to print.</div>;
  }

  return (
    <div className="bg-white text-black min-h-screen">
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 p-4">
        {assets.map((asset) => (
          <div key={asset.id} className="border-2 border-black rounded-xl p-4 flex flex-col items-center justify-center space-y-3 break-inside-avoid shadow-sm print:shadow-none print:border-gray-400">
            <QRCodeSVG 
              value={`${window.location.origin}/assets?id=${asset.id}`}
              size={120}
              level="Q"
              includeMargin={false}
            />
            <div className="text-center w-full overflow-hidden">
                <p className="font-bold text-sm truncate">{organization?.name || 'Organization'}</p>
                <p className="text-xs font-mono font-semibold truncate mt-1">{asset.assetCode || asset.serialNumber || 'No Code'}</p>
                <p className="text-xs truncate">{asset.name}</p>
            </div>
          </div>
        ))}
      </div>
      
      {/* Hide controls when printing */}
      <div className="fixed bottom-4 right-4 print:hidden flex gap-2">
        <button 
          onClick={() => window.print()}
          className="bg-blue-600 text-white px-4 py-2 rounded shadow hover:bg-blue-700"
        >
          Print Now
        </button>
        <button 
          onClick={() => window.close()}
          className="bg-gray-200 text-gray-800 px-4 py-2 rounded shadow hover:bg-gray-300"
        >
          Close
        </button>
      </div>
    </div>
  );
}
