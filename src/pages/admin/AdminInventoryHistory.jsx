import { Link } from "react-router-dom";
import { useMemo , useState } from "react";
import { useFirestoreHistory } from "../../hooks/useFirestoreHistory"
import FiltersHistory from "../../components/history/FiltersHistory";
import PaginationHistory from "../../components/history/PaginationsHistory";
import { useGroups } from "../../hooks/useGroup";
import { useCategories } from "../../hooks/useCategorie";

export default function AdminInventoryHistory() {


  const { groups } = useGroups(); 
  const { categories } = useCategories();

  const { 
    data: movements, 
    loading, 
    page, 
    hasNext,
    setPage,
    searchInput, setSearchInput,
    startDate, setStartDate,
    endDate, setEndDate,
    handleSearch, 
    handleReset: originalReset,
    activeSearch, 
    activeStart, 
    activeEnd,
    selectedGroup, setSelectedGroup,
    selectedCat, setSelectedCat
  } = useFirestoreHistory("MouvementsStock", { 
        pageSize: 10, 
        searchField: "Produit" 
      });

  // 3. Étendre le reset pour inclure nos nouveaux filtres
  const customReset = () => {
    setSelectedGroup("");
    setSelectedCat("");
    originalReset();
  };

  const handlePrev = () => setPage(prev => Math.max(1, prev - 1));
  const handleNext = () => setPage(prev => prev + 1);

  const stats = useMemo(() => {
    return movements.reduce(
      (acc, m) => {
        // Sécurité : on s'assure que ce sont bien des nombres
        const q = Number(m.Quantite) || 0;
        const pu = Number(m.PrixUnitaire) || 0;
        const total = q * pu;

        if (m.TypeMouvement === "Entrée") {
          acc.entrees += q;
          acc.valeurEntrees += total;
        } else if (m.TypeMouvement === "Sortie") {
          acc.sorties += q;
          acc.valeurSorties += total;
        }
        return acc;
      },
      { entrees: 0, sorties: 0, valeurEntrees: 0, valeurSorties: 0 }
    );
  }, [movements]);
  
  return (
    <div className="p-4 md:p-8 bg-slate-50 min-h-screen pt-12 md:pt-8">
      <div className="max-w-6xl mx-auto space-y-6 md:space-y-8">

        <Link to="/admin/inventory" className="inline-flex items-center text-secondary font-bold text-xs md:text-sm hover:text-primary transition-colors gap-2">
          ← <span className="hidden sm:inline">Retour à la liste des clients</span><span className="sm:hidden">Retour</span>
        </Link>
        
        {/* HEADER ADAPTATIF */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3 md:gap-4">
            <div>
              <h1 className="text-2xl md:text-3xl font-black text-slate-900 uppercase tracking-tighter">
                Mouvement<span className="text-primary"> des stock</span>
              </h1>
              <p className="text-[10px] md:text-sm text-secondary font-medium uppercase tracking-widest md:normal-case md:tracking-normal">Flux des stocks</p>
            </div>
          </div>
          
        </div>

        {/* BARRE DE RECHERCHE */}
        <FiltersHistory
          searchValue={searchInput}
          onSearchChange={setSearchInput}
          startDate={startDate}
          onStartDateChange={setStartDate}
          endDate={endDate}
          onEndDateChange={setEndDate}
          selectedGroup={selectedGroup}
          onGroupChange={setSelectedGroup}
          selectedCat={selectedCat}
          onCatChange={setSelectedCat}
          groups={groups}
          categories={categories}
          onSubmit={() => handleSearch({ selectedGroup, selectedCat })}
          onReset={customReset}
          loading={loading}
          placeholder="Rechercher un produit..."
        />


        {/* ---  LES STATS --- */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-4xl">
        {/* Carte Entrées */}
        <div className="bg-white p-6 rounded-[2rem] shadow-sm border border-emerald-50">
          <div className="flex justify-between items-start mb-2">
            <span className="text-[10px] font-black text-emerald-600 uppercase tracking-widest">
              Flux Entrant
            </span>
            <span className="bg-emerald-100 text-emerald-700 text-[10px] font-bold px-2 py-1 rounded-lg">
              +{stats.entrees.toLocaleString('fr-FR')} u
            </span>
          </div>
          <div className="flex items-baseline gap-1">
            <span className="text-3xl font-black text-slate-900">
              {stats.valeurEntrees.toLocaleString('fr-FR')}
            </span>
            <span className="text-sm font-bold text-slate-400">Ar</span>
          </div>
        </div>

        {/* Carte Sorties */}
        <div className="bg-white p-6 rounded-[2rem] shadow-sm border border-rose-50">
          <div className="flex justify-between items-start mb-2">
            <span className="text-[10px] font-black text-rose-600 uppercase tracking-widest">
              Flux Sortant
            </span>
            <span className="bg-rose-100 text-rose-700 text-[10px] font-bold px-2 py-1 rounded-lg">
              -{stats.sorties.toLocaleString('fr-FR')} u
            </span>
          </div>
          <div className="flex items-baseline gap-1">
            <span className="text-3xl font-black text-slate-900">
              {stats.valeurSorties.toLocaleString('fr-FR')}
            </span>
            <span className="text-sm font-bold text-slate-400">Ar</span>
          </div>
        </div>
      </div>

        {/* TABLEAU AVEC SCROLLING ET COLONNES PRIORITAIRES */}
        <div className="bg-transparent md:bg-white md:rounded-[2.5rem] md:overflow-hidden md:shadow-sm md:border md:border-slate-100">
  
          {/* --- VUE MOBILE : CARDS --- */}
          <div className="grid grid-cols-1 gap-4 md:hidden">
            {movements.map((mov) => (
              <div key={mov.id} className="bg-white p-5 rounded-[2rem] border border-slate-100 shadow-sm space-y-4">
                
                {/* En-tête : Date & Type */}
                <div className="flex justify-between items-center">
                  <div className="flex items-center gap-2">
                    <span className={`w-2 h-2 rounded-full ${mov.TypeMouvement === 'Entrée' ? 'bg-emerald-500' : 'bg-amber-500'}`}></span>
                    <p className="font-bold text-slate-700 text-xs">{mov.date}</p>
                  </div>
                  <span className={`px-2 py-1 rounded-lg text-[8px] font-black uppercase tracking-widest ${
                    mov.TypeMouvement === 'Entrée' ? 'bg-emerald-50 text-emerald-600 border border-emerald-100' : 'bg-amber-50 text-amber-600 border border-amber-100'
                  }`}>
                    {mov.TypeMouvement}
                  </span>
                </div>

                {/* Produit & Quantité */}
                <div className="flex justify-between items-end bg-slate-50/50 p-3 rounded-t-2xl border-b border-white">
                  <div className="min-w-0">
                    <p className="text-[9px] text-slate-400 font-black uppercase tracking-widest mb-0.5">Produit</p>
                    <p className="font-black text-slate-900 text-base leading-tight line-clamp-4 mb-0.5">{mov.Produit}</p>
                    {Number(mov.ProduitPoids) > 0 && (
                      <p className="text-[10px] text-slate-400 font-bold">
                        {mov.ProduitPoids}g
                      </p>
                    )}
                  </div>
                  <div className="text-right">
                    <p className="text-[9px] text-slate-400 font-black uppercase tracking-widest mb-0.5">Quantité</p>
                    <p className={`text-lg font-black ${
                      mov.TypeMouvement?.toLowerCase().includes('entr') ? 'text-emerald-500' : 'text-rose-500'
                    }`}>
                      {mov.TypeMouvement?.toLowerCase().includes('entr') ? `+${mov.Quantite}` : `-${mov.Quantite}`}
                    </p>
                  </div>
                </div>

                {/* --- NOUVELLE SECTION : PRIX ET TOTAL MOBILE --- */}
                <div className="flex justify-between items-center bg-slate-50/50 p-3 rounded-b-2xl mt-[-16px]">
                  <div>
                    <p className="text-[9px] text-slate-400 font-black uppercase tracking-widest mb-0.5">Prix Unitaire</p>
                    <p className="font-bold text-slate-700 text-xs">{(Number(mov.PrixUnitaire) || 0).toLocaleString('fr-FR')} Ar</p>
                  </div>
                  <div className="text-right">
                    <p className="text-[9px] text-slate-400 font-black uppercase tracking-widest mb-0.5">Total</p>
                    <p className="font-black text-slate-900 text-xs">
                      {((Number(mov.PrixUnitaire) || 0) * (Number(mov.Quantite) || 0)).toLocaleString('fr-FR')} Ar
                    </p>
                  </div>
                </div>

                {/* Raison / Commentaire */}
                <div className="px-1 pt-2">
                  <p className="text-[9px] text-slate-400 font-black uppercase tracking-widest mb-1">Motif du mouvement</p>
                  <p className="text-xs text-slate-600 italic font-medium leading-relaxed">
                    "{mov.Motif}"
                  </p>
                </div>
              </div>
            ))}
          </div>

          {/* --- VUE DESKTOP : TABLEAU --- */}
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-left border-collapse min-w-full">
              <thead className="bg-slate-50 text-secondary text-[10px] uppercase font-black tracking-widest">
                <tr>
                  <th className="p-6">Date & ID</th>
                  <th className="p-6">Produit</th>
                  <th className="p-6 text-center">Type</th>
                  <th className="p-6 text-center">Quantité</th>
                  <th className="p-6 text-right">Valeur</th>
                  <th className="p-6">Raison</th>
                </tr>
              </thead>
              <tbody className="text-sm">
                {movements.map((mov) => (
                  <tr key={mov.id} className="border-t border-slate-50 hover:bg-slate-50/50 transition-colors group">
                    <td className="p-6 whitespace-nowrap">
                      <p className="font-bold text-slate-700 text-xs">{mov.date}</p>
                      <p className="text-[9px] text-slate-400 font-mono tracking-tighter">{mov.id}</p>
                    </td>
                    <td className="p-6">
                      <p className="font-bold text-slate-900">
                        {mov.Produit}
                        {Number(mov.ProduitPoids) > 0 && (
                          <span className="ml-1 text-[10px] text-slate-400 font-bold italic">
                            ({mov.ProduitPoids}g)
                          </span>
                        )}
                      </p>
                    </td>
                    <td className="p-6 text-center">
                      <span className={`px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest whitespace-nowrap ${
                        mov.TypeMouvement === 'Entrée' ? 'bg-emerald-100 text-emerald-600' : 'bg-amber-100 text-amber-600'
                      }`}>
                        {mov.TypeMouvement}
                      </span>
                    </td>
                    <td className="p-6 text-center font-black">
                      <p className={`text-lg font-black ${
                        mov.TypeMouvement?.toLowerCase().includes('entr') ? 'text-emerald-500' : 'text-rose-500'
                      }`}>
                        {mov.TypeMouvement?.toLowerCase().includes('entr') ? `+${mov.Quantite}` : `-${mov.Quantite}`}
                      </p>
                    </td>
                    <td className="p-6 text-right">
                      <div className="flex flex-col justify-end">
                        <span className="text-slate-900 font-bold text-sm">
                          {(Number(mov.PrixUnitaire) || 0).toLocaleString('fr-FR')} Ar
                        </span>
                        <span className="text-[10px] text-slate-400 font-medium">
                          Total: {((Number(mov.PrixUnitaire) || 0) * (Number(mov.Quantite) || 0)).toLocaleString('fr-FR')} Ar
                        </span>
                      </div>
                    </td>
                    <td className="p-6 text-slate-500 italic text-xs">
                      <span className="line-clamp-2 italic">"{mov.Motif}"</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* ---   MESSAGE VIDE / EMPTY STATE   --- */}
          {!loading && movements.length === 0 && (
            <div className="flex flex-col items-center justify-center py-24 px-4 text-center animate-in fade-in duration-500">
              <div className="w-20 h-20 bg-slate-50 rounded-[2rem] flex items-center justify-center mb-6 border border-slate-100 shadow-sm">
                <svg 
                  className="w-10 h-10 text-slate-300" 
                  fill="none" 
                  stroke="currentColor" 
                  viewBox="0 0 24 24"
                >
                  <path 
                    strokeLinecap="round" 
                    strokeLinejoin="round" 
                    strokeWidth="1.5" 
                    d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" 
                  />
                </svg>
              </div>

              <h3 className="text-xl font-black text-slate-800 uppercase tracking-tight">
                {activeSearch || activeStart || activeEnd 
                  ? "Aucun résultat trouvé" 
                  : "Historique vide"}
              </h3>

              <p className="text-sm text-slate-500 max-w-[280px] mx-auto mt-2 leading-relaxed">
                {activeSearch || activeStart || activeEnd 
                  ? `Nous n'avons trouvé aucun mouvement correspondant à vos critères de filtrage.` 
                  : "Il n'y a encore aucun mouvement de stock enregistré dans la base de données."}
              </p>

              {/* Bouton de secours si des filtres sont actifs */}
              {(activeSearch || activeStart || activeEnd) && (
                <button 
                  onClick={handleReset}
                  className="mt-8 px-6 py-2 bg-slate-900 text-white text-[10px] font-black uppercase tracking-[0.2em] rounded-full hover:bg-primary transition-colors shadow-lg shadow-slate-200"
                >
                  Effacer les filtres
                </button>
              )}
            </div>
          )}
        </div>

        {/* BARRE DE PAGINATION (Adaptée) */}
        <PaginationHistory
          page={page}
          hasNext={hasNext}
          loading={loading}
          show={movements.length > 0 || page > 1}
          onPrev={handlePrev}
          onNext={handleNext}
        />

      </div>
    </div>
  );
}