# Mission 03 : historique git public

Rapport : `audit-cursor/rapports/03-historique-git.md`.

## But
Le dépôt est public : une donnée retirée du site peut rester lisible dans l'historique.
Recenser ce qui y reste, sans jamais le recopier.

## Étapes
1. Écris un script Node dans `rapports/outils-temp/` qui parcourt tous les commits
   (`git rev-list --all`) par lots et cherche, avec `git grep -I -E` :
   - adresses courriel (puis classe-les selon les règles de `CLAUDE.md` : génériques permises
     ou non) ;
   - champs `"notes": "` non vides dans `data.json` ;
   - numéros de téléphone dans des textes libres ;
   - motifs de secrets : `sk-ant-`, `ghp_`, `github_pat_`, `AKIA`, `-----BEGIN`,
     `xox[bp]-`, `AIza`, mots `password`, `secret`, `token` suivis d'une valeur.
2. Liste les fichiers qui ont existé puis ont disparu (`git log --all --diff-filter=D --name-only`)
   et repère ceux qui ressemblent à des données privées (`*.prive.json`, sources, exports,
   documents internes, pièces jointes).
3. Cherche dans les messages de commit les mentions de données personnelles ou de retraits à la
   demande d'une personne (`git log --all --format=%H%x09%s`), et vérifie si la donnée retirée est
   encore lisible dans un commit antérieur.
4. Pour chaque constat : commit court, date, fichier, type de donnée, encore présente dans `HEAD`
   ou non, gravité. **Jamais la valeur.**
5. Propose les options (sans rien faire) : réécriture de l'historique (`git filter-repo`), purge
   des caches GitHub, rotation d'une clé, avec leurs conséquences (clones existants, branche
   `brouillon`, dépôt de l'aperçu `TrouveTaClinique/apercu`, robots).

## Rappel
N'ouvre aucun ticket, ne pousse rien, ne modifie aucune référence git.
