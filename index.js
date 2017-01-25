'use strict';

const start = Date.now();

//global.pi = {};

//const ENV = process.env.NODE_ENV || 'development';

// External modules
//const fs = require('fs');
const http = require('http');
//const https = require('https');
const express = require('express');
const bodyParser = require('body-parser');
const cookieParser = require('cookie-parser');
const compression = require('compression');
const csrf = require('csurf');
//const favicon = require('serve-favicon');
const controllers = require('./controllers');
//const logger = require('./logging');
const app = express();
//const mm = require('./lib/metrics-monkey');
//const os = require('os');
//const pjson = require('./package.json');

const server = http.createServer(app).listen(8079);

server.on('error', function(e) {
  console.error('server error', e);
});

console.log('Listening', Date.now() - start, 'ms have elapsed');

app.set('view engine', 'jade');
app.set('views', __dirname + '/views');

app.use(cookieParser());
app.use(bodyParser.json()); // support json encoded bodies
app.use(bodyParser.urlencoded({ extended: true }));

app.use(compression());
app.use('/public', express.static(__dirname + '/public'));
app.use('/node_modules', express.static(__dirname + '/node_modules'));
//app.use(favicon(__dirname + '/public/favicon.ico'));

//logger.start(app);

// app.use(function(req, res, next) {
//   if (req.get('Host').indexOf('documentation.pointinside.com') >= 0) {
//     res.redirect(301, 'https://apps.pointinside.com/developers');
//     return;
//   }

//   next();
// });

app.use(function csrfProxy(req, res, next) {
  // // Make env available to views
  // res.locals.NODE_ENV = ENV;

  // if (/\/api\/|knowledge/.test(req.url) || req.url === '/preferences') return next();

  csrf({ cookie: true })(req, res, next);
});

// //make csrf integrated with client angular seamlessly
// app.use(function setCSURF(req, res, next) {
//   if (typeof req.csrfToken === 'function') {
//     res.cookie('XSRF-TOKEN', req.csrfToken());
//   }

//   next();
// });

/**
 * Load Internal modules/apps
 */

// // Modules we want to be using a single instance of when instantiating new modules
// var loaded = { app: app, logger: logger };

// if (!global.pi.internalApps) global.pi.internalApps = {};

// // Iterate over each installed internal module
// var internalModulePath = __dirname + '/internal_modules/';
// var internalModules = fs.readdirSync(internalModulePath);

// console.log('Start to require modules', Date.now() - start, 'ms have elapsed');
// internalModules.forEach(function(file) {
//   if (file.indexOf('.') === 0) return;
//   if (file.indexOf('.js') > -1) file = file.replace(/.js$/, '');

//   let moduleStart = Date.now();
//   global.pi.internalApps[file] = require(internalModulePath + file)(loaded);
//   console.log('\trequired', file, 'in', Date.now() - moduleStart, 'ms');
// });

// Init all the controllers
console.log('Before controller require', Date.now() - start, 'ms have elapsed');
controllers(app);
console.log('After controller require', Date.now() - start, 'ms have elapsed');

// // Log server start to Metrics Monkey

// mm.log({
//   partnerName: 'PointInside',
//   applicationType: 'webapps',
//   resourceType: 'webAppServer',
//   resourceName: ENV,
//   event: 'started',
//   value: {hostname: os.hostname(), version: pjson.version},
// });

// logger.errors(app);

// Error handling response
app.use(function(err, req, res, next) {
  if (!res.headersSent && err.statusCode) res.status(err.statusCode);

  // Custom CSRF error messaging
  if (err.code === 'EBADCSRFTOKEN') err.message = 'Invalid CSRF token, please go back and try your request again.';

  res.render('errors/error', { disableNav: true, error: err });
});

app.use(function(req, res, next) {
  res.status(404).render('errors/404');
});
