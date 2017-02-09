'use strict';

const _ = require('lodash');
const diff = require('object-diff');
const async = require('async');

const Action = require('../lib/action');
const Topic = require('../lib/topic');

const APP_NAME = 'record';
const HOME = (process.env.AWS_HOME ? '/' + process.env.AWS_HOME : '') + '/' + APP_NAME;
const FULL_HOME = (process.env.SERVERLESS_STAGE ? '/' + process.env.SERVERLESS_STAGE : '') + HOME;
const NAV_HOME = (process.env.SERVERLESS_STAGE ? '/' + process.env.SERVERLESS_STAGE : '') + '/' + (process.env.AWS_HOME || '');
const OFFSET = process.env.OFFSET ? parseInt(process.env.OFFSET, 10) : 0;
// const ADJ_DISPLAY = 24 + OFFSET;
const ADJ_ENTRY = -OFFSET * 60 * 60 * 1000;

const MEALS = [
  {
    id: 'id-breakfast',
    type: 'breakfast',
    name: 'Breakfast',
  },
  {
    id: 'id-lunch',
    type: 'lunch',
    name: 'Lunch',
  },
  {
    id: 'id-dinner',
    type: 'dinner',
    name: 'Dinner',
  },
   {
    id: 'id-snack',
    type: 'snack',
    name: 'Snack',
  },
];

//to convert to (UTC) milliseconds at local start of day
//NB the aws servers for us-east-1 appear to be on utc (so the offset is going to be messed up for older data with a hard-coded adjust of -8)
function getStartOfDayMilliseconds(date){
  let temp = date.split('-');
  let time = new Date(parseInt(temp[2], 10), parseInt(temp[1], 10) - 1, parseInt(temp[0], 10));//start of the date for server
  return time.getTime();//start of day for someone, don't care who, as long as is consistent for the day, in terms of generating a time field for sorting
          // + ADJ_ENTRY;//start of the day for user
}

// function getTimeOfDay(millis) {
//   let time = new Date(millis);//expressed as hours and minutes for the server
//   let result = {};
//   result.minute = time.getMinutes();
//   result.hour = (ADJ_DISPLAY + time.getHours()) % 24;//adjust hour for the user
//   if (result.minute < 10) {
//     result.minute = '0' + result.minute;
//   }
//   return result;
// }

//to convert milliseconds to time of day for a given date, basically same thing as the date getters (without rounding checks)
//get weirdness based on what is the utc of the server's start of day, as this depends where the server is, so the hours get messed up
// function getTimeOfDay(time, date){
//   let min = (time - getStartOfDayMilliseconds(date)) / 60000;
//   let result = {};
//   result.minute = min % 60;
//   result.hour = (min - result.minute) / 60;
//   if (result.minute < 10) {
//     result.minute = '0' + result.minute;
//   }
//   return result;
// }

function makeNice(timePart){
  if (!timePart) {
    return '00';
  }
  return (timePart < 10 ?  '0' : '') + timePart;
}

//split up topics and weed out one's not to be displayed
//TODO check these are dynamodb-formatted topics
function cleanedTopics(topics) {
  let target = {
    food: [],
    insulin: [],
    reason: [],
    meal: MEALS,
  };

  topics.Items.forEach(function(topic){
    if (topic.attrs && topic.attrs.display) {
      target[topic.attrs.class.toLowerCase()].push(topic.attrs);
    }
  });

  return target;
}

function typeForRecordClass(classText) {
  classText = classText.toLowerCase();
  if (classText === 'dosage') {
    return 'Insulin';
  } else if (classText === 'reading') {
    return 'Reason';
  } else if (classText === 'meal') {
    return 'Meal';
  } else {
    return '';
  }
}

function appendMealInfo(info, eatenThings, amounts){
  info.quantity = 0;
  info.mealCalories = {
    protein: 0,
    starch: 0,
    veg: 0,
    treat: 0,
  };
  info.mealFoods = [];

  eatenThings.forEach(function(thing, index){
    let unitsEaten = amounts[index];
    if (unitsEaten > 0) {
      let eatenThing = thing.split('|');//TOD0 check data format expected: [type, id, calories per unit]
      let totalCal = Math.round(eatenThing[2] * unitsEaten);
      info.mealCalories[eatenThing[0]] = info.mealCalories[eatenThing[0]] + totalCal;
      info.mealFoods.push(eatenThing[1] + '|' + unitsEaten + '|' + totalCal);
      info.quantity += totalCal;
    }
  });
}

module.exports = function(app) {

  app.get(HOME, function(req, res, next) {
    let dateToGet;
    if (req.query.date) {
      dateToGet = req.query.date;
    } else {
      //need to adjust server time back to user time to get today's date
      //NB jetzt is completely bogus for time purposes--it's just to get the date roughly correct for the user
      //during the 7/8 hour gap a couple of times a year, may end up suggesting the wrong date to display for an hour,
      //but so what?  it's manually changeable anyway.
      let jetzt = new Date((new Date()).getTime() - ADJ_ENTRY);
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
          if (action.attrs) {
            action.attrs.minute = makeNice(action.attrs.minute);
            action.attrs.hour = makeNice(action.attrs.hour);
          }

          return action.attrs;
        });

        res.render('record/index', {
          breadcrumbs: [{
              text: 'Records',
              href: FULL_HOME,
            },
          ],
          //_csrf: req.csrfToken(),
          records: unsorted.sort(function(a, b) {
            return a.time - b.time;
          }),
          recordsDate: dateToGet,
          home: FULL_HOME,
          navhome: NAV_HOME,
        });
      });
  });

  app.get(HOME + '/add/:class', function(req, res, next) {
    Topic
      .scan()
      .loadAll()
      .exec(function(err, topics) {
        if (err) return next(err);

        res.render('record/form', {
          //_csrf: req.csrfToken(),
          breadcrumbs: [{
              text: 'Records',
              href: FULL_HOME,
            }, {
              text: 'Add a ' + req.params.class,
            },
          ],
          action: {
            class: req.params.class,
            foods: [
              {},
            ],
          },
          topics: cleanedTopics(topics),

          location: FULL_HOME + '/update',
          buttonText: 'Add',
          typeText: typeForRecordClass(req.params.class),
          home: FULL_HOME,
          navhome: NAV_HOME,
          app: APP_NAME,
        });
      });
  });

  app.post(HOME + '/update', function(req, res, next) {
    //console.log('req received ', req.body);

    let info = {
      class: req.body.classText,
      quantity: req.body.quantity,
      hour: parseInt(req.body.hour, 10),
      minute: parseInt(req.body.minute, 10),
    };

    let recordType = typeForRecordClass(info.class);
    let topic = req.body[recordType].split('|');
    //console.log('received topic ', topic);
    info.type = topic[1];
    info.topicId = topic[0];

    if (info.class.toLowerCase() === 'meal') {
      appendMealInfo(info, req.body.eaten, req.body.unitsEaten);
    }

    if (req.body.id) {
      info.date = req.body.originalDate;
      info.time = getStartOfDayMilliseconds(info.date) + (info.hour * 3600 + info.minute * 60) * 1000;
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
          res.redirect(FULL_HOME);
        });
      });
    } else {
      info.date = req.body.date;
      info.time = getStartOfDayMilliseconds(info.date) + (info.hour * 3600 + info.minute * 60) * 1000;

      let action = new Action(info);

      action.save(function(err) {
        if (err) return next(err);
        res.redirect(FULL_HOME);
      });
    }
  });

  app.get(HOME + '/edit/:class/:date/:id', function(req, res, next) {

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
          actionToPassIn.minute = makeNice(actionToPassIn.minute);
          actionToPassIn.hour = makeNice(actionToPassIn.hour);

          if (actionToPassIn.class.toLowerCase() === 'meal') {
            actionToPassIn.foods = actionToPassIn.mealFoods.map(function(food){
              let temp = food.split('|');
              return {
                id: temp[0],
                units: parseFloat(temp[1]),
                calories: parseInt(temp[2], 10),
              };
            });
            delete actionToPassIn.mealFoods;
            delete actionToPassIn.mealCalories;
          } else {
            actionToPassIn.foods = [
              {},
            ];
          }

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
            href: FULL_HOME,
          }, {
            text: 'Edit a ' + req.params.class,
          },
        ],
        action: actionToPassIn,
        topics: topicsToPassIn,

        location: FULL_HOME + '/update',
        buttonText: 'Update',
        typeText: typeForRecordClass(req.params.class),
        home: FULL_HOME,
        navhome: NAV_HOME,
        app: APP_NAME,
      });
    });
  });

  app.get(HOME + '/delete/:date/:id', function(req, res, next) {
    Action.destroy(req.params.date, req.params.id, function(err) {
      if (err) return next(err);
      res.redirect(FULL_HOME);
    });
  });
};
