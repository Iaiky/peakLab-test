import { useState, useEffect } from 'react';
import { db } from '../../firebase/config';
import { useGroups } from '../../hooks/useGroup';
import { 
  collection, 
  getDocs, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  doc, 
  query, 
  orderBy 
} from 'firebase/firestore';

export default function AdminGroups() {
  const { groups, loading } = useGroups();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingGroup, setEditingGroup] = useState(null);
  const [groupName, setGroupName] = useState("");

  //  Ajouter ou Modifier
  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (editingGroup) {
        // Mode Edition
        await updateDoc(doc(db, "Groupes", editingGroup.id), { Nom: groupName });
      } else {
        // Mode Création
        await addDoc(collection(db, "Groupes"), { Nom: groupName, NombreProduit: 0 });
      }
      setIsModalOpen(false);
      setGroupName("");
    } catch (error) {
      alert("Erreur lors de l'enregistrement");
    }
  };

  // 3. Supprimer
  const handleDelete = async (id, count) => {
    if (count > 0) {
      alert("Impossible de supprimer une groupe qui contient encore des produits.");
      return;
    }
    if (window.confirm("Supprimer cette Groupe ?")) {
      await deleteDoc(doc(db, "Groupes", id));
    }
  };

  return (
    <div className="p-4 md:p-8 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-black text-slate-900 uppercase tracking-tighter">Groupes</h1>
          <p className="text-slate-500 text-sm font-medium">Gérez vos groupes de produits</p>
        </div>
        <button 
            onClick={() => { setEditingGroup(null); setGroupName(""); setIsModalOpen(true); }}
            className="bg-primary text-white flex items-center justify-center shadow-lg shadow-primary/20 hover:scale-105 active:scale-95 transition-all
                /* Mobile : Cercle */
                w-12 h-12 rounded-full 
                /* Desktop : Bouton large avec texte */
                md:w-auto md:h-auto md:px-6 md:py-3 md:rounded-2xl"
            >
            {/* Icône Plus (toujours visible) */}
            <svg 
                className="w-6 h-6 md:w-4 md:h-4 md:mr-2" 
                fill="none" 
                stroke="currentColor" 
                viewBox="0 0 24 24"
            >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 4v16m8-8H4" />
            </svg>

            {/* Texte : Caché sur mobile, affiché sur Desktop (md:) */}
            <span className="hidden md:inline font-bold text-sm">
                Nouveau Groupe
            </span>
        </button>
      </div>

      {/* Liste des Groupes */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {loading ? (
          <p className="text-slate-400 font-medium">Chargement...</p>
        ) : groups.map(group => (
          <div key={group.id} className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm hover:shadow-md transition-all group">
            <div className="flex justify-between items-center">
                <div className="flex-1 min-w-0 pr-4">
                    <h3 className="text-lg font-black text-slate-800 truncate mb-1">
                    {group.Nom}
                    </h3>
                    <span className="inline-flex items-center text-[10px] font-black uppercase text-primary bg-blue-50 px-3 py-1 rounded-full">
                    {group.NombreProduit || 0} Produits
                    </span>
                </div>

                {/* Boutons d'action : Visibles sur mobile, hover sur desktop */}
                <div className="flex gap-2 shrink-0 md:opacity-0 md:group-hover:opacity-100 transition-opacity">
                    <button 
                    onClick={() => { setEditingGroup(group); setGroupName(group.Nom); setIsModalOpen(true); }}
                    className="p-3 bg-slate-100 rounded-xl hover:bg-slate-200 text-slate-600 active:scale-90 transition-transform"
                    >
                    ✏️
                    </button>
                    <button 
                    onClick={() => handleDelete(group.id, group.NombreProduit)}
                    className="p-3 bg-red-50 rounded-xl hover:bg-red-100 text-red-500 active:scale-90 transition-transform"
                    >
                    🗑️
                    </button>
                </div>
            </div>
        </div>
        ))}
      </div>

      {/* Modal de Création/Edition */}
      {isModalOpen && (
        <div className="fixed inset-0 z-[400] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <div className="bg-white rounded-[2.5rem] p-8 w-full max-w-sm shadow-2xl animate-in zoom-in duration-200">
            <h2 className="text-xl font-black mb-6 uppercase tracking-tight">
              {editingGroup ? "Modifier groupe" : "Ajouter une groupe"}
            </h2>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="text-[10px] font-bold uppercase text-slate-400 px-1">Nom du Groupe</label>
                <input 
                  autoFocus
                  required
                  type="text"
                  value={groupName}
                  onChange={(e) => setGroupName(e.target.value)}
                  className="w-full bg-slate-50 border-none rounded-2xl p-4 mt-1 focus:ring-2 focus:ring-primary"
                  placeholder="ex: Muscletech"
                />
              </div>
              <div className="flex gap-3 pt-2">
                <button 
                  type="button" 
                  onClick={() => setIsModalOpen(false)}
                  className="flex-1 py-4 font-bold text-slate-500 bg-slate-100 rounded-2xl hover:bg-slate-200"
                >
                  Annuler
                </button>
                <button 
                  type="submit"
                  className="flex-1 py-4 font-bold text-white bg-primary rounded-2xl shadow-lg shadow-primary/20"
                >
                  Enregistrer
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}