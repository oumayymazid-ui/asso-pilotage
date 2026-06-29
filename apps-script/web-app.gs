// Web App — CRM relationnel BDD_Asso_CRM (lecture + ecriture)
// Tables : FAMILLE / PERSONNE / INSCRIPTION / PAIEMENT / EVALUATION / SCOLARITE / ETABLISSEMENT / PROFESSEUR
// L'etat civil vit dans PERSONNE ; le niveau/statut vit dans INSCRIPTION.

const SHEET_ID = "1bOISBPwoU1xa5R4Um0fRASXKFeclJ8jB3A3CUHBMlI8";

function doGet(e) {
  var action = (e && e.parameter && e.parameter.action) || "ping";
  try {
    var ss = SpreadsheetApp.openById(SHEET_ID);
    var result;
    if (action === "ping") result = { ok: true, message: "API CRM operationnelle", base: ss.getName() };
    else if (action === "inspect") result = inspecterNouveauSheet();
    else if (action === "getFamilles") result = getFamilles(ss);
    else if (action === "getMembres") result = getMembres(ss, e.parameter.idFamille);
    else if (action === "getMembre") result = getMembre(ss, e.parameter.idMembre);
    else if (action === "getPaiements") result = getPaiements(ss, e.parameter.idMembre);
    else if (action === "getTaches") result = getTaches(ss, e.parameter.cibleType, e.parameter.cibleId);
    else result = { error: "Action inconnue : " + action };
    return jsonResponse(result);
  } catch (err) {
    return jsonResponse({ error: String(err) });
  }
}

function doPost(e) {
  try {
    var body = JSON.parse(e.postData.contents);
    var ss = SpreadsheetApp.openById(SHEET_ID);
    var a = body.action, result;
    if (a === "addFamille") result = addFamille(ss, body.data);
    else if (a === "updateFamille") result = updateFamille(ss, body.idFamille, body.data);
    else if (a === "addMembre") result = addMembre(ss, body.data);
    else if (a === "updateMembre") result = updateMembre(ss, body.idMembre, body.data);
    else if (a === "deleteMembre") result = deleteMembre(ss, body.idMembre);
    else if (a === "ensureCommentaireColumn") result = ensureCommentaireColumn(ss);
    else if (a === "ensureTacheSheet") result = ensureTacheSheet(ss);
    else if (a === "addTache") result = addTache(ss, body.data);
    else if (a === "updateTache") result = updateTache(ss, body.idTache, body.data);
    else if (a === "deleteTache") result = deleteTache(ss, body.idTache);
    else result = { error: "Action inconnue : " + a };
    return jsonResponse(result);
  } catch (err) {
    return jsonResponse({ error: String(err) });
  }
}

// ── LECTURE / mapping ─────────────────────────────────────

function getFamilles(ss) {
  var familles = sheetToObjects(ss, "FAMILLE");
  var personnes = sheetToObjects(ss, "PERSONNE");
  var inscriptions = sheetToObjects(ss, "INSCRIPTION");
  return familles.map(function(f) {
    var membresF = personnes
      .filter(function(p) { return String(p["Famille ID"]) === String(f["ID"]); })
      .map(function(p) { return mapMembre(p, inscriptions); });
    return {
      ID_Famille: String(f["ID"]),
      Nom_Famille: f["Nom"],
      Adresse: f["Adresse"] || "",
      Code_Postal: f["Code postal"] ? String(f["Code postal"]) : "",
      Ville: f["Ville"] || "",
      Adresse_Complete: joinAdresse(f),
      Quartier_QVP: f["Quartier QVP"],
      Notes: f["Commentaire"] || "",
      Nb_Membres: membresF.length,
      Date_Creation: "",
      membres: membresF,
      statut: membresF.length > 0 ? membresF[0].Statut_Inscription : "",
      nbMembres: membresF.length
    };
  });
}

function getMembres(ss, idFamille) {
  var personnes = sheetToObjects(ss, "PERSONNE");
  var inscriptions = sheetToObjects(ss, "INSCRIPTION");
  var membres = personnes.map(function(p) { return mapMembre(p, inscriptions); });
  if (idFamille) return membres.filter(function(m) { return m.ID_Famille === String(idFamille); });
  return membres;
}

function getMembre(ss, idMembre) {
  var personnes = sheetToObjects(ss, "PERSONNE");
  var inscriptions = sheetToObjects(ss, "INSCRIPTION");
  var p = personnes.filter(function(x) { return String(x["ID"]) === String(idMembre); })[0];
  if (!p) return { error: "Personne introuvable" };
  var membre = mapMembre(p, inscriptions);
  membre.inscriptions = inscriptions
    .filter(function(i) { return String(i["Personne ID"]) === String(idMembre); })
    .map(function(i) { return mapInscription(i); });
  membre.paiements = getPaiements(ss, idMembre);
  membre.evaluations = sheetToObjects(ss, "EVALUATION")
    .filter(function(ev) { return String(ev["Personne ID"]) === String(idMembre); })
    .map(function(ev) {
      return {
        ID: String(ev["ID"]), Date: fmtDate(ev["Date"]), Niveau: ev["Niveau attribue"],
        Comprehension_Ecrite: ev["Note comprehension ecrite"], Comprehension_Orale: ev["Note comprehension orale"],
        Expression_Ecrite: ev["Note expression ecrite"], Expression_Orale: ev["Note expression orale"],
        Evaluateur: ev["Evaluateur"]
      };
    });
  return membre;
}

function getPaiements(ss, idMembre) {
  var inscriptions = sheetToObjects(ss, "INSCRIPTION");
  var paiements = sheetToObjects(ss, "PAIEMENT");
  var inscIds = inscriptions
    .filter(function(i) { return String(i["Personne ID"]) === String(idMembre); })
    .map(function(i) { return String(i["ID"]); });
  return paiements
    .filter(function(pay) { return inscIds.indexOf(String(pay["Inscription ID"])) >= 0; })
    .map(function(pay) {
      return {
        ID_Paiement: String(pay["ID"]), ID_Membre: String(idMembre),
        Date_Paiement: fmtDate(pay["Date de paiement"]), Montant: pay["Montant"],
        Mode_Paiement: pay["Mode de paiement"],
        Date_Depot_Banque: fmtDate(pay["Date de depot banque"]),
        Date_Virement: fmtDate(pay["Date de virement"])
      };
    });
}

// ── ECRITURE ──────────────────────────────────────────────

function addFamille(ss, data) {
  var sh = ss.getSheetByName("FAMILLE");
  var id = nextId(sh);
  appendByHeader(sh, {
    "ID": id, "Nom": data.Nom_Famille || "", "Adresse": data.Adresse || "",
    "Code postal": data.Code_Postal || "", "Ville": data.Ville || "",
    "Quartier QVP": data.Quartier_QVP || ""
  });
  return { ok: true, ID_Famille: String(id) };
}

function updateFamille(ss, idFamille, data) {
  var sh = ss.getSheetByName("FAMILLE");
  var map = {};
  if (data.Nom_Famille !== undefined) map["Nom"] = data.Nom_Famille;
  if (data.Adresse !== undefined) map["Adresse"] = data.Adresse;
  if (data.Code_Postal !== undefined) map["Code postal"] = data.Code_Postal;
  if (data.Ville !== undefined) map["Ville"] = data.Ville;
  if (data.Quartier_QVP !== undefined) map["Quartier QVP"] = data.Quartier_QVP;
  if (data.Notes !== undefined) map["Commentaire"] = data.Notes;
  var ok = updateRowByHeader(sh, idFamille, map);
  return ok ? { ok: true } : { error: "Famille introuvable" };
}

function addMembre(ss, data) {
  var shP = ss.getSheetByName("PERSONNE");
  var id = nextId(shP);
  appendByHeader(shP, {
    "ID": id, "Famille ID": data.ID_Famille, "Categorie": data.Role || "Adulte",
    "Contact principal": data.Contact_Principal || "", "Nom": data.Nom || "", "Prenom": data.Prenom || "",
    "Genre": data.Genre || "", "Date de naissance": parseDateFr(data.Date_Naissance),
    "Telephone": data.Telephone || "", "Email": data.Email || "",
    "Pays d'origine": data.Pays_Origine || "", "Langue maternelle": data.Langue_Maternelle || "",
    "Droit a l'image": data.Droit_Image || "", "Charte d'engagement": data.Charte || "",
    "Commentaire": data.Notes || ""
  });
  // Cree une inscription si un niveau ou un statut est fourni
  if (data.Niveau || data.Statut_Inscription) {
    var shI = ss.getSheetByName("INSCRIPTION");
    appendByHeader(shI, {
      "ID": nextId(shI), "Personne ID": id, "Annee scolaire": data.Annee_Scolaire || "",
      "Type apprenant": data.Type_Apprenant || "", "Statut": data.Statut_Inscription || "",
      "Niveau / Classe": data.Niveau || "", "Orientation": data.Source_Orientation || "",
      "Date d'inscription": new Date()
    });
  }
  return { ok: true, ID_Membre: String(id) };
}

function updateMembre(ss, idMembre, data) {
  var shP = ss.getSheetByName("PERSONNE");
  var pmap = {};
  if (data.Nom !== undefined) pmap["Nom"] = data.Nom;
  if (data.Prenom !== undefined) pmap["Prenom"] = data.Prenom;
  if (data.Role !== undefined) pmap["Categorie"] = data.Role;
  if (data.Contact_Principal !== undefined) pmap["Contact principal"] = data.Contact_Principal;
  if (data.Genre !== undefined) pmap["Genre"] = data.Genre;
  if (data.Date_Naissance !== undefined) pmap["Date de naissance"] = parseDateFr(data.Date_Naissance);
  if (data.Telephone !== undefined) pmap["Telephone"] = data.Telephone;
  if (data.Email !== undefined) pmap["Email"] = data.Email;
  if (data.Pays_Origine !== undefined) pmap["Pays d'origine"] = data.Pays_Origine;
  if (data.Langue_Maternelle !== undefined) pmap["Langue maternelle"] = data.Langue_Maternelle;
  if (data.Droit_Image !== undefined) pmap["Droit a l'image"] = data.Droit_Image;
  if (data.Charte !== undefined) pmap["Charte d'engagement"] = data.Charte;
  if (data.Notes !== undefined) pmap["Commentaire"] = data.Notes;
  var ok = updateRowByHeader(shP, idMembre, pmap);
  if (!ok) return { error: "Personne introuvable" };

  // Niveau / statut / orientation -> INSCRIPTION (derniere, sinon on en cree une)
  if (data.Statut_Inscription !== undefined || data.Niveau !== undefined ||
      data.Type_Apprenant !== undefined || data.Source_Orientation !== undefined) {
    var shI = ss.getSheetByName("INSCRIPTION");
    var imap = {};
    if (data.Statut_Inscription !== undefined) imap["Statut"] = data.Statut_Inscription;
    if (data.Niveau !== undefined) imap["Niveau / Classe"] = data.Niveau;
    if (data.Type_Apprenant !== undefined) imap["Type apprenant"] = data.Type_Apprenant;
    if (data.Source_Orientation !== undefined) imap["Orientation"] = data.Source_Orientation;
    var rowIdx = findLatestRowBy(shI, "Personne ID", idMembre);
    if (rowIdx > 0) {
      var headers = shI.getRange(1, 1, 1, shI.getLastColumn()).getValues()[0];
      Object.keys(imap).forEach(function(h) {
        var c = headers.indexOf(h);
        if (c >= 0) shI.getRange(rowIdx + 1, c + 1).setValue(imap[h]);
      });
    } else {
      appendByHeader(shI, {
        "ID": nextId(shI), "Personne ID": idMembre, "Statut": data.Statut_Inscription || "",
        "Niveau / Classe": data.Niveau || "", "Type apprenant": data.Type_Apprenant || "",
        "Orientation": data.Source_Orientation || "", "Date d'inscription": new Date()
      });
    }
  }
  return { ok: true };
}

function deleteMembre(ss, idMembre) {
  // Recupere les inscriptions de la personne pour cascader les paiements
  var inscriptions = sheetToObjects(ss, "INSCRIPTION")
    .filter(function(i) { return String(i["Personne ID"]) === String(idMembre); })
    .map(function(i) { return String(i["ID"]); });
  deleteRowsWhere(ss.getSheetByName("PAIEMENT"), "Inscription ID", inscriptions);
  deleteRowsWhere(ss.getSheetByName("INSCRIPTION"), "Personne ID", [String(idMembre)]);
  deleteRowsWhere(ss.getSheetByName("EVALUATION"), "Personne ID", [String(idMembre)]);
  deleteRowsWhere(ss.getSheetByName("SCOLARITE"), "Personne ID", [String(idMembre)]);
  var ok = deleteRowsWhere(ss.getSheetByName("PERSONNE"), "ID", [String(idMembre)]);
  return ok > 0 ? { ok: true } : { error: "Personne introuvable" };
}

// ── Helpers mapping ───────────────────────────────────────

function mapMembre(p, inscriptions) {
  var insc = inscriptions.filter(function(i) { return String(i["Personne ID"]) === String(p["ID"]); });
  var d = insc.length > 0 ? insc[insc.length - 1] : null;
  return {
    ID_Membre: String(p["ID"]), ID_Famille: String(p["Famille ID"]),
    Nom: p["Nom"], Prenom: p["Prenom"], Role: p["Categorie"],
    Contact_Principal: p["Contact principal"], Genre: p["Genre"],
    Date_Naissance: fmtDate(p["Date de naissance"]),
    Langue_Maternelle: p["Langue maternelle"], Pays_Origine: p["Pays d'origine"],
    Telephone: p["Telephone"], Email: p["Email"], WhatsApp: "",
    Droit_Image: p["Droit a l'image"], Charte: p["Charte d'engagement"],
    Statut_Inscription: d ? d["Statut"] : "", Niveau: d ? d["Niveau / Classe"] : "",
    Type_Apprenant: d ? d["Type apprenant"] : "", Source_Orientation: d ? d["Orientation"] : "",
    Nb_Enfants: "", Notes: p["Commentaire"] || ""
  };
}

function mapInscription(i) {
  return {
    ID_Inscription: String(i["ID"]), ID_Membre: String(i["Personne ID"]),
    Annee_Scolaire: i["Annee scolaire"], Type_Apprenant: i["Type apprenant"],
    Statut: i["Statut"], Niveau: i["Niveau / Classe"], Disponibilite: i["Disponibilite"],
    Orientation: i["Orientation"], Date_Inscription: fmtDate(i["Date d'inscription"]),
    Beneficiaire: i["Beneficiaire"], Montant_Adhesion: i["Montant adhesion"], Remarques: i["Remarques"]
  };
}

// ── TACHES ────────────────────────────────────────────────

var TACHE_HEADERS = ["ID", "Cible_Type", "Cible_ID", "Titre", "Echeance", "Statut", "Assigne_A", "Date_Creation"];

function ensureTacheSheet(ss) {
  var sh = ss.getSheetByName("TACHE");
  if (!sh) {
    sh = ss.insertSheet("TACHE");
    sh.getRange(1, 1, 1, TACHE_HEADERS.length).setValues([TACHE_HEADERS]);
    return { ok: true, cree: true };
  }
  return { ok: true, deja: true };
}

function getTaches(ss, cibleType, cibleId) {
  var taches = sheetToObjects(ss, "TACHE");
  return taches
    .filter(function(t) { return String(t["Cible_Type"]) === String(cibleType) && String(t["Cible_ID"]) === String(cibleId); })
    .map(mapTache);
}

function addTache(ss, data) {
  ensureTacheSheet(ss);
  var sh = ss.getSheetByName("TACHE");
  var id = nextId(sh);
  appendByHeader(sh, {
    "ID": id,
    "Cible_Type": data.Cible_Type || "",
    "Cible_ID": data.Cible_ID || "",
    "Titre": data.Titre || "",
    "Echeance": data.Echeance || "",
    "Statut": data.Statut || "A faire",
    "Assigne_A": data.Assigne_A || "",
    "Date_Creation": fmtDate(new Date())
  });
  return { ok: true, ID_Tache: String(id) };
}

function updateTache(ss, idTache, data) {
  var sh = ss.getSheetByName("TACHE");
  var map = {};
  if (data.Titre !== undefined) map["Titre"] = data.Titre;
  if (data.Echeance !== undefined) map["Echeance"] = data.Echeance;
  if (data.Statut !== undefined) map["Statut"] = data.Statut;
  if (data.Assigne_A !== undefined) map["Assigne_A"] = data.Assigne_A;
  var ok = updateRowByHeader(sh, idTache, map);
  return ok ? { ok: true } : { error: "Tache introuvable" };
}

function deleteTache(ss, idTache) {
  var n = deleteRowsWhere(ss.getSheetByName("TACHE"), "ID", [String(idTache)]);
  return n > 0 ? { ok: true } : { error: "Tache introuvable" };
}

function mapTache(t) {
  return {
    ID_Tache: String(t["ID"]),
    Cible_Type: t["Cible_Type"],
    Cible_ID: String(t["Cible_ID"]),
    Titre: t["Titre"],
    Echeance: t["Echeance"] ? fmtDateISO(t["Echeance"]) : "",
    Statut: t["Statut"] || "A faire",
    Assigne_A: t["Assigne_A"] || "",
    Date_Creation: t["Date_Creation"] ? fmtDate(t["Date_Creation"]) : ""
  };
}

function ensureCommentaireColumn(ss) {
  var res = {};
  ["PERSONNE", "FAMILLE"].forEach(function(nom) {
    var sh = ss.getSheetByName(nom);
    var lastCol = sh.getLastColumn();
    var headers = sh.getRange(1, 1, 1, lastCol).getValues()[0];
    if (headers.indexOf("Commentaire") >= 0) { res[nom] = "deja"; return; }
    sh.getRange(1, lastCol + 1).setValue("Commentaire");
    res[nom] = "ajoute colonne " + (lastCol + 1);
  });
  return { ok: true, resultat: res };
}

function joinAdresse(f) {
  var parts = [];
  if (f["Adresse"]) parts.push(f["Adresse"]);
  var cpVille = [f["Code postal"], f["Ville"]].filter(function(x) { return x; }).join(" ");
  if (cpVille) parts.push(cpVille);
  return parts.join(", ");
}

// ── Utilitaires generiques ────────────────────────────────

function nextId(sh) {
  var data = sh.getDataRange().getValues();
  var max = 0;
  for (var i = 1; i < data.length; i++) { var v = Number(data[i][0]); if (!isNaN(v) && v > max) max = v; }
  return max + 1;
}

function appendByHeader(sh, obj) {
  var headers = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0];
  var row = headers.map(function(h) { return obj.hasOwnProperty(h) ? obj[h] : ""; });
  sh.appendRow(row);
}

function updateRowByHeader(sh, idValue, mapping) {
  var headers = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0];
  var data = sh.getDataRange().getValues();
  for (var i = 1; i < data.length; i++) {
    if (String(data[i][0]) === String(idValue)) {
      Object.keys(mapping).forEach(function(h) {
        var c = headers.indexOf(h);
        if (c >= 0) sh.getRange(i + 1, c + 1).setValue(mapping[h]);
      });
      return true;
    }
  }
  return false;
}

function findLatestRowBy(sh, headerName, value) {
  var data = sh.getDataRange().getValues();
  var col = data[0].indexOf(headerName);
  if (col < 0) return -1;
  var last = -1;
  for (var i = 1; i < data.length; i++) { if (String(data[i][col]) === String(value)) last = i; }
  return last;
}

function deleteRowsWhere(sh, headerName, values) {
  if (!sh || !values || values.length === 0) return 0;
  var data = sh.getDataRange().getValues();
  var col = data[0].indexOf(headerName);
  if (col < 0) return 0;
  var count = 0;
  for (var i = data.length - 1; i >= 1; i--) {
    if (values.indexOf(String(data[i][col])) >= 0) { sh.deleteRow(i + 1); count++; }
  }
  return count;
}

function parseDateFr(s) {
  if (!s) return "";
  var parts = String(s).split("/");
  if (parts.length !== 3) return s;
  var d = parseInt(parts[0], 10), m = parseInt(parts[1], 10), y = parseInt(parts[2], 10);
  if (isNaN(d) || isNaN(m) || isNaN(y)) return s;
  return new Date(y, m - 1, d);
}

function fmtDate(v) {
  if (!v) return "";
  if (Object.prototype.toString.call(v) === "[object Date]") return Utilities.formatDate(v, "Europe/Paris", "dd/MM/yyyy");
  return String(v);
}

function fmtDateISO(v) {
  if (!v) return "";
  if (Object.prototype.toString.call(v) === "[object Date]") return Utilities.formatDate(v, "Europe/Paris", "yyyy-MM-dd");
  return String(v);
}

function sheetToObjects(ss, nom) {
  var feuille = ss.getSheetByName(nom);
  if (!feuille) return [];
  var data = feuille.getDataRange().getValues();
  if (data.length < 2) return [];
  var entetes = data[0];
  return data.slice(1).map(function(row) {
    var obj = {};
    entetes.forEach(function(h, i) { obj[h] = row[i]; });
    return obj;
  }).filter(function(obj) { return obj[entetes[0]] !== "" && obj[entetes[0]] !== null; });
}

function jsonResponse(data) {
  return ContentService.createTextOutput(JSON.stringify(data)).setMimeType(ContentService.MimeType.JSON);
}
