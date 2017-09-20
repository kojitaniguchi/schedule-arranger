'use strict'
const Sequelize = require('sequelize');
//DB接続のロード
//DB_CONNECTION="postgres://username:postgres@localhost/databasename"
require('dotenv').config();
var DB_CONNECTION = process.env.DB_CONNECTION

const sequelize = new Sequelize(
  DB_CONNECTION,
  { logging: true });

module.exports = {
  database: sequelize,
  Sequelize: Sequelize
}
