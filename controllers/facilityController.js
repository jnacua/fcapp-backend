const Facility = require('../models/facilityModel');

exports.getAll = async (req, res) => {
  res.json(await Facility.find());
};

exports.create = async (req, res) => {
  const facility = new Facility(req.body);
  res.status(201).json(await facility.save());
};
