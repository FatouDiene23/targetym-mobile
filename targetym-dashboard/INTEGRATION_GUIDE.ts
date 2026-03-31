// ============================================================
// GUIDE D'INTÉGRATION - Remplacement du champ Nationalité
// ============================================================
// 
// Fichiers à créer/modifier :
// 1. CRÉER : src/data/nationalities.ts        (liste des nationalités)
// 2. CRÉER : src/components/NationalitySelect.tsx (composant select)
// 3. MODIFIER : AddEmployeeModal.tsx           (formulaire ajout)
// 4. MODIFIER : EditEmployeeModal.tsx          (formulaire édition)
// ============================================================


// ============================================================
// ÉTAPE 1 : Copier nationalities.ts dans src/data/
// ÉTAPE 2 : Copier NationalitySelect.tsx dans src/components/
// ============================================================


// ============================================================
// ÉTAPE 3 : MODIFIER AddEmployeeModal.tsx
// ============================================================

// A) Ajouter l'import en haut du fichier :
import NationalitySelect from "@/components/NationalitySelect";

// B) REMPLACER l'ancien champ nationalité (chercher ce bloc) :

// ❌ ANCIEN CODE À SUPPRIMER :
/*
<div>
  <label className="block text-sm font-medium text-gray-700 mb-1">Nationalité</label>
  <input
    type="text"
    name="nationality"
    value={formData.nationality}
    onChange={handleChange}
    placeholder="Ivoirienne"
    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none"
  />
</div>
*/

// ✅ NOUVEAU CODE À METTRE À LA PLACE :
/*
<div>
  <label className="block text-sm font-medium text-gray-700 mb-1">Nationalité</label>
  <NationalitySelect
    value={formData.nationality}
    onChange={(val) => setFormData((prev) => ({ ...prev, nationality: val }))}
    placeholder="Sélectionner une nationalité..."
  />
</div>
*/


// ============================================================
// ÉTAPE 4 : MODIFIER EditEmployeeModal.tsx
// ============================================================

// Même principe : ajouter l'import et remplacer le champ texte
// par le composant NationalitySelect avec la même syntaxe.

// A) Ajouter l'import :
// import NationalitySelect from "@/components/NationalitySelect";

// B) Remplacer le champ nationalité par :
/*
<div>
  <label className="block text-sm font-medium text-gray-700 mb-1">Nationalité</label>
  <NationalitySelect
    value={formData.nationality}
    onChange={(val) => setFormData((prev) => ({ ...prev, nationality: val }))}
    placeholder="Sélectionner une nationalité..."
  />
</div>
*/


// ============================================================
// C'EST TOUT ! Aucune modification backend nécessaire.
// Le champ reste un string dans la base de données,
// mais maintenant les valeurs sont contrôlées et cohérentes.
// ============================================================
