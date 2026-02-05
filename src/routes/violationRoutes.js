// routes/violationRoutes.js - Violation API endpoints
const express = require('express');
const router = express.Router();
const Violation = require('../models/Violation');

// Get all violations
router.get('/', async (req, res) => {
  try {
    const { limit = 100, page = 1, type, severity, acknowledged } = req.query;
    const skip = (page - 1) * limit;
    
    const filter = {};
    if (type) filter.type = type;
    if (severity) filter.severity = severity;
    if (acknowledged !== undefined) filter.acknowledged = acknowledged === 'true';
    
    const violations = await Violation.find(filter)
      .sort({ timestamp: -1 })
      .skip(skip)
      .limit(parseInt(limit))
      .populate('vehicleId', 'name licensePlate');
    
    const total = await Violation.countDocuments(filter);
    
    res.json({
      success: true,
      violations,
      total,
      page: parseInt(page),
      limit: parseInt(limit),
      totalPages: Math.ceil(total / limit)
    });
  } catch (error) {
    console.error('Error fetching violations:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get violations by vehicle
router.get('/vehicle/:vehicleId', async (req, res) => {
  try {
    const { vehicleId } = req.params;
    const { limit = 50, days = 7 } = req.query;
    
    const dateFilter = new Date();
    dateFilter.setDate(dateFilter.getDate() - parseInt(days));
    
    const violations = await Violation.find({
      vehicleId,
      timestamp: { $gte: dateFilter }
    })
    .sort({ timestamp: -1 })
    .limit(parseInt(limit))
    .populate('vehicleId', 'name licensePlate');
    
    res.json({
      success: true,
      violations,
      count: violations.length,
      vehicleId
    });
  } catch (error) {
    console.error('Error fetching vehicle violations:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get violation by ID
router.get('/:id', async (req, res) => {
  try {
    const violation = await Violation.findById(req.params.id)
      .populate('vehicleId', 'name licensePlate');
    
    if (!violation) {
      return res.status(404).json({ success: false, error: 'Violation not found' });
    }
    
    res.json({ success: true, violation });
  } catch (error) {
    console.error('Error fetching violation:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Acknowledge violation
router.put('/:id/acknowledge', async (req, res) => {
  try {
    const violation = await Violation.findByIdAndUpdate(
      req.params.id,
      { acknowledged: true, acknowledgedBy: req.user?.id, acknowledgedAt: new Date() },
      { new: true }
    );
    
    if (!violation) {
      return res.status(404).json({ success: false, error: 'Violation not found' });
    }
    
    // Emit acknowledgment via socket
    if (req.io) {
      req.io.emit('violation:acknowledged', {
        violationId: violation._id,
        vehicleId: violation.vehicleId,
        acknowledgedBy: req.user?.id,
        timestamp: new Date()
      });
    }
    
    res.json({ success: true, violation });
  } catch (error) {
    console.error('Error acknowledging violation:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Create violation (for testing/simulator)
router.post('/', async (req, res) => {
  try {
    const violationData = req.body;
    
    // Ensure required fields
    if (!violationData.vehicleId || !violationData.type) {
      return res.status(400).json({
        success: false,
        error: 'vehicleId and type are required'
      });
    }
    
    const violation = new Violation({
      ...violationData,
      timestamp: violationData.timestamp || new Date()
    });
    
    await violation.save();
    
    // Populate vehicle info
    await violation.populate('vehicleId', 'name licensePlate');
    
    // Emit via socket
    if (req.io) {
      req.io.emit('violation:detected', violation.toObject());
    }
    
    res.status(201).json({ success: true, violation });
  } catch (error) {
    console.error('Error creating violation:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Delete violation
router.delete('/:id', async (req, res) => {
  try {
    const violation = await Violation.findByIdAndDelete(req.params.id);
    
    if (!violation) {
      return res.status(404).json({ success: false, error: 'Violation not found' });
    }
    
    res.json({ success: true, message: 'Violation deleted' });
  } catch (error) {
    console.error('Error deleting violation:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get violation statistics
router.get('/stats/summary', async (req, res) => {
  try {
    const { days = 30 } = req.query;
    const dateFilter = new Date();
    dateFilter.setDate(dateFilter.getDate() - parseInt(days));
    
    const stats = await Violation.aggregate([
      {
        $match: {
          timestamp: { $gte: dateFilter }
        }
      },
      {
        $group: {
          _id: {
            type: '$type',
            severity: '$severity'
          },
          count: { $sum: 1 },
          acknowledged: {
            $sum: { $cond: ['$acknowledged', 1, 0] }
          }
        }
      },
      {
        $group: {
          _id: '$_id.type',
          total: { $sum: '$count' },
          severities: {
            $push: {
              severity: '$_id.severity',
              count: '$count',
              acknowledged: '$acknowledged'
            }
          }
        }
      }
    ]);
    
    const totalViolations = await Violation.countDocuments({
      timestamp: { $gte: dateFilter }
    });
    
    const acknowledgedCount = await Violation.countDocuments({
      timestamp: { $gte: dateFilter },
      acknowledged: true
    });
    
    res.json({
      success: true,
      stats,
      summary: {
        total: totalViolations,
        acknowledged: acknowledgedCount,
        pending: totalViolations - acknowledgedCount,
        days: parseInt(days)
      }
    });
  } catch (error) {
    console.error('Error fetching violation stats:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;