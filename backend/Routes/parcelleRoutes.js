const express = require('express');
const router = express.Router();
const parcelleCtrl = require('../controller/parcelleController');

router.post('/', parcelleCtrl.createParcelle);
router.get('/', parcelleCtrl.getAllParcelles);
router.get('/compare', parcelleCtrl.compareParcellesSeries);
router.get('/farmer/:farmerId', parcelleCtrl.getFarmerParcelles);
router.get('/:id', parcelleCtrl.getParcelleDetails);
router.get('/:id/serie-temporelle', parcelleCtrl.getParcelleTimeSeries);
router.get('/:id/meteo', parcelleCtrl.getParcelleWeather);
router.get('/:id/heatmap', parcelleCtrl.getParcelleHeatmap);
router.post('/:id/analyze-stress', parcelleCtrl.analyzeParcelleStress);
router.put('/:id', parcelleCtrl.updateParcelle);
router.delete('/:id', parcelleCtrl.deleteParcelle);

module.exports = router;