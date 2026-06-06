const Parcelle = require('../models/Parcel');
const geeService = require('../services/geeService');
const { getParcelleWeather } = require('../services/weatherService');
const cropCycleEngine = require('../services/cropCycleEngine');

const toIsoDate = (value) => new Date(value).toISOString().split('T')[0];

const sixMonthsAgoIso = () => {
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
    return toIsoDate(sixMonthsAgo);
};

const getPlantationStartIso = (datePlantation) => {
    if (!datePlantation) return null;
    const parsed = new Date(datePlantation);
    return Number.isNaN(parsed.getTime()) ? null : toIsoDate(parsed);
};

const sanitizeDatePlantation = (rawDate) => {
    if (!rawDate) return null;
    const parsed = new Date(rawDate);
    if (Number.isNaN(parsed.getTime())) return null;
    const today = new Date();
    const parsedIso = toIsoDate(parsed);
    const todayIso = toIsoDate(today);
    return parsedIso > todayIso ? todayIso : parsedIso;
};

const getSeriesWithFallback = async (geometry, startDate, endDate) => {
    const primary = await geeService.getNDVITimeSeries(geometry, startDate, endDate);
    if (primary.length > 0) return primary;

    const fallbackStart = sixMonthsAgoIso();
    if (fallbackStart === startDate) return primary;

    return geeService.getNDVITimeSeries(geometry, fallbackStart, endDate);
};

// CREATE
exports.createParcelle = async (req, res) => {
    try {
        const payload = { ...req.body };
        // Associer la parcelle à l'utilisateur connecté
        payload.userId = req.auth.userId;
        if (Object.prototype.hasOwnProperty.call(payload, 'datePlantation')) {
            payload.datePlantation = sanitizeDatePlantation(payload.datePlantation);
        }

        // Si une culture de type saisonnière a un stade initial estimé spécifique
        if (payload.cultureType && payload.datePlantation && payload.cultureEstimatedStage) {
            payload.datePlantation = cropCycleEngine.calculateEffectiveStartDate(
                payload.cultureType,
                payload.datePlantation,
                payload.cultureEstimatedStage
            );
        }

        // Vérification des doublons : empêcher le même agriculteur de créer la même parcelle
        const duplicateQuery = {
            userId: payload.userId,
            nom: payload.nom,
            proprietaire: payload.proprietaire,
            'geometry.coordinates': payload.geometry.coordinates
        };
        
        if (payload.wilaya) {
            duplicateQuery.wilaya = payload.wilaya;
        }

        const parcelleExistante = await Parcelle.findOne(duplicateQuery);
        if (parcelleExistante) {
            return res.status(400).json({ 
                error: "Vous avez déjà créé cette parcelle avec ces mêmes coordonnées, ce nom et ce propriétaire." 
            });
        }

        const nouvelleParcelle = new Parcelle(payload);
        const saved = await nouvelleParcelle.save();

        // LOGIQUE CROP MONITORING : Calculer les indices immédiatement après l'ajout
        const today = toIsoDate(new Date());
        const startDate = getPlantationStartIso(saved.datePlantation) || sixMonthsAgoIso();

        // On lance le calcul GEE
        const stats = await getSeriesWithFallback(saved.geometry, startDate, today);

        // On renvoie TOUT : les infos de la parcelle + les données des graphes
    res.status(201).json({
    success: true,
    info: saved,
    analytics: stats,
    // On récupère la dernière valeur du tableau pour afficher la moyenne actuelle
    ndviMoyen: stats.length > 0 ? stats[stats.length - 1].ndvi : 0,
    ndwiMoyen: stats.length > 0 ? stats[stats.length - 1].ndwi : 0,
    saviMoyen: stats.length > 0 ? stats[stats.length - 1].savi : 0,
    gndviMoyen: stats.length > 0 ? stats[stats.length - 1].gndvi : 0,
    ndreMoyen: stats.length > 0 ? stats[stats.length - 1].ndre : 0,
    eviMoyen: stats.length > 0 ? stats[stats.length - 1].evi : 0
});
    } catch (err) {
        console.error(err);
        res.status(400).json({ error: err.message });
    }
};

// READ ALL — filtré par utilisateur connecté
exports.getAllParcelles = async (req, res) => {
    try {
        const parcelles = await Parcelle.find({ userId: req.auth.userId }).sort({ createdAt: -1 });
        res.json(parcelles);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

// READ FARMER PARCELLES (For advisors)
exports.getFarmerParcelles = async (req, res) => {
  try {
    const { farmerId } = req.params;
    // On pourrait vérifier ici si l'advisor a une conversation avec ce farmer
    const parcelles = await Parcelle.find({ userId: farmerId }).sort({ createdAt: -1 });
    res.json(parcelles);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// GET ONE + STATS GEE (La logique métier principale)
exports.getParcelleDetails = async (req, res) => {
    try {
        const query = { _id: req.params.id };
        if (req.auth.role !== 'conseiller') {
            query.userId = req.auth.userId;
        }
        const parcelle = await Parcelle.findOne(query);
        if (!parcelle) return res.status(404).send("Parcelle non trouvée");

        // On récupère les données NDVI depuis la date de plantation (ou 6 mois)
        const today = toIsoDate(new Date());
        const startDate = getPlantationStartIso(parcelle.datePlantation) || sixMonthsAgoIso();

        let stats = [];
        let latestSentinelImageDate = null;

        try {
            [stats, latestSentinelImageDate] = await Promise.all([
                getSeriesWithFallback(parcelle.geometry, startDate, today),
                geeService.getLatestSentinelImageDate(parcelle.geometry)
            ]);
        } catch (geeErr) {
            console.error('[GEE] Error fetching parcel stats:', geeErr.message);
            // Continue with empty analytics — don't fail the whole request
        }

        // Enrich info with GEE-computed indices when DB fields are missing
        const lastStat = stats.length > 0 ? stats[stats.length - 1] : null;
        const enrichedInfo = parcelle.toObject ? parcelle.toObject() : { ...parcelle };
        if (lastStat) {
            if (enrichedInfo.ndviMoyen  == null) enrichedInfo.ndviMoyen  = lastStat.ndvi  ?? null;
            if (enrichedInfo.ndwiMoyen  == null) enrichedInfo.ndwiMoyen  = lastStat.ndwi  ?? null;
            if (enrichedInfo.saviMoyen  == null) enrichedInfo.saviMoyen  = lastStat.savi  ?? null;
            if (enrichedInfo.gndviMoyen == null) enrichedInfo.gndviMoyen = lastStat.gndvi ?? null;
        }

        // Calculer l'état phénologique et le diagnostic
        const phenology = cropCycleEngine.calculateCurrentStage(
            enrichedInfo.cultureType,
            enrichedInfo.datePlantation,
            enrichedInfo.cultureAgeYears,
            enrichedInfo.treeDensity
        );
        const diagnostic = cropCycleEngine.generateDiagnostic(
            enrichedInfo.cultureType,
            phenology,
            enrichedInfo.ndviMoyen,
            enrichedInfo.ndwiMoyen
        );

        enrichedInfo.phenology = phenology;
        enrichedInfo.diagnostic = diagnostic;

        res.json({ info: enrichedInfo, analytics: stats, latestSentinelImageDate });
    } catch (err) {
        console.error('[getParcelleDetails] Error:', err.message);
        res.status(500).json({ error: err.message });
    }
};

exports.getParcelleTimeSeries = async (req, res) => {
    try {
        const query = { _id: req.params.id };
        if (req.auth.role !== 'conseiller') {
            query.userId = req.auth.userId;
        }
        const parcelle = await Parcelle.findOne(query);
        if (!parcelle) return res.status(404).send("Parcelle non trouvée");

        const todayIso = toIsoDate(new Date());
        const fallbackStart = getPlantationStartIso(parcelle.datePlantation) || sixMonthsAgoIso();

        const startDate = req.query.debut || fallbackStart;
        const endDate = req.query.fin || todayIso;

        const stats = await getSeriesWithFallback(parcelle.geometry, startDate, endDate);
        res.json({ parcelleId: parcelle._id, startDate, endDate, analytics: stats });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

exports.getParcelleWeather = async (req, res) => {
    try {
        const query = { _id: req.params.id };
        if (req.auth.role !== 'conseiller') {
            query.userId = req.auth.userId;
        }
        const parcelle = await Parcelle.findOne(query);
        if (!parcelle) return res.status(404).send("Parcelle non trouvée");

        let meteo = {};
        try {
            meteo = await getParcelleWeather(parcelle.geometry);
        } catch (weatherErr) {
            console.error('[Weather] Error fetching weather:', weatherErr.message);
            // Return empty meteo rather than crashing
        }

        res.json({ parcelleId: parcelle._id, ...meteo });
    } catch (err) {
        console.error('[getParcelleWeather] Error:', err.message);
        res.status(500).json({ error: err.message });
    }
};

exports.updateParcelle = async (req, res) => {
  try {
    const payload = { ...req.body };
    // Empêcher la modification de userId
    delete payload.userId;

    const existing = await Parcelle.findOne({ _id: req.params.id, userId: req.auth.userId });
    if (!existing) return res.status(404).json({ error: 'Parcelle non trouvée ou accès refusé' });

    if (Object.prototype.hasOwnProperty.call(payload, 'datePlantation')) {
        payload.datePlantation = sanitizeDatePlantation(payload.datePlantation);
    }

    // Réajuster si besoin la date de début de semis théorique compensée
    if (payload.cultureType !== undefined || payload.datePlantation !== undefined || payload.cultureEstimatedStage !== undefined) {
        const type = payload.cultureType !== undefined ? payload.cultureType : existing.cultureType;
        const date = payload.datePlantation !== undefined ? payload.datePlantation : existing.datePlantation;
        const stage = payload.cultureEstimatedStage !== undefined ? payload.cultureEstimatedStage : existing.cultureEstimatedStage;

        if (type && date) {
            payload.datePlantation = cropCycleEngine.calculateEffectiveStartDate(type, date, stage);
        }
    }

    const updated = await Parcelle.findOneAndUpdate(
        { _id: req.params.id, userId: req.auth.userId },
        payload,
        { new: true }
    );
    res.json(updated);
  } catch (err) { res.status(400).json({ error: err.message }); }
};

exports.analyzeParcelleStress = async (req, res) => {
    try {
        const result = await geeService.analyzeStress(req.params.id);
        res.json(result);
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
};

exports.getParcelleHeatmap = async (req, res) => {
    try {
        const parcelle = await Parcelle.findOne({ _id: req.params.id, userId: req.auth.userId });
        if (!parcelle) return res.status(404).send("Parcelle non trouvée");
        const indexType = req.query.index || 'ndvi';
        const url = await geeService.getHeatmap(parcelle.geometry, indexType);
        res.json({ url });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

// DELETE — vérifie l'appartenance avant suppression
exports.deleteParcelle = async (req, res) => {
    try {
        const deleted = await Parcelle.findOneAndDelete({ _id: req.params.id, userId: req.auth.userId });
        if (!deleted) return res.status(404).json({ error: 'Parcelle non trouvée ou accès refusé' });
        res.json({ message: "Parcelle supprimée avec succès" });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

// COMPARE — séries temporelles de plusieurs parcelles en une seule requête (max 5)
exports.compareParcellesSeries = async (req, res) => {
    try {
        const { ids, debut, fin } = req.query;
        if (!ids) return res.status(400).json({ error: 'Le paramètre ids est requis.' });

        const idList = String(ids).split(',').filter(Boolean).slice(0, 5);
        const todayIso = toIsoDate(new Date());
        const endDate = fin || todayIso;

        const parcelles = await Parcelle.find({ _id: { $in: idList }, userId: req.auth.userId });

        const results = await Promise.all(
            parcelles.map(async (parcelle) => {
                const fallbackStart = getPlantationStartIso(parcelle.datePlantation) || sixMonthsAgoIso();
                const startDate = debut || fallbackStart;
                const series = await getSeriesWithFallback(parcelle.geometry, startDate, endDate);
                return {
                    parcelleId: String(parcelle._id),
                    nom: parcelle.nom,
                    status: parcelle.status,
                    ndviMoyen: parcelle.ndviMoyen,
                    ndwiMoyen: parcelle.ndwiMoyen,
                    saviMoyen: parcelle.saviMoyen,
                    gndviMoyen: parcelle.gndviMoyen,
                    ndreMoyen: parcelle.ndreMoyen,
                    eviMoyen: parcelle.eviMoyen,
                    lastAnalyzedCaptureDate: parcelle.lastAnalyzedCaptureDate,
                    series,
                };
            })
        );

        res.json(results);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: err.message });
    }
};