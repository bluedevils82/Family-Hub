import React, { useState, useEffect } from 'react';
import { db, auth } from '../firebase';
import { collection, onSnapshot, query, orderBy } from 'firebase/firestore';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, LineChart, Line } from 'recharts';
import { TrendingUp, DollarSign, Calendar, BarChart2 } from 'lucide-react';

interface Receipt {
  id: string;
  total: number;
  date: string; // YYYY-MM-DD
}

interface MonthlyData {
  month: string;
  total: number;
}

export default function SpendingTrends() {
  const [data, setData] = useState<MonthlyData[]>([]);
  const [priceHistory, setPriceHistory] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!auth.currentUser) return;

    const q = query(collection(db, 'receipts'), orderBy('date', 'asc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const receipts = snapshot.docs.map(doc => doc.data() as Receipt);
      
      // Group by month
      const monthlyMap: Record<string, number> = {};
      const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

      receipts.forEach(receipt => {
        const date = new Date(receipt.date);
        const monthYear = `${monthNames[date.getMonth()]} ${date.getFullYear().toString().slice(-2)}`;
        monthlyMap[monthYear] = (monthlyMap[monthYear] || 0) + receipt.total;
      });

      const chartData = Object.entries(monthlyMap).map(([month, total]) => ({
        month,
        total: parseFloat(total.toFixed(2))
      }));

      setData(chartData);
    });

    const pq = query(collection(db, 'price_history'), orderBy('date', 'asc'));
    const punsubscribe = onSnapshot(pq, (snapshot) => {
      const history = snapshot.docs.map(doc => doc.data());
      setPriceHistory(history);
      setLoading(false);
    });

    return () => {
      unsubscribe();
      punsubscribe();
    };
  }, []);

  if (loading) return <div className="h-64 flex items-center justify-center text-gray-400">Loading trends...</div>;

  const totalSpent = data.reduce((sum, d) => sum + d.total, 0);

  // Filter history for a specific staple (e.g., "Milk") to show Personal CPI theory
  const milkHistory = priceHistory
    .filter(h => h.itemName.toLowerCase().includes('milk'))
    .map(h => ({
      date: h.date,
      price: h.unitPrice
    }));

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-indigo-50 text-indigo-600 rounded-lg">
            <TrendingUp size={24} />
          </div>
          <div>
            <h2 className="text-xl font-semibold text-gray-900">Spending Trends</h2>
            <p className="text-xs text-gray-500">Monthly grocery expenditure</p>
          </div>
        </div>
        <div className="text-right">
          <span className="text-xs font-bold text-gray-400 uppercase tracking-widest block">Total Tracked</span>
          <span className="text-xl font-bold text-indigo-600">${totalSpent.toFixed(2)}</span>
        </div>
      </div>

      <div className="h-64 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
            <XAxis 
              dataKey="month" 
              axisLine={false} 
              tickLine={false} 
              tick={{ fontSize: 10, fill: '#94a3b8' }}
              dy={10}
            />
            <YAxis 
              axisLine={false} 
              tickLine={false} 
              tick={{ fontSize: 10, fill: '#94a3b8' }}
            />
            <Tooltip 
              cursor={{ fill: '#f8fafc' }}
              contentStyle={{ 
                borderRadius: '12px', 
                border: 'none', 
                boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)',
                fontSize: '12px',
                fontWeight: '600'
              }}
              formatter={(value: number) => [`$${value}`, 'Spent']}
            />
            <Bar 
              dataKey="total" 
              radius={[6, 6, 0, 0]} 
              barSize={32}
            >
              {data.map((entry, index) => (
                <Cell 
                  key={`cell-${index}`} 
                  fill={index === data.length - 1 ? '#6366f1' : '#e2e8f0'} 
                  className="transition-all duration-300 hover:fill-indigo-400"
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="mt-6 grid grid-cols-3 gap-4 border-t border-gray-50 pt-6">
        <div className="flex flex-col gap-1">
          <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Avg / Month</span>
          <span className="text-sm font-bold text-gray-700">
            ${data.length > 0 ? (totalSpent / data.length).toFixed(2) : '0.00'}
          </span>
        </div>
        <div className="flex flex-col gap-1">
          <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Highest</span>
          <span className="text-sm font-bold text-gray-700">
            ${data.length > 0 ? Math.max(...data.map(d => d.total)).toFixed(2) : '0.00'}
          </span>
        </div>
        <div className="flex flex-col gap-1">
          <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Months</span>
          <span className="text-sm font-bold text-gray-700">{data.length}</span>
        </div>
      </div>

      {/* Pillar 2: The Digital Price Book (Personal CPI) Theory */}
      {milkHistory.length > 1 && (
        <div className="mt-8 pt-8 border-t border-gray-50">
          <div className="flex items-center gap-3 mb-6">
            <div className="p-2 bg-amber-50 text-amber-600 rounded-lg">
              <BarChart2 size={24} />
            </div>
            <div>
              <h2 className="text-xl font-semibold text-gray-900">Personal CPI</h2>
              <p className="text-xs text-gray-500">Unit price tracking for staples (e.g., Milk)</p>
            </div>
          </div>
          
          <div className="h-48 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={milkHistory} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis 
                  dataKey="date" 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fontSize: 8, fill: '#94a3b8' }}
                />
                <YAxis 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fontSize: 8, fill: '#94a3b8' }}
                  tickFormatter={(value) => `$${value}`}
                />
                <Tooltip 
                  contentStyle={{ 
                    borderRadius: '12px', 
                    border: 'none', 
                    boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)',
                    fontSize: '10px'
                  }}
                />
                <Line 
                  type="monotone" 
                  dataKey="price" 
                  stroke="#f59e0b" 
                  strokeWidth={3} 
                  dot={{ r: 4, fill: '#f59e0b', strokeWidth: 2, stroke: '#fff' }} 
                  activeDot={{ r: 6 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
          <p className="text-[10px] text-gray-400 mt-4 italic">
            * Tracking unit price fluctuations to identify true sales cycles versus promotional traps.
          </p>
        </div>
      )}
    </div>
  );
}
