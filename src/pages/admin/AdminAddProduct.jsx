import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { db, storage } from '../../firebase/config';
import { collection, addDoc, getDocs, doc, updateDoc, increment, query, where, serverTimestamp } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { Link } from 'react-router-dom';

import { useGroups } from '../../hooks/useGroup';
import { useCategories } from '../../hooks/useCategorie';

export default function AdminAddProduct() {
  const navigate = useNavigate();
  const fileInputRef = useRef(null);

  // Utilisation des hooks
  const { groups } = useGroups();
  const { categories, getCategoriesByGroup } = useCategories();

  // États pour les données
  const [formData, setFormData] = useState({
    Nom: '',
    IdGroupe: '', // On stocke l'ID
    IdCategorie: '', // On stocke l'ID
    Prix: '',
    Poids: '',
    Stock: '',
    Description: ''
  });
  
  const [imageFile, setImageFile] = useState(null); // Le vrai fichier binaire
  const [imagePreview, setImagePreview] = useState(null); // L'aperçu pour l'écran
  const [isDragging, setIsDragging] = useState(false);
  const [loading, setLoading] = useState(false);

  // Filtrage dynamique des catégories selon le groupe choisi
  const filteredCategories = getCategoriesByGroup(formData.IdGroupe);

  // Reset de la catégorie si on change de groupe
  useEffect(() => {
    setFormData(prev => ({ ...prev, IdCategorie: '' }));
  }, [formData.IdGroupe]);

  // 3. LA FONCTION MAGIQUE HANDLEFILE (Expliquée plus bas)
  const handleFile = (file) => {
    if (file && file.type.startsWith('image/')) {
      setImageFile(file); // On garde le binaire pour l'upload
      setImagePreview(URL.createObjectURL(file)); // On crée l'aperçu visuel
    }
  };

  // Gestion du Drag & Drop
  const handleDragOver = (e) => { e.preventDefault(); setIsDragging(true); };
  const handleDragLeave = () => setIsDragging(false);
  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragging(false);
    handleFile(e.dataTransfer.files[0]);
  };

  const updateCounts = async (groupId, catId, value) => {
    try {
      // 1. Références des documents
      const groupRef = doc(db, "Groupes", groupId);
      const catRef = doc(db, "categories", catId);

      // 2. Mise à jour groupée (plus propre)
      // On peut utiliser un try/catch individuel pour ne pas bloquer si l'un manque
      await updateDoc(groupRef, {
        NombreProduit: increment(value)
      }).catch(err => console.warn("Le groupe n'existe pas, compteur non mis à jour"));

      await updateDoc(catRef, {
        count: increment(value)
      }).catch(err => console.warn("La catégorie n'existe pas, compteur non mis à jour"));

    } catch (error) {
      console.error("Erreur lors de la mise à jour des compteurs:", error);
    }
  };

  // 4. L'ENVOI À FIREBASE
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.IdGroupe || !formData.IdCategorie) return alert("Choisissez une marque et une catégorie !");
    
    setLoading(true);
    try {
      let url = "https://firebasestorage.googleapis.com/v0/b/store-muscu.firebasestorage.app/o/produits%2Fno-image.png?alt=media&token=d10c5320-4948-4739-a4c3-e4c1faebd7bc";
      // 3. Upload uniquement SI un fichier a été sélectionné
      if (imageFile) {
        const storageRef = ref(storage, `produits/${Date.now()}_${imageFile.name}`);
        await uploadBytes(storageRef, imageFile);
        url = await getDownloadURL(storageRef);
      }

      // 2. Préparation données
      const stockInitial = Number(formData.Stock) || 0;
      const prixInitial = Number(formData.Prix) || 0;

      const productData = {
        Nom: formData.Nom,
        IdGroupe: formData.IdGroupe,
        IdCategorie: formData.IdCategorie,
        Prix: prixInitial,
        Poids: Number(formData.Poids) || 0,
        Stock: stockInitial,
        Description: formData.Description,
        image: url,
        createdAt: serverTimestamp()
      };

      // 3. Ajout Produit
      const docRef = await addDoc(collection(db, "produits"), productData);

      // 4. Mouvement Stock
      if (stockInitial > 0) {
        await addDoc(collection(db, "MouvementsStock"), {
          Produit: formData.Nom,
          ProductId: docRef.id,
          IdGroupe: formData.IdGroupe, 
          IdCategorie: formData.IdCategorie,
          Quantite: stockInitial,
          PrixUnitaire: prixInitial,
          Motif: "Ajout initial",
          TypeMouvement: "Entrée",
          DateAjout: serverTimestamp()
        });
      }
      
      // 5. Mise à jour des compteurs (Groupe + Catégorie)
      await updateCounts(formData.IdGroupe, formData.IdCategorie, 1);

      navigate('/admin/products');
    } catch (error) {
      console.error(error);
      alert("Erreur lors de l'ajout");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-8 max-w-5xl">

      <Link to="/admin/products" className="inline-flex items-center text-secondary font-bold text-xs md:text-sm hover:text-primary transition-colors gap-2">
          ← <span className="hidden sm:inline">Retour à la liste des produits</span><span className="sm:hidden">Liste des produits</span>
        </Link>

      <div className="flex items-center gap-4 mb-8">
        <h1 className="text-3xl font-black text-slate-900 uppercase tracking-tighter">
          Nouveau <span className="text-primary">Produit</span>
        </h1>
      </div>

      <form 
        className="grid grid-cols-1 md:grid-cols-3 gap-8"
        onSubmit={ handleSubmit }
      >
        {/* COLONNE GAUCHE : INFOS TEXTE */}
        <div className="md:col-span-2 space-y-6 bg-white p-8 rounded-[2.5rem] shadow-sm border border-slate-100">
          {/* On passe en 1 colonne par défaut (mobile) et 2 colonnes sur tablette/desktop (md:) */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            
            {/* Nom du produit - Garde toute la largeur même sur desktop */}
            <div className="md:col-span-2 space-y-2">
              <label className="text-xs font-black uppercase text-secondary tracking-widest px-1">Nom du produit</label>
              <input 
                required
                type="text" 
                placeholder="ex: Whey Isolate Native" 
                className="w-full bg-slate-50 border-none rounded-2xl p-4 focus:ring-2 focus:ring-primary" 
                onChange={(e) => setFormData({...formData, Nom: e.target.value})}
              />
            </div>

            {/* Groupe */}
            <div className="space-y-2">
              <label className="text-xs font-black uppercase text-secondary tracking-widest px-1">Groupe</label>
              <select 
                required
                value={formData.IdGroupe} 
                className="w-full bg-slate-50 border-none rounded-2xl p-4 focus:ring-2 focus:ring-primary font-medium"
                onChange={(e) => setFormData({...formData, IdGroupe: e.target.value})}
              >
                <option value="">Choisir un groupe</option>
                {groups.map(g => <option key={g.id} value={g.id}>{g.Nom}</option>)}
              </select>
            </div>
            
            {/* Catégorie */}
            <div className="space-y-2">
              <label className="text-xs font-black uppercase text-secondary tracking-widest px-1">Catégorie</label>
              <select 
                required
                disabled={!formData.IdGroupe}
                value={formData.IdCategorie}
                className="w-full bg-slate-50 border-none rounded-2xl p-4 focus:ring-2 focus:ring-primary font-medium"
                onChange={(e) => setFormData({...formData, IdCategorie: e.target.value})}
              >
                <option value="">{formData.IdGroupe ? "Choisir catégorie" : "Sélectionnez d'abord une marque"}</option>
                {filteredCategories.map(c => <option key={c.id} value={c.id}>{c.Nom}</option>)}
              </select>
            </div>

            {/* Prix */}
            <div className="space-y-2">
              <label className="text-xs font-black uppercase text-secondary tracking-widest px-1">Prix (Ar)</label>
              <input 
                required
                type="number" 
                className="w-full bg-slate-50 border-none rounded-2xl p-4 focus:ring-2 focus:ring-primary" 
                onChange={(e) => setFormData({...formData, Prix: e.target.value})}
              />
            </div>

            {/* Poids */}
            <div className="space-y-2">
              <label className="text-xs font-black uppercase text-secondary tracking-widest px-1">Poids (kg)</label>
              <input 
                required
                type="number" 
                step="0.1" 
                className="w-full bg-slate-50 border-none rounded-2xl p-4 focus:ring-2 focus:ring-primary" 
                onChange={(e) => setFormData({...formData, Poids: e.target.value})}
              />
            </div>

            {/* Stock */}
            <div className="space-y-2">
              <label className="text-xs font-black uppercase text-secondary tracking-widest px-1">Stock Initial</label>
              <input 
                required
                type="number" 
                className="w-full bg-slate-50 border-none rounded-2xl p-4 focus:ring-2 focus:ring-primary" 
                onChange={(e) => setFormData({...formData, Stock: e.target.value})}
              />
            </div>
          </div>

          {/* Description */}
          <div className="space-y-2">
            <label className="text-xs font-black uppercase text-secondary tracking-widest px-1">Description</label>
            <textarea 
              rows="3" 
              className="w-full bg-slate-50 border-none rounded-2xl p-4 focus:ring-2 focus:ring-primary"
              onChange={(e) => setFormData({...formData, Description: e.target.value})}
            ></textarea>
          </div>
        </div>

        {/* COLONNE DROITE : IMAGE & ACTIONS */}
        <div className="space-y-6">
          <div 
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current.click()}
            className={`
              aspect-square rounded-[2.5rem] border-4 border-dashed transition-all flex flex-col items-center justify-center cursor-pointer overflow-hidden relative
              ${isDragging ? 'border-primary bg-primary/5' : 'border-slate-200 bg-white hover:border-primary/50'}
            `}
          >
            {imagePreview ? (
              <img src={imagePreview} alt="Preview" className="w-full h-full object-cover" />
            ) : (
              <div className="text-center p-6">
                <span className="text-4xl mb-4 block">📸</span>
                <p className="text-xs font-bold text-slate-500 uppercase tracking-tighter">Glissez votre photo ici ou cliquez</p>
              </div>
            )}
            <input type="file" ref={fileInputRef} onChange={(e) => handleFile(e.target.files[0])} className="hidden" accept="image/*" />
          </div>

          <button 
            type="submit" 
            disabled={loading}
            className="w-full bg-primary text-white py-5 rounded-[2rem] font-black uppercase tracking-widest shadow-xl shadow-primary/20 hover:scale-[1.02] transition-all disabled:bg-slate-300"
          >
            {loading ? "Enregistrement..." : "Enregistrer le produit"}
          </button>
        </div>
      </form>
    </div>
  );
}