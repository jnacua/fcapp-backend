const Forum = require('../models/forumModel');

exports.getAll = async (req, res) => {
  res.json(await Forum.find());
};

exports.create = async (req, res) => {
  const post = new Forum(req.body);
  res.status(201).json(await post.save());
};
