import React, { useState, useEffect } from 'react';
import { db, auth } from '../firebase';
import { collection, onSnapshot, query, where } from 'firebase/firestore';
import { Bell, AlertCircle, Calendar, ArrowRight } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface Bill {
  id: string;
  name: string;
  dueDate: string;
  amount: number;
  status: 'pending' | 'paid';
}

export default function BillAlerts() {
  const [upcomingBills, setUpcomingBills] = useState<Bill[]>([]);
  const [checkingBalance, setCheckingBalance] = useState(1250.45); // Simulated FOS Fuel Gauge
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!auth.currentUser) return;

    const q = query(collection(db, 'bills'));
    
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const now = new Date();
      const threeDaysFromNow = new Date();
      threeDaysFromNow.setDate(now.getDate() + 3);

      const billsData = snapshot.docs
        .map(doc => ({ id: doc.id, ...doc.data() } as Bill))
        .filter(bill => {
          if (bill.status === 'paid') return false;
          const due = new Date(bill.dueDate);
          return due >= now && due <= threeDaysFromNow;
        })
        .sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime());

      setUpcomingBills(billsData);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const totalUpcoming = upcomingBills.reduce((sum, b) => sum + b.amount, 0);
  const isLowFuel = checkingBalance < totalUpcoming;

  const requestPermission = () => {
    if ('Notification' in window) {
      Notification.requestPermission();
    }
  };

  if (loading) return null;
  if (upcomingBills.length === 0) return null;

  return (
    <motion.div 
      initial={{ opacity: 0, y: -20 }}
      animate={{ opacity: 1, y: 0 }}
      className="mb-6"
    >
      <div className={`border rounded-2xl p-4 flex flex-col md:flex-row md:items-center justify-between gap-4 transition-colors ${
        isLowFuel ? 'bg-red-50 border-red-100' : 'bg-amber-50 border-amber-100'
      }`}>
        <div className="flex items-start gap-3">
          <div className={`p-2 rounded-xl mt-0.5 ${
            isLowFuel ? 'bg-red-100 text-red-600' : 'bg-amber-100 text-amber-600'
          }`}>
            {isLowFuel ? <AlertCircle size={20} className="animate-pulse" /> : <Bell size={20} className="animate-bounce" />}
          </div>
          <div>
            <h3 className={`text-sm font-bold flex items-center gap-2 ${
              isLowFuel ? 'text-red-900' : 'text-amber-900'
            }`}>
              {isLowFuel ? 'Low Fuel Warning' : 'Bill Alerts'} 
              <span className={`px-2 py-0.5 rounded-full text-[10px] ${
                isLowFuel ? 'bg-red-200 text-red-700' : 'bg-amber-200 text-amber-700'
              }`}>{upcomingBills.length}</span>
            </h3>
            <p className={`text-xs mt-1 ${isLowFuel ? 'text-red-700' : 'text-amber-700'}`}>
              {isLowFuel 
                ? `Warning: Upcoming bills ($${totalUpcoming.toFixed(2)}) exceed your checking balance ($${checkingBalance.toFixed(2)}).`
                : `You have bills due soon. Total: $${totalUpcoming.toFixed(2)}`}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          {upcomingBills.map(bill => (
            <div key={bill.id} className="bg-white/80 backdrop-blur-sm border border-amber-200 px-3 py-1.5 rounded-lg flex items-center gap-3 shadow-sm">
              <div className="flex flex-col">
                <span className="text-xs font-bold text-gray-900">{bill.name}</span>
                <span className="text-[10px] text-amber-600 font-medium flex items-center gap-1">
                  <Calendar size={10} /> {bill.dueDate}
                </span>
              </div>
              <div className="text-xs font-bold text-gray-900 border-l border-amber-200 pl-3">
                ${bill.amount.toFixed(2)}
              </div>
            </div>
          ))}
        </div>

        {Notification.permission === 'default' && (
          <button 
            onClick={requestPermission}
            className="text-[10px] font-bold uppercase tracking-widest text-amber-600 hover:text-amber-700 underline underline-offset-4"
          >
            Enable Browser Alerts
          </button>
        )}
      </div>
    </motion.div>
  );
}
