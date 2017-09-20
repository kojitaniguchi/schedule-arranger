'use strict'
const Sequelize = require('sequelize');
//DB接続の
require('dotenv').config();
var DB_CONNECTION = process.env.DB_CONNECTION

const sequelize = new Sequelize(
  DB_CONNECTION,
  { logging: true });

module.exports = {
  database: sequelize,
  Sequelize: Sequelize
}
