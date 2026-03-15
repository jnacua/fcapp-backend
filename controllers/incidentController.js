const Incident = require('../models/incidentModel');

exports.getAll = async (req, res) => {
  res.json(await Incident.find());
};

exports.create = async (req, res) => {
  const incident = new Incident(req.body);
  res.status(201).json(await incident.save());
};
