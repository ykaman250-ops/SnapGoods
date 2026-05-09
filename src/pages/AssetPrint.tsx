import React, { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { api } from '../lib/api';
import { QRCodeSVG } from 'qrcode.react';
import type { Asset } from '../lib/types';
import { useAuth } from '../lib/auth';

export default function AssetPrint() {
  const [searchParams] = useSearchParams();
  const ids = searchParams.get('ids')?.split(',') || [];
  const type = searchParams.get('type') || 'asset'; // 'asset' or 'inventory'
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const { organization } = useAuth();

  useEffect(() => {
    async function loadItems() {
      if (ids.length === 0) {
        setLoading(false);
        return;
      }
      
      try {
        const loaded: any[] = [];
        const collectionName = type === 'inventory' ? 'inventory_items' : 'assets';
        for (const id of ids) {
           const item = await api.get(collectionName, id);
           if (item) loaded.push(item);
        }
        setItems(loaded);
      } catch (error) {
        console.error('Failed to load items for printing', error);
      } finally {
        setLoading(false);
        setTimeout(() => {
          if (ids.length > 0) window.print();
        }, 500);
      }
    }
    loadItems();
  }, [ids.join(','), type]);

  if (loading) {
    return <div className="p-8">Loading labels for generating...</div>;
  }

  if (items.length === 0) {
    return <div className="p-8">No items found to print.</div>;
  }

  return (
    <div className="bg-white text-black min-h-screen">
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 p-4">
        {items.map((item) => (
          <div key={item.id} className="border-2 border-black rounded-xl p-4 flex flex-col items-center justify-center space-y-3 break-inside-avoid shadow-sm print:shadow-none print:border-gray-400">
            <QRCodeSVG 
              value={type === 'inventory' ? `${window.location.origin}/inventory?id=${item.id}` : `${window.location.origin}/assets?id=${item.id}`}
              size={120}
              level="Q"
              includeMargin={false}
            />
          <div className="text-center w-full overflow-hidden">
              <p className="font-bold text-sm truncate">{organization?.name}</p>
              <p className="text-xs font-mono font-semibold truncate mt-1">
                {type === 'inventory' ? item.itemCode : item.assetCode}
              </p>
              {type === 'asset' && item.assetTag && (
                <p className="text-[10px] font-mono text-gray-600 truncate mt-0.5">{item.assetTag}</p>
              )}
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
