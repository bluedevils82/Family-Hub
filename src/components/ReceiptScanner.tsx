import React, { useState, useEffect, useRef } from 'react';
import { db, auth } from '../firebase';
import { collection, addDoc, onSnapshot, query, orderBy, limit, serverTimestamp } from 'firebase/firestore';
import { Camera, Upload, Loader2, Receipt as ReceiptIcon, History, TrendingUp, DollarSign } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface Receipt {
  id: string;
  store: string;
  merchantName: string;
  date: string;
  total: number;
  category: string;
  items: { name: string; price: number; quantity: number; isPersonal?: boolean }[];
  scannedBy: string;
  timestamp: any;
}

export default function ReceiptScanner() {
  const [receipts, setReceipts] = useState<Receipt[]>([]);
  const [scanning, setScanning] = useState(false);
  const [loading, setLoading] = useState(true);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const q = query(collection(db, 'receipts'), orderBy('timestamp', 'desc'), limit(10));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const receiptsData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Receipt));
      setReceipts(receiptsData);
      setLoading(false);
    }, (error) => {
      console.error('Receipt scanner error:', error);
    });
    return () => unsubscribe();
  }, []);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !auth.currentUser) return;

    setScanning(true);
    try {
      const reader = new FileReader();
      reader.onloadend = async () => {
        const base64Data = (reader.result as string).split(',')[1];
        await scanReceipt(base64Data);
      };
      reader.readAsDataURL(file);
    } catch (error) {
      console.error('File upload error:', error);
      setScanning(false);
    }
  };

  const scanReceipt = async (base64Data: string) => {
    // Loaded on first scan so the AI client is not part of the initial download.
    const { GoogleGenAI } = await import('@google/genai');
    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });
    const model = ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: [
        {
          parts: [
            { inlineData: { data: base64Data, mimeType: 'image/jpeg' } },
            { text: 'Extract the store name, human-readable merchant name, date (YYYY-MM-DD), total amount, personal finance category (e.g., Food and Drink), and a list of items with their prices and quantities from this receipt. Return as JSON: { "store": string, "merchantName": string, "date": string, "total": number, "category": string, "items": [{ "name": string, "price": number, "quantity": number }] }. Assume all items are for the Family Budget (isPersonal: false) by default.' }
          ]
        }
      ],
      config: { responseMimeType: 'application/json' }
    });

    try {
      const response = await model;
      const data = JSON.parse(response.text || '{}');
      
      if (data.store && data.total) {
        // Save the receipt
        const receiptRef = await addDoc(collection(db, 'receipts'), {
          ...data,
          scannedBy: auth.currentUser?.uid,
          timestamp: serverTimestamp()
        });

        // Implement Pillar 2: The Digital Price Book Theory
        // Save unit prices for trend analysis (Personal CPI)
        const priceHistoryPromises = data.items.map((item: any) => {
          const unitPrice = item.price / (item.quantity || 1);
          return addDoc(collection(db, 'price_history'), {
            itemName: item.name,
            unitPrice,
            date: data.date,
            store: data.store,
            timestamp: serverTimestamp()
          });
        });

        await Promise.all(priceHistoryPromises);
      }
    } catch (error) {
      console.error('Scanning error:', error);
    } finally {
      setScanning(false);
    }
  };

  const totalSpent = receipts.reduce((sum, r) => sum + r.total, 0);

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-purple-50 text-purple-600 rounded-lg">
            <ReceiptIcon size={24} />
          </div>
          <h2 className="text-xl font-semibold text-gray-900">Receipt Scanner</h2>
        </div>
        <button
          onClick={() => fileInputRef.current?.click()}
          disabled={scanning}
          className="flex items-center gap-2 bg-purple-600 text-white px-4 py-2 rounded-lg hover:bg-purple-700 transition-colors disabled:opacity-50 font-medium"
        >
          {scanning ? <Loader2 size={18} className="animate-spin" /> : <Camera size={18} />}
          {scanning ? 'Scanning...' : 'Scan Receipt'}
        </button>
        <input
          type="file"
          ref={fileInputRef}
          onChange={handleFileUpload}
          accept="image/*"
          className="hidden"
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
        <div className="bg-purple-50 rounded-xl p-4 border border-purple-100">
          <div className="flex items-center gap-2 text-purple-600 mb-1">
            <TrendingUp size={16} />
            <span className="text-xs font-bold uppercase tracking-wider">Recent Spending</span>
          </div>
          <div className="flex items-baseline gap-1">
            <span className="text-2xl font-bold text-purple-900">${totalSpent.toFixed(2)}</span>
            <span className="text-xs text-purple-500">last 10 receipts</span>
          </div>
        </div>
        <div className="bg-blue-50 rounded-xl p-4 border border-blue-100">
          <div className="flex items-center gap-2 text-blue-600 mb-1">
            <History size={16} />
            <span className="text-xs font-bold uppercase tracking-wider">Kroger Points</span>
          </div>
          <div className="flex items-baseline gap-1">
            <span className="text-2xl font-bold text-blue-900">1,240</span>
            <span className="text-xs text-blue-500">pts available</span>
          </div>
        </div>
      </div>

      <div className="space-y-4">
        <h3 className="text-sm font-bold text-gray-400 uppercase tracking-widest flex items-center gap-2">
          <History size={14} /> Scan History
        </h3>
        {loading ? (
          <div className="text-center py-8 text-gray-400">Loading history...</div>
        ) : (
          <div className="space-y-3">
            <AnimatePresence mode="popLayout">
              {receipts.map((receipt) => (
                <motion.div
                  key={receipt.id}
                  layout
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="p-4 bg-gray-50 rounded-xl border border-transparent hover:border-purple-100 transition-all"
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex flex-col">
                      <span className="text-sm font-bold text-gray-900">{receipt.store}</span>
                      <span className="text-[10px] text-gray-400">{receipt.date}</span>
                    </div>
                    <span className="text-base font-bold text-purple-600">${receipt.total.toFixed(2)}</span>
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {receipt.items?.slice(0, 3).map((item, idx) => (
                      <span key={idx} className="text-[10px] bg-white border border-gray-100 px-2 py-0.5 rounded-full text-gray-500">
                        {item.name}
                      </span>
                    ))}
                    {receipt.items?.length > 3 && (
                      <span className="text-[10px] text-gray-400 px-2 py-0.5">+{receipt.items.length - 3} more</span>
                    )}
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
            {receipts.length === 0 && (
              <div className="text-center py-12 text-gray-400 italic">
                No receipts scanned yet. Upload your first one!
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
