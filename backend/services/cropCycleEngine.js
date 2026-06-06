/**
 * cropCycleEngine.js
 * Moteur biologique d'analyse des stades de croissance des cultures saisonnières
 * et de modélisation phénologique de l'arboriculture.
 */

// Définitions des cultures saisonnières (Stades, NDVI attendu, conseils)
const SEASONAL_CROPS = {
    "blé": {
        label: "Blé",
        totalDuration: 130,
        stages: [
            { name: "germination", label: "Germination / Levée", startDay: 0, endDay: 20, ndvi: [0.12, 0.25], ndwi: [0.15, 0.40], desc: "Les graines germent et les premières pousses sortent du sol. Le taux de couverture végétale est très faible.", advice: "Maintenir une humidité de surface régulière mais légère. Surveiller la levée des mauvaises herbes." },
            { name: "vegetative", label: "Croissance Végétative", startDay: 20, endDay: 60, ndvi: [0.25, 0.58], ndwi: [0.20, 0.50], desc: "Tallage et montaison. Développement rapide des feuilles et de la biomasse aérienne.", advice: "C'est la période idéale pour l'apport en azote. Assurer une irrigation modérée selon le climat." },
            { name: "flowering", label: "Floraison / Épiaison", startDay: 60, endDay: 90, ndvi: [0.58, 0.85], ndwi: [0.30, 0.60], desc: "Émergence des épis et fécondation. Activité photosynthétique et transpiration à leur apogée.", advice: "Besoin en eau maximal ! Éviter tout stress hydrique durant l'épiaison pour maximiser le nombre de grains." },
            { name: "maturation", label: "Maturation du grain", startDay: 90, endDay: 120, ndvi: [0.35, 0.60], ndwi: [0.10, 0.35], desc: "Remplissage des grains et sénescence progressive de la plante. La couleur passe du vert au jaune paille.", advice: "Réduire puis stopper progressivement l'irrigation pour favoriser le séchage naturel du grain." },
            { name: "harvest", label: "Prêt pour la récolte", startDay: 120, endDay: 130, ndvi: [0.15, 0.32], ndwi: [0.05, 0.20], desc: "La culture a atteint sa pleine maturité. Les grains sont secs et prêts à être moissonnés.", advice: "Planifier la récolte par temps sec et ensoleillé pour éviter la réhydratation du grain." }
        ]
    },
    "riz": {
        label: "Riz",
        totalDuration: 130,
        stages: [
            { name: "germination", label: "Pépinière / Repiquage", startDay: 0, endDay: 20, ndvi: [0.12, 0.25], ndwi: [0.45, 0.80], desc: "Jeunes plants repiqués. Le sol est majoritairement inondé, d'où un NDWI très élevé.", advice: "Maintenir une lame d'eau constante de 2 à 5 cm pour protéger les jeunes plants." },
            { name: "vegetative", label: "Tallage / Croissance", startDay: 20, endDay: 60, ndvi: [0.25, 0.65], ndwi: [0.35, 0.70], desc: "Multiplication des talles et élongation des tiges. La couverture foliaire commence à masquer l'eau.", advice: "Appliquer la première fraction d'azote. Gérer le niveau d'eau pour encourager le tallage vigoureux." },
            { name: "flowering", label: "Montaison / Floraison", startDay: 60, endDay: 90, ndvi: [0.65, 0.88], ndwi: [0.40, 0.75], desc: "Formation de la panicule et floraison. L'indice NDVI atteint sa valeur maximale.", advice: "Veiller à ce que la parcelle reste totalement submergée. Sensibilité maximale au froid nocturne." },
            { name: "maturation", label: "Maturation (Grain pâteux)", startDay: 90, endDay: 120, ndvi: [0.40, 0.68], ndwi: [0.15, 0.40], desc: "Les panicules s'alourdissent et s'inclinent. Le jaunissement des feuilles commence.", advice: "Vidanger progressivement l'eau de la parcelle 10 à 15 jours avant la date estimée de récolte." },
            { name: "harvest", label: "Récolte", startDay: 120, endDay: 130, ndvi: [0.18, 0.35], ndwi: [0.08, 0.25], desc: "Les panicules sont dorées et les grains durs. La parcelle doit être sèche pour le passage des machines.", advice: "Procéder à la récolte dès que l'humidité du grain descend entre 18% et 22%." }
        ]
    },
    "maïs": {
        label: "Maïs",
        totalDuration: 120,
        stages: [
            { name: "germination", label: "Levée (3-5 feuilles)", startDay: 0, endDay: 15, ndvi: [0.12, 0.24], ndwi: [0.12, 0.35], desc: "Émergence des premières feuilles. Racines s'installant dans le sol.", advice: "Surveiller les attaques de ravageurs du sol. Éviter les croûtes de battance." },
            { name: "vegetative", label: "Croissance Végétative", startDay: 15, endDay: 50, ndvi: [0.24, 0.70], ndwi: [0.18, 0.45], desc: "Élongation rapide des entrenœuds. Accumulation massive de matière sèche foliaire.", advice: "Apport d'engrais de couverture. Assurer un apport d'eau régulier pour éviter tout enroulement des feuilles." },
            { name: "flowering", label: "Floraison (Pollinisation)", startDay: 50, endDay: 80, ndvi: [0.70, 0.92], ndwi: [0.25, 0.55], desc: "Apparition des panicules mâles et des soies femelles. Période la plus critique du cycle.", advice: "Irrigation obligatoire en l'absence de pluie ! Le moindre stress hydrique réduit le taux de fécondation." },
            { name: "maturation", label: "Remplissage / Maturation", startDay: 80, endDay: 110, ndvi: [0.45, 0.72], ndwi: [0.12, 0.32], desc: "Accumulation d'amidon dans les grains. Dessèchement des feuilles inférieures et des spathes.", advice: "Surveiller le point noir au hile du grain indiquant la maturité physiologique complète." },
            { name: "harvest", label: "Moisson / Récolte", startDay: 110, endDay: 120, ndvi: [0.18, 0.38], ndwi: [0.05, 0.18], desc: "La plante est sèche. Les épis sont mûrs et pointent vers le bas.", advice: "Moissonner dès que le taux d'humidité du grain convient aux critères de stockage." }
        ]
    },
    "tomate": {
        label: "Tomate",
        totalDuration: 115,
        stages: [
            { name: "germination", label: "Repiquage / Reprise", startDay: 0, endDay: 15, ndvi: [0.14, 0.26], ndwi: [0.18, 0.38], desc: "Jeunes plants s'adaptant à leur nouvel environnement. Faible couverture.", advice: "Irriguer copieusement mais sans excès juste après le repiquage pour favoriser le système racinaire." },
            { name: "vegetative", label: "Développement Végétatif", startDay: 15, endDay: 45, ndvi: [0.26, 0.62], ndwi: [0.20, 0.45], desc: "Ramification intense, croissance des tiges secondaires et formation du feuillage dense.", advice: "Mettre en place le tuteurage et réaliser un ébourgeonnage régulier (suppression des gourmands)." },
            { name: "flowering", label: "Floraison / Nouaison", startDay: 45, endDay: 75, ndvi: [0.62, 0.86], ndwi: [0.28, 0.55], desc: "Apparition des bouquets floraux et formation des premiers jeunes fruits verts.", advice: "Besoins en calcium élevés (prévenir la nécrose apicale). Maintenir des apports d'eau réguliers." },
            { name: "maturation", label: "Grossissement / Maturation", startDay: 75, endDay: 105, ndvi: [0.48, 0.72], ndwi: [0.15, 0.38], desc: "Virage de couleur des fruits (vert, orange puis rouge). Remplissage en sucre.", advice: "Limiter les fluctuations d'irrigation pour éviter l'éclatement des fruits. Pailler le sol." },
            { name: "harvest", label: "Récolte continue", startDay: 105, endDay: 115, ndvi: [0.22, 0.45], ndwi: [0.10, 0.28], desc: "Cueillette des fruits mûrs. Le feuillage commence à vieillir.", advice: "Récolter régulièrement pour stimuler la maturation des fruits restants sur les bouquets supérieurs." }
        ]
    },
    "poivron": {
        label: "Poivron",
        totalDuration: 120,
        stages: [
            { name: "germination", label: "Établissement", startDay: 0, endDay: 15, ndvi: [0.12, 0.25], ndwi: [0.15, 0.35], desc: "Installation racinaire après plantation en plein champ ou sous serre.", advice: "Assurer un sol chaud et humide. Protéger contre le vent." },
            { name: "vegetative", label: "Croissance Végétative", startDay: 15, endDay: 50, ndvi: [0.25, 0.60], ndwi: [0.18, 0.42], desc: "Développement de la tige principale rigide et des premières ramifications.", advice: "Apporter un engrais équilibré. Désherber régulièrement pour éviter la concurrence." },
            { name: "flowering", label: "Floraison / Nouaison", startDay: 50, endDay: 80, ndvi: [0.60, 0.82], ndwi: [0.25, 0.50], desc: "Ouverture des petites fleurs blanches auto-pollinisatrices et nouaison des poivrons.", advice: "Éviter les températures extrêmes (>35°C) sous abri qui provoquent la coulure des fleurs." },
            { name: "maturation", label: "Grossissement du fruit", startDay: 80, endDay: 110, ndvi: [0.45, 0.68], ndwi: [0.15, 0.35], desc: "Développement final de la paroi du fruit (péricarpe). Changement de couleur.", advice: "Soutenir la plante avec une irrigation constante. Carence en eau = fruits déformés ou brûlés par le soleil." },
            { name: "harvest", label: "Récolte", startDay: 110, endDay: 120, ndvi: [0.20, 0.40], ndwi: [0.08, 0.22], desc: "Fruits fermes à peau brillante prêts pour la cueillette.", advice: "Couper la tige proprement avec un sécateur pour éviter d'arracher les branches fragiles." }
        ]
    }
};

// Définitions des arbres (Arboriculture)
const TREE_CROPS = {
    "olivier": {
        label: "Olivier",
        evergreen: true,
        agePhases: [
            { maxAge: 5, label: "Jeune Verger (non productif)", ndvi: [0.18, 0.32], desc: "Arbres en pleine installation racinaire et développement de charpente." },
            { maxAge: 15, label: "Verger en Production", ndvi: [0.32, 0.50], desc: "Entrée active en fructification. Canopée moyennement développée." },
            { maxAge: 999, label: "Verger Mature (plénitude)", ndvi: [0.45, 0.68], desc: "Arbres centenaires ou matures à canopée dense et structure solide." }
        ],
        seasons: {
            spring: { label: "Printemps (Floraison & Nouaison)", months: [3, 4, 5], activity: "Forte activité végétative, pousse printanière des rameaux et floraison.", advice: "Période clé pour l'apport d'azote et l'irrigation de soutien pour stimuler la nouaison." },
            summer: { label: "Été (Durcissement du noyau)", months: [6, 7, 8], activity: "Ralentissement estival dû à la chaleur. Accumulation d'huile dans la pulpe.", advice: "Irrigation localisée (goutte-à-goutte) indispensable pour éviter la chute prématurée des olives." },
            autumn: { label: "Automne (Maturation & Récolte)", months: [9, 10, 11], activity: "Changement de couleur des fruits (tournante) et récolte.", advice: "Préparer les filets et le matériel de récolte. Traiter contre la mouche de l'olive si nécessaire." },
            winter: { label: "Hiver (Repos végétatif)", months: [12, 1, 2], activity: "Repos métabolique induit par le froid. Taille hivernale.", advice: "Réaliser la taille d'éclaircie pour éliminer les rameaux improductifs et aérer le cœur de l'arbre." }
        }
    },
    "agrumes": {
        label: "Agrumes (Oranger, Citronnier)",
        evergreen: true,
        agePhases: [
            { maxAge: 4, label: "Jeune plantation", ndvi: [0.22, 0.38], desc: "Développement végétatif soutenu sans production significative." },
            { maxAge: 10, label: "Jeune adulte productif", ndvi: [0.38, 0.62], desc: "Fructification régulière, taille de canopée en expansion constante." },
            { maxAge: 999, label: "Verger adulte mature", ndvi: [0.55, 0.82], desc: "Canopée dense et jointive. Rendement maximal." }
        ],
        seasons: {
            spring: { label: "Printemps (Fleur & Pousse active)", months: [3, 4, 5], activity: "Floraison blanche odorante et forte pousse de printemps.", advice: "Besoins nutritionnels maximaux (engrais complet NPK + oligo-éléments comme le fer)." },
            summer: { label: "Été (Grossissement des fruits)", months: [6, 7, 8], activity: "Développement des oranges/citrons. Transpiration élevée.", advice: "Irrigation intensive indispensable ! Les agrumes sont extrêmement sensibles à la sécheresse estivale." },
            autumn: { label: "Automne (Véraison & Récolte précoce)", months: [9, 10, 11], activity: "Changement de couleur des fruits induit par les écarts thermiques nocturnes.", advice: "Surveiller les attaques de cératite (mouche des fruits). Récolter les variétés précoces." },
            winter: { label: "Hiver (Récolte principale & Repos)", months: [12, 1, 2], activity: "Pleine récolte des oranges douces et clémentines. Résistance relative au froid.", advice: "Protéger le tronc du gel si nécessaire. Effectuer la taille après la récolte." }
        }
    },
    "pommier": {
        label: "Pommier",
        evergreen: false, // Feuillage caduc
        agePhases: [
            { maxAge: 3, label: "Jeune Verger", ndvi: [0.18, 0.35], desc: "Installation des arbres et greffons. Formation de la structure." },
            { maxAge: 8, label: "Verger productif", ndvi: [0.35, 0.65], desc: "Production commerciale de fruits. Canopée à développement modéré." },
            { maxAge: 999, label: "Verger mature", ndvi: [0.50, 0.82], desc: "Pleine maturité des pommiers. Canopée volumineuse." }
        ],
        seasons: {
            spring: { label: "Printemps (Débourrement & Floraison)", months: [3, 4, 5], activity: "Éclatement des bourgeons, apparition des feuilles et floraison.", advice: "Protéger les fleurs contre les gelées tardives. Appliquer des traitements fongicides contre la tavelure." },
            summer: { label: "Été (Développement du feuillage & Fruits)", months: [6, 7, 8], activity: "Feuillage dense et photosynthèse maximale. Grossissement des pommes.", advice: "Pratiquer l'éclaircissage manuel des fruits si la charge est trop lourde pour éviter la casse des branches." },
            autumn: { label: "Automne (Récolte & Chute des feuilles)", months: [9, 10, 11], activity: "Récolte des pommes. Sénescence et coloration dorée des feuilles avant chute.", advice: "Ramasser et détruire les fruits tombés au sol pour limiter la prolifération de ravageurs hivernants." },
            winter: { label: "Hiver (Dormance complète)", months: [12, 1, 2], activity: "Arbres totalement dénudés de feuilles. Arrêt de sève.", advice: "Réaliser la taille de structure en période hors-gel pour sculpter les futurs gobelets." }
        }
    },
    "palmier": {
        label: "Palmier Dattier",
        evergreen: true,
        agePhases: [
            { maxAge: 5, label: "Jeune rejet (non productif)", ndvi: [0.16, 0.28], desc: "Enracinement et croissance des premières palmes solides." },
            { maxAge: 12, label: "Palmeraie en Production", ndvi: [0.28, 0.45], desc: "Premiers régimes de dattes (stade Blah/Gharb). Élongation du stipe." },
            { maxAge: 999, label: "Palmeraie Adulte Mature", ndvi: [0.42, 0.65], desc: "Palmiers de grande hauteur à couronne de palmes dense et large." }
        ],
        seasons: {
            spring: { label: "Printemps (Pollinisation)", months: [3, 4, 5], activity: "Apparition des spathes. Pollinisation manuelle des fleurs femelles.", advice: "Réaliser la pollinisation manuelle dès l'ouverture des spathes femelles pour assurer le rendement." },
            summer: { label: "Été (Maturation des dattes - Bser/Rutab)", months: [6, 7, 8], activity: "Virage de couleur des régimes. Températures et ensoleillement maximaux nécessaires.", advice: "Protéger les régimes avec des filets ou des sacs en tissu pour prévenir le dessèchement et le vent." },
            autumn: { label: "Automne (Récolte principale - Tamr)", months: [9, 10, 11], activity: "Récolte des dattes mûres (Tamr). Nettoyage de la couronne.", advice: "Couper les régimes avec précaution. Commencer le nettoyage des palmes sèches inférieures." },
            winter: { label: "Hiver (Repos végétatif & Entretien)", months: [12, 1, 2], activity: "Ralentissement végétatif. Travaux d'entretien au sol.", advice: "Nettoyer les rejets inutiles au pied du palmier. Apporter de la fumure organique au sol." }
        }
    }
};

/**
 * Calcule la date de début de semis / plantation théorique compensée.
 * Permet d'intégrer une parcelle en cours de cycle sans fausser les calculs temporels.
 */
exports.calculateEffectiveStartDate = (cultureType, inputDateStr, initialStage) => {
    const defaultDate = new Date(inputDateStr || Date.now());
    const cropKey = String(cultureType).toLowerCase().trim();
    const cropDef = SEASONAL_CROPS[cropKey];
    
    // Si ce n'est pas une culture saisonnière connue ou si le stade est automatique
    if (!cropDef || !initialStage || initialStage === 'auto') {
        return defaultDate;
    }

    // Trouver le stade correspondant
    const stage = cropDef.stages.find(s => s.name === initialStage);
    if (!stage) return defaultDate;

    // Déterminer le décalage (milieu de la plage du stade choisi)
    const offsetDays = Math.round((stage.startDay + stage.endDay) / 2);
    
    // Reculer la date de semis effective pour compenser l'âge déjà accumulé
    const effectiveDate = new Date(defaultDate.getTime());
    effectiveDate.setDate(effectiveDate.getDate() - offsetDays);
    
    return effectiveDate;
};

/**
 * Détermine le stade phénologique ou saisonnier de la parcelle.
 */
exports.calculateCurrentStage = (cultureType, datePlantation, ageYears = 0, treeDensity = 0) => {
    const cropKey = String(cultureType).toLowerCase().trim();
    
    // 1. CAS ARBORICULTURE
    if (TREE_CROPS[cropKey]) {
        const treeDef = TREE_CROPS[cropKey];
        const age = Number(ageYears) || 0;
        
        // Déterminer la phase d'âge
        const phase = treeDef.agePhases.find(p => age <= p.maxAge) || treeDef.agePhases[treeDef.agePhases.length - 1];
        
        // Déterminer la phase saisonnière (selon le mois en cours)
        const currentMonth = new Date().getMonth() + 1; // 1-12
        let currentSeason = treeDef.seasons.spring; // fallback
        let seasonKey = "spring";
        
        for (const [key, sDef] of Object.entries(treeDef.seasons)) {
            if (sDef.months.includes(currentMonth)) {
                currentSeason = sDef;
                seasonKey = key;
                break;
            }
        }

        // Calcul de la densité relative (standard de comparaison : 250 arbres/ha)
        const densityFactor = Number(treeDensity) > 0 ? Math.min(Number(treeDensity) / 250, 1.5) : 1.0;
        
        // Ajuster l'enveloppe NDVI attendue selon l'âge et la densité
        const baseNdvi = phase.ndvi;
        const adjustedNdvi = [
            Math.max(baseNdvi[0] * densityFactor, 0.1),
            Math.min(baseNdvi[1] * densityFactor, 0.95)
        ];

        return {
            isTree: true,
            currentStage: seasonKey,
            stageLabel: currentSeason.label,
            progressPercent: 100, // Arbre permanent
            expectedNdviRange: adjustedNdvi,
            expectedNdwiRange: [0.10, 0.50],
            description: `${phase.label} (Plantation de ${age} ans, densité : ${treeDensity} arbres/ha). ${phase.desc} Actuellement : ${currentSeason.activity}`,
            advice: currentSeason.advice,
            meta: {
                ageLabel: `${age} ans (${age <= 5 ? 'Jeune' : age <= 15 ? 'Productif' : 'Mature'})`,
                seasonLabel: currentSeason.label,
                densityLabel: `${treeDensity} arbres / hectare`
            }
        };
    }

    // 2. CAS CULTURE SAISONNIÈRE
    const cropDef = SEASONAL_CROPS[cropKey];
    if (cropDef) {
        const start = new Date(datePlantation || Date.now());
        const today = new Date();
        const diffTime = Math.abs(today - start);
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        
        // Trouver le stade phénologique correspondant aux jours écoulés
        let activeStage = cropDef.stages.find(s => diffDays >= s.startDay && diffDays < s.endDay);
        
        // Si le cycle est dépassé
        if (diffDays >= cropDef.totalDuration) {
            return {
                isTree: false,
                currentStage: "completed",
                stageLabel: "Cycle Terminé / Récolté",
                progressPercent: 100,
                expectedNdviRange: [0.10, 0.28],
                expectedNdwiRange: [0.05, 0.20],
                description: "Le cycle de culture théorique est achevé. La parcelle est en période post-récolte ou en jachère.",
                advice: "Préparer le sol pour la prochaine rotation de cultures ou procéder aux travaux d'amendement organique de fond."
            };
        }

        // Si aucun stade n'est trouvé (par exemple diffDays < 0 ou erreur), forcer germination
        if (!activeStage) {
            activeStage = cropDef.stages[0];
        }

        const progressPercent = Math.min(Math.round((diffDays / cropDef.totalDuration) * 100), 99);

        return {
            isTree: false,
            currentStage: activeStage.name,
            stageLabel: activeStage.label,
            progressPercent,
            expectedNdviRange: activeStage.ndvi,
            expectedNdwiRange: activeStage.ndwi,
            description: `Jour ${diffDays} sur ${cropDef.totalDuration} de croissance théorique. ${activeStage.desc}`,
            advice: activeStage.advice
        };
    }

    // 3. FALLBACK GENERAL (Si culture inconnue, comportement NDVI classique)
    return {
        isTree: false,
        currentStage: "unknown",
        stageLabel: "Cycle Standard",
        progressPercent: 50,
        expectedNdviRange: [0.35, 0.80],
        expectedNdwiRange: [0.15, 0.50],
        description: "Analyse agronomique générique sans profil phénologique spécifique.",
        advice: "Surveiller les variations d'indices NDVI/NDWI pour détecter les anomalies locales de vigueur ou d'hydratation."
    };
};

/**
 * Analyse et interprète les indices calculés par rapport au stade biologique réel.
 * Évite les faux positifs (ex: NDVI bas attendu en germination n'est pas une alerte stress).
 */
exports.generateDiagnostic = (cultureType, phenology, ndvi, ndwi) => {
    if (ndvi == null || isNaN(ndvi)) {
        return {
            status: "unknown",
            statusLabel: "Inconnu",
            text: "Données satellites insuffisantes pour générer un diagnostic."
        };
    }

    const [minExpectedNdvi, maxExpectedNdvi] = phenology.expectedNdviRange;
    const [minExpectedNdwi, maxExpectedNdwi] = phenology.expectedNdwiRange;

    let ndviStatus = "normal"; // normal, low, high
    let ndwiStatus = "normal"; // normal, low

    if (ndvi < minExpectedNdvi) {
        // Si le NDVI baisse de plus de 20% sous le seuil attendu
        ndviStatus = ndvi < (minExpectedNdvi * 0.8) ? "critical" : "warning";
    } else if (ndvi > maxExpectedNdvi) {
        ndviStatus = "exceptional";
    }

    if (ndwi < minExpectedNdwi) {
        ndwiStatus = ndwi < (minExpectedNdwi * 0.8) ? "critical" : "warning";
    }

    let status = "ok";
    let statusLabel = "Vigueur Optimale";
    let text = "";

    // Construire le diagnostic textuel intelligent
    if (phenology.isTree) {
        // Spécificités Arbres
        if (ndviStatus === "critical" || ndviStatus === "warning") {
            status = ndviStatus === "critical" ? "critical" : "warning";
            statusLabel = ndviStatus === "critical" ? "Alerte Santé" : "Vigueur Faible";
            text = `L'indice NDVI (${ndvi.toFixed(2)}) est nettement inférieur aux normales de saison pour ce type de plantation (${minExpectedNdvi.toFixed(2)} - ${maxExpectedNdvi.toFixed(2)}). Cela suggère une baisse anormale de la densité foliaire due à une attaque de ravageurs, une maladie, ou une sécheresse prolongée.`;
        } else {
            text = `Vigueur végétative stable. L'activité chlorophyllienne de l'arbre (${ndvi.toFixed(2)}) correspond parfaitement aux normales pour cette phase saisonnière (${minExpectedNdvi.toFixed(2)} - ${maxExpectedNdvi.toFixed(2)}).`;
        }

        if (ndwiStatus === "critical" || ndwiStatus === "warning") {
            status = "critical";
            statusLabel = "Stress Hydrique détecté";
            text += ` De plus, l'indice d'humidité NDWI (${ndwi.toFixed(2)}) est critique. L'arbre subit un stress hydrique prononcé, risquant de compromettre la récolte ou de causer le flétrissement des feuilles.`;
        } else {
            text += ` L'hydratation de la canopée est adéquate.`;
        }
    } else {
        // Spécificités Cultures Saisonnières
        if (phenology.currentStage === "germination") {
            // En germination, un NDVI bas est 100% normal !
            if (ndvi <= maxExpectedNdvi && ndvi >= minExpectedNdvi) {
                text = `Excellent démarrage. Le NDVI de ${ndvi.toFixed(2)} est bas mais parfaitement conforme pour le stade de germination (levée). Le sol commence doucement à se couvrir de jeunes pousses verdoyantes.`;
            } else if (ndvi < minExpectedNdvi) {
                status = "warning";
                statusLabel = "Levée Tardive / Retard";
                text = `Alerte levée : Le NDVI (${ndvi.toFixed(2)}) est extrêmement bas, signalant un possible problème de germination (semences défectueuses, sol trop dur ou croûte de battance empêchant la sortie des pousses).`;
            } else {
                text = `La croissance est très vigoureuse pour ce début de cycle. Le NDVI de ${ndvi.toFixed(2)} indique une couverture du sol plus rapide que la moyenne théorique.`;
            }
        } else if (phenology.currentStage === "harvest" || phenology.currentStage === "completed") {
            // En phase de récolte, la chute de NDVI est normale
            text = `Dessèchement normal de maturité. Le NDVI bas (${ndvi.toFixed(2)}) traduit fidèlement la sénescence de fin de cycle végétatif et la réduction d'activité chlorophyllienne requise pour la moisson.`;
        } else {
            // En croissance active, floraison, etc.
            if (ndviStatus === "critical" || ndviStatus === "warning") {
                status = ndviStatus === "critical" ? "critical" : "warning";
                statusLabel = ndviStatus === "critical" ? "Stress Végétatif Sévère" : "Croissance Ralentie";
                text = `Le NDVI de ${ndvi.toFixed(2)} montre une anomalie de vigueur notable en pleine période active de croissance (seuil de référence attendu : ${minExpectedNdvi.toFixed(2)} - ${maxExpectedNdvi.toFixed(2)}). La biomasse foliaire est insuffisante, traduisant un stress de croissance ou un manque d'intrants.`;
            } else {
                text = `Développement parfait. Le NDVI de ${ndvi.toFixed(2)} se situe dans la plage optimale (${minExpectedNdvi.toFixed(2)} - ${maxExpectedNdvi.toFixed(2)}) pour ce stade de ${phenology.stageLabel}. La photosynthèse est pleinement active.`;
            }

            if (ndwiStatus === "critical" || ndwiStatus === "warning") {
                status = "critical";
                statusLabel = "Stress Hydrique Actif";
                text += ` L'indice NDWI (${ndwi.toFixed(2)}) est sous le seuil d'irrigation recommandé (${minExpectedNdwi.toFixed(2)}). La plante transpire excessivement sans apport d'eau suffisant, induisant un flétrissement imminent.`;
            } else {
                text += ` L'état hydrique est excellent, assurant les besoins de transpiration de la culture.`;
            }
        }
    }

    return {
        status,
        statusLabel,
        text
    };
};
