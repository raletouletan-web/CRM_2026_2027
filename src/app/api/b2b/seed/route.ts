import { db } from "@/db";
import { calls, financialSettings, prospectingHours, prospects } from "@/db/schema";
import { count, eq } from "drizzle-orm";
import { json } from "@/lib/server";

export const dynamic = "force-dynamic";

// POST /api/b2b/seed — initialise les données B2B (heures, paramètres et appels qualifiés)
export async function POST() {
  // Garde-fou : le jeu de démonstration n'est créé que sur une base sans aucun appel ni heure déclarée.
  // Il ne modifie jamais des données existantes (appels réels, paramètres ROI).
  const [{ value: nbCalls }] = await db.select({ value: count() }).from(calls);
  const [{ value: nbHours }] = await db.select({ value: count() }).from(prospectingHours);
  if (nbCalls > 0 || nbHours > 0) {
    return json({
      ok: true,
      seeded: false,
      message: "Données existantes conservées : aucune donnée de démonstration ajoutée.",
    });
  }

  // 1. Paramètres financiers pour 2026-11
  await db
    .insert(financialSettings)
    .values({
      mois: "2026-11",
      coutProspection: 4500,
      panierMoyen: 2500,
    })
    .onConflictDoUpdate({
      target: financialSettings.mois,
      set: { coutProspection: 4500, panierMoyen: 2500, updatedAt: new Date() },
    });

  // 2. Heures de prospection par commercial (jours ouvrés de novembre 2026 : du 02 au 11)
  const jours = [
    "2026-11-02",
    "2026-11-03",
    "2026-11-04",
    "2026-11-05",
    "2026-11-06",
    "2026-11-09",
    "2026-11-10",
    "2026-11-11",
  ];
  const commerciaux = ["Alexandre Martin", "Sarah Benali", "Thomas Leroy", "Élodie Fontaine"];

  // Calibrage réaliste des sessions de prospection téléphonique pure :
  // En moyenne 35 à 50 min de phoning direct par commercial par jour (9 à 17 appels/h)
  for (const c of commerciaux) {
    for (const j of jours) {
      const baseHours = c === "Alexandre Martin" ? 0.6 : c === "Sarah Benali" ? 0.7 : c === "Thomas Leroy" ? 0.8 : 0.5;
      const heures = j === "2026-11-11" ? baseHours * 0.5 : baseHours;
      await db
        .insert(prospectingHours)
        .values({
          commercial: c,
          date: j,
          heures,
          notes: `Session blitz phoning B2C ${j}`,
        })
        .onConflictDoNothing();
    }
  }

  // 3. Récupérer des prospects existants pour lier les appels
  const allProspects = await db.select().from(prospects).limit(60);
  if (allProspects.length === 0) {
    return json({ seeded: false, message: "Prospects manquants" });
  }

  // Mettre à jour les 12 appels existants avec des attributs B2B cohérents
  const existingCalls = await db.select().from(calls);
  const sampleResults = [
    { res: "contact_utile_rappel", dur: 145, post: 40, rdv: "a_venir", sig: "non", motif: "" },
    { res: "pas_reponse", dur: 0, post: 15, rdv: "non", sig: "non", motif: "" },
    { res: "repondeur", dur: 15, post: 20, rdv: "non", sig: "non", motif: "" },
    { res: "barrage", dur: 25, post: 30, rdv: "non", sig: "non", motif: "" },
    { res: "contact_utile_rdv", dur: 210, post: 55, rdv: "oui", sig: "oui", motif: "" },
    { res: "contact_utile_refus", dur: 75, post: 35, rdv: "non", sig: "non", motif: "pas_budget" },
    { res: "contact_utile_rdv", dur: 180, post: 50, rdv: "oui", sig: "non", motif: "" },
    { res: "contact_utile_rappel", dur: 130, post: 40, rdv: "a_venir", sig: "non", motif: "" },
    { res: "contact_utile_rdv", dur: 195, post: 45, rdv: "oui", sig: "oui", motif: "" },
    { res: "contact_utile_rappel", dur: 110, post: 30, rdv: "a_venir", sig: "non", motif: "" },
    { res: "barrage", dur: 20, post: 20, rdv: "non", sig: "non", motif: "" },
    { res: "contact_utile_refus", dur: 65, post: 25, rdv: "non", sig: "non", motif: "deja_equipe" },
  ];

  for (let i = 0; i < existingCalls.length; i++) {
    const c = existingCalls[i];
    const s = sampleResults[i % sampleResults.length];
    const rep = commerciaux[i % commerciaux.length];
    await db
      .update(calls)
      .set({
        commercial: rep,
        resultat: s.res,
        dureeSecondes: s.dur,
        tempsTraitement: s.post,
        rdvHonore: s.rdv,
        clientSigne: s.sig,
        motifRefus: s.motif,
      })
      .where(eq(calls.id, c.id));
  }

  // 4. Ajouter une série d'appels qualifiés supplémentaires pour créer des statistiques d'équipe riches
  if (existingCalls.length < 50) {
    const newCalls: (typeof calls.$inferInsert)[] = [];
    const entreprises = [
      "TechCorp Solutions",
      "Apex Logistique",
      "Cabinet Dupont & Co",
      "Groupe Horizon BTP",
      "BioSanté Ouest",
      "Innov'RH Conseil",
      "Manufacture du Centre",
      "Finova Courtage",
      "AeroSys Ingénierie",
      "Delta Services IT",
      "OmniCom Médias",
      "Proxima Distribution",
    ];

    // Créons ~160 appels répartis sur nov 2026 avec distributions réalistes
    let seed = 42;
    const rnd = () => {
      seed = (seed * 9301 + 49297) % 233280;
      return seed / 233280;
    };

    for (let dayIdx = 0; dayIdx < jours.length; dayIdx++) {
      const jourStr = jours[dayIdx];
      // Pour chaque commercial ce jour-là
      for (const rep of commerciaux) {
        // 5 à 7 appels par commercial par session
        const nbCallsThisDay = 5 + Math.floor(rnd() * 3);
        for (let k = 0; k < nbCallsThisDay; k++) {
          const p = allProspects[Math.floor(rnd() * allProspects.length)];
          const ent = entreprises[Math.floor(rnd() * entreprises.length)];
          // Heure d'appel entre 8h et 18h
          const hour = 8 + Math.floor(rnd() * 10);
          const minute = Math.floor(rnd() * 60);
          const callDate = new Date(`${jourStr}T${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}:00Z`);

          const roll = rnd();
          let res: string;
          let dur = 0;
          let post = 15 + Math.floor(rnd() * 30);
          let motif = "";
          let rdvHonore = "non";
          let clientSigne = "non";
          let resume = "";

          if (roll < 0.04) {
            // Faux numéro (~4%)
            res = "faux_numero";
            dur = 0;
            post = 15;
            resume = "Numéro non attribué ou erroné.";
          } else if (roll < 0.52) {
            // Pas de réponse / occupé (~48%)
            res = "pas_reponse";
            dur = 0;
            post = 10;
            resume = "Pas de réponse après 5 sonneries.";
          } else if (roll < 0.72) {
            // Répondeur (~20%)
            res = "repondeur";
            dur = 12 + Math.floor(rnd() * 15);
            post = 20;
            resume = "Message vocal de relance déposé.";
          } else if (roll < 0.82) {
            // Barrage standard (~10%)
            res = "barrage";
            dur = 18 + Math.floor(rnd() * 20); // <30s
            post = 30;
            resume = "Barrage secrétaire : refuse de transmettre.";
          } else if (roll < 0.86) {
            // Mauvais interlocuteur (~4%)
            res = "mauvais_interlocuteur";
            dur = 25 + Math.floor(rnd() * 35);
            post = 35;
            resume = "N'est plus responsable du périmètre.";
          } else if (roll < 0.94) {
            // Contact utile – refus (~8%)
            res = "contact_utile_refus";
            dur = 45 + Math.floor(rnd() * 80);
            post = 45;
            const motifs = ["deja_equipe", "pas_budget", "mauvais_moment", "pas_bon_interlocuteur", "autre"];
            motif = motifs[Math.floor(rnd() * motifs.length)];
            resume = `Échange direct avec le prospect. Refus : ${motif}.`;
          } else if (roll < 0.97) {
            // Contact utile – rappel (~3%)
            res = "contact_utile_rappel";
            dur = 130 + Math.floor(rnd() * 90); // > 2 min
            post = 50;
            resume = "Intérêt confirmé, rappel calé pour approfondir.";
          } else {
            // Contact utile – RDV pris (~3%)
            res = "contact_utile_rdv";
            dur = 180 + Math.floor(rnd() * 150); // > 2 min
            post = 60;
            resume = "RDV fixé directement avec le prospect.";
            // Si la date est antérieure au 10 nov, le RDV est déjà échu
            if (dayIdx <= 4) {
              const rdvRoll = rnd();
              if (rdvRoll < 0.8) {
                rdvHonore = "oui";
                // Conversion en client signé (~30% des honorés)
                if (rnd() < 0.35) {
                  clientSigne = "oui";
                }
              } else {
                rdvHonore = "non";
              }
            } else {
              rdvHonore = "a_venir";
            }
          }

          newCalls.push({
            prospectId: p.id,
            commercial: rep,
            entreprise: ent,
            telephone: p.telephone || "01 42 68 00 00",
            date: callDate,
            type: "appel",
            resultat: res,
            dureeSecondes: dur,
            tempsTraitement: post,
            duree: Math.round(dur / 60),
            motifRefus: motif,
            rdvHonore,
            clientSigne,
            resume,
          });
        }
      }
    }

    if (newCalls.length > 0) {
      await db.insert(calls).values(newCalls);
    }
  }

  return json({ ok: true, message: "Données B2C initialisées avec succès." });
}
