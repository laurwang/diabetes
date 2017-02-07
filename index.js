'use strict';

const start = Date.now();

// External modules
const http = require('http');
const express = require('express');
const bodyParser = require('body-parser');
const cookieParser = require('cookie-parser');
const compression = require('compression');
//const csrf = require('csurf');
const controllers = require('./controllers');
const app = express();

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

// app.use(function csrfProxy(req, res, next) {
//   // // Make env available to views
//   // res.locals.NODE_ENV = ENV;

//   // if (/\/api\/|knowledge/.test(req.url) || req.url === '/preferences') return next();

//   csrf({ cookie: true })(req, res, next);
// });

// Init all the controllers
console.log('Before controller require', Date.now() - start, 'ms have elapsed');
controllers(app);
console.log('After controller require', Date.now() - start, 'ms have elapsed');

// Error handling response
app.use(function(err, req, res, next) {
  if (!res.headersSent && err.statusCode) res.status(err.statusCode);

  // Custom CSRF error messaging
  //if (err.code === 'EBADCSRFTOKEN') err.message = 'Invalid CSRF token, please go back and try your request again.';

  res.render('errors/error', { disableNav: true, error: err });
});

app.use(function(req, res, next) {
  res.status(404).render('errors/404');
});
