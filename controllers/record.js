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

//to convert milliseconds to time of day for a given date
//NB might as well use Date.getHours() and Date.getMinutes()
// function getTimeOfDay(time, date){
//   let min = (time - getStartOfDayMilliseconds(date)) / 60000;
//   let result = {};
//   result.minute = min % 60;
//   result.hour = (min - result.minute) / 60;
//   return result;
// }

//split up topics and weed out one's not to be displayed
//TODO check these are dynamodb-formatted topics
function cleanedTopics(topics) {
  let target = {
    foods: [],
    insulins: [],
  };

  topics.Items.forEach(function(topic){
    if (topic.attrs){
      if (topic.attrs.display) {
        if (topic.attrs.class.toLowerCase() === 'food') {
          target.foods.push(topic.attrs);
        } else if (topic.attrs.class.toLowerCase() === 'insulin') {
          target.insulins.push(topic.attrs);
        }
      }
    }
  });

  return target;
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

        let unsorted = actions.Items.map(function(action) {
          if (action.attrs && action.attrs.time) {
            let time = new Date(action.attrs.time);
            action.attrs.minute = time.getMinutes();
            action.attrs.hour = time.getHours();
          }

          return action.attrs;
        });

        res.render('record/index', {
          breadcrumbs: [{
              text: 'Records',
              href: '/record',
            },
          ],
          //_csrf: req.csrfToken(),
          records: unsorted.sort(function(a, b) {
            return a.time - b.time;
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
          topics: cleanedTopics(topics),

          location: '/record/update',
          buttonText: 'Add',
          app: APP_NAME,
        });
      });
  });

  app.post('/record/update', function(req, res, next) {
    //console.log('req received ', req.body);

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
    let topicsToPassIn;

    async.parallel([
      function getTopics(cb) {
        Topic
          .scan()
          .loadAll()
          .exec(function(err, topics) {
            if (err) return next(err);

            topicsToPassIn = cleanedTopics(topics);

            cb();
          });
      },

      function getAction(cb) {
        Action.get(req.params.date, req.params.id, function(err, action) {
          if (err) return cb(err);

          if (!action) return cb(new Error('No record found'));

          actionToPassIn = action.attrs;
          actionToPassIn.class = req.params.class;
          let time = new Date(actionToPassIn.time);
          actionToPassIn.minute = time.getMinutes();
          actionToPassIn.hour = time.getHours();

          cb();
        });
      },
    ], function(err) {
      if (err) return next(err);

      //console.log('action passed in ', actionToPassIn);

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
