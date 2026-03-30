import React, { useState, useEffect } from 'react';
import { db, auth } from '../firebase';
import { collection, addDoc, onSnapshot, query, orderBy, deleteDoc, doc, serverTimestamp, updateDoc } from 'firebase/firestore';
import { CreditCard, Plus, Trash2, Calendar, DollarSign, Wallet } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface Bill {
  id: string;
  name: string;
  dueDate: string;
  amount: number;
  account: string;
  recurring: boolean;
  frequency?: 'WEEKLY' | 'BIWEEKLY' | 'MONTHLY' | 'ANNUALLY';
  autopay?: boolean;
  streamId?: string;
  category?: string;
  status: 'pending' | 'paid';
  addedBy: string;
  timestamp: any;
}

export default function BillTracker() {
  const [bills, setBills] = useState<Bill[]>([]);
  const [name, setName] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [amount, setAmount] = useState('');
  const [account, setAccount] = useState('Checking');
  const [recurring, setRecurring] = useState(true);
  const [frequency, setFrequency] = useState<'WEEKLY' | 'BIWEEKLY' | 'MONTHLY' | 'ANNUALLY'>('MONTHLY');
  const [autopay, setAutopay] = useState(false);
  const [category, setCategory] = useState('Utilities');
  const [loading, setLoading] = useState(true);
  const [showPaid, setShowPaid] = useState(false);

  useEffect(() => {
    const q = query(collection(db, 'bills'), orderBy('dueDate', 'asc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const billsData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Bill));
      setBills(billsData);
      setLoading(false);
    }, (error) => {
      console.error('Bill tracker error:', error);
    });
    return () => unsubscribe();
  }, []);

  const addBill = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !dueDate || !amount || !auth.currentUser) return;

    try {
      await addDoc(collection(db, 'bills'), {
        name: name.trim(),
        dueDate,
        amount: parseFloat(amount),
        account,
        recurring,
        frequency: recurring ? frequency : null,
        autopay: recurring ? autopay : false,
        category,
        status: 'pending',
        addedBy: auth.currentUser.uid,
        timestamp: serverTimestamp()
      });
      setName('');
      setDueDate('');
      setAmount('');
      setAutopay(false);
    } catch (error) {
      console.error('Add bill error:', error);
    }
  };

  const markAsPaid = async (bill: Bill) => {
    try {
      if (bill.recurring) {
        const currentDue = new Date(bill.dueDate);
        let nextDue = new Date(currentDue);

        switch (bill.frequency) {
          case 'WEEKLY':
            nextDue.setDate(currentDue.getDate() + 7);
            break;
          case 'BIWEEKLY':
            nextDue.setDate(currentDue.getDate() + 14);
            break;
          case 'ANNUALLY':
            nextDue.setFullYear(currentDue.getFullYear() + 1);
            break;
          case 'MONTHLY':
          default:
            nextDue.setMonth(currentDue.getMonth() + 1);
            break;
        }

        const nextDueDateStr = nextDue.toISOString().split('T')[0];
        
        await updateDoc(doc(db, 'bills', bill.id), {
          dueDate: nextDueDateStr,
          status: 'pending'
        });
      } else {
        await updateDoc(doc(db, 'bills', bill.id), {
          status: 'paid'
        });
      }
    } catch (error) {
      console.error('Mark as paid error:', error);
    }
  };

  const deleteBill = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'bills', id));
    } catch (error) {
      console.error('Delete bill error:', error);
    }
  };

  const filteredBills = bills.filter(b => showPaid ? b.status === 'paid' : b.status === 'pending');

  const accounts = ['Checking', 'Savings', 'Credit Card', 'Cash'];

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-blue-50 text-blue-600 rounded-lg">
            <CreditCard size={24} />
          </div>
          <h2 className="text-xl font-semibold text-gray-900">Bill Tracker</h2>
        </div>
        <div className="flex bg-gray-100 p-1 rounded-lg">
          <button
            onClick={() => setShowPaid(false)}
            className={`px-3 py-1 text-xs font-bold rounded-md transition-all ${!showPaid ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-500'}`}
          >
            Pending
          </button>
          <button
            onClick={() => setShowPaid(true)}
            className={`px-3 py-1 text-xs font-bold rounded-md transition-all ${showPaid ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-500'}`}
          >
            Paid
          </button>
        </div>
      </div>

      <form onSubmit={addBill} className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-gray-500 uppercase tracking-wider">Bill Name</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Rent, Netflix"
            className="px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-gray-500 uppercase tracking-wider">Due Date</label>
          <input
            type="date"
            value={dueDate}
            onChange={(e) => setDueDate(e.target.value)}
            className="px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-gray-500 uppercase tracking-wider">Amount</label>
          <div className="relative">
            <DollarSign size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="number"
              step="0.01"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0.00"
              className="w-full pl-8 pr-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
            />
          </div>
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-gray-500 uppercase tracking-wider">Account</label>
          <select
            value={account}
            onChange={(e) => setAccount(e.target.value)}
            className="px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
          >
            {accounts.map(acc => <option key={acc} value={acc}>{acc}</option>)}
          </select>
        </div>
        <div className="md:col-span-2 grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
          <div className="flex flex-col gap-2">
            <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer">
              <input
                type="checkbox"
                checked={recurring}
                onChange={(e) => setRecurring(e.target.checked)}
                className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
              />
              Recurring Bill
            </label>
            {recurring && (
              <div className="flex flex-col gap-1">
                <select
                  value={frequency}
                  onChange={(e) => setFrequency(e.target.value as any)}
                  className="px-3 py-1.5 text-xs border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                >
                  <option value="WEEKLY">Weekly</option>
                  <option value="BIWEEKLY">Bi-weekly</option>
                  <option value="MONTHLY">Monthly</option>
                  <option value="ANNUALLY">Annually</option>
                </select>
              </div>
            )}
          </div>

          <div className="flex flex-col gap-2">
            {recurring && (
              <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer">
                <input
                  type="checkbox"
                  checked={autopay}
                  onChange={(e) => setAutopay(e.target.checked)}
                  className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
                />
                Autopay Enabled
              </label>
            )}
          </div>

          <div className="flex justify-end">
            <button
              type="submit"
              className="w-full md:w-auto bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 transition-colors flex items-center justify-center gap-2 font-medium"
            >
              <Plus size={18} /> Add Bill
            </button>
          </div>
        </div>
      </form>

      {loading ? (
        <div className="text-center py-8 text-gray-400">Loading bills...</div>
      ) : (
        <div className="space-y-3">
          <AnimatePresence mode="popLayout">
            {filteredBills.map((bill) => (
              <motion.div
                key={bill.id}
                layout
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="flex items-center justify-between p-4 bg-gray-50 rounded-xl border border-transparent hover:border-blue-100 transition-all group"
              >
                <div className="flex items-center gap-4">
                  <div className={`p-2 rounded-lg shadow-sm ${bill.status === 'paid' ? 'bg-green-50 text-green-600' : 'bg-white text-blue-600'}`}>
                    <Wallet size={20} />
                  </div>
                  <div className="flex flex-col">
                    <span className={`text-sm font-semibold ${bill.status === 'paid' ? 'text-gray-400 line-through' : 'text-gray-900'}`}>{bill.name}</span>
                    <div className="flex items-center gap-3 text-[10px] text-gray-500 uppercase tracking-wider mt-1">
                      <span className="flex items-center gap-1"><Calendar size={10} /> {bill.dueDate}</span>
                      <span className="flex items-center gap-1"><CreditCard size={10} /> {bill.account}</span>
                      {bill.recurring && (
                        <span className="bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded text-[8px] flex items-center gap-1">
                          {bill.frequency?.toLowerCase()}
                          {bill.autopay && <span className="w-1 h-1 bg-blue-700 rounded-full"></span>}
                          {bill.autopay && "autopay"}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <span className={`text-base font-bold ${bill.status === 'paid' ? 'text-gray-400' : 'text-gray-900'}`}>${bill.amount.toFixed(2)}</span>
                  
                  {bill.status === 'pending' && (
                    <button
                      onClick={() => markAsPaid(bill)}
                      className="bg-white border border-blue-200 text-blue-600 px-3 py-1 rounded-lg text-xs font-bold hover:bg-blue-600 hover:text-white transition-all shadow-sm"
                    >
                      Mark Paid
                    </button>
                  )}

                  <button
                    onClick={() => deleteBill(bill.id)}
                    className="text-gray-300 hover:text-red-500 transition-colors p-1 opacity-0 group-hover:opacity-100"
                  >
                    <Trash2 size={18} />
                  </button>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
          {filteredBills.length === 0 && (
            <div className="text-center py-12 text-gray-400 italic">
              {showPaid ? 'No paid bills yet.' : 'No pending bills. You\'re all caught up!'}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
