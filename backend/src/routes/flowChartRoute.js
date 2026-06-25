const express = require('express');
const router = express.Router();
const flowchartController = require('../controllers/flowChartCont');
const { optionalAuthenticate } = require('../middlewares/authMiddleware');

router.post('/generate', optionalAuthenticate, flowchartController.createFlowchart);

module.exports = router;
