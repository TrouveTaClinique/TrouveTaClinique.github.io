# Rapport QA — étape 4

Date : 31 août 2026  
Statut : contrôles techniques réussis, inspection visuelle automatisée indisponible

## Résultat

Le brouillon se régénère de façon déterministe et les fichiers produits sont cohérents avec
l’architecture définie. Aucun fichier n’a été envoyé sur `main` ou mis en production.

| Contrôle | Résultat |
| --- | ---: |
| Fiches source | 127 |
| Cliniques publiées | 89 |
| Établissements cartographiques | 7 |
| HTML analysés | 225 |
| Références locales | 2 427 |
| JSON-LD | 112 |
| URL canoniques avec cible | 224 |
| URL du sitemap | 71 |
| Headers sobres | 108 |
| Headers de carte V4 | 4 |
| JavaScript inline unique | 111 |
| Ressources PWA hors ligne | 19 |
| Routes HTTP essentielles | 12 |

## Garde-fous vérifiés

- Aucun courriel ni nom de champ interne interdit dans les 217 pages publiques ciblées.
- Aucun lien direct de l’univers Montérégie-Est vers les cartes Centre, Ouest ou complète.
- Aucune référence à la police interdite dans les fichiers actifs.
- Segoe UI est présente dans les gabarits de carte et de pages.
- La PWA est réservée à Montérégie-Est.
- Le filtre « Établissements » est désactivé par défaut, sans compteur et accompagné du bouton
  d’information demandé.

## Corrections appliquées

- Redirections historiques réparées pour deux fiches désormais masquées.
- Ressources Leaflet manquantes intégrées au CSS.
- Documentation du workflow actualisée.

## Contrôle restant avant publication officielle

Une inspection visuelle bureau et mobile devra être faite dès qu’un navigateur de test ou un
environnement de prévisualisation privé sera disponible. Le moteur Chromium n’a pas pu être
installé dans l’environnement courant parce que son archive de téléchargement était tronquée.

Le workflow exige aussi le secret de protection prévu par le projet. Il doit être configuré dans
le nouveau repo avant toute exécution automatisée. Sa valeur ne doit jamais être ajoutée aux
fichiers du dépôt.
