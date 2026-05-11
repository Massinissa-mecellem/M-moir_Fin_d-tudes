const ee = require('@google/earthengine');
const Parcelle = require('../models/Parcel');
const Alerte = require('../models/Alert');
const { sendAlertNotification, sendCriticalAlertNotification } = require('./pushService');
const { getParcelleWeather } = require('./weatherService');

const toPercent = (value) => `${(value * 100).toFixed(1)}%`;
const INDICES_STABILITY_THRESHOLD = Number(process.env.INDICES_STABILITY_THRESHOLD || 0.05);
const INDICES_DEGRADATION_THRESHOLD = Number(process.env.INDICES_DEGRADATION_THRESHOLD || 0.1);
const DEFAULT_HISTORY_DAYS = 180;

const toDateOnly = (value) => {
    if (!value) return null;
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return null;
    parsed.setHours(0, 0, 0, 0);
    return parsed;
};

const normalizeDateRange = (startDate, endDate) => {
    const parsedEnd = toDateOnly(endDate) || toDateOnly(new Date());
    const parsedStart = toDateOnly(startDate) || (() => {
        const fallback = new Date(parsedEnd);
        fallback.setDate(fallback.getDate() - DEFAULT_HISTORY_DAYS);
        return fallback;
    })();

    let normalizedStart = parsedStart;
    let normalizedEnd = parsedEnd;

    if (normalizedEnd <= normalizedStart) {
        normalizedEnd = new Date(normalizedStart);
        normalizedEnd.setDate(normalizedEnd.getDate() + 1);
    }

    return {
        start: normalizedStart.toISOString().slice(0, 10),
        end: normalizedEnd.toISOString().slice(0, 10)
    };
};

const parseCaptureDate = (rawDate) => {
    if (!rawDate) return null;
    const parsed = new Date(rawDate);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
};

const classifyDelta = (delta) => {
    if (delta <= -INDICES_DEGRADATION_THRESHOLD) return 'degradation';
    if (delta >= INDICES_DEGRADATION_THRESHOLD) return 'amelioration';
    if (Math.abs(delta) <= INDICES_STABILITY_THRESHOLD) return 'stabilite';
    return delta > 0 ? 'amelioration legere' : 'degradation legere';
};

const buildIndicesReport = (current, previous) => {
    const ndviDelta = current.ndvi - previous.ndvi;
    const ndwiDelta = current.ndwi - previous.ndwi;
    const saviDelta = (current.savi || 0) - (previous.savi || 0);
    const gndviDelta = (current.gndvi || 0) - (previous.gndvi || 0);
    const ndreDelta = (current.ndre || 0) - (previous.ndre || 0);
    const eviDelta = (current.evi || 0) - (previous.evi || 0);

    const ndviTrend = ndviDelta >= 0 ? 'hausse' : 'baisse';
    const ndwiTrend = ndwiDelta >= 0 ? 'hausse' : 'baisse';
    const saviTrend = saviDelta >= 0 ? 'hausse' : 'baisse';
    const gndviTrend = gndviDelta >= 0 ? 'hausse' : 'baisse';
    const ndreTrend = ndreDelta >= 0 ? 'hausse' : 'baisse';
    const eviTrend = eviDelta >= 0 ? 'hausse' : 'baisse';

    const ndviClass = classifyDelta(ndviDelta);
    const ndwiClass = classifyDelta(ndwiDelta);
    const saviClass = classifyDelta(saviDelta);
    const gndviClass = classifyDelta(gndviDelta);
    const ndreClass = classifyDelta(ndreDelta);
    const eviClass = classifyDelta(eviDelta);

    return [
        `Nouvelle image Sentinel-2 du ${current.date}.`,
        `NDVI: ${previous.ndvi.toFixed(3)} -> ${current.ndvi.toFixed(3)} (${ndviTrend} ${toPercent(Math.abs(ndviDelta))}, ${ndviClass}).`,
        `NDWI: ${previous.ndwi.toFixed(3)} -> ${current.ndwi.toFixed(3)} (${ndwiTrend} ${toPercent(Math.abs(ndwiDelta))}, ${ndwiClass}).`,
        `SAVI: ${(previous.savi || 0).toFixed(3)} -> ${(current.savi || 0).toFixed(3)} (${saviTrend}, ${saviClass}).`,
        `GNDVI: ${(previous.gndvi || 0).toFixed(3)} -> ${(current.gndvi || 0).toFixed(3)} (${gndviTrend}, ${gndviClass}).`,
        `NDRE: ${(previous.ndre || 0).toFixed(3)} -> ${(current.ndre || 0).toFixed(3)} (${ndreTrend}, ${ndreClass}).`,
        `EVI: ${(previous.evi || 0).toFixed(3)} -> ${(current.evi || 0).toFixed(3)} (${eviTrend}, ${eviClass}).`
    ].join(' ');
};

const getNDVITimeSeries = (geometry, startDate, endDate) => {
    return new Promise((resolve, reject) => {
        const normalizedRange = normalizeDateRange(startDate, endDate);
        const polygon = ee.Geometry.Polygon(geometry.coordinates);
        
        // 1. Masquage des nuages pour Sentinel-2
        const maskS2clouds = (image) => {
            const qa = image.select('QA60');
            // Bits 10 et 11 sont les nuages et les cirrus
            const cloudBitMask = 1 << 10;
            const cirrusBitMask = 1 << 11;
            const mask = qa.bitwiseAnd(cloudBitMask).eq(0)
                .and(qa.bitwiseAnd(cirrusBitMask).eq(0));
            // On applique le masque pour ne garder que les pixels clairs
            return image.updateMask(mask).copyProperties(image, ["system:time_start"]);
        };

        // Collection Sentinel-2 (Harmonized = plus précise/récente)
        const s2Collection = ee.ImageCollection('COPERNICUS/S2_SR_HARMONIZED')
            .filterBounds(polygon)
            .filterDate(normalizedRange.start, normalizedRange.end)
            .filter(ee.Filter.lt('CLOUDY_PIXEL_PERCENTAGE', 60)) // On est plus tolérant car on masque pixel par pixel
            .map(maskS2clouds);

        const s2Series = s2Collection.map(image => {
            const ndvi = image.normalizedDifference(['B8', 'B4']).rename('ndvi');
            const ndwi = image.normalizedDifference(['B8', 'B11']).rename('ndwi'); 
            const savi = image.expression(
                '((NIR - RED) / (NIR + RED + L)) * (1 + L)', {
                    'NIR': image.select('B8'),
                    'RED': image.select('B4'),
                    'L': 0.5
                }
            ).rename('savi');
            const gndvi = image.normalizedDifference(['B8', 'B3']).rename('gndvi');
            const ndre = image.normalizedDifference(['B8', 'B5']).rename('ndre');
            const evi = image.expression(
                '2.5 * ((NIR - RED) / (NIR + 6 * RED - 7.5 * BLUE + 1))', {
                    'NIR': image.select('B8'),
                    'RED': image.select('B4'),
                    'BLUE': image.select('B2')
                }
            ).rename('evi');
            
            const stats = ee.Image([ndvi, ndwi, savi, gndvi, ndre, evi]).reduceRegion({
                reducer: ee.Reducer.mean(),
                geometry: polygon,
                scale: 10,
                maxPixels: 1e9
            });
            
            return ee.Feature(null, {
                'ndvi': stats.get('ndvi'),
                'ndwi': stats.get('ndwi'),
                'savi': stats.get('savi'),
                'gndvi': stats.get('gndvi'),
                'ndre': stats.get('ndre'),
                'evi': stats.get('evi'),
                'date': image.date().format('YYYY-MM-DD')
            });
        });

        // 2. Collection Météo (ERA5 Land Daily)
        const weatherCollection = ee.ImageCollection('ECMWF/ERA5_LAND/DAILY_AGGR')
            .filterBounds(polygon)
            .filterDate(normalizedRange.start, normalizedRange.end);

        const weatherSeries = weatherCollection.map(image => {
            // Précipitations : on passe de mètres à millimètres (* 1000)
            const precipImage = image.select('total_precipitation_sum').multiply(1000).rename('precip');
            // Température : on passe de Kelvin à Celsius (- 273.15)
            const tempImage = image.select('temperature_2m').subtract(273.15).rename('temp');
            
            const stats = ee.Image([precipImage, tempImage]).reduceRegion({
                reducer: ee.Reducer.mean(),
                geometry: polygon,
                scale: 11132, // Résolution ERA5 (~11km)
                maxPixels: 1e9
            });
            
            return ee.Feature(null, {
                'precip': stats.get('precip'),
                'temp': stats.get('temp'),
                'date': image.date().format('YYYY-MM-DD')
            });
        });

        // Extraire les deux collections en une seule requête pour être rapide
        ee.Dictionary({
            s2: s2Series.toList(1000),
            weather: weatherSeries.toList(1000)
        }).getInfo((data, err) => {
            if (err) return reject(err);
            
            // On enlève les images S2 où la parcelle était 100% nuageuse (ndvi = null)
            const s2Data = data.s2.map(f => f.properties).filter(d => d.ndvi !== null);
            const weatherData = data.weather.map(f => f.properties);

            // Créer un dictionnaire météo par date pour la jointure
            const weatherMap = {};
            weatherData.forEach(w => {
                weatherMap[w.date] = w;
            });

            // Combiner Sentinel-2 avec la météo correspondante
            const formatted = s2Data.map(s2 => {
                const w = weatherMap[s2.date] || {};
                return {
                    date: s2.date,
                    ndvi: s2.ndvi,
                    ndwi: s2.ndwi,
                    savi: s2.savi,
                    gndvi: s2.gndvi,
                    ndre: s2.ndre,
                    evi: s2.evi,
                    precip: w.precip !== undefined ? w.precip : null,
                    temp: w.temp !== undefined ? w.temp : null
                };
            });

            // Trier par date du plus ancien au plus récent
            formatted.sort((a, b) => new Date(a.date) - new Date(b.date));

            resolve(formatted);
        });
    });
};

const getLatestSentinelCaptures = (geometry, limit = 2) => {
    return new Promise((resolve, reject) => {
        const polygon = ee.Geometry.Polygon(geometry.coordinates);

        const maskS2clouds = (image) => {
            const qa = image.select('QA60');
            const cloudBitMask = 1 << 10;
            const cirrusBitMask = 1 << 11;
            const mask = qa.bitwiseAnd(cloudBitMask).eq(0)
                .and(qa.bitwiseAnd(cirrusBitMask).eq(0));
            return image.updateMask(mask).copyProperties(image, ['system:time_start']);
        };

        const collection = ee.ImageCollection('COPERNICUS/S2_SR_HARMONIZED')
            .filterBounds(polygon)
            .filterDate(ee.Date(Date.now()).advance(-45, 'day'), ee.Date(Date.now()))
            .filter(ee.Filter.lt('CLOUDY_PIXEL_PERCENTAGE', 60))
            .map(maskS2clouds)
            .sort('system:time_start', false)
            .limit(limit);

        const series = collection.map((image) => {
            const ndvi = image.normalizedDifference(['B8', 'B4']).rename('ndvi');
            const ndwi = image.normalizedDifference(['B8', 'B11']).rename('ndwi');
            const savi = image.expression(
                '((NIR - RED) / (NIR + RED + L)) * (1 + L)', {
                    'NIR': image.select('B8'),
                    'RED': image.select('B4'),
                    'L': 0.5
                }
            ).rename('savi');
            const gndvi = image.normalizedDifference(['B8', 'B3']).rename('gndvi');
            const ndre = image.normalizedDifference(['B8', 'B5']).rename('ndre');
            const evi = image.expression(
                '2.5 * ((NIR - RED) / (NIR + 6 * RED - 7.5 * BLUE + 1))', {
                    'NIR': image.select('B8'),
                    'RED': image.select('B4'),
                    'BLUE': image.select('B2')
                }
            ).rename('evi');

            const stats = ee.Image([ndvi, ndwi, savi, gndvi, ndre, evi]).reduceRegion({
                reducer: ee.Reducer.mean(),
                geometry: polygon,
                scale: 10,
                maxPixels: 1e9
            });

            return ee.Feature(null, {
                ndvi: stats.get('ndvi'),
                ndwi: stats.get('ndwi'),
                savi: stats.get('savi'),
                gndvi: stats.get('gndvi'),
                ndre: stats.get('ndre'),
                evi: stats.get('evi'),
                date: image.date().format('YYYY-MM-DD')
            });
        });

        series.toList(limit).getInfo((data, err) => {
            if (err) return reject(err);
            const clean = data.map((f) => f.properties).filter((d) => d.ndvi !== null && d.ndwi !== null);
            resolve(clean);
        });
    });
};

const getLatestSentinelImageDate = (geometry, lookbackDays = 90) => {
    return new Promise((resolve, reject) => {
        const polygon = ee.Geometry.Polygon(geometry.coordinates);

        const collection = ee.ImageCollection('COPERNICUS/S2_SR_HARMONIZED')
            .filterBounds(polygon)
            .filterDate(ee.Date(Date.now()).advance(-lookbackDays, 'day'), ee.Date(Date.now()))
            .sort('system:time_start', false)
            .limit(1);

        collection.toList(1).getInfo((data, err) => {
            if (err) return reject(err);
            if (!data || data.length === 0) return resolve(null);
            const image = data[0];
            const millis = image?.properties?.['system:time_start'];
            if (!millis) return resolve(null);
            resolve(new Date(millis).toISOString().slice(0, 10));
        });
    });
};

const analyzeStress = async (parcelleId) => {
    const parcelle = await Parcelle.findById(parcelleId);
    if (!parcelle) throw new Error('Parcelle introuvable');

    const captures = await getLatestSentinelCaptures(parcelle.geometry, 2);
    if (captures.length < 2) {
        return { parcelleId, status: parcelle.status, message: 'Pas assez de captures Sentinel-2.' };
    }

    const [current, previous] = captures;
    const meteo = await getParcelleWeather(parcelle.geometry).catch(() => null);
    const currentCaptureDate = parseCaptureDate(current.date) || new Date();
    const currentCaptureDateKey = currentCaptureDate.toISOString().slice(0, 10);
    const isNewCapture = !parcelle.lastAnalyzedCaptureDate
        || new Date(parcelle.lastAnalyzedCaptureDate).toISOString().slice(0, 10) !== currentCaptureDateKey;

    if (!isNewCapture) {
        return {
            parcelleId,
            status: parcelle.status,
            message: 'Aucune nouvelle image Sentinel-2 depuis la dernière analyse.'
        };
    }

    const ndviDropRatio = previous.ndvi > 0 ? (previous.ndvi - current.ndvi) / previous.ndvi : 0;
    const ndwiDropRatio = previous.ndwi > 0 ? (previous.ndwi - current.ndwi) / previous.ndwi : 0;
    const saviDropRatio = previous.savi > 0 ? (previous.savi - current.savi) / previous.savi : 0;
    const gndviDropRatio = previous.gndvi > 0 ? (previous.gndvi - current.gndvi) / previous.gndvi : 0;

    const ndviCritical = current.ndvi < 0.3 || ndviDropRatio >= 0.25;
    const ndwiCritical = current.ndwi < 0.1 || ndwiDropRatio >= 0.25;
    const saviCritical = current.savi < 0.2 || saviDropRatio >= 0.25;
    const gndviCritical = current.gndvi < 0.25 || gndviDropRatio >= 0.25;

    let nextStatus = 'ok';
    const createdAlerts = [];
    const criticalAlerts = [];
    const report = buildIndicesReport(current, previous);

    const updateAlert = await Alerte.create({
        parcelleId: parcelle._id,
        type: 'Mise à jour',
        valeurIndice: current.ndvi,
        rapport: report,
        date: currentCaptureDate,
        isRead: false
    });
    createdAlerts.push(updateAlert);

    if (ndviCritical) {
        const alert = await Alerte.create({
            parcelleId: parcelle._id,
            type: 'Santé',
            valeurIndice: current.ndvi,
            rapport: report,
            date: currentCaptureDate,
            isRead: false
        });
        createdAlerts.push(alert);
        criticalAlerts.push(alert);
        nextStatus = 'critical';
    }

    if (ndwiCritical) {
        const alert = await Alerte.create({
            parcelleId: parcelle._id,
            type: 'Stress Hydrique',
            valeurIndice: current.ndwi,
            rapport: report,
            date: currentCaptureDate,
            isRead: false
        });
        createdAlerts.push(alert);
        criticalAlerts.push(alert);
        nextStatus = nextStatus === 'critical' ? 'critical' : 'warning';
    }

    if (saviCritical) {
        const alert = await Alerte.create({
            parcelleId: parcelle._id,
            type: 'Santé',
            valeurIndice: current.savi,
            rapport: `Vigueur corrigée (SAVI) critique: ${current.savi.toFixed(3)}. Influence du sol probable ou stress végétal sévère.`,
            date: currentCaptureDate,
            isRead: false
        });
        createdAlerts.push(alert);
        nextStatus = 'critical';
    }

    if (gndviCritical) {
        const alert = await Alerte.create({
            parcelleId: parcelle._id,
            type: 'Santé',
            valeurIndice: current.gndvi,
            rapport: `Indice de chlorophylle (GNDVI) critique: ${current.gndvi.toFixed(3)}. Risque de carence nutritionnelle ou sénescence précoce.`,
            date: currentCaptureDate,
            isRead: false
        });
        createdAlerts.push(alert);
        nextStatus = nextStatus === 'critical' ? 'critical' : 'warning';
    }

    const thermalStress = meteo?.currentDay?.tempMax != null
        && meteo.currentDay.tempMax > 38
        && (current.ndvi - previous.ndvi) <= -0.08;
    if (thermalStress) {
        const alert = await Alerte.create({
            parcelleId: parcelle._id,
            type: 'Santé',
            valeurIndice: current.ndvi,
            rapport: `Stress thermique probable: NDVI en baisse (${previous.ndvi.toFixed(3)} -> ${current.ndvi.toFixed(3)}) avec Tmax ${meteo.currentDay.tempMax.toFixed(1)}°C.`,
            date: currentCaptureDate,
            isRead: false
        });
        createdAlerts.push(alert);
        criticalAlerts.push(alert);
        nextStatus = 'critical';
    }

    const forecastPrecip = (meteo?.next5Days || []).reduce((sum, day) => sum + (day.precipMm || 0), 0);
    const urgentIrrigation = current.ndwi < 0.2
        && (meteo?.currentDay?.etp || 0) >= 4.5
        && forecastPrecip < 1;
    if (urgentIrrigation) {
        const alert = await Alerte.create({
            parcelleId: parcelle._id,
            type: 'Stress Hydrique',
            valeurIndice: current.ndwi,
            rapport: `Irrigation urgente: NDWI ${current.ndwi.toFixed(3)}, ETP ${meteo.currentDay.etp.toFixed(1)} mm/j, pluie prévue 5j ${forecastPrecip.toFixed(1)} mm.`,
            date: currentCaptureDate,
            isRead: false
        });
        createdAlerts.push(alert);
        criticalAlerts.push(alert);
        nextStatus = 'critical';
    }

    const fungalRisk = (meteo?.currentDay?.humidity || 0) > 80
        && (meteo?.currentDay?.tempMax || 0) >= 15
        && (meteo?.currentDay?.tempMax || 0) <= 30;
    if (fungalRisk) {
        const alert = await Alerte.create({
            parcelleId: parcelle._id,
            type: 'Santé',
            valeurIndice: current.ndvi,
            rapport: `Risque fongique: humidité ${meteo.currentDay.humidity.toFixed(0)}% et température favorable (${meteo.currentDay.tempMin?.toFixed?.(1) ?? '--'}-${meteo.currentDay.tempMax.toFixed(1)}°C).`,
            date: currentCaptureDate,
            isRead: false
        });
        createdAlerts.push(alert);
    }

    if (!ndviCritical && !ndwiCritical && (current.ndvi < 0.45 || current.ndwi < 0.2)) {
        nextStatus = 'warning';
    }

    parcelle.status = nextStatus;
    parcelle.ndviMoyen = current.ndvi;
    parcelle.ndwiMoyen = current.ndwi;
    parcelle.saviMoyen = current.savi;
    parcelle.gndviMoyen = current.gndvi;
    parcelle.ndreMoyen = current.ndre;
    parcelle.eviMoyen = current.evi;
    parcelle.lastAnalyzedCaptureDate = currentCaptureDate;
    await parcelle.save();

    await sendAlertNotification({
        title: 'Nouvelle image satellite traitée',
        body: `${parcelle.nom}: indices NDVI/NDWI mis à jour.`,
        data: {
            parcelleId: String(parcelle._id),
            alertId: String(updateAlert._id),
            level: 'info',
            url: '/alertes'
        }
    });

    if (nextStatus === 'critical' && criticalAlerts.length) {
        await Promise.all(criticalAlerts.map((alert) => sendCriticalAlertNotification(alert, parcelle)));
    }

    return {
        parcelleId,
        status: nextStatus,
        current,
        previous,
        alertsCreated: createdAlerts.length
    };
};

const getHeatmap = (geometry, indexType = 'ndvi') => {
    return new Promise((resolve, reject) => {
        try {
            const polygon = ee.Geometry.Polygon(geometry.coordinates);

            const maskS2clouds = (image) => {
                const qa = image.select('QA60');
                const cloudBitMask = 1 << 10;
                const cirrusBitMask = 1 << 11;
                const mask = qa.bitwiseAnd(cloudBitMask).eq(0)
                    .and(qa.bitwiseAnd(cirrusBitMask).eq(0));
                return image.updateMask(mask).copyProperties(image, ['system:time_start']);
            };

            const collection = ee.ImageCollection('COPERNICUS/S2_SR_HARMONIZED')
                .filterBounds(polygon)
                .filterDate(ee.Date(Date.now()).advance(-60, 'day'), ee.Date(Date.now()))
                .filter(ee.Filter.lt('CLOUDY_PIXEL_PERCENTAGE', 60))
                .map(maskS2clouds)
                .sort('system:time_start', false);

            const latestImage = collection.first();
            
            latestImage.getInfo((img, err) => {
                if (err) return reject(err);
                if (!img) return reject(new Error("Aucune image satellite récente trouvée."));

                let indexImage;
                let minVal = 0.1;
                let maxVal = 0.8;

                switch(indexType) {
                    case 'ndwi':
                        indexImage = latestImage.normalizedDifference(['B8', 'B11']).rename('ndwi');
                        minVal = 0;
                        maxVal = 0.5;
                        break;
                    case 'savi':
                        indexImage = latestImage.expression(
                            '((NIR - RED) / (NIR + RED + L)) * (1 + L)', {
                                'NIR': latestImage.select('B8'),
                                'RED': latestImage.select('B4'),
                                'L': 0.5
                            }
                        ).rename('savi');
                        minVal = 0.1;
                        maxVal = 0.7;
                        break;
                    case 'gndvi':
                        indexImage = latestImage.normalizedDifference(['B8', 'B3']).rename('gndvi');
                        minVal = 0.2;
                        maxVal = 0.8;
                        break;
                    case 'ndre':
                        indexImage = latestImage.normalizedDifference(['B8', 'B5']).rename('ndre');
                        minVal = 0.1;
                        maxVal = 0.6;
                        break;
                    case 'evi':
                        indexImage = latestImage.expression(
                            '2.5 * ((NIR - RED) / (NIR + 6 * RED - 7.5 * BLUE + 1))', {
                                'NIR': latestImage.select('B8'),
                                'RED': latestImage.select('B4'),
                                'BLUE': latestImage.select('B2')
                            }
                        ).rename('evi');
                        minVal = 0.1;
                        maxVal = 0.7;
                        break;
                    case 'ndvi':
                    default:
                        indexImage = latestImage.normalizedDifference(['B8', 'B4']).rename('ndvi');
                        minVal = 0.1;
                        maxVal = 0.8;
                }
                
                const stats = indexImage.reduceRegion({
                    reducer: ee.Reducer.percentile([2, 98]),
                    geometry: polygon,
                    scale: 10,
                    maxPixels: 1e9
                });

                stats.evaluate((val, errEval) => {
                    if (errEval) return reject(errEval);

                    const propName = `${indexType}_p2`;
                    const propNameMax = `${indexType}_p98`;
                    const min = (val && val[propName] !== undefined) ? val[propName] : minVal;
                    const max = (val && val[propNameMax] !== undefined) ? val[propNameMax] : maxVal;

                    const palette = [
                        '#d73027', // Rouge (très bas)
                        '#f46d43', // Orange
                        '#fdae61', // Jaune-Orange
                        '#fee08b', // Jaune
                        '#d9ef8b', // Vert-Jaune
                        '#a6d96a', // Vert clair
                        '#66bd63', // Vert moyen
                        '#1a9850'  // Vert foncé
                    ];

                    const visParams = {
                        min: min,
                        max: max,
                        palette: palette
                    };

                    const finalImage = indexImage.resample('bilinear').clip(polygon);

                    finalImage.getMap(visParams, (mapObj, errMap) => {
                        if (errMap) return reject(errMap);
                        if (!mapObj || !mapObj.urlFormat) return reject(new Error("Impossible de générer l'URL de la carte"));
                        resolve(mapObj.urlFormat);
                    });
                });
            });
        } catch (error) {
            reject(error);
        }
    });
};

module.exports = { getNDVITimeSeries, analyzeStress, getLatestSentinelImageDate, getHeatmap };