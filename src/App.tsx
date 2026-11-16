import { useState, useEffect, lazy, Suspense } from 'react';
import { auth } from './firebase';
import { onAuthStateChanged, User } from 'firebase/auth';
import Auth from './components/Auth';
import GroceryList from './components/GroceryList';
import BillTracker from './components/BillTracker';
import ReceiptScanner from './components/ReceiptScanner';
import BillAlerts from './components/BillAlerts';

// The charting library is the largest dependency; load it only once someone is signed in.
const SpendingTrends = lazy(() => import('./components/SpendingTrends'));
import { LayoutDashboard, ShoppingBasket, CreditCard, Receipt as ReceiptIcon, Home, Menu, X, Bell, TrendingUp } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

type Tab = 'dashboard' | 'grocery' | 'bills' | 'receipts';

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [activeTab, setActiveTab] = useState<Tab>('dashboard');
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
    });
    return () => unsubscribe();
  }, []);

  const tabs: { id: Tab; label: string; icon: any; color: string }[] = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard, color: 'blue' },
    { id: 'grocery', label: 'Grocery List', icon: ShoppingBasket, color: 'green' },
    { id: 'bills', label: 'Bill Tracker', icon: CreditCard, color: 'blue' },
    { id: 'receipts', label: 'Receipt Scanner', icon: ReceiptIcon, color: 'purple' },
  ];

  const renderContent = () => {
    if (!user) {
      return (
        <div className="flex flex-col items-center justify-center min-h-[60vh] text-center p-6">
          <div className="w-20 h-20 bg-blue-50 text-blue-600 rounded-3xl flex items-center justify-center mb-6">
            <Home size={40} />
          </div>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Welcome to Family Hub</h1>
          <p className="text-gray-500 max-w-md mb-8">
            The all-in-one organizer for your family's groceries, bills, and spending trends.
          </p>
          <Auth />
        </div>
      );
    }

    switch (activeTab) {
      case 'dashboard':
        return (
          <div className="space-y-6">
            <BillAlerts />
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="space-y-6">
                <Suspense fallback={<div className="h-64 rounded-2xl bg-white border border-gray-100 animate-pulse" aria-hidden="true" />}>
                  <SpendingTrends />
                </Suspense>
                <GroceryList />
              </div>
              <div className="space-y-6">
                <BillTracker />
                <ReceiptScanner />
              </div>
            </div>
          </div>
        );
      case 'grocery':
        return <GroceryList />;
      case 'bills':
        return <BillTracker />;
      case 'receipts':
        return <ReceiptScanner />;
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 font-sans text-gray-900">
      {/* Mobile Header */}
      <header className="lg:hidden bg-white border-b border-gray-200 px-4 py-3 flex items-center justify-between sticky top-0 z-50">
        <div className="flex items-center gap-2">
          <div className="p-1.5 bg-blue-600 text-white rounded-lg">
            <Home size={20} />
          </div>
          <span className="font-bold text-lg tracking-tight">Family Hub</span>
        </div>
        <button onClick={() => setIsSidebarOpen(true)} className="p-2 text-gray-500" aria-label="Open menu">
          <Menu size={24} />
        </button>
      </header>

      <div className="flex">
        {/* Sidebar */}
        <aside className={`
          fixed inset-y-0 left-0 z-50 w-64 bg-white border-r border-gray-200 transform transition-transform duration-300 ease-in-out lg:relative lg:translate-x-0
          ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'}
        `}>
          <div className="h-full flex flex-col p-6">
            <div className="hidden lg:flex items-center gap-3 mb-10">
              <div className="p-2 bg-blue-600 text-white rounded-xl shadow-lg shadow-blue-200">
                <Home size={24} />
              </div>
              <span className="font-bold text-xl tracking-tight">Family Hub</span>
            </div>

            <nav className="flex-1 space-y-1">
              {tabs.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => {
                    setActiveTab(tab.id);
                    setIsSidebarOpen(false);
                  }}
                  className={`
                    w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all
                    ${activeTab === tab.id 
                      ? 'bg-blue-50 text-blue-600' 
                      : 'text-gray-500 hover:bg-gray-50 hover:text-gray-900'}
                  `}
                >
                  <tab.icon size={20} />
                  {tab.label}
                </button>
              ))}
            </nav>

            <div className="pt-6 border-t border-gray-100">
              <Auth />
            </div>
          </div>
          
          {/* Mobile Close Button */}
          <button 
            onClick={() => setIsSidebarOpen(false)}
            className="lg:hidden absolute top-4 right-4 p-2 text-gray-400"
            aria-label="Close menu"
          >
            <X size={24} />
          </button>
        </aside>

        {/* Overlay */}
        {isSidebarOpen && (
          <div 
            className="fixed inset-0 bg-black/20 backdrop-blur-sm z-40 lg:hidden"
            onClick={() => setIsSidebarOpen(false)}
          />
        )}

        {/* Main Content */}
        <main className="flex-1 p-4 lg:p-8 max-w-7xl mx-auto w-full">
          <AnimatePresence mode="wait">
            <motion.div
              key={activeTab + (user ? 'auth' : 'noauth')}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
            >
              {renderContent()}
            </motion.div>
          </AnimatePresence>
        </main>
      </div>
    </div>
  );
}
