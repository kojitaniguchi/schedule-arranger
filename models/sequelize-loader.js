'use strict'
const Sequelize = require('Sequelize');
const sequelize = new Sequelize(
  'postgres://postgres:postgres@localhost/schedule_arranger',
  { logging: true });

module.exports = {
  database: sequelize,
  Sequelize: Sequelize
}
