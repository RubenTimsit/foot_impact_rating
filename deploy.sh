#!/bin/bash
# Script de déploiement rapide sur GitHub Pages

echo "🚀 Déploiement sur GitHub Pages"
echo "================================"
echo ""

# Demander le message de commit
echo "📝 Entre un message pour le commit:"
read commit_message

# Si aucun message, utiliser un message par défaut
if [ -z "$commit_message" ]; then
    commit_message="🔄 Mise à jour"
fi

# Ajouter tous les fichiers
echo "📦 Ajout des fichiers..."
git add .

# Créer le commit
echo "💾 Création du commit..."
git commit -m "$commit_message"

# Pousser vers GitHub
echo "📤 Push vers GitHub..."
git push

echo ""
echo "✅ Déploiement terminé !"
echo "🌐 Ton site sera mis à jour dans 1-2 minutes"
echo "📍 URL: https://TON_USERNAME.github.io/foot-impact-rating/"
echo ""

