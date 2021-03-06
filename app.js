//default
var express = require('express')
var path = require('path')
var favicon = require('serve-favicon')
var logger = require('morgan')
var cookieParser = require('cookie-parser')
var bodyParser = require('body-parser')
//
var helmet = require('helmet')
//
var session = require('express-session')
var passport = require('passport')

// モデルの読み込み-------------------------------------------------------------
var User = require('./models/user')
var Schedule = require('./models/schedule')
var Availability = require('./models/availability')
var Candidate = require('./models/candidate')
var Comment = require('./models/comment')
User.sync().then(() => {
  Schedule.belongsTo(User, {foreignKey: 'createdBy'})
  Schedule.sync()
  Comment.belongsTo(User, {foreignKey: 'userId'})
  Comment.sync()
  Availability.belongsTo(User, {foreignKey: 'userId'})
  Candidate.sync().then(() => {
    Availability.belongsTo(Candidate, {foreignKey: 'candidateId'})
    Availability.sync()
  })
})

//passport関連----
passport.serializeUser(function (user, done) {
  done(null, user)
})

passport.deserializeUser(function (obj, done) {
  done(null, obj)
})

// middleewar-------------------------------------------------------------------
var app = express()
app.use(helmet())

// view engine setup
app.set('views', path.join(__dirname, 'views'))
app.set('view engine', 'jade')

// uncomment after placing your favicon in /public
//app.use(favicon(path.join(__dirname, 'public', 'favicon.ico')))
app.use(logger('dev'))
app.use(bodyParser.json())
app.use(bodyParser.urlencoded({ extended: false }))
app.use(cookieParser())
app.use(express.static(path.join(__dirname, 'public')))

//session管理
app.use(session({ secret: SESSION_SECRET, resave: false, saveUninitialized: false }))
app.use(passport.initialize())
app.use(passport.session())

//router modules----------------------------------------------------------------
const routes = require('./routes/index')
const login = require('./routes/login')
const logout = require('./routes/logout')
const schedules = require('./routes/schedules')
const availabilities = require('./routes/availabilities')
const comments = require('./routes/comments')

app.use('/', routes)
app.use('/login', login)
app.use('/logout', logout)
app.use('/schedules', schedules)
app.use('/schedules', availabilities)
app.use('/schedules', comments)

//githubu認証-------------------------------------------------------------------
var GitHubStrategy = require('passport-github2').Strategy
//設定を.envからロード
require('dotenv').config()
var GITHUB_CLIENT_ID = process.env.GITHUB_CLIENT_ID
var GITHUB_CLIENT_SECRET = process.env.GITHUB_CLIENT_SECRET
var SESSION_SECRET = process.env.SESSION_SECRET

passport.use(new GitHubStrategy({
  clientID: GITHUB_CLIENT_ID,
  clientSecret: GITHUB_CLIENT_SECRET ,
  callbackURL: 'http://localhost:8000/auth/github/callback'
},
  function (accessToken, refreshToken, profile, done) {
    process.nextTick(function () {
      User.upsert({
        userId: profile.id,
        username: profile.username
      }).then(() => {
        done(null, profile)
      })
    })
  }
))

app.get('/auth/github',
  passport.authenticate('github', { scope:['user:email'] }),
  function (req, res) {
})
app.get('/auth/github/callback',
  passport.authenticate('github', { failureRedirect: '/login' }),
  function (req, res) {
    var loginFrom = req.cookies.loginFrom
    if (loginFrom &&
    loginFrom.indexOf('http://') < 0 &&
    loginFrom.indexOf('https://') < 0 ) {
      res.clearCookie('loginFrom')
      res.redirect(loginFrom)
    } else {
      res.redirect('/')
    }
  })

// catch 404 and forward to error handler---------------------------------------
app.use(function(req, res, next) {
  var err = new Error('Not Found')
  err.status = 404
  next(err)
})


if (app.get('env') === 'development') {
  app.use(function(err, req, res, next) {
    res.status(err.status || 500)
    res.render('error', {
      message: err.message,
      error: err
    })
  })
}

// production error handler
// no stacktraces leaked to user
app.use(function(err, req, res, next) {
  res.status(err.status || 500)
  res.render('error', {
    message: err.message,
    error: {}
  })
})


module.exports = app
