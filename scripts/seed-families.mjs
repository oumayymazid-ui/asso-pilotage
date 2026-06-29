// Script de création des familles fictives via l'API Apps Script déjà déployée
// Usage : node scripts/seed-families.mjs

const API_URL = "https://script.google.com/macros/s/AKfycbwyDcPzZymbcCwmr7VstF4duYs6qJUozMROWb8GOKxMPBit2q1lZop9bMKXe2WnPPLn/exec"

const NOMS = ["Benali","Diallo","Traore","Coulibaly","Ndiaye","Mbaye","Camara","Kone","Toure","Sylla","Bah","Sow","Barry","Konate","Keita","Cisse","Balde","Martin","Bernard","Dupont","Leroy","Moreau","Simon","Laurent","Lefebvre","Michel","Garcia","Nguyen","Tran","Le","Pham","Hoang","Vo","Duong","Do","Bui","Dang","El Amrani","Bouazza","Mansouri","Rachidi","Alaoui","Benkirane","Chaabi","Lamrani","Tahiri","Okonkwo","Adeyemi","Ibrahim","Musa","Yusuf","Ahmed","Hassan","Ali","Omar","Saleh","Popescu","Ionescu","Gheorghe","Popa","Stan","Radu","Santos","Silva","Costa","Ferreira","Alves","Carvalho","Pereira","Rodrigues","Lima","Gomes","Ivanov","Petrov","Sidorov","Kuznetsov","Popov","Sokolov","Lebedev","Kozlov"]
const PRENOMS_F = ["Fatima","Aicha","Mariama","Kadiatou","Mariam","Bineta","Aminata","Coumba","Rokhaya","Sophie","Marie","Claire","Anne","Isabelle","Nathalie","Christine","Sandrine","Linh","Huong","Lan","Mai","Thu","Hoa","Amina","Houda","Khadija","Zineb","Sara","Nadia","Samira","Awa","Rouga","Penda","Seynabou","Meryem","Hanae"]
const PRENOMS_M = ["Mamadou","Ibrahima","Ousmane","Modou","Cheikh","Abdou","Samba","Lamine","Moussa","Babacar","Jean","Pierre","Marc","Philippe","David","Bruno","Thierry","Pascal","Frederic","Nicolas","Minh","Duc","Hieu","Tuan","Hung","Long","Mohamed","Karim","Hamid","Youssef","Rachid","Mehdi","Amine","Tariq","Samir","Bilal"]
const PRENOMS_E = ["Lucas","Emma","Noah","Lea","Gabriel","Jade","Raphael","Chloe","Louis","Camille","Theo","Manon","Hugo","Ines","Tom","Anais","Nathan","Lola","Mathis","Zoe","Adam","Lina","Enzo","Lisa","Rayan","Nour","Kylian","Yasmine","Sacha","Ambre","Ethan","Sofia","Axel","Alice","Ryan","Eva","Dylan","Lucie","Nolan","Sarah"]
const NIVEAUX = ["Alpha","A1-","A1+","A2-","A2+/B1"]
const STATUTS = ["EN COURS","EN COURS","EN COURS","SUSPENDU","ARRETE"]
const PAYS = ["Mali","Senegal","Guinee","Maroc","Algerie","Tunisie","Vietnam","Cambodge","France","Roumanie","Portugal","Cameroun","Congo","Togo","Benin"]
const LANGUES = ["Bambara","Wolof","Pular","Arabe","Berbere","Vietnamien","Khmer","Roumain","Portugais","Francais","Anglais","Fon","Haoussa"]
const RUES = ["des Lilas","du Moulin","de la Paix","Victor Hugo","Jean Jaures","des Acacias","du Chateau","de la Republique","Moliere","Voltaire","Emile Zola","du Commerce","des Cerisiers"]
const VOIES = ["rue","avenue","boulevard","impasse","allee"]
const SOURCES = ["Mission locale","CAF","Mairie","Bouche a oreille","Ecole","Travailleur social","Pole emploi","Autre"]

function rand(arr) { return arr[Math.floor(Math.random() * arr.length)] }
function randInt(a, b) { return Math.floor(Math.random() * (b - a + 1)) + a }
function pad(n, l) { return String(n).padStart(l, "0") }
function date(minY, maxY) { return `${pad(randInt(1,28),2)}/${pad(randInt(1,12),2)}/${randInt(minY,maxY)}` }
function tel() { return `06${randInt(10,99)}${randInt(100000,999999)}` }

async function post(body) {
  const res = await fetch(API_URL, {
    method: "POST",
    headers: { "Content-Type": "text/plain;charset=utf-8" },
    body: JSON.stringify(body),
    redirect: "follow",
  })
  return res.json()
}

// 70 familles : nbParents × nbEnfants
const CONFIGS = [
  ...Array(20).fill([2,2]),
  ...Array(15).fill([2,3]),
  ...Array(10).fill([1,2]),
  ...Array(8).fill([1,1]),
  ...Array(7).fill([2,1]),
  ...Array(5).fill([1,0]),
  ...Array(3).fill([2,4]),
  ...Array(2).fill([1,3]),
].sort(() => Math.random() - 0.5)

let famIdx = 1, memIdx = 1, ok = 0, err = 0

for (const [nbP, nbE] of CONFIGS) {
  const idFam = `FAM${pad(famIdx,4)}`
  const nom = rand(NOMS)
  const adresse = `${randInt(1,120)} ${rand(VOIES)} ${rand(RUES)}, Nantes`
  const qvp = Math.random() > 0.4 ? "Oui" : "Non"
  const pays = rand(PAYS)
  const langue = rand(LANGUES)
  const niveau = rand(NIVEAUX)
  const source = rand(SOURCES)

  // Créer la famille
  const resFam = await post({
    action: "addFamille",
    data: { ID_Famille: idFam, Nom_Famille: nom, Adresse: adresse, Quartier_QVP: qvp, Nb_Membres: nbP + nbE, Date_Creation: "23/06/2026" }
  })
  if (!resFam?.ok) { console.error(`ERREUR famille ${idFam}:`, resFam); err++; famIdx++; continue }

  // Parents
  for (let p = 0; p < nbP; p++) {
    const idMem = `MEM${pad(memIdx,4)}`
    const prenom = p === 0 ? rand(PRENOMS_F) : rand(PRENOMS_M)
    const role = p === 0 ? "Parent" : "Representant legal"
    const t = tel()
    await post({
      action: "addMembre",
      data: {
        ID_Membre: idMem, ID_Famille: idFam, Nom: nom, Prenom: prenom,
        Role: role, Genre: p === 0 ? "F" : "M",
        Date_Naissance: date(1970, 1990),
        Langue_Maternelle: langue, Pays_Origine: pays,
        Telephone: t, WhatsApp: t, Email: "",
        Statut_Inscription: rand(STATUTS), Niveau: niveau,
        Source_Orientation: source, Nb_Enfants: nbE || "", Notes: ""
      }
    })
    memIdx++
  }

  // Enfants
  for (let e = 0; e < nbE; e++) {
    const idMem = `MEM${pad(memIdx,4)}`
    const prenom = rand(PRENOMS_E)
    await post({
      action: "addMembre",
      data: {
        ID_Membre: idMem, ID_Famille: idFam, Nom: nom, Prenom: prenom,
        Role: "Enfant", Genre: Math.random() > 0.5 ? "F" : "M",
        Date_Naissance: date(2010, 2020),
        Langue_Maternelle: langue, Pays_Origine: pays,
        Telephone: "", WhatsApp: "", Email: "",
        Statut_Inscription: "", Niveau: "", Source_Orientation: "", Nb_Enfants: "", Notes: ""
      }
    })
    memIdx++
  }

  ok++
  process.stdout.write(`\r${ok}/70 familles créées...`)
  famIdx++
}

console.log(`\nTerminé : ${ok} familles, ${memIdx - 1} membres`)
