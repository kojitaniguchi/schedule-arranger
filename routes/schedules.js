'use strict'
const express = require('express');
const router = express.Router();
const authenticationEnsure = require('./authentication-ensurer');

router.get('/new', authenticationEnsure, (req, res, next) => {
  res.render('new', { user: req.user });
});

router.post('/', authenticationEnsure, (req, res, next) => {
  console.log(req.body);
  res.redirect('/');
});

module.exports = router;
