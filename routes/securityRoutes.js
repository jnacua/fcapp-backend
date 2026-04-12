const express = require('express');
const router = express.Router();
const securityController = require('../controllers/securityController');

router.post('/submit-scan', securityController.submitScan);
router.get('/latest-scan', securityController.getLatestScan);
router.post('/clear-scan', securityController.clearScan);

module.exports = router; 
