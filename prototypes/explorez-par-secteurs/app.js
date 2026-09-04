const MILIEUX = {
  urgence: [
    { nom: "Hôpital Pierre-Boucher", ville: "Longueuil", rls: "Pierre-Boucher", type: "Hôpital" },
    { nom: "Hôtel-Dieu de Sorel", ville: "Sorel-Tracy", rls: "Pierre-De Saurel", type: "Hôpital" },
    { nom: "Hôpital Honoré-Mercier", ville: "Saint-Hyacinthe", rls: "Richelieu-Yamaska", type: "Hôpital" }
  ],
  hospitalisation: [
    { nom: "Hôpital Pierre-Boucher", ville: "Longueuil", rls: "Pierre-Boucher", type: "Hôpital" },
    { nom: "Hôtel-Dieu de Sorel", ville: "Sorel-Tracy", rls: "Pierre-De Saurel", type: "Hôpital" },
    { nom: "Hôpital Honoré-Mercier", ville: "Saint-Hyacinthe", rls: "Richelieu-Yamaska", type: "Hôpital" }
  ],
  ucdg: [
    { nom: "Hôpital Pierre-Boucher", ville: "Longueuil", rls: "Pierre-Boucher", type: "Hôpital" },
    { nom: "Hôtel-Dieu de Sorel", ville: "Sorel-Tracy", rls: "Pierre-De Saurel", type: "Hôpital" },
    { nom: "Hôpital Honoré-Mercier", ville: "Saint-Hyacinthe", rls: "Richelieu-Yamaska", type: "Hôpital" }
  ],
  "soins-intensifs": [
    { nom: "Hôpital Pierre-Boucher", ville: "Longueuil", rls: "Pierre-Boucher", type: "Hôpital" },
    { nom: "Hôtel-Dieu de Sorel", ville: "Sorel-Tracy", rls: "Pierre-De Saurel", type: "Hôpital" }
  ],
  obstetrique: [
    { nom: "Hôtel-Dieu de Sorel", ville: "Sorel-Tracy", rls: "Pierre-De Saurel", type: "Hôpital" }
  ],
  "gmf-u": [
    { nom: "GMF-U des Montérégiennes", ville: "Boucherville", rls: "Pierre-Boucher", type: "GMF-U" },
    { nom: "GMF-U Richelieu-Yamaska", ville: "Saint-Hyacinthe", rls: "Richelieu-Yamaska", type: "GMF-U" }
  ],
  chsld: [
    { nom: "Centre d'hébergement de Contrecoeur", ville: "Contrecoeur", rls: "Pierre-Boucher", type: "CHSLD" },
    { nom: "Centre d'hébergement Jeanne-Crevier", ville: "Boucherville", rls: "Pierre-Boucher", type: "CHSLD" },
    { nom: "Centre d'hébergement J.-Arsène-Parenteau", ville: "Sorel-Tracy", rls: "Pierre-De Saurel", type: "CHSLD" },
    { nom: "Centre d'hébergement Élisabeth-Lafrance", ville: "Sorel-Tracy", rls: "Pierre-De Saurel", type: "CHSLD" },
    { nom: "Centre d'hébergement de l'Hôtel-Dieu-de-Saint-Hyacinthe", ville: "Saint-Hyacinthe", rls: "Richelieu-Yamaska", type: "CHSLD" },
    { nom: "Centre d'hébergement de Montarville", ville: "Saint-Bruno-de-Montarville", rls: "Richelieu-Yamaska", type: "CHSLD" },
    { nom: "Centre d'hébergement Marguerite-Adam", ville: "Beloeil", rls: "Richelieu-Yamaska", type: "CHSLD" }
  ],
  sad: [
    { nom: "CLSC de Longueuil-Ouest", ville: "Longueuil", rls: "Pierre-Boucher", type: "CLSC" },
    { nom: "CLSC des Seigneuries", ville: "Varennes", rls: "Pierre-Boucher", type: "CLSC" },
    { nom: "CLSC Simonne-Monet-Chartrand", ville: "Longueuil", rls: "Pierre-Boucher", type: "CLSC" },
    { nom: "CLSC Gaston-Bélanger", ville: "Sorel-Tracy", rls: "Pierre-De Saurel", type: "CLSC" },
    { nom: "CLSC des Maskoutains", ville: "Saint-Hyacinthe", rls: "Richelieu-Yamaska", type: "CLSC" },
    { nom: "CLSC des Patriotes", ville: "Beloeil", rls: "Richelieu-Yamaska", type: "CLSC" }
  ],
  autres: [
    { nom: "Centre de réadaptation en dépendance Longueuil", ville: "Longueuil", rls: "Mission régionale", type: "CRD" },
    { nom: "Centre de réadaptation en dépendance Saint-Hyacinthe", ville: "Saint-Hyacinthe", rls: "Mission régionale", type: "CRD" },
    { nom: "Centre de réadaptation en dépendance Saint-Philippe", ville: "Saint-Philippe", rls: "Mission régionale", type: "CRD" },
    { nom: "Centre de détention", ville: "Sorel-Tracy", rls: "Mission régionale", type: "Détention" }
  ]
};

const HOSPITALIER = [
  { id: "urgence", nom: "Urgence", sous: "Accueil 24 h",
    hi: "var(--sq-menthe)", mid: "var(--sq-azur)",
    tint: "color-mix(in srgb, var(--sq-azur) 62%, var(--sq-bleu))", on: "#fff" },
  { id: "hospitalisation", nom: "Hospitalisation", sous: "Courte durée",
    hi: "color-mix(in srgb, var(--sq-azur) 45%, #fff)", mid: "color-mix(in srgb, var(--sq-bleu) 40%, var(--sq-azur))",
    tint: "var(--sq-bleu)", on: "#fff" },
  { id: "obstetrique", nom: "Obstétrique", sous: "Sorel seulement",
    hi: "#fff", mid: "var(--sq-menthe)",
    tint: "color-mix(in srgb, var(--sq-menthe) 48%, var(--sq-sarcelle))", on: "var(--sq-bleu)" },
  { id: "ucdg", nom: "UCDG", sous: "Gériatrie courte durée",
    hi: "var(--sq-menthe)", mid: "var(--sq-sarcelle)",
    tint: "color-mix(in srgb, var(--sq-sarcelle) 58%, var(--sq-bleu))", on: "#fff" },
  { id: "soins-intensifs", nom: "Soins intensifs", sous: "Unités ≤ 6 lits",
    hi: "color-mix(in srgb, var(--sq-azur) 40%, var(--sq-menthe))",
    mid: "color-mix(in srgb, var(--sq-azur) 55%, var(--sq-sarcelle))",
    tint: "color-mix(in srgb, var(--sq-bleu) 48%, var(--sq-azur))", on: "#fff" }
];

const COMMUNAUTAIRE = [
  { id: "gmf-u", nom: "GMF-U", sous: "Première ligne universitaire",
    hi: "#fff", mid: "var(--sq-menthe)",
    tint: "color-mix(in srgb, var(--sq-menthe) 52%, var(--sq-azur))", on: "var(--sq-bleu)" },
  { id: "chsld", nom: "CHSLD", sous: "Longue durée",
    hi: "var(--sq-menthe)", mid: "var(--sq-sarcelle)",
    tint: "color-mix(in srgb, var(--sq-sarcelle) 72%, var(--sq-bleu))", on: "#fff" },
  { id: "sad", nom: "Soins à domicile", sous: "SAD, SIAD et palliatifs",
    hi: "var(--sq-menthe)", mid: "color-mix(in srgb, var(--sq-azur) 48%, var(--sq-menthe))",
    tint: "var(--sq-azur)", on: "#fff" },
  { id: "autres", nom: "Autres", sous: "Réadaptation et détention",
    hi: "color-mix(in srgb, var(--sq-sarcelle) 40%, var(--sq-menthe))",
    mid: "color-mix(in srgb, var(--sq-bleu) 38%, var(--sq-sarcelle))",
    tint: "var(--sq-bleu)", on: "#fff" }
];

const ICON_HOSP = '<svg width="34" height="34" viewBox="0 0 56 56" fill="none"><path d="M16 46V20.5L28 12l12 8.5V46" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"/><path d="M24 46V34h8v12M28 24v10M23.5 29h9" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/></svg>';
const ICON_COMM = '<svg width="34" height="34" viewBox="0 0 56 56" fill="none"><circle cx="21" cy="21" r="6.2" stroke="currentColor" stroke-width="1.7"/><circle cx="36.5" cy="22.5" r="5.2" stroke="currentColor" stroke-width="1.7"/><path d="M10.5 42c1.8-7.2 6.2-10.8 10.5-10.8S29.4 34.8 31.2 42M29 42c1.3-5.4 4.5-8.8 8.8-8.8S45.4 36.8 47 42" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/></svg>';

const state = { famille: null, secteur: "", parRls: false };
const chooser = document.getElementById("chooser");
const explorer = document.getElementById("explorer");
const orbitStage = document.getElementById("orbit-stage");
const panel = document.getElementById("panel");
const crumbNow = document.getElementById("crumb-now");

function items() {
  return state.famille === "hospitalier" ? HOSPITALIER : COMMUNAUTAIRE;
}

function liste() {
  if (state.secteur && MILIEUX[state.secteur]) return MILIEUX[state.secteur];
  const ids = items().map((s) => s.id);
  const vus = new Set();
  const out = [];
  ids.forEach((id) => {
    MILIEUX[id].forEach((m) => {
      const cle = m.nom + m.rls;
      if (vus.has(cle)) return;
      vus.add(cle);
      out.push(m);
    });
  });
  return out;
}

function setStep(n) {
  document.querySelectorAll(".path li").forEach((el) => {
    const step = Number(el.getAttribute("data-step"));
    el.classList.toggle("is-now", step === n);
    el.classList.toggle("is-on", step < n);
  });
}

function familleNom() {
  return state.famille === "hospitalier" ? "Hospitalier" : "Communautaire";
}

function openFamille(famille) {
  state.famille = famille;
  state.secteur = "";
  state.parRls = false;
  chooser.hidden = true;
  explorer.hidden = false;
  crumbNow.textContent = familleNom();
  setStep(2);
  drawOrbit();
  drawPanel();
}

function back() {
  state.famille = null;
  state.secteur = "";
  state.parRls = false;
  chooser.hidden = false;
  explorer.hidden = true;
  orbitStage.innerHTML = "";
  panel.innerHTML = "";
  setStep(1);
}

function reach() {
  if (window.matchMedia("(max-width: 720px)").matches) return 118;
  if (window.matchMedia("(max-width: 900px)").matches) return 148;
  return 176;
}

function milieuxLabel(n) {
  return n + (n > 1 ? " milieux" : " milieu");
}

function drawOrbit() {
  const list = items();
  const r = reach();
  const hosp = state.famille === "hospitalier";
  const klass = hosp ? "orb-hosp" : "orb-comm";
  orbitStage.classList.remove("has-front", "settled");
  orbitStage.innerHTML =
    '<div class="halo" aria-hidden="true"></div>' +
    '<div class="halo halo-2" aria-hidden="true"></div>' +
    '<div class="core"><span class="orb ' + klass + '">' +
    '<span class="orb-face"></span><span class="orb-spec"></span><span class="orb-rim"></span>' +
    '<span class="orb-icon">' + (hosp ? ICON_HOSP : ICON_COMM) + "</span></span>" +
    '<span class="core-label">' + familleNom() + "</span></div>";

  list.forEach((item, i) => {
    const to = -90 + (360 * i) / list.length;
    const from = to - 52;
    const n = MILIEUX[item.id].length;
    const slot = document.createElement("div");
    slot.className = "slot";
    slot.style.setProperty("--from", from + "deg");
    slot.style.setProperty("--to", to + "deg");
    slot.style.setProperty("--reach", r + "px");
    slot.style.setProperty("--d", 80 + i * 70 + "ms");
    slot.innerHTML =
      '<div class="arm">' +
      '<button type="button" class="bubble" data-id="' + item.id + '" aria-pressed="false" aria-label="' +
      item.nom + ", " + milieuxLabel(n) +
      '" style="--hi:' + item.hi + ";--mid:" + item.mid + ";--tint:" + item.tint + ";--on:" + item.on + '">' +
      '<span class="n">' + n + '</span><span class="u">milieux</span></button>' +
      '<span class="caption">' + item.nom + "</span></div>";
    orbitStage.appendChild(slot);
  });

  window.setTimeout(function () { orbitStage.classList.add("settled"); }, 1000);

  orbitStage.querySelectorAll(".bubble").forEach((btn) => {
    btn.onclick = () => selectSecteur(btn.getAttribute("data-id"));
  });
  syncFront();
}

function syncFront() {
  orbitStage.classList.toggle("has-front", Boolean(state.secteur));
  orbitStage.querySelectorAll(".slot").forEach((slot) => {
    const bid = slot.querySelector(".bubble").getAttribute("data-id");
    slot.classList.toggle("is-front", bid === state.secteur);
  });
  orbitStage.querySelectorAll(".bubble").forEach((b) => {
    b.setAttribute("aria-pressed", b.getAttribute("data-id") === state.secteur ? "true" : "false");
  });
}

function selectSecteur(id) {
  state.secteur = state.secteur === id ? "" : id;
  state.parRls = false;
  syncFront();
  setStep(state.secteur ? 3 : 2);
  drawPanel();
}

function accent(type) {
  if (type === "Hôpital") return " accent-bleu";
  if (type === "CLSC" || type === "GMF-U") return " accent-azur";
  return "";
}

function card(m) {
  return '<article class="card' + accent(m.type) + '"><span class="type">' + m.type +
    "</span><strong>" + m.nom + '</strong><span class="meta">' + m.ville + " · " + m.rls + "</span></article>";
}

function drawPanel() {
  const meta = items().find((s) => s.id === state.secteur);
  const milieux = liste();
  const titre = meta ? meta.nom : "Tous les milieux";
  const sous = meta
    ? meta.sous + " · " + milieuxLabel(milieux.length)
    : (state.famille === "hospitalier"
      ? milieux.length + " établissements · tous les secteurs de cette famille"
      : milieuxLabel(milieux.length) + " · tous les secteurs de cette famille");
  let body = "";
  if (state.parRls) {
    const map = new Map();
    milieux.forEach((m) => {
      const arr = map.get(m.rls) || [];
      arr.push(m);
      map.set(m.rls, arr);
    });
    map.forEach((arr, rls) => {
      body += '<div class="rls-label">' + rls + " · " + arr.length + '</div><div class="cards">' + arr.map(card).join("") + "</div>";
    });
  } else {
    body = '<div class="cards">' + milieux.map(card).join("") + "</div>";
  }
  panel.innerHTML =
    '<div class="panel-head"><div><h2>' + titre + '</h2><p class="sous">' + sous + "</p></div>" +
    '<div class="seg" role="group" aria-label="Classement">' +
    '<button type="button" id="btn-list" aria-pressed="' + (state.parRls ? "false" : "true") + '"' + (state.parRls ? "" : ' class="on"') + ">Liste</button>" +
    '<button type="button" id="btn-rls" aria-pressed="' + (state.parRls ? "true" : "false") + '"' + (state.parRls ? ' class="on"' : "") + ">Par RLS</button></div></div>" +
    '<div class="panel-body">' + body + "</div>";
  document.getElementById("btn-list").onclick = () => { state.parRls = false; drawPanel(); };
  document.getElementById("btn-rls").onclick = () => { state.parRls = true; drawPanel(); };
}

document.querySelectorAll(".planet").forEach((btn) => {
  btn.onclick = () => openFamille(btn.getAttribute("data-famille"));
});
document.getElementById("btn-back").onclick = back;

document.addEventListener("keydown", (e) => {
  if (e.key !== "Escape") return;
  if (state.secteur) selectSecteur(state.secteur);
  else if (state.famille) back();
});

let resizeTimer = 0;
window.addEventListener("resize", () => {
  if (!state.famille) return;
  window.clearTimeout(resizeTimer);
  resizeTimer = window.setTimeout(drawOrbit, 120);
});
