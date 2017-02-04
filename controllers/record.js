'use strict';

const _ = require('lodash');
const diff = require('object-diff');
const async = require('async');

const Action = require('../lib/action');
const Topic = require('../lib/topic');

const APP_NAME = 'record';


//to convert to (UTC) milliseconds at local start of day
//TODO check date is formatted correctly
function getStartOfDayMilliseconds(date){
  let temp = date.split('-');
  let time = new Date(parseInt(temp[2], 10), parseInt(temp[1], 10) - 1, parseInt(temp[0], 10));
  return time.getTime();
}

module.exports = function(app) {

  app.get('/record', function(req, res, next) {
    let dateToGet;
    if (req.query.date) {
      dateToGet = req.query.date;
    } else {
      let jetzt = new Date();
      dateToGet = jetzt.getDate() + '';
      if (dateToGet.length === 1){
        dateToGet = '0' + dateToGet;
      }
      let temp = jetzt.getMonth() + 1;
      if(temp < 10){
        dateToGet += ('-0' + temp + '-' + (1900 + jetzt.getYear()));
      } else {
        dateToGet += ('-' + temp + '-' + (1900 + jetzt.getYear()));
      }
      //console.log('getting ', dateToGet);
    }

    Action
      .query(dateToGet)
      .loadAll()
      .exec(function(err, actions) {
        if (err) return next(err);
        res.render('record/index', {
          breadcrumbs: [{
              text: 'Records',
            },
          ],
          //_csrf: req.csrfToken(),
          records: actions.Items.map(function(action) {
            return action.attrs;
          }),
          recordsDate: dateToGet,
        });
      });
  });

  app.get('/record/add/:class', function(req, res, next) {
    Topic
      .scan()
      .loadAll()
      .exec(function(err, topics) {
        if (err) return next(err);

        let splitTopics = {
          foods: [],
          insulins: [],
        };

        topics.Items.forEach(function(topic){
          if (topic.attrs){
            if (topic.attrs.class.toLowerCase() === 'food') {
              splitTopics.foods.push(topic.attrs);
            } else if (topic.attrs.class.toLowerCase() === 'insulin') {
              splitTopics.insulins.push(topic.attrs);
            }
          }
        });

        res.render('record/form', {
          //_csrf: req.csrfToken(),
          breadcrumbs: [{
              text: 'Records',
              href: '/record',
            }, {
              text: 'Add a ' + req.params.class,
            },
          ],
          action: {
            class: req.params.class,
          },
          topics: splitTopics,

          location: '/record/update',
          buttonText: 'Add',
          app: APP_NAME,
        });
      });
  });

  app.post('/record/update', function(req, res, next) {
    console.log('req received ', req.body);

    let info = {
      class: req.body.classText,
      quantity: req.body.quantity,
    };

    if (info.class.toLowerCase() === 'meal') {
      // mealCalories: joi.object().keys({
      //     all: joi.number().integer(),
      //     protein: joi.number().integer(),
      //     starch: joi.number().integer(),
      //     veg: joi.number().integer(),
      //     snack: joi.number().integer(),
      // }).optional(),
      // mealFoods: joi.array().items(joi.string()).single().optional(),//id<space>calories
    } else if (info.class.toLowerCase() === 'dosage') {
      let insulin = req.body.insulin.split('|');
      console.log('received insulin ', insulin);
      info.insulinType = insulin[1];
      info.insulinId = insulin[0];
    }

    if (req.body.id) {
      info.date = req.body.originalDate;
      info.time = getStartOfDayMilliseconds(info.date) + (req.body.hour * 3600 + req.body.minute * 60) * 1000;
      info.id = req.body.id;
      Action.get(info.date, info.id, function(err, action) {
        if (err) return next(err);
        if (!action) return next(new Error('No such record found for ' + info.date));
        let changed = diff(action.attrs, info);
        _.forEach(changed, function(value, key) {
          //if (key === '_csrf' || key === 'isOff') return;
          //if (value === '') return;//won't let you blank something that's been populated, just end up with what was previously there
          let updateObj = {};
          updateObj[key] = value;
          action.set(updateObj);
        });

        action.update(function(err) {
          if (err) return next(err);
          res.redirect('/record');
        });
      });
    } else {
      info.date = req.body.date;
      info.time = getStartOfDayMilliseconds(info.date) + (req.body.hour * 3600 + req.body.minute * 60) * 1000;
      let action = new Action(info);

      action.save(function(err) {
        if (err) return next(err);
        res.redirect('/record');
      });
    }
  });

  app.get('/record/edit/:class/:date/:id', function(req, res, next) {

    let actionToPassIn;
    let topicsToPassIn = {
      foods: [],
      insulins: [],
    };

    async.parallel([
      function getTopics(cb) {
        Topic
          .scan()
          .loadAll()
          .exec(function(err, topics) {
            if (err) return next(err);

            topics.Items.forEach(function(topic){
              if (topic.attrs){
                if (topic.attrs.class.toLowerCase() === 'food') {
                  topicsToPassIn.foods.push(topic.attrs);
                } else if (topic.attrs.class.toLowerCase() === 'insulin') {
                  topicsToPassIn.insulins.push(topic.attrs);
                }
              }
            });

            cb();
          });
      },

      function getActions(cb) {
        Action.get(req.params.date, req.params.id, function(err, action) {
          if (err) return cb(err);

          if (!action) return cb(new Error('No record found'));

          actionToPassIn = action.attrs;
          actionToPassIn.class = req.params.class;
          let min = (actionToPassIn.time - getStartOfDayMilliseconds(actionToPassIn.date)) / 60000;
          actionToPassIn.minute = min % 60;
          actionToPassIn.hour = (min - actionToPassIn.minute) / 60;

          cb();
        });
      },
    ], function(err) {
      if (err) return next(err);

      console.log('action passed in ', actionToPassIn);

      res.render('record/form', {
        //_csrf: req.csrfToken(),
        breadcrumbs: [{
            text: 'Records',
            href: '/record',
          }, {
            text: 'Edit a ' + req.params.class,
          },
        ],
        action: actionToPassIn,
        topics: topicsToPassIn,

        location: '/record/update',
        buttonText: 'Update',
        app: APP_NAME,
      });
    });
  });

  app.get('/record/delete/:date/:id', function(req, res, next) {
    Action.destroy(req.params.date, req.params.id, function(err) {
      if (err) return next(err);
      res.redirect('/record');
    });
  });
};
