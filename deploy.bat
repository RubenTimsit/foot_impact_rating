@echo off
REM Script de déploiement rapide sur GitHub Pages (Windows)

echo ========================================
echo    Deploiement sur GitHub Pages
echo ========================================
echo.

REM Demander le message de commit
set /p commit_message="Entre un message pour le commit: "

REM Si aucun message, utiliser un message par défaut
if "%commit_message%"=="" set commit_message=Mise a jour

REM Ajouter tous les fichiers
echo.
echo [1/3] Ajout des fichiers...
git add .

REM Créer le commit
echo [2/3] Creation du commit...
git commit -m "%commit_message%"

REM Pousser vers GitHub
echo [3/3] Push vers GitHub...
git push

echo.
echo ========================================
echo   Deploiement termine !
echo ========================================
echo.
echo Ton site sera mis a jour dans 1-2 minutes
echo URL: https://TON_USERNAME.github.io/foot-impact-rating/
echo.
pause

