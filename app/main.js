var express = require('express')
  , RedisStore = require('connect-redis')(express)
  , cors = require('cors')
  , config = require('config')
  , mongoose = require('mongoose')
  , _ = require('underscore')
  , logger = require('winston')
  , resources = require('./modules/resources')
  , accounts = require('./modules/accounts')
  , stylus = require('stylus')
  , passport = require("passport")
  , store = require("./modules/cn-store-js");


var setupDB = function() {
  mongoose.connect(config.dbURI); 
  var db = mongoose.connection;
  
  db.on('error', function(err) { 
    if(err) logger.error('crisisnet.main.setupDB mongo connect error ' + err);
  });

  return db;
};

/**
 * Passport is the authencation framework used through the application. Sessions 
 * are required for complex auth workflows (like OAuth), so we need to tell 
 * passport how users should be identified in the session (`serializeUser`) and 
 * how the user will be retrieved from the application and provided to the 
 * route callback as a property of the passed `req` argument. (`deserializeUser`)
 *
 * Note that an authenticated user will available at `req.user` in the route
 * callback. If that property isn't available, then you're dealing with an 
 * anonymous user.
 */
var setupPassport = function() {
  passport.serializeUser(function(user, done) {
      done(null, user.id);
  });

  passport.deserializeUser(function(userID, done) {
      store.User.findOne({_id: userID}, function(err, user) {
        done(null, user);
      });
  });
};


/**
 * Entry point for the application.
 */
var start = function(db) {
  var app = express();
  var corsOptions = {
    headers: ['Content-Type',]
  };

  /**
   * Server configuration
   */

  // Required for authencation module to function properly
  setupPassport();

  // Session support. This is required for OAuth
  app.use(express.cookieParser());
  app.use(express.session({
    secret: config.sessionSecret,
    store: new RedisStore({
      secret: config.sessionSecret
    })
  }));
  app.use(passport.initialize());
  app.use(passport.session());

  
  // Static assets
  app.use(stylus.middleware({
      debug: true
    , src: __dirname + '/static/stylus/'
    , dest: __dirname + '/static/css/'
    , compile: function(str) {
      return stylus(str).set('compress', true);
    }
  }));
  app.use(express.static(__dirname + '/static'));

  // Parse body for post requests
  app.use(express.bodyParser());
  
  // Allow cross-site requests using CORS protocol
  app.use(cors(corsOptions)); 
  
  // Request routing!
  // app.use(app.router);
  
  // Templates
  app.set('views', __dirname + '/views');
  app.set('view engine', 'html');  
  app.set('layout', 'layout');
  app.set('partials', {});
  app.engine('html', require('hogan-express'));
  if(process.env.NODE_ENV === "production") {
    app.enable('view cache');
  }

  /**
   * Application bootstrapping
   */

  // Setup routes
  resources.item.setupRoutes(app, "item");
  accounts.auth.setupRoutes(app, "auth");
  accounts.profile.setupRoutes(app, "profile");


  // ...and we're off.
  app.listen(8083);
};

logger.info('crisisnet listening on port 8083 with env='+process.env.NODE_ENV);

var db = setupDB();
db.once('open', start);