'use strict';

const APP_NAME = 'homepage';

module.exports = function(app) {

  app.get('/login', function(req, res, next) {
    res.redirect('/');
  });

  app.get('/logout', function(req, res, next) {
    res.redirect('/');
  });

  /**
   * Route hit by the ELB to determine instance state.
   *
   * Only a static response for now, in the future should check system state.
   */
  app.get('/health', function(req, res) {
    return res.json({
      ready: true,
    });
  });

  // Launcher -----------------
  app.get('/', function(req, res, next) {
    res.render('index', {
    });
  });

};
