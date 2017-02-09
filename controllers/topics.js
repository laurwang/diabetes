'use strict';

const _ = require('lodash');
const diff = require('object-diff');
const Topic = require('../lib/topic');

const APP_NAME = 'topics';
const HOME = (process.env.AWS_HOME ? '/' + process.env.AWS_HOME : '') + '/' + APP_NAME;
const FULL_HOME = (process.env.SERVERLESS_STAGE ? '/' + process.env.SERVERLESS_STAGE : '') + HOME;
const NAV_HOME = (process.env.SERVERLESS_STAGE ? '/' + process.env.SERVERLESS_STAGE : '') + '/' + (process.env.AWS_HOME || '');

const DEFAULT = [
  'name',
  'type',
  'unit',
  'calories',
];

module.exports = function(app) {
  app.get(HOME, function(req, res, next) {
    Topic
      .scan()
      .loadAll()
      .exec(function(err, topics) {
        if (err) return next(err);

        let splitTopics = {
          food: [],
          insulin: [],
          reason: [],
        };

        topics.Items.forEach(function(topic){
          if (topic.attrs){
            splitTopics[topic.attrs.class.toLowerCase()].push(topic.attrs);
          }
        });

        res.render('topic', {
          breadcrumbs: [{
              text: 'Choices',
            },
          ],
          //_csrf: req.csrfToken(),
          topics: splitTopics,
          home: FULL_HOME,
          navhome: NAV_HOME,
        });
      });
  });

  app.get(HOME + '/add/:class', function(req, res, next) {
    //console.log('received req query', req.query);
    //initialize so that re-usable form (both add and copy) doesn't freak out

    if (req.query.id) {
      Topic.get(req.query.id, function(err, topic) {
        if (err) return next(err);
        if (!topic || !topic.attrs) return next(new Error('no topic with attributes found'));

        //console.log('topic', topic.attrs);
        res.render('topic/form', {
          breadcrumbs: [{
              text: 'Choices',
              href: FULL_HOME,
            }, {
              text: topic.attrs.class.toLowerCase() === 'insulin' ? 'Add an Insulin' : 'Add a ' + topic.attrs.class,
            },
          ],
          //_csrf: req.csrfToken(),
          topic: topic.attrs,
          location: FULL_HOME + '/add',
          home: FULL_HOME,
          navhome: NAV_HOME,
        });
      });
    } else {
      let topic = {
        class: req.params.class,
      };
      DEFAULT.forEach(function(field) {
        topic[field] = '';
      });

      res.render('topic/form', {
        breadcrumbs: [{
            text: 'Choices',
            href: FULL_HOME,
          }, {
            text: topic.class.toLowerCase() === 'insulin' ? 'Add an Insulin' : 'Add a ' + topic.class,
          },
        ],
        //_csrf: req.csrfToken(),
        topic: topic,
        location: FULL_HOME + '/add',
        home: FULL_HOME,
        navhome: NAV_HOME,
      });
    }
  });

  app.post(HOME + '/add', function(req, res, next) {
    //console.log('req.body', req.body);
    let topic = {
      name: req.body.name,
      type: req.body.type,
      class: req.body.classText,
    };

    if (topic.class.toLowerCase() === 'food') {
      topic.class = 'Food';
      topic.calories = req.body.calories;
      topic.unit = req.body.unit;
    } else if (topic.class.toLowerCase() === 'insulin') {
      topic.class = 'Insulin';
    } else if (topic.class.toLowerCase() === 'reason') {
      topic.class = 'Reason';
    }

    (new Topic(topic)).save(function(err) {
      if (err) return next(err);
      res.redirect(FULL_HOME);
    });
  });

  app.get(HOME + '/onoff/:id', function(req, res, next) {
    Topic.get(req.params.id, function(err, topic) {
      if (err) return next(err);
      if (!topic || !topic.attrs) return next(new Error('No topic with attributes found.'));

      //console.log('previous setting for display: ', topic.attrs.display);//assume nonexistent equals false for isOff
      let updateObj = {
        display: !topic.attrs.display,
      };
      topic.set(updateObj);

      topic.update(function(err) {
        if (err) return next(err);
        res.redirect(FULL_HOME);
      });
    });

    // Topic.destroy(req.params.id, function(err) {
    //   if (err) return next(err);
    //   res.redirect(FULL_HOME);
    // });
  });
};
