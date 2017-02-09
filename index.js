'use strict';

const start = Date.now();

// External modules
const http = require('http');
const express = require('express');
const bodyParser = require('body-parser');
//const csrf = require('csurf');
const controllers = require('./controllers');
const app = express();

app.set('view engine', 'jade');
app.set('views', __dirname + '/views');

app.use(bodyParser.json()); // support json encoded bodies
app.use(bodyParser.urlencoded({ extended: true }));

//TO RUN LOCALLY comment out following two lines
const awsServerlessExpressMiddleware = require('aws-serverless-express/middleware');
app.use(awsServerlessExpressMiddleware.eventContext());

//app.use('/public', express.static(__dirname + '/public'));//NB changed nav.jade files to get imgs from S3
app.use('/node_modules', express.static(__dirname + '/node_modules'));

// app.use(function csrfProxy(req, res, next) {
//   // // Make env available to views
//   // res.locals.NODE_ENV = ENV;

//   // if (/\/api\/|knowledge/.test(req.url) || req.url === '/preferences') return next();

//   csrf({ cookie: true })(req, res, next);
// });

// Init all the controllers BEFORE error handling; somehow this doesn't seem to be hapening correctly on AWS
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

//TO RUN LOCALLY uncomment following five lines
// const server = http.createServer(app).listen(8079);
// server.on('error', function(e) {
//   console.error('server error', e);
// });
// console.log('Listening', Date.now() - start, 'ms have elapsed');

module.exports = app;
