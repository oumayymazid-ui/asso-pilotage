import LegalPage, { Section, Todo } from "@/components/LegalPage"

export const metadata = { title: "Politique de confidentialité — Asso Pilotage" }

export default function ConfidentialitePage() {
  return (
    <LegalPage title="Politique de confidentialité" updated="1er juillet 2026">
      <p>
        La présente politique décrit la manière dont l'association traite les données personnelles
        des bénéficiaires, de leurs familles et des membres de l'équipe, conformément au Règlement
        général sur la protection des données (RGPD) et à la loi « Informatique et Libertés ».
      </p>

      <Section title="Responsable de traitement">
        <p>
          Le responsable de traitement est l'association <Todo>nom de l'association</Todo>, dont le
          siège est situé <Todo>adresse</Todo>. Contact : <Todo>email de contact / DPO le cas échéant</Todo>.
        </p>
      </Section>

      <Section title="Données collectées">
        <ul className="list-disc pl-5 flex flex-col gap-1">
          <li>Identité : nom, prénom, date de naissance (dont mineurs)</li>
          <li>Coordonnées : adresse postale, téléphone, e-mail, quartier</li>
          <li>Situation familiale : composition de la famille, lien parent / enfant</li>
          <li>Suivi pédagogique : inscriptions, niveau, assiduité (présences / absences), évaluations</li>
          <li>Données financières : paiements, montants dus, financements</li>
          <li>Documents : bulletins d'inscription, autorisations, pièces justificatives</li>
          <li>Droit à l'image : consentement à la diffusion de photos / vidéos</li>
          <li>Comptes utilisateurs : e-mail et rôle des membres de l'équipe</li>
        </ul>
      </Section>

      <Section title="Finalités et base légale">
        <ul className="list-disc pl-5 flex flex-col gap-1">
          <li>Gestion et suivi des bénéficiaires (mission d'intérêt de l'association)</li>
          <li>Suivi pédagogique et de l'assiduité (mission de l'association)</li>
          <li>Gestion administrative et financière (obligation légale / mission)</li>
          <li>Communication et diffusion d'images : <strong>consentement</strong> (consentement parental pour les mineurs)</li>
        </ul>
        <p>
          Base légale principale : exécution de la mission d'intérêt général de l'association et,
          pour l'image, le consentement des personnes concernées.
        </p>
      </Section>

      <Section title="Destinataires et sous-traitants">
        <p>
          Les données sont accessibles aux membres habilités de l'association. Des prestataires
          techniques (sous-traitants au sens du RGPD) interviennent pour l'hébergement et certaines
          fonctionnalités :
        </p>
        <ul className="list-disc pl-5 flex flex-col gap-1">
          <li><strong>Vercel</strong> — hébergement de l'application (États-Unis)</li>
          <li><strong>Supabase</strong> — authentification / comptes (région <Todo>région du projet Supabase</Todo>)</li>
          <li><strong>Google</strong> — stockage des données (Sheets), documents (Drive), lecture assistée des bulletins et aide à la rédaction de publications (Gemini)</li>
        </ul>
        <p>
          Certains prestataires étant situés <strong>hors Union européenne</strong>, les transferts
          sont encadrés par des garanties appropriées (clauses contractuelles types).{" "}
          <Todo>vérifier / joindre les garanties de transfert de chaque prestataire</Todo>
        </p>
      </Section>

      <Section title="Durée de conservation">
        <p>
          Les données sont conservées pour la durée nécessaire aux finalités ci-dessus, puis
          archivées ou supprimées. <Todo>préciser les durées (ex. X ans après le dernier contact)</Todo>
        </p>
      </Section>

      <Section title="Vos droits">
        <p>
          Vous disposez d'un droit d'accès, de rectification, d'effacement, d'opposition, de
          limitation et de portabilité de vos données. Pour les exercer, contactez :{" "}
          <Todo>email de contact / DPO</Todo>.
        </p>
        <p>
          Vous pouvez introduire une réclamation auprès de la CNIL —{" "}
          <a href="https://www.cnil.fr" className="text-familles-dark hover:underline">www.cnil.fr</a>.
        </p>
      </Section>

      <Section title="Mineurs">
        <p>
          L'association traite des données de mineurs. Leur collecte et, en particulier, l'usage de
          leur image reposent sur le consentement du ou des titulaires de l'autorité parentale.
        </p>
      </Section>

      <Section title="Cookies">
        <p>
          L'application utilise uniquement des cookies strictement nécessaires à son fonctionnement
          (maintien de la session d'authentification). Aucun cookie de mesure d'audience ou
          publicitaire n'est déposé sans votre consentement.{" "}
          <Todo>mettre à jour si un outil de mesure d'audience est ajouté</Todo>
        </p>
      </Section>
    </LegalPage>
  )
}
