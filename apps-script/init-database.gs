// Script à coller dans le nouveau Google Sheet
// Extensions > Apps Script > Coller > Enregistrer > Exécuter "initialiserBase"

const ANCIEN_SHEET_ID = "1OdegCqHJNhi6NZfWwlYfcfAlJ7v4YnYw";
const NOUVEAU_SHEET_ID = "1eRLKluC-C_3a45cH5op7Wqw50q52AGcNBkmB2z39se4";

function initialiserBase() {
  const ss = SpreadsheetApp.openById(NOUVEAU_SHEET_ID);

  // Supprimer les feuilles existantes sauf la première
  const feuilles = ss.getSheets();
  feuilles.forEach((f, i) => { if (i > 0) ss.deleteSheet(f); });

  // Créer les 5 feuilles avec leurs en-têtes
  creerFeuille(ss, "Familles", [
    "ID_Famille", "Nom_Famille", "Adresse", "Quartier_QVP", "Nb_Membres", "Date_Creation"
  ]);

  creerFeuille(ss, "Membres", [
    "ID_Membre", "ID_Famille", "Nom", "Prenom", "Role",
    "Genre", "Date_Naissance", "Langue_Maternelle", "Pays_Origine",
    "Telephone", "Email", "WhatsApp", "Statut_Inscription",
    "Niveau", "Source_Orientation", "Nb_Enfants", "Notes"
  ]);

  creerFeuille(ss, "Inscriptions", [
    "ID_Inscription", "ID_Membre", "Annee_Scolaire", "Statut",
    "Niveau", "Date_Inscription", "Source", "Notes"
  ]);

  creerFeuille(ss, "Paiements", [
    "ID_Paiement", "ID_Membre", "Annee_Scolaire", "Mode_Paiement",
    "Montant_Inscription", "Montant_Adhesion", "Solde",
    "Date_Paiement_1", "Montant_Paiement_1",
    "Date_Paiement_2", "Montant_Paiement_2",
    "Date_Paiement_3", "Montant_Paiement_3",
    "Date_Paiement_4", "Montant_Paiement_4",
    "Date_Depot_Banque", "Date_Virement", "Remarques"
  ]);

  creerFeuille(ss, "Etablissements_Liens", [
    "ID_Lien", "ID_Membre", "Nom_Etablissement", "Type_Etablissement"
  ]);

  // Renommer la première feuille
  ss.getSheets()[0].setName("README");
  ss.getSheets()[0].getRange("A1").setValue("Base de données Asso Pilotage — créée le " + new Date().toLocaleDateString("fr-FR"));
  ss.getSheets()[0].getRange("A2").setValue("Ne pas modifier les colonnes ID_* — elles servent de clés de liaison entre les feuilles.");

  // Importer les données
  importerDonnees(ss);

  SpreadsheetApp.getUi().alert("✅ Base initialisée avec succès !");
}

function creerFeuille(ss, nom, entetes) {
  const feuille = ss.insertSheet(nom);
  const range = feuille.getRange(1, 1, 1, entetes.length);
  range.setValues([entetes]);
  range.setBackground("#4a154b");
  range.setFontColor("#ffffff");
  range.setFontWeight("bold");
  feuille.setFrozenRows(1);
  return feuille;
}

function importerDonnees(ss) {
  const ancien = SpreadsheetApp.openById(ANCIEN_SHEET_ID);

  // Lister toutes les feuilles disponibles pour debug
  const toutesLesFeuilles = ancien.getSheets().map(f => f.getName());
  Logger.log("Feuilles disponibles dans l'ancien Sheet : " + toutesLesFeuilles.join(", "));

  // Lire INSCRITS (cherche de façon flexible)
  const inscrits = ancien.getSheets().find(f => f.getName().toUpperCase().includes("INSCRIT"));
  if (!inscrits) {
    Logger.log("Feuille INSCRITS introuvable. Feuilles trouvées : " + toutesLesFeuilles.join(", "));
    return;
  }
  Logger.log("Feuille trouvée : " + inscrits.getName() + " — " + inscrits.getLastRow() + " lignes");

  const data = inscrits.getDataRange().getValues();

  // Chercher la ligne d'en-têtes dans les 5 premières lignes
  let ligneEntetes = 0;
  for (let i = 0; i < Math.min(5, data.length); i++) {
    if (data[i].some(h => h && h.toString().toUpperCase() === "NOM")) {
      ligneEntetes = i;
      break;
    }
  }
  const entetes = data[ligneEntetes];
  Logger.log("Ligne d'en-têtes : " + ligneEntetes + " — " + entetes.slice(0, 10).join(" | "));

  // Trouver les index des colonnes importantes
  function col(nom) {
    return entetes.findIndex(h => h && h.toString().toLowerCase().includes(nom.toLowerCase()));
  }

  // NOM (index 2) est vide dans ce Sheet — seul le Prénom (index 3) est renseigné
  const iPrenom    = col("prénom") !== -1 ? col("prénom") : col("prenom");
  const iGenre     = col("genre") !== -1 ? col("genre") : col("sexe");
  const iLangue    = col("langue");
  const iPays      = col("pays");
  const iStatut    = entetes.findIndex(h => h && h.toString().includes("cours"));
  const iNiveau    = col("qualite") !== -1 ? col("qualite") : col("niveau");
  const iDate      = col("date");
  const iNbEnfants = col("enfant") !== -1 ? col("enfant") : col("parents suivent");
  const iNotes     = col("remarque") !== -1 ? col("remarque") : col("note");

  Logger.log("Index — PRENOM:" + iPrenom + " GENRE:" + iGenre + " PAYS:" + iPays + " STATUT:" + iStatut + " NIVEAU:" + iNiveau);

  // Lire Régularisation
  const regul = ancien.getSheetByName("Régularisation");
  const regulData = regul ? regul.getDataRange().getValues() : [];
  const regulEntetes = regulData.length > 0 ? regulData[0] : [];

  function colR(nom) {
    return regulEntetes.findIndex(h => h && h.toString().toLowerCase().includes(nom.toLowerCase()));
  }

  // Construire un index des paiements par nom
  const paiementsMap = {};
  for (let i = 1; i < regulData.length; i++) {
    const row = regulData[i];
    const nom = (row[0] || "").toString().trim().toUpperCase();
    const prenom = (row[1] || "").toString().trim();
    if (nom) paiementsMap[nom + "_" + prenom] = row;
  }

  // Index des familles par nom
  const famillesMap = {};
  let famId = 1;
  let memId = 1;
  let insId = 1;
  let payId = 1;

  const rowsFamilles = [];
  const rowsMembres = [];
  const rowsInscriptions = [];
  const rowsPaiements = [];

  Logger.log("Index colonnes — NOM:" + col("nom") + " PRENOM:" + col("prénom") + " STATUT:" + col("statut"));

  for (let i = ligneEntetes + 1; i < data.length; i++) {
    const row = data[i];
    const prenom = iPrenom >= 0 ? (row[iPrenom] || "").toString().trim() : "";

    if (!prenom) continue;

    // Sans nom de famille disponible : une famille = une personne (à regrouper manuellement après)
    const idFamille = "FAM" + String(famId++).padStart(4, "0");
    rowsFamilles.push([
      idFamille,
      prenom, // Nom famille = prénom pour l'instant
      "",
      "",
      1,
      new Date().toLocaleDateString("fr-FR")
    ]);

    // Membre
    const idMembre = "MEM" + String(memId++).padStart(4, "0");
    rowsMembres.push([
      idMembre,
      idFamille,
      "", // Nom de famille vide dans la source
      prenom,
      "Parent",
      iGenre >= 0 ? row[iGenre] : "",
      "",
      iLangue >= 0 ? row[iLangue] : "",
      iPays >= 0 ? row[iPays] : "",
      "", "", "",
      iStatut >= 0 ? row[iStatut] : "",
      iNiveau >= 0 ? row[iNiveau] : "",
      "",
      iNbEnfants >= 0 ? row[iNbEnfants] : 0,
      iNotes >= 0 ? row[iNotes] : ""
    ]);

    // Inscription
    rowsInscriptions.push([
      "INS" + String(insId++).padStart(4, "0"),
      idMembre,
      "25-26",
      iStatut >= 0 ? row[iStatut] : "",
      iNiveau >= 0 ? row[iNiveau] : "",
      iDate >= 0 ? row[iDate] : "",
      "",
      iNotes >= 0 ? row[iNotes] : ""
    ]);

    // Paiement depuis Régularisation (clé = prénom)
    const cleRegul = "_" + prenom;
    const regulRow = paiementsMap[cleRegul] || [];
    rowsPaiements.push([
      "PAY" + String(payId++).padStart(4, "0"),
      idMembre,
      "25-26",
      regulRow[colR("mode")] || "",
      regulRow[colR("inscription 25")] || "",
      regulRow[colR("adhésion 25")] || "",
      regulRow[colR("solde")] || "",
      regulRow[colR("date de paiement 1")] || "", regulRow[colR("montant du paiement 1")] || "",
      regulRow[colR("date de paiement 2")] || "", regulRow[colR("montant du paiement 2")] || "",
      regulRow[colR("date de paiement 3")] || "", regulRow[colR("montant du paiement 3")] || "",
      regulRow[colR("date de paiement 4")] || "", regulRow[colR("montant du paiement 4")] || "",
      regulRow[colR("dépôt")] || "",
      regulRow[colR("virement")] || "",
      regulRow[colR("remarque")] || ""
    ]);
  }

  // (pas de mise à jour nb membres — chaque famille = 1 membre pour l'instant)

  // Écrire dans les feuilles
  ecrire(ss, "Familles", rowsFamilles);
  ecrire(ss, "Membres", rowsMembres);
  ecrire(ss, "Inscriptions", rowsInscriptions);
  ecrire(ss, "Paiements", rowsPaiements);

  Logger.log("Import terminé : " + rowsMembres.length + " membres, " + rowsFamilles.length + " familles");
}

function ecrire(ss, nomFeuille, rows) {
  if (rows.length === 0) return;
  const feuille = ss.getSheetByName(nomFeuille);
  feuille.getRange(2, 1, rows.length, rows[0].length).setValues(rows);
}
