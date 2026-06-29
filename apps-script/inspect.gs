function inspecterNouveauSheet() {
  var NEW_ID = "1MH1K9drs7pZmqq9jgsTf7o51ZYrK5z-M";
  var out = {};
  try {
    var file = DriveApp.getFileById(NEW_ID);
    out.nom = file.getName();
    out.mimeType = file.getMimeType();
  } catch (e) {
    out.driveError = e.message;
  }
  try {
    var ss = SpreadsheetApp.openById(NEW_ID);
    out.onglets = ss.getSheets().map(function(s) {
      var lr = s.getLastRow();
      var lc = s.getLastColumn();
      var header = lc > 0 ? s.getRange(1, 1, 1, lc).getValues()[0] : [];
      var sample = (lr > 1 && lc > 0) ? s.getRange(2, 1, 1, lc).getValues()[0] : [];
      return { nom: s.getName(), lignes: lr, colonnes: lc, entetes: header, exemple: sample };
    });
  } catch (e) {
    out.sheetError = e.message;
  }
  Logger.log(JSON.stringify(out));
  return out;
}
