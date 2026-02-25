import { useState, useEffect } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { db } from '../../firebase/config';
import { doc, collection, runTransaction, serverTimestamp, getDocs } from 'firebase/firestore';
import { useInventoryPagination } from '../../hooks/useInventoryPagination';
import  PaginationHistory  from '../../components/history/PaginationsHistory'
import { useCategories } from '../../hooks/useCategorie';
import GroupTabs from '../../components/GroupTabs';
import StockMovementModal from '../../components/admin/StockMovementModal';

export default function AdminInventory() {

  const [searchParams, setSearchParams] = useSearchParams();
  const [groups, setGroups] = useState([]);
  
  // 1. Récupération du groupe actif depuis l'URL
  const currentGroupId = searchParams.get("group") || "";

  const { 
    data: products, 
    setData,
    loading, 
    page, 
    hasNext, 
    setPage, 
    searchInput, 
    activeSearch,
    setSearchInput, 
    updateFilters 
  } = useInventoryPagination(10);

  const [selectedProduct, setSelectedProduct] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [movementType, setMovementType] = useState('IN');
  const [quantity, setQuantity] = useState(1);
  const [unitPrice, setUnitPrice] = useState('');
  const [comment, setComment] = useState("");

  // 2. Charger les groupes au démarrage
  useEffect(() => {
    const fetchGroups = async () => {
      const snap = await getDocs(collection(db, "Groupes"));
      const list = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setGroups(list);
      
      // Si aucun groupe n'est dans l'URL, on prend le premier
      if (!currentGroupId && list.length > 0) {
        setSearchParams({ group: list[0].id });
      }
    };
    fetchGroups();
  }, [currentGroupId, setSearchParams]);

    // Fonction pour transformer l'IdCategorie en Nom lisible
    // 1. Récupérer les catégories (si ce n'est pas déjà fait)
    const [allCategoriesDocs, setAllCategoriesDocs] = useState([]);
    useEffect(() => {
      const fetchCats = async () => {
        const snap = await getDocs(collection(db, "categories"));
        setAllCategoriesDocs(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      };
      fetchCats();
    }, []);

    // 2. LA FONCTION QUI MANQUAIT
    const getCatName = (id) => {
      if (!id) return "Général";
      const found = allCategoriesDocs.find(c => c.id === id);
      return found ? found.Nom : "Général";
    };

  const openMovementModal = (product, type) => {
    setSelectedProduct(product);
    setMovementType(type);
    setIsModalOpen(true);
  };

  const handleConfirm = async () => {
    // On récupère les valeurs numériques proprement au début
    const moveQty = Number(quantity);
    const pPrice = Number(unitPrice);
    let updatedStockValue;
    const reference =
      selectedProduct.id +
      "_" +
      moveQty +
      new Date()
        .toISOString()
        .slice(0, 16)
        .replace("T", "-")
        .replace(":", "-");// ID unique pour éviter les doublons

    try {
      const productRef = doc(db, "produits", selectedProduct.id);

      // DÉBUT DE LA TRANSACTION : Tout ce qui est à l'intérieur est "atomique"
      await runTransaction(db, async (transaction) => {
        // 1. Lecture en temps réel du stock sur le serveur
        const productDoc = await transaction.get(productRef);
        if (!productDoc.exists()) throw "Le produit n'existe plus dans la base !";

        const productData = productDoc.data();
        const currentStock = Number(productData.Stock) || 0;

        // 2. Calcul du nouveau stock
        updatedStockValue = movementType === 'IN' 
          ? currentStock + moveQty 
          : currentStock - moveQty;

        // 3. Vérification de sécurité pour les sorties
        if (movementType === 'OUT' && currentStock < moveQty) {
          throw `Stock insuffisant ! (Disponible: ${currentStock}, Demandé: ${moveQty})`;
        }  

        // 5. CRÉATION DU MOUVEMENT D'HISTORIQUE
        const movementRef = doc(db, "MouvementsStock", reference);

        const existingMovement = await transaction.get(movementRef);
        if (existingMovement.exists()) {
          throw "Ce mouvement existe déjà.";
        }
        
        transaction.set(movementRef, {
          reference: reference, 
          Produit: selectedProduct.Nom || selectedProduct.name || "Produit sans nom",
          ProductId: selectedProduct.id,
          ProduitPoids: selectedProduct.Poids,
          IdGroupe: productData.IdGroupe || "N/A",
          IdCategorie: productData.IdCategorie || "N/A",
          Quantite: moveQty,
          PrixUnitaire: pPrice,
          ValeurTotale: moveQty * pPrice, // Calculer le total ici facilite les futurs rapports
          Motif: comment || "Aucun commentaire",
          TypeMouvement: movementType === 'IN' ? "Entrée" : "Sortie",
          DateAjout: serverTimestamp(),
          StockAvant: currentStock,
          StockApres: updatedStockValue
        });

        // 5. MISE À JOUR DU PRODUIT
        transaction.update(productRef, { 
          Stock: updatedStockValue,
          DerniereMiseAJour: serverTimestamp() 
        });
      });

      // --- SI ON ARRIVE ICI, LA TRANSACTION EST RÉUSSIE ---

      // 6. Mise à jour de l'UI locale (State React)
      setData(prevProducts => 
        prevProducts.map(p => 
          p.id === selectedProduct.id ? { ...p, Stock: updatedStockValue } : p
        )
      );

      // 7. Reset et Fermeture (le modal gère déjà son isSubmitting)
      // setIsModalOpen(false);
      setQuantity(1);
      setUnitPrice('');
      setComment("");

    } catch (error) {
      // Si la transaction échoue, rien n'a été modifié en base
      console.error("Erreur critique transaction:", error);
      alert(typeof error === 'string' ? error : "Une erreur réseau est survenue. Veuillez réessayer.");
      // On ne ferme pas le modal ici pour permettre à l'utilisateur de corriger (ex: réduire la quantité)
      throw error; // On propage l'erreur pour que le modal arrête son état "isSubmitting"
    }
  };

  return (
    <div className="p-4 md:p-8 pt-12 md:pt-8">
      {/* HEADER ADAPTATIF */}
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6 mb-8 md:mb-10">
        <div>
          <h1 className="text-2xl md:text-3xl font-black text-slate-900 uppercase tracking-tighter">
            Etats<span className="text-primary"> des Stocks</span>
          </h1>
          <p className="text-xs md:text-sm text-secondary font-medium">Contrôle des flux et inventaire</p>
        </div>
        
        {/* ZONE ACTIONS : RECHERCHE + BOUTON */}
        <div className="flex flex-col sm:flex-row w-full lg:w-auto gap-3">
          
          {/* BARRE DE RECHERCHE AVEC BOUTONS D'ACTION */}
          <div className="relative group w-full">
            <form 
              onSubmit={(e) => { e.preventDefault(); updateFilters(searchInput); }} 
              className="relative flex items-center gap-2 w-full"
            >
              <div className="relative flex-1 group">
                {/* L'icône Loupe */}
                <div className="absolute inset-y-0 left-4 flex items-center pointer-events-none">
                  <svg
                    className="w-4 h-4 text-slate-400 group-focus-within:text-primary transition-colors"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="2.5"
                      d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                    />
                  </svg>
                </div>

                {/* L'Input */}
                <input
                  type="text"
                  placeholder="Rechercher un produit..."
                  value={searchInput}
                  onChange={(e) => setSearchInput(e.target.value)}
                  className="w-full bg-white border-none rounded-2xl py-4 pl-11 pr-12 text-xs shadow-sm focus:ring-2 focus:ring-primary/20 placeholder:text-slate-400 transition-all font-medium"
                />

                {/* Bouton RESET (X) - S'affiche seulement s'il y a du texte ou un filtre actif */}
                {(searchInput !== "" || activeSearch !== "") && (
                  <button
                    type="button"
                    onClick={() => {
                      setSearchInput("");
                      updateFilters("");
                    }}
                    className="absolute inset-y-0 right-4 flex items-center text-slate-400 hover:text-red-500 transition-colors"
                    title="Réinitialiser"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                )}
              </div>

              {/* Bouton VALIDER (Filtrer) */}
              <button
                type="submit"
                className="bg-slate-900 text-white px-6 py-4 rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-primary transition-all shadow-lg shadow-slate-200 active:scale-95"
              >
                Filtrer
              </button>
            </form>
          </div>

          {/* BOUTON HISTORIQUE */}
          <Link 
            to="/admin/inventory/history"
            className="bg-white text-slate-900 border border-slate-200 px-6 py-3 rounded-2xl font-black uppercase text-[10px] tracking-widest hover:bg-slate-50 transition-all shadow-sm flex items-center justify-center gap-2 shrink-0"
          >
            <span>📜</span> Historique
          </Link>
        </div>
      </div>

      <GroupTabs 
        groups={groups} 
        currentGroupId={currentGroupId} 
        onGroupChange={(id) => setSearchParams({ group: id, page: 1 })} 
      />

      {/* TABLEAU AVEC SCROLL HORIZONTAL MOBILE */}
      <div className="bg-transparent md:bg-white md:rounded-[2.5rem] md:shadow-sm md:border md:border-slate-100 overflow-hidden">
  
        {/* --- VUE MOBILE : CARDS (Affiche toutes les colonnes) --- */}
        <div className="grid grid-cols-1 gap-4 md:hidden">
          {products.map((product) => (
            <div key={product.id} className="bg-white p-5 rounded-[2rem] border border-slate-100 shadow-sm space-y-4">
              
              {/* Ligne 1 : Référence / Produit */}
              <div className="flex justify-between items-start">
                {/* min-w-0 est essentiel pour que line-clamp fonctionne, pr-4 pour l'espace avec le stock */}
                <div className="min-w-0 flex-1 pr-4">
                  <p className="text-[10px] text-secondary font-black uppercase tracking-widest mb-1">Référence</p>
                  
                  {/* Nom du produit : Autorise 2 lignes avant les "..." */}
                  <p className="font-black text-slate-900 text-base leading-tight line-clamp-4 mb-2">
                    {product.Nom}
                  </p>
                  
                  {/* Bloc Catégorie + Poids en dessous */}
                  <div className="flex flex-col gap-0.5">
                    <p className="text-[10px] text-primary font-bold uppercase tracking-wide">
                      {getCatName(product.IdCategorie)}
                    </p>
                    {Number(product.Poids) > 0 && (
                      <p className="text-[10px] text-slate-400 font-bold italic">
                        {product.Poids}g
                      </p>
                    )}
                  </div>
                </div>
                
                {/* Ligne 2 : Stock (Reste en haut à droite) */}
                <div className="flex flex-col items-center shrink-0 min-w-[60px] ml-2">
                  <p className="text-[10px] text-secondary font-black uppercase tracking-widest mb-1">
                    Stock
                  </p>
                  <span className={`inline-block px-3 py-1 rounded-lg text-[11px] font-black ${
                    Number(product.Stock) > 5 
                      ? 'bg-green-100 text-green-600' 
                      : Number(product.Stock) === 0 
                        ? 'bg-red-100 text-red-600' 
                        : 'bg-orange-100 text-orange-600'
                  }`}>
                    {product.Stock || 0} pcs
                  </span>
                </div>
              </div>

              {/* Ligne 3 : Actions (Boutons larges pour mobile) */}
              <div className="pt-4 border-t border-slate-50 flex gap-3">
                <button 
                  onClick={() => openMovementModal(product, 'IN')}
                  className="flex-1 bg-green-500 hover:bg-green-600 text-white text-[11px] font-black uppercase py-3 rounded-xl transition active:scale-95 flex items-center justify-center gap-2"
                >
                  <span>+</span> Arrivage
                </button>
                <button 
                  onClick={() => openMovementModal(product, 'OUT')}
                  className="flex-1 bg-slate-900 hover:bg-slate-800 text-white text-[11px] font-black uppercase py-3 rounded-xl transition active:scale-95 flex items-center justify-center gap-2"
                >
                  <span>-</span> Retrait
                </button>
              </div>
            </div>
          ))}
        </div>

        {/* --- VUE DESKTOP : TABLEAU --- */}
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead className="bg-slate-50 border-b border-slate-100">
              <tr className="text-[11px] uppercase tracking-widest text-secondary font-black">
                <th className="px-8 py-5">Référence</th>
                <th className="px-6 py-5">Poids</th>
                <th className="px-6 py-5">Stock</th>
                <th className="px-8 py-5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {products.map((product) => (
                <tr key={product.id} className="hover:bg-slate-50/50 transition-colors">
                  <td className="px-8 py-5">
                    <p className="font-bold text-slate-900 text-sm">{product.Nom}</p>
                    <p className="text-[10px] text-secondary font-medium uppercase">{getCatName(product.IdCategorie)}</p>
                  </td>
                  <td className="px-6 py-5">
                    {Number(product.Poids) > 0 ? (
                      <span className="text-sm font-bold text-slate-600">
                        {product.Poids}<span className="text-[10px] text-slate-400">g</span>
                      </span>
                    ) : (
                      <span className="text-slate-300 text-xs">-</span>
                    )}
                  </td>
                  <td className="px-6 py-5">
                    <span className={`inline-block px-3 py-1 rounded-lg text-[11px] font-black ${
                      Number(product.Stock) > 5 
                        ? 'bg-green-100 text-green-600' 
                        : Number(product.Stock) === 0 
                          ? 'bg-red-100 text-red-600' 
                          : 'bg-orange-100 text-orange-600'
                    }`}>
                      {product.Stock || 0} pcs
                    </span>
                  </td>
                  <td className="px-8 py-5 text-right">
                    <div className="flex justify-end gap-2">
                      <button 
                        onClick={() => openMovementModal(product, 'IN')}
                        className="bg-green-500 hover:bg-green-600 text-white text-[10px] font-bold px-4 py-2 rounded-xl transition active:scale-95"
                      >
                        + Arrivage
                      </button>
                      <button 
                        onClick={() => openMovementModal(product, 'OUT')}
                        className="bg-slate-900 hover:bg-slate-800 text-white text-[10px] font-bold px-4 py-2 rounded-xl transition active:scale-95"
                      >
                        - Retrait
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* --- ÉTAT VIDE (EMPTY STATE) --- */}
        {!loading && products.length === 0 && (
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
                  d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" 
                />
              </svg>
            </div>

            <h3 className="text-xl font-black text-slate-800 uppercase tracking-tight">
              {activeSearch
                ? "Aucun produit trouvé" 
                : "Inventaire vide"}
            </h3>

            <p className="text-sm text-slate-500 max-w-[280px] mx-auto mt-2 leading-relaxed">
              {activeSearch
                ? `Aucun résultat pour ces critères. Essayez de modifier votre recherche ou la catégorie.` 
                : "Il n'y a encore aucun produit enregistré dans votre inventaire."}
            </p>

            {/* Bouton de réinitialisation rapide */}
            {(activeSearch) && (
              <button 
                onClick={() => {
                  setSearchInput("");
                  updateFilters("");
                }}
                className="mt-8 px-6 py-2 bg-slate-900 text-white text-[10px] font-black uppercase tracking-[0.2em] rounded-full hover:bg-primary transition-colors shadow-lg shadow-slate-200"
              >
                Réinitialiser les filtres
              </button>
            )}
          </div>
        )}

        {/* BARRE DE PAGINATION (Adaptée) */}
          {/* PAGINATION */}
          <PaginationHistory 
            page={page} 
            hasNext={hasNext} 
            loading={loading}
            show={true}
            onPrev={() => setPage(page - 1)} // On passe le chiffre directement
            onNext={() => setPage(page + 1)} // On passe le chiffre directement
          />
      </div>

      {/* MODAL RESPONSIVE */}
      <StockMovementModal 
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        movementType={movementType}
        product={selectedProduct}
        quantity={quantity}
        setQuantity={setQuantity}
        unitPrice={unitPrice}
        setUnitPrice={setUnitPrice}
        comment={comment}
        setComment={setComment}
        onConfirm={handleConfirm} // Ta fonction qui enregistre dans Firestore
      />
    </div>
  );
}