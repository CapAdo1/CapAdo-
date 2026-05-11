# Cap Ado

Application de conseils parentalité pour les parents d'adolescents.

## Déploiement sur Vercel

### 1. Uploader sur GitHub
- Allez sur github.com/CapAdo1
- Créez un nouveau repository nommé `capado`
- Uploadez tous les fichiers de ce dossier (sauf `.env`)

### 2. Variables d'environnement sur Vercel
Dans Vercel → Settings → Environment Variables, ajoutez :
```
VITE_SUPABASE_URL=https://oyohnfqxdgsqlaohmned.supabase.co
VITE_SUPABASE_ANON=votre_clé_anon
VITE_STRIPE_KEY=votre_clé_stripe
VITE_PRICE_PREMIUM=price_1TVsJY3YtYkz2snDyxb6Ina6
VITE_PRICE_PREMIUM_PLUS=price_1TVsN03YtYkz2snDD0oQphpj
```

### 3. Connecter GitHub à Vercel
- Vercel → New Project → Import depuis GitHub → sélectionner `capado`
- Framework: Vite
- Déployer

## Stack technique
- React + Vite
- Supabase (auth + base de données)
- Stripe (paiements)
- Claude API (IA)
