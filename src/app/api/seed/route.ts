import { db } from "@/db";
import { calls, prospects, type ProspectInsert } from "@/db/schema";
import { count } from "drizzle-orm";
import { json } from "@/lib/server";

export const dynamic = "force-dynamic";

// Petit PRNG déterministe pour des données reproductibles.
function mulberry32(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const PRENOMS = [
  "Aïcha", "Amadou", "Aminata", "Brigitte", "Céline", "Djoyss", "Élodie", "Fatou", "Habiba", "Inès",
  "José", "Karim", "Leila", "Mamy", "Nora", "Omar", "Rostide", "Sandy", "Stéphanie", "Vincent",
  "Yasmina", "Zakia", "Bilal", "Clara", "Driss", "Emma", "Farida", "Grégory", "Houda", "Ilhame",
  "Jean", "Kadiatou", "Lamine", "Marlène", "Nicolas", "Océane", "Pascal", "Rania", "Sonia", "Thierry",
  "Ursule", "Victor", "Wendy", "Xavier", "Youssef", "Zoé", "Antoine", "Binta", "Cyril", "Delphine",
];

const NOMS = [
  "Akassy", "BAMEZON", "Benamar", "Benbara", "BISSE", "Douayeb", "Fof", "Giraud", "Idri", "Kessad",
  "Mbenza", "Michaud", "Mendy", "Mili", "Mounkela", "Nabti", "Nana", "Omri", "Rodrigues", "Shankuru",
  "SOUAGNON", "Da Silva", "Winckelmuller", "Zekou", "Zazungi", "meddane", "Menut", "Zanutto", "Derdour", "Lessa",
  "Yoro", "Akif", "Mavie Cœur", "Anne Rose", "Diallo", "Traoré", "Koné", "Bakayoko", "Camara", "Touré",
  "Diarra", "Keita", "Sissoko", "Coulibaly", "Ouattara", "Fofana", "Konaté", "Bamba", "Yao", "Kouadio",
];

const EMAILS = ["gmail.com", "hotmail.fr", "hotmail.com", "outlook.fr", "outlook.com", "live.fr", "yahoo.fr", "orange.fr"];

function slug(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "");
}

function makePhone(rand: () => number): string {
  const r = rand();
  if (r < 0.15) {
    return "07" + String(Math.floor(rand() * 100000000)).padStart(8, "0");
  }
  const parts = Array.from({ length: 4 }, () => String(Math.floor(rand() * 100)).padStart(2, "0"));
  return `+33 6 ${parts.join(" ")}`;
}

function makeEmail(prenom: string, nom: string, rand: () => number): string {
  const dom = EMAILS[Math.floor(rand() * EMAILS.length)];
  const num = Math.floor(rand() * 90) + 10;
  return `${slug(prenom)}${slug(nom)}${num}@${dom}`;
}

// Prospects explicites tirés des copies d'écran.
function specialProspects(today: Date): ProspectInsert[] {
  const d = (iso: string, h = 0, m = 0) => {
    const [y, mo, da] = iso.split("-").map(Number);
    return new Date(Date.UTC(y, mo - 1, da, h, m));
  };
  return [
    {
      nom: "SOUAGNON", prenom: "Brigitte", telephone: "+33 6 69 74 37 18", email: "fletbib3@gmail.com",
      urgence: "chaud", statut: "close", financement: "Non défini", nbAppels: 2,
      dernierContact: d("2026-11-11", 9, 12), prochainRappel: d("2026-05-08"), heureRappel: "",
      resumeAppel: "Appel ce jour. A dit qu'elle va me rappeler. AES intervient en tant AES. Pour VAE DEAS",
      offreProposee: "1400", statutPaiement: "Payé", caGenere: 1400,
    },
    {
      nom: "Fof (Fofana)", prenom: "Rouqui", telephone: "+33 6 12 34 56 78", email: "roufi.fofana@gmail.com",
      urgence: "moyen", statut: "close", financement: "Non défini", nbAppels: 0,
      dernierContact: d("2026-11-10", 15, 30), offreProposee: "1440", statutPaiement: "Payé", caGenere: 1440,
      resumeAppel: "Signature obtenue, paiement encaissé.",
    },
    {
      nom: "Mbenza", prenom: "Matona", telephone: "+33 7 11 22 33 44", email: "matona.mbenza@hotmail.fr",
      urgence: "moyen", statut: "close", financement: "CPF", nbAppels: 0,
      dernierContact: d("2026-11-09", 11, 5), offreProposee: "1400", statutPaiement: "Payé", caGenere: 1400,
      resumeAppel: "CPF validé, dossier envoyé.",
    },
    {
      nom: "Mounkela", prenom: "Lisette", telephone: "+33 6 98 76 54 32", email: "lisette.mounkela@outlook.com",
      urgence: "froid", statut: "close", financement: "Autofinancement", nbAppels: 0,
      dernierContact: d("2026-11-08", 10, 20), offreProposee: "800", statutPaiement: "Payé", caGenere: 800,
      resumeAppel: "Petit budget, offre 800 acceptée.",
    },
    {
      nom: "Lessa", prenom: "Solange", telephone: "0761294245", email: "solange.lessa@live.fr",
      urgence: "moyen", statut: "close", financement: "OPCO", nbAppels: 0,
      dernierContact: d("2026-11-07", 16, 45), offreProposee: "1400", statutPaiement: "Payé", caGenere: 1400,
      resumeAppel: "OPCO OK, closing signé.",
    },
    {
      nom: "Zehia Yoro", prenom: "Marlène", telephone: "+33 6 55 44 33 22", email: "marlene.yoro@yahoo.fr",
      urgence: "moyen", statut: "close", financement: "CPF", nbAppels: 0,
      dernierContact: d("2026-11-06", 9, 50), offreProposee: "1400", statutPaiement: "Payé", caGenere: 1400,
      resumeAppel: "VAE validée, paiement reçu.",
    },
    {
      nom: "Benamar", prenom: "Mourad", telephone: "0761294245", email: "mouradbenamar@hotmail.fr",
      urgence: "chaud", statut: "rdv_prevu", financement: "Non défini", nbAppels: 2,
      dernierContact: d("2026-11-11", 10, 5), prochainRappel: d("2026-10-28"), heureRappel: "10:00",
      resumeAppel: "message laissé sur répondeur pour avoir des nouvelles.",
      offreProposee: "1050", statutPaiement: "Non défini", caGenere: 0,
    },
    {
      nom: "BISSE", prenom: "VINCIANE", telephone: "+33 6 51 48 45 19", email: "lastezy@hotmail.com",
      urgence: "chaud", statut: "rdv_prevu", financement: "Non défini", nbAppels: 3,
      dernierContact: d("2026-11-11", 11, 40), prochainRappel: d("2026-11-09"), heureRappel: "19:30",
      resumeAppel:
        "j'ai eu Vassiane au téléphone. Elle m'a expliqué que le problème c'était le prix. Je lui ai expliqué que l'offre initiale était à 157 et finalement je fais une proposition à 120, c'est le moment de se lancer.",
      offreProposee: "120", statutPaiement: "En attente", caGenere: 0,
    },
    {
      nom: "Anne Rose", prenom: "thomy", telephone: "+33 6 12 96 32 87", email: "annerose57300@live.fr",
      urgence: "moyen", statut: "nouveau_lead", financement: "CPF", nbAppels: 1,
      dernierContact: d("2026-11-10", 14, 15), prochainRappel: d("2025-11-04"), heureRappel: "",
      resumeAppel: "FOLLOW UP CPF 2800", offreProposee: "2800", statutPaiement: "Non défini", caGenere: 0,
    },
    {
      nom: "Mavie Cœur", prenom: "Hms", telephone: "+33 6 42 98 90 05", email: "aychatboinaali84@outlook.fr",
      urgence: "moyen", statut: "rdv_prevu", financement: "Non défini", nbAppels: 1,
      dernierContact: d("2026-11-11", 8, 50), prochainRappel: d("2026-11-11"), heureRappel: "14:00",
      resumeAppel: "FOLLOW UP 8X R2 5 février à 14h00", offreProposee: null, statutPaiement: "Non défini", caGenere: 0,
    },
    {
      nom: "Akassy", prenom: "Ines", telephone: "+33 6 20 11 22 33", email: "ines.akassy@gmail.com",
      urgence: "moyen", statut: "nouveau_lead", financement: "Non défini", caGenere: 0,
    },
    {
      nom: "BAMEZON", prenom: "Rostide", telephone: "+33 6 21 22 33 44", email: "rostide.bamezon@hotmail.fr",
      urgence: "moyen", statut: "nouveau_lead", financement: "Non défini", caGenere: 0,
    },
    {
      nom: "Giraud", prenom: "Sandrine", telephone: "+33 6 22 33 44 55", email: "sandrine.giraud@orange.fr",
      urgence: "moyen", statut: "nouveau_lead", financement: "Non défini", caGenere: 0,
      resumeAppel: "intéressée follow up 10 Janvier 11H00// Elle NEGOCIE A 1500€", offreProposee: "1500",
    },
    {
      nom: "Zanutto", prenom: "Dominique", telephone: "+33 6 23 44 55 66", email: "dominique.zanutto@gmail.com",
      urgence: "moyen", statut: "nouveau_lead", financement: "Non défini", caGenere: 0,
    },
    {
      nom: "Mendy", prenom: "Danielle", telephone: "+33 6 24 55 66 77", email: "danielle.mendy@outlook.com",
      urgence: "moyen", statut: "nouveau_lead", financement: "Non défini", caGenere: 0,
    },
    {
      nom: "Benbara", prenom: "Dalila", telephone: "+33 6 25 66 77 88", email: "dalila.benbara@live.fr",
      urgence: "moyen", statut: "nouveau_lead", financement: "Non défini", caGenere: 0,
    },
    {
      nom: "Idri", prenom: "Biba", telephone: "+33 6 26 77 88 99", email: "biba.idri@yahoo.fr",
      urgence: "moyen", statut: "nouveau_lead", financement: "Non défini", caGenere: 0,
    },
    {
      nom: "Rodrigues", prenom: "Djoyss", telephone: "+33 6 27 88 99 00", email: "djoyss.rodrigues@gmail.com",
      urgence: "moyen", statut: "nouveau_lead", financement: "Non défini", caGenere: 0,
    },
    {
      nom: "Mili", prenom: "Nora", telephone: "+33 6 30 11 22 33", email: "nora.mili@hotmail.fr",
      urgence: "moyen", statut: "a_appeler", financement: "Non défini", caGenere: 0,
      prochainRappel: d("2026-11-11"), heureRappel: "09:30",
    },
    {
      nom: "Ilhame", prenom: "Ilhame", telephone: "+33 6 31 22 33 44", email: "ilhame92@gmail.com",
      urgence: "moyen", statut: "a_appeler", financement: "Non défini", caGenere: 0,
      prochainRappel: d("2026-11-11"), heureRappel: "11:00",
    },
    {
      nom: "Michaud", prenom: "Manou", telephone: "+33 6 32 33 44 55", email: "manou.michaud@outlook.fr",
      urgence: "moyen", statut: "a_appeler", financement: "Non défini", caGenere: 0,
      prochainRappel: d("2026-11-12"), heureRappel: "10:00",
    },
    {
      nom: "Leila Douayeb", prenom: "Leila", telephone: "+33 6 33 44 55 66", email: "leila.douayeb@gmail.com",
      urgence: "moyen", statut: "a_appeler", financement: "Non défini", caGenere: 0,
      resumeAppel: "LOST DEJA Accompagné",
    },
    {
      nom: "farida", prenom: "farida", telephone: "+33 6 34 55 66 77", email: "farida84@hotmail.com",
      urgence: "moyen", statut: "a_appeler", financement: "Non défini", caGenere: 0,
      prochainRappel: d("2026-11-11"), heureRappel: "16:30",
    },
    {
      nom: "Da Silva", prenom: "Stéphanie", telephone: "+33 6 35 66 77 88", email: "stephanie.dasilva@orange.fr",
      urgence: "moyen", statut: "a_appeler", financement: "Non défini", caGenere: 0,
    },
    {
      nom: "Kessad", prenom: "Myriam", telephone: "+33 6 36 77 88 99", email: "myriam.kessad@gmail.com",
      urgence: "moyen", statut: "a_appeler", financement: "Non définir", caGenere: 0,
    },
    {
      nom: "Derdour", prenom: "Habiba", telephone: "+33 6 37 88 99 00", email: "habiba.derdour@live.fr",
      urgence: "moyen", statut: "a_appeler", financement: "Non défini", caGenere: 0,
    },
    {
      nom: "Shankuru", prenom: "Noella", telephone: "+33 6 40 11 22 33", email: "noella.shankuru@gmail.com",
      urgence: "moyen", statut: "appele", financement: "Non défini", nbAppels: 1,
      dernierContact: d("2026-11-11"), heureRappel: "18:15",
      prochainRappel: d("2026-11-11"), resumeAppel: "Appel passé, en attente de décision.",
    },
    {
      nom: "Menut", prenom: "Fanny", telephone: "+33 6 41 22 33 44", email: "fanny.menut@hotmail.fr",
      urgence: "moyen", statut: "appele", financement: "Non défini", nbAppels: 1,
      dernierContact: d("2026-11-10"), resumeAppel: "Joint, à relancer.",
    },
    {
      nom: "Nabti", prenom: "Sandy", telephone: "+33 6 42 33 44 55", email: "sandy.nabti@outlook.com",
      urgence: "moyen", statut: "appele", financement: "Non défini", nbAppels: 1,
      dernierContact: d("2026-11-09"), resumeAppel: "Intéressée par la VAE.",
    },
    {
      nom: "Akif", prenom: "Mazouza", telephone: "+33 6 43 44 55 66", email: "mazouza.akif@gmail.com",
      urgence: "moyen", statut: "appele", financement: "Non défini", nbAppels: 0,
      dernierContact: d("2026-11-08"), resumeAppel: "Pas le bon interlocuteur.",
    },
    {
      nom: "Nana", prenom: "Claudine", telephone: "+33 6 44 55 66 77", email: "claudine.nana@orange.fr",
      urgence: "moyen", statut: "rdv_prevu", financement: "CPF", caGenere: 0, offreProposee: "1400",
      prochainRappel: d("2026-11-13"), heureRappel: "14:00",
    },
    {
      nom: "Zazungi", prenom: "Mayukunda", telephone: "+33 6 45 66 77 88", email: "mayukunda.zazungi@gmail.com",
      urgence: "moyen", statut: "rdv_prevu", financement: "Non défini", caGenere: 0,
    },
    {
      nom: "Inés", prenom: "Inés", telephone: "+33 6 46 77 88 99", email: "ines.petit@hotmail.fr",
      urgence: "moyen", statut: "rdv_prevu", financement: "Non défini", caGenere: 0,
    },
    {
      nom: "Flora Daniel Zekou", prenom: "Sonia", telephone: "+33 6 47 88 99 00", email: "sonia.zekou@outlook.com",
      urgence: "moyen", statut: "rdv_prevu", financement: "Non défini", caGenere: 0,
      resumeAppel: "Rappeler le 25/11 à midi", prochainRappel: d("2026-11-25"), heureRappel: "12:00",
    },
    {
      nom: "Omri", prenom: "Houda", telephone: "+33 6 48 99 00 11", email: "houda.omri@gmail.com",
      urgence: "moyen", statut: "rdv_prevu", financement: "Non défini", caGenere: 0,
      resumeAppel: "repondeur; je laisse vocal",
    },
    {
      nom: "meddane", prenom: "Zakia", telephone: "+33 6 49 00 11 22", email: "zakia.meddane@yahoo.fr",
      urgence: "moyen", statut: "rdv_prevu", financement: "Non défini", caGenere: 0,
    },
    {
      nom: "Winckelmuller", prenom: "Mandy", telephone: "+33 6 50 11 22 33", email: "mandy.winckelmuller@hotmail.fr",
      urgence: "moyen", statut: "rdv_prevu", financement: "Non défini", caGenere: 0,
    },
  ];
}

// POST /api/seed — remplit la base avec un jeu de démo uniquement si elle est vide.
export async function POST() {
  const [{ value: existing }] = await db.select({ value: count() }).from(prospects);
  if (existing > 0) return json({ seeded: false, count: existing });

  const rand = mulberry32(20261111);
  const today = new Date();
  const d = (iso: string, h = 0, m = 0) => {
    const [y, mo, da] = iso.split("-").map(Number);
    return new Date(Date.UTC(y, mo - 1, da, h, m));
  };

  const specials = specialProspects(today);
  const byStatut = (s: string) => specials.filter((p) => p.statut === s).length;

  const targets: Record<string, number> = {
    nouveau_lead: 370 - byStatut("nouveau_lead"),
    a_appeler: 66 - byStatut("a_appeler"),
    appele: 4 - byStatut("appele"),
    relance: 0,
    rdv_prevu: 47 - byStatut("rdv_prevu"),
    close: 6 - byStatut("close"),
    perdu: 82,
  };

  const generated: ProspectInsert[] = [];
  let froidDone = specials.filter((p) => p.urgence === "froid").length; // 1 (Lisette)
  for (const [statut, n] of Object.entries(targets)) {
    for (let i = 0; i < n; i++) {
      const prenom = PRENOMS[Math.floor(rand() * PRENOMS.length)];
      const nom = NOMS[Math.floor(rand() * NOMS.length)];
      let urgence: "chaud" | "moyen" | "froid" = "moyen";
      if (froidDone < 2 && rand() < 0.004) {
        urgence = "froid";
        froidDone++;
      }
      const offreRand = rand();
      const offre = offreRand < 0.5 ? null : offreRand < 0.7 ? 800 : offreRand < 0.85 ? 1400 : offreRand < 0.95 ? 1440 : 2800;
      const hasRappel = rand() < 0.12;
      const rappelDate = new Date(today.getTime() + Math.floor(rand() * 30 - 5) * 86400000);
      generated.push({
        nom,
        prenom,
        telephone: makePhone(rand),
        email: makeEmail(prenom, nom, rand),
        urgence,
        statut,
        financement: rand() < 0.4 ? "Non défini" : ["CPF", "OPCO", "Pôle emploi (AIF)", "Autofinancement"][Math.floor(rand() * 4)],
        nbAppels: 0,
        prochainRappel: hasRappel ? rappelDate : null,
        heureRappel: hasRappel ? `${String(8 + Math.floor(rand() * 11)).padStart(2, "0")}:${rand() < 0.5 ? "00" : "30"}` : "",
        resumeAppel: rand() < 0.3 ? pickResume(rand) : "",
        offreProposee: offre === null ? null : String(offre),
        statutPaiement: "Non défini",
        caGenere: 0,
        source: "Import liste",
      });
    }
  }

  const all = [...specials, ...generated];
  const inserted = await db.insert(prospects).values(all).returning({ id: prospects.id });
  const idByKey = new Map<string, number>();
  inserted.forEach((row, i) => idByKey.set(`${all[i].prenom}|${all[i].nom}`, row.id));

  // 12 appels au total (comme sur le dashboard) dont 3 aujourd'hui.
  const callDefs: Array<[string, string, string, string, string]> = [
    ["Brigitte", "SOUAGNON", "appel", "Appel ce jour. A dit qu'elle va me rappeler. AES intervient en tant AES. Pour VAE DEAS", d("2026-11-11", 9, 12).toISOString()],
    ["Brigitte", "SOUAGNON", "appel", "Premier échange, besoin VAE DEAS confirmé.", d("2026-11-05", 15, 2).toISOString()],
    ["Mourad", "Benamar", "appel", "message laissé sur répondeur pour avoir des nouvelles.", d("2026-11-11", 10, 5).toISOString()],
    ["Mourad", "Benamar", "note", "Relance vocale programmée.", d("2026-11-03", 11, 20).toISOString()],
    ["VINCIANE", "BISSE", "appel", "Elle m'a expliqué que le problème c'était le prix. Offre initiale à 157, proposition à 120.", d("2026-11-11", 11, 40).toISOString()],
    ["VINCIANE", "BISSE", "appel", "Premier contact, interéssée mais hésite sur le tarif.", d("2026-11-09", 19, 30).toISOString()],
    ["VINCIANE", "BISSE", "rdv", "RDV téléphonique confirmé.", d("2026-11-08", 14, 0).toISOString()],
    ["thomy", "Anne Rose", "appel", "FOLLOW UP CPF 2800 — intéressée.", d("2026-11-10", 14, 15).toISOString()],
    ["Hms", "Mavie Cœur", "appel", "FOLLOW UP 8X R2 5 février à 14h00.", d("2026-11-11", 8, 50).toISOString()],
    ["Noella", "Shankuru", "appel", "Appel passé, en attente de décision.", d("2026-11-11", 16, 0).toISOString()],
    ["Fanny", "Menut", "appel", "Joint, à relancer.", d("2026-11-10", 9, 45).toISOString()],
    ["Sandy", "Nabti", "appel", "Intéressée par la VAE.", d("2026-11-09", 17, 10).toISOString()],
  ];

  const callRows = callDefs.map(([p, n, type, resume, iso]) => ({
    prospectId: idByKey.get(`${p}|${n}`)!,
    date: new Date(iso),
    type,
    resume,
    duree: type === "appel" ? 2 + Math.floor(rand() * 8) : 0,
  }));
  await db.insert(calls).values(callRows);

  return json({ seeded: true, prospects: inserted.length, calls: callRows.length });
}

function pickResume(rand: () => number): string {
  const resumes = [
    "Intéressé(e), à relancer la semaine prochaine.",
    "En réflexion sur le financement.",
    "RDV fixé, envoyer la plaquette avant.",
    "Pas disponible, rappeler en début d'après-midi.",
    "Budget serré, proposer l'offre à 800€.",
    "Dossier CPF en cours de validation.",
    "Très motivé(e), closing probable.",
    "Hésite avec une autre formation.",
    "Negociation en cours sur le prix.",
    "Repondeur, laisser un message vocal.",
  ];
  return resumes[Math.floor(rand() * resumes.length)];
}
