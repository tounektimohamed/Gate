import { useState, useEffect } from 'react';
import { collection, onSnapshot, query, where } from 'firebase/firestore';
import { Users, LogOut, Coffee, ArrowLeftRight } from 'lucide-react';
import { db } from '../firebase';
import { motion } from 'motion/react';

export default function DashboardStats() {
  const [stats, setStats] = useState({
    inside: 0,
    outside: 0,
    guests: 0,
    total: 0
  });

  useEffect(() => {
    // 1. Live count of individuals
    const unsubscribeIndividuals = onSnapshot(collection(db, 'individuals'), (snapshot) => {
      let insideCount = 0;
      let outsideCount = 0;
      let totalCount = 0;

      snapshot.forEach((doc) => {
        const data = doc.data();
        totalCount++;
        if (data.status === 'outside') {
          outsideCount++;
        } else {
          insideCount++;
        }
      });

      setStats(prev => ({
        ...prev,
        inside: insideCount,
        outside: outsideCount,
        total: totalCount
      }));
    });

    // 2. Live count of active guests (where departureTime is null)
    const guestsQuery = query(collection(db, 'guests'), where('departureTime', '==', null));
    const unsubscribeGuests = onSnapshot(guestsQuery, (snapshot) => {
      setStats(prev => ({
        ...prev,
        guests: snapshot.size
      }));
    });

    return () => {
      unsubscribeIndividuals();
      unsubscribeGuests();
    };
  }, []);

  const cardVariants = {
    hidden: { opacity: 0, y: 10 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.3 } }
  };

  return (
    <div id="stats-dashboard-grid" className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
      {/* Inside Camp */}
      <motion.div
        variants={cardVariants}
        initial="hidden"
        animate="visible"
        className="bg-emerald-50 border border-emerald-100 rounded-2xl p-4 flex items-center gap-4 shadow-sm"
      >
        <div className="p-3 bg-emerald-500 text-white rounded-xl">
          <Users className="w-6 h-6" />
        </div>
        <div>
          <span className="block text-xs font-semibold text-emerald-700">المتواجدون بالداخل</span>
          <span className="text-2xl font-extrabold text-emerald-900 font-mono">{stats.inside}</span>
        </div>
      </motion.div>

      {/* Outside Camp */}
      <motion.div
        variants={cardVariants}
        initial="hidden"
        animate="visible"
        transition={{ delay: 0.05 }}
        className="bg-amber-50 border border-amber-100 rounded-2xl p-4 flex items-center gap-4 shadow-sm"
      >
        <div className="p-3 bg-amber-500 text-white rounded-xl">
          <LogOut className="w-6 h-6" />
        </div>
        <div>
          <span className="block text-xs font-semibold text-amber-700">المتواجدون بالخارج</span>
          <span className="text-2xl font-extrabold text-amber-900 font-mono">{stats.outside}</span>
        </div>
      </motion.div>

      {/* Guests */}
      <motion.div
        variants={cardVariants}
        initial="hidden"
        animate="visible"
        transition={{ delay: 0.1 }}
        className="bg-sky-50 border border-sky-100 rounded-2xl p-4 flex items-center gap-4 shadow-sm"
      >
        <div className="p-3 bg-sky-500 text-white rounded-xl">
          <Coffee className="w-6 h-6" />
        </div>
        <div>
          <span className="block text-xs font-semibold text-sky-700">الزوار الحاليون</span>
          <span className="text-2xl font-extrabold text-sky-900 font-mono">{stats.guests}</span>
        </div>
      </motion.div>

      {/* Total Registered */}
      <motion.div
        variants={cardVariants}
        initial="hidden"
        animate="visible"
        transition={{ delay: 0.15 }}
        className="bg-indigo-50 border border-indigo-100 rounded-2xl p-4 flex items-center gap-4 shadow-sm"
      >
        <div className="p-3 bg-indigo-500 text-white rounded-xl">
          <ArrowLeftRight className="w-6 h-6" />
        </div>
        <div>
          <span className="block text-xs font-semibold text-indigo-700">المجموع الكلي للمسجلين</span>
          <span className="text-2xl font-extrabold text-indigo-900 font-mono">{stats.total}</span>
        </div>
      </motion.div>
    </div>
  );
}
