'use strict';

const APP_NAME = 'homepage';
const HOME = '/' + (process.env.AWS_HOME || '');
console.log('home ', HOME);

module.exports = function(app) {

  // app.get(HOME + '/login', function(req, res, next) {
  //   res.redirect(HOME);
  // });

  // app.get(HOME + '/logout', function(req, res, next) {
  //   res.redirect(HOME);
  // });

  /**
   * Route hit by the ELB to determine instance state.
   *
   * Only a static response for now, in the future should check system state.
   */
  app.get(HOME + '/health', function(req, res) {
    return res.json({
      ready: true,
    });
  });

  // Launcher -----------------
  app.get(HOME, function(req, res, next) {
    res.render('index', {
      home: (process.env.SERVERLESS_STAGE ? '/' + process.env.SERVERLESS_STAGE : '') + (process.env.AWS_HOME ? '/' + process.env.AWS_HOME : ''),
      navhome: (process.env.SERVERLESS_STAGE ? '/' + process.env.SERVERLESS_STAGE : '') + HOME,
    });
  });

};
