import React, { useState, useEffect } from 'react';
import { db, auth } from '../firebase';
import { collection, addDoc, onSnapshot, query, orderBy, updateDoc, deleteDoc, doc, serverTimestamp } from 'firebase/firestore';
import { Plus, Trash2, CheckCircle2, Circle, ShoppingBasket, Tag } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface GroceryItem {
  id: string;
  name: string;
  category: string;
  checked: boolean;
  aisleLocation?: {
    aisle: string;
    bay: string;
    shelf: string;
  };
  stockLevel?: 'HIGH' | 'LOW' | 'TEMPORARILY_OUT_OF_STOCK';
  addedBy: string;
  timestamp: any;
}

export default function GroceryList() {
  const [items, setItems] = useState<GroceryItem[]>([]);
  const [newItem, setNewItem] = useState('');
  const [category, setCategory] = useState('General');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const q = query(collection(db, 'grocery_items'), orderBy('timestamp', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const itemsData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as GroceryItem));
      
      // Implement Pillar 1: Aisle Mapping Theory
      // Sort by aisle if available, then by bay, then by name
      const sortedData = [...itemsData].sort((a, b) => {
        if (a.checked !== b.checked) return a.checked ? 1 : -1;
        
        const aisleA = a.aisleLocation?.aisle || 'ZZZ';
        const aisleB = b.aisleLocation?.aisle || 'ZZZ';
        if (aisleA !== aisleB) return aisleA.localeCompare(aisleB);
        
        const bayA = a.aisleLocation?.bay || 'ZZZ';
        const bayB = b.aisleLocation?.bay || 'ZZZ';
        if (bayA !== bayB) return bayA.localeCompare(bayB);
        
        return a.name.localeCompare(b.name);
      });

      setItems(sortedData);
      setLoading(false);
    }, (error) => {
      console.error('Grocery list error:', error);
    });
    return () => unsubscribe();
  }, []);

  const addItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newItem.trim() || !auth.currentUser) return;

    try {
      await addDoc(collection(db, 'grocery_items'), {
        name: newItem.trim(),
        category,
        checked: false,
        addedBy: auth.currentUser.uid,
        timestamp: serverTimestamp()
      });
      setNewItem('');
    } catch (error) {
      console.error('Add item error:', error);
    }
  };

  const toggleItem = async (id: string, checked: boolean) => {
    try {
      await updateDoc(doc(db, 'grocery_items', id), { checked: !checked });
    } catch (error) {
      console.error('Toggle item error:', error);
    }
  };

  const deleteItem = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'grocery_items', id));
    } catch (error) {
      console.error('Delete item error:', error);
    }
  };

  const categories = ['General', 'Produce', 'Dairy', 'Meat', 'Frozen', 'Pantry', 'Household'];

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
      <div className="flex items-center gap-3 mb-6">
        <div className="p-2 bg-green-50 text-green-600 rounded-lg">
          <ShoppingBasket size={24} />
        </div>
        <h2 className="text-xl font-semibold text-gray-900">Grocery List</h2>
      </div>

      <form onSubmit={addItem} className="flex flex-col gap-3 mb-8">
        <div className="flex gap-2">
          <input
            type="text"
            value={newItem}
            onChange={(e) => setNewItem(e.target.value)}
            placeholder="Add an item..."
            className="flex-1 px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-500"
          />
          <button
            type="submit"
            className="bg-green-600 text-white p-2 rounded-lg hover:bg-green-700 transition-colors"
          >
            <Plus size={24} />
          </button>
        </div>
        <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
          {categories.map((cat) => (
            <button
              key={cat}
              type="button"
              onClick={() => setCategory(cat)}
              className={`px-3 py-1 rounded-full text-xs font-medium whitespace-nowrap transition-colors ${
                category === cat ? 'bg-green-100 text-green-700' : 'bg-gray-50 text-gray-500 hover:bg-gray-100'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      </form>

      {loading ? (
        <div className="text-center py-8 text-gray-400">Loading items...</div>
      ) : (
        <div className="space-y-2">
          <AnimatePresence mode="popLayout">
            {items.map((item) => (
              <motion.div
                key={item.id}
                layout
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className={`flex items-center justify-between p-3 rounded-xl border transition-all ${
                  item.checked ? 'bg-gray-50 border-transparent' : 'bg-white border-gray-100 hover:border-green-200'
                }`}
              >
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => toggleItem(item.id, item.checked)}
                    className={`transition-colors ${item.checked ? 'text-green-500' : 'text-gray-300 hover:text-green-500'}`}
                  >
                    {item.checked ? <CheckCircle2 size={22} /> : <Circle size={22} />}
                  </button>
                  <div className="flex flex-col">
                    <span className={`text-sm font-medium ${item.checked ? 'line-through text-gray-400' : 'text-gray-700'}`}>
                      {item.name}
                    </span>
                    <span className="text-[10px] text-gray-400 flex items-center gap-1">
                      <Tag size={10} /> {item.category}
                    </span>
                  </div>
                </div>
                <button
                  onClick={() => deleteItem(item.id)}
                  className="text-gray-300 hover:text-red-500 transition-colors p-1"
                >
                  <Trash2 size={18} />
                </button>
              </motion.div>
            ))}
          </AnimatePresence>
          {items.length === 0 && (
            <div className="text-center py-12 text-gray-400 italic">
              Your list is empty. Time to stock up!
            </div>
          )}
        </div>
      )}
    </div>
  );
}
