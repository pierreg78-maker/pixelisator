# Publication sur GitHub Pages

Le dépôt contient une application React/Vite : GitHub Pages ne peut pas servir directement ses fichiers source. Le fichier `.github/workflows/deploy-pages.yml` compile automatiquement l’application puis publie uniquement le dossier `dist/public`.

Après avoir ajouté ces fichiers au dépôt, ouvrez **Settings → Pages** dans GitHub. Sous **Build and deployment**, choisissez **Source: GitHub Actions**. Ensuite, ouvrez l’onglet **Actions**, lancez ou attendez le workflow **Déployer sur GitHub Pages**. Lorsque son statut est vert, le site est accessible à l’adresse `https://pierreg78-maker.github.io/pixelisator/`.

Les modifications poussées sur la branche `main` déclenchent ensuite une nouvelle publication automatiquement.
