/* Formulaire « Nous joindre » de la page À propos (28 sept. 2026) : validation et courriel.
   Aucune dépendance et aucun réseau ici ; l'envoi passe par la liaison send_email de Cloudflare
   (Email Routing), branchée dans index.js. Tant que cette liaison ou la destination manque, le
   service répond 503 avec « repli » : la page prépare alors le courriel dans le logiciel du
   visiteur, comme avant. Aucun message n'est conservé par le service. */
import { enTetesCors, ORIGINES_PAR_DEFAUT } from './logique.js';

export const LIMITES_CONTACT = { nom: 120, titre: 160, courriel: 200, message: 5000 };
const CORPS_MAX = 16384;
const COURRIEL_VALIDE = /^[^\s@<>"(),;:]+@[^\s@<>"(),;:]+\.[^\s@<>"(),;:]+$/;
export const EXPEDITEUR_PAR_DEFAUT = 'formulaire@trouvetaclinique.ca';

/* Toutes les réponses portent « contact: true » : la page sait qu'elle parle bien à cette route
   (et non à une ancienne version du service), sinon elle se replie sur le courriel prérempli. */
const json = (corps, statut, entetes) => new Response(JSON.stringify({ contact: true, ...corps }), {
  status: statut,
  headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', ...entetes }
});

/* { donnees } si tout va bien, { erreur } à montrer au visiteur, ou { robot } si le champ piège
   (invisible pour un humain) est rempli : on fait alors semblant d'accepter, sans rien envoyer. */
export function validerContact(corps) {
  const v = k => String((corps && corps[k]) || '').replace(/\r\n?/g, '\n').trim();
  const d = { nom: v('nom'), titre: v('titre'), courriel: v('courriel'), message: v('message') };
  if (v('site')) return { robot: true };
  if (!d.nom || !d.message) return { erreur: 'Indiquez au moins votre nom et votre message.' };
  for (const [cle, max] of Object.entries(LIMITES_CONTACT)) {
    if (d[cle].length > max) return { erreur: 'Un des champs est trop long.' };
  }
  if (/\n/.test(d.nom + d.titre + d.courriel)) return { erreur: 'Un des champs est invalide.' };
  if (d.courriel && !COURRIEL_VALIDE.test(d.courriel)) return { erreur: 'L’adresse courriel semble invalide.' };
  return { donnees: d };
}

function base64Utf8(texte) {
  const octets = new TextEncoder().encode(texte);
  let binaire = '';
  for (let i = 0; i < octets.length; i += 0x8000) binaire += String.fromCharCode(...octets.subarray(i, i + 0x8000));
  return btoa(binaire);
}
const enteteUtf8 = texte => `=?UTF-8?B?${base64Utf8(texte)}?=`;

export function texteDuCourriel(d) {
  return `${d.message}\n\nNom : ${d.nom}` +
    (d.titre ? `\nTitre ou fonction : ${d.titre}` : '') +
    (d.courriel ? `\nCourriel pour la réponse : ${d.courriel}` : '') +
    '\n\n(Formulaire « Nous joindre » de trouvetaclinique.ca)\n';
}

/* Message MIME brut attendu par EmailMessage (cloudflare:email). */
export function construireCourriel(d, { de, a, id, maintenant = new Date() }) {
  const corps = base64Utf8(texteDuCourriel(d)).replace(/.{1,76}/g, '$&\r\n');
  return [
    `From: ${enteteUtf8('Trouve ta clinique')} <${de}>`,
    `To: <${a}>`,
    ...(d.courriel ? [`Reply-To: <${d.courriel}>`] : []),
    `Subject: ${enteteUtf8('Trouve ta clinique : message de ' + d.nom)}`,
    `Message-ID: <${id}@trouvetaclinique.ca>`,
    `Date: ${maintenant.toUTCString()}`,
    'MIME-Version: 1.0',
    'Content-Type: text/plain; charset=UTF-8',
    'Content-Transfer-Encoding: base64',
    '',
    corps
  ].join('\r\n');
}

/* Point d'entrée testable. deps : limiter(ip) -> booléen ; envoyer(de, a, brut) ou null. */
export async function traiterContact(requete, env, deps) {
  const autorisees = env.ORIGINES ? env.ORIGINES.split(',').map(s => s.trim()).filter(Boolean) : ORIGINES_PAR_DEFAUT;
  const cors = enTetesCors(requete.headers.get('Origin'), autorisees);
  if (!cors) return json({ erreur: 'Origine non autorisée.' }, 403, {});
  if (requete.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
  if (requete.method !== 'POST') return json({ erreur: 'Méthode non permise.' }, 405, { ...cors, Allow: 'POST, OPTIONS' });
  if (!deps.envoyer || !env.CONTACT_DESTINATION) {
    return json({ erreur: 'Envoi direct non configuré.', repli: true }, 503, cors);
  }
  const brut = await requete.text();
  if (brut.length > CORPS_MAX) return json({ erreur: 'Message trop long.' }, 413, cors);
  let corps;
  try { corps = JSON.parse(brut); } catch (e) { return json({ erreur: 'Requête invalide.' }, 400, cors); }
  const resultat = validerContact(corps);
  if (resultat.robot) return json({ ok: true }, 200, cors);
  if (resultat.erreur) return json({ erreur: resultat.erreur }, 400, cors);
  const ip = requete.headers.get('CF-Connecting-IP') || 'inconnue';
  if (!(await deps.limiter(ip))) {
    return json({ erreur: 'Trop de messages en peu de temps. Réessayez dans une minute.' }, 429, { ...cors, 'Retry-After': '60' });
  }
  const de = env.CONTACT_EXPEDITEUR || EXPEDITEUR_PAR_DEFAUT;
  const id = (globalThis.crypto && crypto.randomUUID) ? crypto.randomUUID() : String(Date.now());
  try {
    await deps.envoyer(de, env.CONTACT_DESTINATION, construireCourriel(resultat.donnees, { de, a: env.CONTACT_DESTINATION, id }));
  } catch (e) {
    console.error('Contact : envoi refusé', e && e.message);
    return json({ erreur: 'Envoi impossible pour le moment.', repli: true }, 502, cors);
  }
  return json({ ok: true }, 200, cors);
}
