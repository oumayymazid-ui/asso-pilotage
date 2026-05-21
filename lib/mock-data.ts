export const absences = {
  stats: { total: 3, nonJustifiees: 2, appelsEffectues: 1 },
  today: [
    { id: 1, nom: "Sarah M.", groupe: "Groupe A – Web", totalAbsences: 3, statut: "à appeler", contact: "06 12 34 56 78" },
    { id: 2, nom: "Yasmine B.", groupe: "Groupe B – Python", totalAbsences: 1, statut: "excusée", contact: "07 23 45 67 89" },
    { id: 3, nom: "Fatima K.", groupe: "Groupe A – Web", totalAbsences: 5, statut: "à appeler", contact: "06 34 56 78 90" },
  ],
  historique: [
    { semaine: "12 mai", total: 5 },
    { semaine: "5 mai", total: 2 },
    { semaine: "28 avr.", total: 8 },
    { semaine: "21 avr.", total: 1 },
  ],
}

export const finances = {
  stats: { enCours: 2, montantTotal: 17000, deadlineCetteSemaine: 1, tauxRemplissage: 68 },
  demandes: [
    { id: 1, type: "Subvention", org: "Mairie de Paris", montant: 5000, statut: "en cours", priorite: "haute", deadline: "2026-05-30", responsable: "Nadia", notes: "Dossier complet envoyé le 3 mai" },
    { id: 2, type: "Subvention", org: "Région Île-de-France", montant: 12000, statut: "à compléter", priorite: "haute", deadline: "2026-05-28", responsable: "Nadia", notes: "Manque rapport d'activité 2025" },
    { id: 3, type: "Mécénat", org: "Fondation Orange", montant: 3000, statut: "accepté", priorite: "normale", deadline: "2026-04-15", responsable: "Nadia", notes: "Versement prévu en juin" },
    { id: 4, type: "Subvention", org: "CAF Paris", montant: 8000, statut: "rejeté", priorite: "normale", deadline: "2026-03-01", responsable: "Nadia", notes: "Hors critères d'éligibilité" },
  ],
  inscriptions: [
    { id: 1, nom: "Leila A.", montant: 50, statut: "payé", date: "2026-05-02" },
    { id: 2, nom: "Mariam D.", montant: 50, statut: "en attente", date: "2026-05-10" },
    { id: 3, nom: "Noura S.", montant: 50, statut: "en retard", date: "2026-04-20" },
    { id: 4, nom: "Hana T.", montant: 50, statut: "payé", date: "2026-05-05" },
    { id: 5, nom: "Ines C.", montant: 50, statut: "en retard", date: "2026-04-15" },
  ],
}

export const ateliers = {
  // Sessions d'ateliers
  sessions: [
    { id: 1, titre: "Initiation HTML/CSS", description: "Découverte des bases du web", date: "2026-05-21", heure: "14h00", duree: "2h", salle: "Salle A", formatrice: "Somayeh", beneficiaireIds: [1, 3, 4], benevoleIds: [1], statut: "planifié" },
    { id: 2, titre: "Logique & Algorithmie", description: "Résolution de problèmes et pensée computationnelle", date: "2026-05-22", heure: "10h00", duree: "2h", salle: "À confirmer", formatrice: "Somayeh", beneficiaireIds: [2, 6], benevoleIds: [2], statut: "planifié" },
    { id: 3, titre: "Projet web libre", description: "Travaux pratiques sur projet personnel", date: "2026-05-24", heure: "09h30", duree: "3h", salle: "Salle B", formatrice: "Nadia", beneficiaireIds: [5], benevoleIds: [3], statut: "planifié" },
    { id: 4, titre: "Initiation HTML/CSS — séance 1", description: "", date: "2026-05-07", heure: "14h00", duree: "2h", salle: "Salle A", formatrice: "Somayeh", beneficiaireIds: [1, 3, 4], benevoleIds: [1], statut: "terminé" },
  ],
  // Bénéficiaires (enfants + contact parent)
  // Notes du test de positionnement : 4 thématiques × 2 sessions (initial / final).
  // Cf. lib/positionnement.ts pour les types & helpers.
  beneficiaires: [
    { id: 1, prenom: "Leila", nom: "A.", dateNaissance: "2015-03-12", email: "leila@email.fr", telephone: "", nomParent: "Farida A.", telephoneParent: "06 11 22 33 44", emailParent: "farida.a@email.fr", dateInscription: "2026-09-10",
      positionnementInitial: { comprehensionEcrite: 8,  comprehensionOrale: 10, expressionEcrite: 7,  expressionOrale: 9  },
      positionnementFinal:   { comprehensionEcrite: null, comprehensionOrale: null, expressionEcrite: null, expressionOrale: null },
      niveau: "débutant", notes: "Très motivée. Objectif : apprendre à coder.", statut: "actif" },
    { id: 2, prenom: "Mariam", nom: "D.", dateNaissance: "2013-07-25", email: "", telephone: "", nomParent: "Khadija D.", telephoneParent: "06 22 33 44 55", emailParent: "khadija.d@email.fr", dateInscription: "2026-09-10",
      positionnementInitial: { comprehensionEcrite: 15, comprehensionOrale: 13, expressionEcrite: 14, expressionOrale: 14 },
      positionnementFinal:   { comprehensionEcrite: null, comprehensionOrale: null, expressionEcrite: null, expressionOrale: null },
      niveau: "intermédiaire", notes: "A déjà fait du HTML en autodidacte. Bonne logique.", statut: "actif" },
    { id: 3, prenom: "Sarah", nom: "M.", dateNaissance: "2016-01-08", email: "", telephone: "", nomParent: "Amina M.", telephoneParent: "06 33 44 55 66", emailParent: "amina.m@email.fr", dateInscription: "2026-09-15",
      positionnementInitial: { comprehensionEcrite: 7,  comprehensionOrale: 6,  expressionEcrite: 8,  expressionOrale: 7  },
      positionnementFinal:   { comprehensionEcrite: null, comprehensionOrale: null, expressionEcrite: null, expressionOrale: null },
      niveau: "débutant", notes: "3 absences. Barrière langue partielle.", statut: "actif" },
    { id: 4, prenom: "Fatima", nom: "K.", dateNaissance: "2014-11-30", email: "", telephone: "", nomParent: "Zainab K.", telephoneParent: "06 44 55 66 77", emailParent: "zainab.k@email.fr", dateInscription: "2026-09-15",
      positionnementInitial: { comprehensionEcrite: 6,  comprehensionOrale: 7,  expressionEcrite: 5,  expressionOrale: 6  },
      positionnementFinal:   { comprehensionEcrite: null, comprehensionOrale: null, expressionEcrite: null, expressionOrale: null },
      niveau: "débutant", notes: "Besoin d'accompagnement renforcé.", statut: "actif" },
    { id: 5, prenom: "Hana", nom: "T.", dateNaissance: "2012-05-19", email: "hana@email.fr", telephone: "06 55 66 77 88", nomParent: "Nour T.", telephoneParent: "06 55 66 77 89", emailParent: "nour.t@email.fr", dateInscription: "2026-09-10",
      positionnementInitial: { comprehensionEcrite: 19, comprehensionOrale: 18, expressionEcrite: 18, expressionOrale: 20 },
      positionnementFinal:   { comprehensionEcrite: null, comprehensionOrale: null, expressionEcrite: null, expressionOrale: null },
      niveau: "avancé", notes: "Niveau excellent. Peut aider les autres.", statut: "actif" },
    { id: 6, prenom: "Ines", nom: "C.", dateNaissance: "2013-09-03", email: "", telephone: "", nomParent: "Soraya C.", telephoneParent: "06 66 77 88 99", emailParent: "soraya.c@email.fr", dateInscription: "2026-09-12",
      positionnementInitial: { comprehensionEcrite: 12, comprehensionOrale: 13, expressionEcrite: 11, expressionOrale: 12 },
      positionnementFinal:   { comprehensionEcrite: null, comprehensionOrale: null, expressionEcrite: null, expressionOrale: null },
      niveau: "intermédiaire", notes: "Bonne progression. Intéressée par le back-end.", statut: "actif" },
  ],
  // Groupes (composition par âge, niveau ou mixte)
  groupes: [
    { id: 1, nom: "Groupe A – Débutants", type: "niveau", description: "Bénéficiaires sans expérience (note ≤ 10)", beneficiaireIds: [1, 3, 4] },
    { id: 2, nom: "Groupe B – Intermédiaires", type: "niveau", description: "HTML/CSS connus, bonne logique (note 11-16)", beneficiaireIds: [2, 6] },
    { id: 3, nom: "Groupe C – Avancés", type: "niveau", description: "Niveau confirmé (note ≥ 17)", beneficiaireIds: [5] },
  ],
}

export const communication = {
  stats: { postsASemaine: 2, evenementsAVenir: 3, postsDrafts: 1 },
  calendrier: [
    { id: 1, date: "2026-05-21", titre: "Recap atelier HTML", plateforme: ["LinkedIn", "Instagram"], statut: "à créer", evenement: "Atelier 21 mai" },
    { id: 2, date: "2026-05-23", titre: "Portrait bénévole", plateforme: ["Instagram"], statut: "brouillon", evenement: null },
    { id: 3, date: "2026-05-27", titre: "Annonce portes ouvertes", plateforme: ["LinkedIn", "Instagram", "Facebook"], statut: "à créer", evenement: "Portes ouvertes 7 juin" },
    { id: 4, date: "2026-06-07", titre: "Live portes ouvertes", plateforme: ["Instagram"], statut: "planifié", evenement: "Portes ouvertes 7 juin" },
  ],
  evenements: [
    { id: 1, nom: "Atelier public – HTML/CSS", date: "2026-05-21", type: "atelier" },
    { id: 2, nom: "Portes ouvertes", date: "2026-06-07", type: "événement" },
    { id: 3, nom: "Remise des diplômes Promo 3", date: "2026-06-28", type: "cérémonie" },
  ],
}

export const membres = {
  liste: [
    { id: 1,  prenom: "Nadjat",   nom: "B.",     email: "nadjat@asso.fr",   telephone: "06 11 22 33 44", role: "coordinatrice", statut: "active",     dateInscription: "2024-09-01", notes: "" },
    { id: 2,  prenom: "Somayeh",  nom: "M.",     email: "somayeh@asso.fr",  telephone: "06 22 33 44 55", role: "formatrice",    statut: "active",     dateInscription: "2024-09-01", notes: "Formatrice web & algorithmie" },
    { id: 3,  prenom: "Nadia",    nom: "A.",     email: "nadia@asso.fr",    telephone: "06 33 44 55 66", role: "formatrice",    statut: "active",     dateInscription: "2024-10-15", notes: "Formatrice projets avancées" },
    { id: 4,  prenom: "Amira",    nom: "L.",     email: "amira@asso.fr",    telephone: "06 44 55 66 77", role: "benevole",      statut: "active",     dateInscription: "2024-11-01", notes: "Accueil & animation" },
    { id: 5,  prenom: "Fatima",   nom: "K.",     email: "fatima@asso.fr",   telephone: "06 55 66 77 88", role: "benevole",      statut: "active",     dateInscription: "2025-01-10", notes: "" },
    { id: 6,  prenom: "Yasmine",  nom: "D.",     email: "yasmine@asso.fr",  telephone: "06 66 77 88 99", role: "benevole",      statut: "inactive",   dateInscription: "2024-12-01", notes: "Indisponible jusqu'à sept." },
    { id: 7,  prenom: "Inès",     nom: "C.",     email: "ines@asso.fr",     telephone: "",               role: "benevole",      statut: "en attente", dateInscription: "2025-05-10", notes: "Candidature reçue" },
  ],
}

export const benevoles = {
  stats: { total: 12, confirmes: 9, manquantsProchainEvent: 2, desistementsEnCours: 1 },
  prochainEvenement: { nom: "Portes ouvertes", date: "2026-06-07", besoins: 6, confirmes: 4 },
  liste: [
    { id: 1, nom: "Amira L.", competences: ["Animation", "Accueil"], disponible: true, prochainEvent: true },
    { id: 2, nom: "Céline D.", competences: ["Technique", "Formation"], disponible: true, prochainEvent: true },
    { id: 3, nom: "Dina R.", competences: ["Communication", "Accueil"], disponible: false, prochainEvent: false },
    { id: 4, nom: "Emma P.", competences: ["Animation"], disponible: true, prochainEvent: true },
    { id: 5, nom: "Fatiha M.", competences: ["Accueil", "Admin"], disponible: true, prochainEvent: false },
    { id: 6, nom: "Jade B.", competences: ["Technique", "Animation"], disponible: true, prochainEvent: true },
    { id: 7, nom: "Karine S.", competences: ["Formation"], disponible: false, prochainEvent: false },
    { id: 8, nom: "Lucie T.", competences: ["Communication"], disponible: true, prochainEvent: false },
  ],
}
