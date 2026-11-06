// Plan de catégories comptables d'une auto-école (comptes du Plan Comptable Général).
// tva : taux appliqué par défaut (en %) ; charge/produit : entre dans le résultat ou non.
// ⚠️ Les taux et comptes sont des valeurs par défaut à valider avec votre expert-comptable.

export const CATEGORIES = {
  // --- Recettes -----------------------------------------------------------
  recette_eleves: { libelle: "Encaissements élèves (forfaits, leçons)", compte: "706100", tva: 20, sens: "produit" },
  recette_cpf: { libelle: "Formations financées CPF (Caisse des Dépôts)", compte: "706200", tva: 20, sens: "produit" },
  recette_financeurs: { libelle: "Autres financeurs (France Travail, employeurs, OPCO)", compte: "706300", tva: 20, sens: "produit" },
  recette_autre: { libelle: "Autres produits", compte: "758000", tva: 0, sens: "produit" },
  // --- Charges ------------------------------------------------------------
  carburant: { libelle: "Carburant des véhicules", compte: "606110", tva: 20, sens: "charge" },
  energie: { libelle: "Électricité, eau, gaz", compte: "606100", tva: 20, sens: "charge" },
  fournitures: { libelle: "Fournitures, livres de code, petit matériel", compte: "606400", tva: 20, sens: "charge" },
  location_vehicules: { libelle: "Location / leasing des véhicules", compte: "612200", tva: 20, sens: "charge" },
  loyer: { libelle: "Loyer et charges locatives", compte: "613200", tva: 20, sens: "charge" },
  entretien_vehicules: { libelle: "Entretien et réparation des véhicules", compte: "615500", tva: 20, sens: "charge" },
  logiciels: { libelle: "Logiciels et abonnements (code en ligne, gestion)", compte: "615600", tva: 20, sens: "charge" },
  assurance: { libelle: "Assurances", compte: "616000", tva: 0, sens: "charge" },
  honoraires: { libelle: "Honoraires (expert-comptable, juridique)", compte: "622600", tva: 20, sens: "charge" },
  publicite: { libelle: "Publicité, site internet", compte: "623000", tva: 20, sens: "charge" },
  telecom: { libelle: "Téléphone et internet", compte: "626000", tva: 20, sens: "charge" },
  frais_bancaires: { libelle: "Frais bancaires et commissions CB", compte: "627000", tva: 0, sens: "charge" },
  impots_taxes: { libelle: "Impôts et taxes (CFE…)", compte: "635000", tva: 0, sens: "charge" },
  salaires: { libelle: "Salaires nets", compte: "641000", tva: 0, sens: "charge" },
  charges_sociales: { libelle: "Charges sociales (URSSAF, retraite, prévoyance)", compte: "645000", tva: 0, sens: "charge" },
  interets: { libelle: "Intérêts d'emprunt", compte: "661100", tva: 0, sens: "charge" },
  autre_charge: { libelle: "Autres charges", compte: "628000", tva: 20, sens: "charge" },
  // --- Hors résultat -------------------------------------------------------
  tva_reglee: { libelle: "TVA versée au Trésor", compte: "445510", tva: 0, sens: "hors" },
  emprunt_capital: { libelle: "Remboursement d'emprunt (capital)", compte: "164000", tva: 0, sens: "hors" },
  associe: { libelle: "Compte courant d'associé (apports, prélèvements)", compte: "455000", tva: 0, sens: "hors" },
  virement_interne: { libelle: "Virement interne", compte: "580000", tva: 0, sens: "hors" },
  a_classer: { libelle: "À classer (compte d'attente)", compte: "471000", tva: 0, sens: "hors" },
};

export const CATEGORY_KEYS = Object.keys(CATEGORIES);

// Règles par mots-clés (premier qui correspond). Complétez-les avec vos libellés bancaires habituels.
const RULES = [
  [/caisse des depots|cdc.*formation|moncompteformation|mon compte formation|\bcpf\b/, "recette_cpf"],
  [/france travail|pole emploi|opco|agefice|fafcea/, "recette_financeurs"],
  [/urssaf|retraite|humanis|malakoff|ag2r|prevoyance|klesia/, "charges_sociales"],
  [/dgfip.*tva|tva\b.*(impots|dgfip)|impots\.gouv.*tva/, "tva_reglee"],
  [/dgfip|impots|cfe|taxe/, "impots_taxes"],
  [/salaire|paie |virement.*(philippe|david|bernadette|toufik|soraya)/, "salaires"],
  [/total ?energies|esso|shell|bp |avia|carburant|intermarche.*station|leclerc.*station|station/, "carburant"],
  [/edf|engie|veolia|eau du|electricite|gaz/, "energie"],
  [/loyer|sci |foncia|nexity|immobili/, "loyer"],
  [/diac|leasys|ald|arval|leaseplan|ayvens|credit.?bail|loa|lld|location vehicule/, "location_vehicules"],
  [/norauto|feu vert|midas|speedy|garage|carrosserie|pneu|controle technique|vulco/, "entretien_vehicules"],
  [/axa|allianz|maif|macif|matmut|groupama|generali|assurance|hiscox/, "assurance"],
  [/orange|sfr|bouygues|free mobile|free telecom|\bfree\b/, "telecom"],
  [/icicode|ici code|codes rousseau|ediser|prepacode|stych|logiciel|aeasy|ornikar pro|microsoft|google workspace|adobe|ovh|netlify|anthropic/, "logiciels"],
  [/expert.?compt|cabinet.*(compta|audit)|fiducial|in extenso|honoraires/, "honoraires"],
  [/frais|commission|cotisation carte|agios|abonnement banc|tenue de compte/, "frais_bancaires"],
  [/interets? (d.)?emprunt/, "interets"],
  [/echeance pret|remboursement pret|pret n|emprunt/, "emprunt_capital"],
  [/facebook|meta ads|google ads|pages jaunes|vroomvroom|imprimerie|vistaprint/, "publicite"],
  [/bureau vallee|amazon|fnac|ikea|fournitures|papeterie/, "fournitures"],
  [/apport|compte courant|prelevement associe|remuneration gerant/, "associe"],
  [/virement interne|vir.*epargne|livret/, "virement_interne"],
  [/remise (de )?(cheque|cb)|remise carte|tpe|sumup|stripe|paypal|lyra|payplug|cheque|especes|vir(ement)? .*(inscription|forfait|lecon|permis|code|aac|conduite)/, "recette_eleves"],
];

const norm = (s) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/\s+/g, " ");

/** Catégorie par règles ; null si aucune règle ne s'applique ou si le sens (crédit/débit) est incohérent. */
export function categorizeByRules(tx) {
  const l = norm(tx.libelle);
  for (const [re, cat] of RULES) {
    if (!re.test(l)) continue;
    const sens = CATEGORIES[cat].sens;
    if (sens === "produit" && tx.montant < 0) continue;
    if (sens === "charge" && tx.montant > 0) continue;
    return cat;
  }
  return null;
}
