'use strict';

const _ = require('lodash');
const diff = require('object-diff');
//const piAuth = require('@pi/auth');
const Topic = require('../lib/topic');
//const knowledge = require('../lib/knowledge');

const APP_NAME = 'topics';

const DEFAULT = [
  'name',
  'type',
  'unit',
];

module.exports = function(app) {
  //app.use('/topics', piAuth.authz);

  app.get('/topics', function(req, res, next) {
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

        res.render('topic', {
          breadcrumbs: [{
              text: 'Topics',
            },
          ],
          //_csrf: req.csrfToken(),
          topics: splitTopics,
        });
      });
  });

  app.get('/topics/addFood', function(req, res, next) {

    //initialize so that re-usable form (both add and copy) doesn't freak out
    let topic = {};

    if (req.query.topic) {
      topic = req.query.topic;
    } else {
      DEFAULT.forEach(function(field) {
        topic[field] = '';
      });
      topic.class = 'Food';
      topic.calories = 0;
    }

    res.render('topic/form', {
      breadcrumbs: [{
          text: 'Topics',
          href: '/topics',
        }, {
          text: 'Add Food',
        },
      ],
      //_csrf: req.csrfToken(),
      topic: topic,
      location: '/topics/addFood',
      actionText: 'Add',
    });
  });

  app.post('/topics/add', function(req, res, next) {
    let topic = new Topic({
      name: req.body.name,
      type: req.body.type,
      unit: req.body.unit,
      class: 'Insulin',
    });

    if (req.body.class.toLowerCase() === 'food') {
      topic.class = 'Food';
      topic.calories = req.body.calories;
    }

    topic.save(function(err) {
      if (err) return next(err);
      res.redirect('/topics');
    });
  });

  app.get('/topics/onoff/:id', function(req, res, next) {
    Topic.get(req.params.id, function(err, topic) {
      if (err) return next(err);
      if (!topic || !topic.attrs) return next(new Error('No topic with attributes found.'));

      console.log('previous setting for display: ', topic.attrs.display);//assume nonexistent equals false for isOff
      let updateObj = {
        display: !topic.attrs.display,
      };
      topic.set(updateObj);

      topic.update(function(err) {
        if (err) return next(err);
        res.redirect('/topics');
      });
    });

    // Topic.destroy(req.params.id, function(err) {
    //   if (err) return next(err);
    //   res.redirect('/topics');
    // });
  });

  app.get('/topics/copy/:id', function(req, res, next) {
    Topic.get(req.params.id, function(err, topic) {
      if (err) return next(err);
      if (!topic || !topic.attrs) return next(new Error('no topic with attributes found'));

      if (topic.attrs.class.toLowerCase() === 'food'){
        req.query.topic = topic.attrs;
        res.redirect('/topics/addFood');
      }


      // res.render('topic/form', {
      //   breadcrumbs: [{
      //       text: 'Topics',
      //       href: '/topics',
      //     }, {
      //       text: 'Add Food',
      //     },
      //   ],
      //   //_csrf: req.csrfToken(),
      //   topic: topic.attrs,
      //   location: '/topics/addFood',
      //   actionText: 'Add',
      // });
    });
  });

//TODO turn into add, if applicable
  // app.post('/topics/edit', function(req, res, next) {
  //   // knowledge.log({
  //   //   app: APP_NAME,
  //   //   action: 'edit topic',
  //   //   value: {
  //   //     topicId: req.body.id,
  //   //   },
  //   //   req,
  //   // });

  //   req.body.applicationType = req.body.applicationTypePrefix + req.body.applicationType;
  //   req.body.resourceType = req.body.resourceTypePrefix + req.body.resourceType;
  //   req.body.resourceName = req.body.resourceNamePrefix + req.body.resourceName;
  //   req.body.event = req.body.eventPrefix + req.body.event;

  //   delete req.body.applicationTypePrefix;
  //   delete req.body.resourceTypePrefix;
  //   delete req.body.resourceNamePrefix;
  //   delete req.body.eventPrefix;

  //   Topic.get(req.body.id, function(err, topic) {
  //     if (err) return next(err);
  //     if (!topic) return next(new Error('no topic found'));
  //     let changed = diff(topic.attrs, req.body);
  //     _.forEach(changed, function(value, key) {
  //       //if (key === '_csrf') return;
  //       if (value === '') return;
  //       let updateObj = {};
  //       updateObj[key] = value;
  //       topic.set(updateObj);
  //     });

  //     topic.update(function(err) {
  //       if (err) return next(err);
  //       res.redirect('/topics');
  //     });
  //   });
  // });
};
