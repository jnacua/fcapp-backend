const Panic = require('../models/panicModel');

exports.getAll = async (req, res) => {
  res.json(await Panic.find());
};

exports.create = async (req, res) => {
  const panic = new Panic(req.body);
  res.status(201).json(await panic.save());
};
