// ─────────────────────────────────────────────────────────────
// regrouperFamilles() — a lancer UNE FOIS dans l'editeur Apps Script
// Prend les membres existants (244 individus) et les regroupe
// en familles fictives mais coherentes : nom de famille partage,
// adresse commune, pays/langue coherents, roles parent/enfant.
// Conserve les prenoms reels. SHEET_ID est defini dans web-app.gs.
// ─────────────────────────────────────────────────────────────

function regrouperFamilles() {
  var NOMS = ["Benali","Diallo","Traore","Coulibaly","Ndiaye","Mbaye","Camara","Kone","Toure","Sylla","Bah","Sow","Barry","Konate","Keita","Cisse","Balde","Martin","Bernard","Dupont","Leroy","Moreau","Simon","Laurent","Lefebvre","Michel","Garcia","Nguyen","Tran","Pham","Hoang","Vo","Bui","Dang","El Amrani","Bouazza","Mansouri","Rachidi","Alaoui","Benkirane","Lamrani","Tahiri","Okonkwo","Adeyemi","Ibrahim","Musa","Yusuf","Ahmed","Hassan","Ali","Omar","Saleh","Popescu","Ionescu","Gheorghe","Popa","Stan","Radu","Santos","Silva","Costa","Ferreira","Alves","Carvalho","Pereira","Rodrigues","Lima","Gomes","Ivanov","Petrov","Sidorov","Kuznetsov","Popov","Sokolov","Lebedev","Kozlov","Diop","Fall","Gueye","Seck","Faye","Ba","Sene","Thiam","Dieng","Niang"];
  var PAYS = ["Mali","Senegal","Guinee","Maroc","Algerie","Tunisie","Vietnam","Cambodge","France","Roumanie","Portugal","Cameroun","Congo","Togo","Benin","Cote d'Ivoire"];
  var LANGUES = ["Bambara","Wolof","Pular","Arabe","Berbere","Vietnamien","Khmer","Roumain","Portugais","Francais","Anglais","Fon","Haoussa","Soninke","Dioula"];
  var RUES = ["des Lilas","du Moulin","de la Paix","Victor Hugo","Jean Jaures","des Acacias","du Chateau","de la Republique","Moliere","Voltaire","Emile Zola","du Commerce","des Cerisiers","des Roses","du Stade"];
  var VOIES = ["rue","avenue","boulevard","impasse","allee"];
  var NIVEAUX = ["Alpha","A1-","A1+","A2-","A2+/B1"];
  var STATUTS = ["EN COURS","EN COURS","EN COURS","SUSPENDU","ARRETE"];
  var SOURCES = ["Mission locale","CAF","Mairie","Bouche a oreille","Ecole","Travailleur social","Pole emploi","Autre"];

  function rand(a) { return a[Math.floor(Math.random() * a.length)]; }
  function randInt(a, b) { return Math.floor(Math.random() * (b - a + 1)) + a; }
  function pad(n, l) { return String(n).padStart(l, "0"); }
  function dateFr(minY, maxY) { return pad(randInt(1,28),2) + "/" + pad(randInt(1,12),2) + "/" + randInt(minY,maxY); }
  function tel() { return "06" + randInt(10,99) + randInt(100000,999999); }

  var ss = SpreadsheetApp.openById(SHEET_ID);
  var fMembres = ss.getSheetByName("Membres");
  var fFamilles = ss.getSheetByName("Familles");

  // 1) Lire les membres existants (on garde le prenom reel = colonne index 3)
  var data = fMembres.getDataRange().getValues();
  var header = data[0];
  var rows = data.slice(1).filter(function(r) { return r[0]; });
  rows.sort(function() { return Math.random() - 0.5; });

  // 2) Tailles de familles coherentes (total = nb de membres)
  var reste = rows.length;
  var tailles = [];
  while (reste > 0) {
    var t, r = Math.random();
    if (r < 0.20) t = 1;
    else if (r < 0.55) t = 2;
    else if (r < 0.80) t = 3;
    else if (r < 0.95) t = 4;
    else t = 5;
    if (t > reste) t = reste;
    tailles.push(t);
    reste -= t;
  }

  // 3) Affecter chaque groupe a une famille
  var famRows = [];
  var idx = 0;
  for (var f = 0; f < tailles.length; f++) {
    var taille = tailles[f];
    var idFam = "FAM" + pad(f + 1, 4);
    var nomFam = rand(NOMS);
    var pays = rand(PAYS);
    var langue = rand(LANGUES);
    var adresse = randInt(1,120) + " " + rand(VOIES) + " " + rand(RUES) + ", Nantes";
    var qvp = Math.random() > 0.4 ? "Oui" : "Non";
    var source = rand(SOURCES);
    var niveau = rand(NIVEAUX);

    famRows.push([idFam, nomFam, adresse, qvp, taille, "23/06/2026"]);

    for (var m = 0; m < taille; m++) {
      var row = rows[idx];
      var estParent = (m === 0) || (taille >= 4 && m === 1);
      // 0 ID_Membre, 1 ID_Famille, 2 Nom, 3 Prenom, 4 Role, 5 Genre,
      // 6 Date_Naissance, 7 Langue, 8 Pays, 9 Tel, 10 Email, 11 WhatsApp,
      // 12 Statut, 13 Niveau, 14 Source, 15 Nb_Enfants, 16 Notes
      row[1] = idFam;
      row[2] = nomFam;
      row[4] = estParent ? "Parent" : "Enfant";
      row[6] = estParent ? dateFr(1970, 1992) : dateFr(2008, 2019);
      row[7] = langue;
      row[8] = pays;
      if (estParent) {
        var tp = tel();
        row[9] = tp;
        row[11] = tp;
        row[12] = rand(STATUTS);
        row[13] = niveau;
        row[14] = source;
      } else {
        row[9] = ""; row[11] = ""; row[12] = ""; row[13] = ""; row[14] = "";
      }
      idx++;
    }
  }

  // 4) Reecrire les membres
  fMembres.getRange(2, 1, rows.length, header.length).setValues(rows);

  // 5) Reecrire les familles
  if (fFamilles.getLastRow() > 1) fFamilles.deleteRows(2, fFamilles.getLastRow() - 1);
  fFamilles.getRange(2, 1, famRows.length, famRows[0].length).setValues(famRows);

  Logger.log("OK : " + famRows.length + " familles pour " + rows.length + " membres");
}
