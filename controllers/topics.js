'use strict';

const _ = require('lodash');
const diff = require('object-diff');
//const piAuth = require('@pi/auth');
const Topic = require('../lib/topic');
//const knowledge = require('../lib/knowledge');

const APP_NAME = 'topics';

const DEFAULT = [
  'applicationType',
  'resourceType',
  'resourceName',
  'event',
];

const SEARCHES = [
  'starts with ',
  'ends with ',
  'contains ',
];

module.exports = function(app) {
  //app.use('/topics', piAuth.authz);

  app.get('/topics', function(req, res, next) {
    // knowledge.log({
    //   app: APP_NAME,
    //   action: 'view',
    //   req,
    // });

    Topic
      .scan()
      .loadAll()
      .exec(function(err, topics) {
        if (err) return next(err);
        res.render('topic', {
          breadcrumbs: [{
              text: 'Topics',
            },
          ],
          _csrf: req.csrfToken(),
          topics: topics.Items.map(function(topic) {
            //process the fields for expanded searches
            DEFAULT.forEach(function(field) {
              let prefix = '';
              let stripped = topic.attrs[field];
              SEARCHES.forEach(function(search) {
                if (topic.attrs[field].startsWith(search)) {
                  prefix = search;
                  stripped = stripped.substring(search.length).trim();
                }
              });

              topic.attrs[field] = {
                prefix: prefix,
                field: stripped,
              };
            });

            return topic.attrs;
          }),
        });
      });
  });

  app.get('/topics/add', function(req, res, next) {
    // knowledge.log({
    //   app: APP_NAME,
    //   action: 'view.add',
    //   req,
    // });

    //initialize so that re-usable form (both add and edit) doesn't freak out
    let topic = {};
    DEFAULT.forEach(function(field) {
      topic[field] = {};
    });

    res.render('topic/form', {
      breadcrumbs: [{
          text: 'Topics',
          href: '/topics',
        }, {
          text: 'Add Topic',
        },
      ],
      _csrf: req.csrfToken(),
      topic: topic,
      location: '/topics/add',
      actionText: 'Add',
    });
  });

  app.post('/topics/add', function(req, res, next) {
    // knowledge.log({
    //   app: APP_NAME,
    //   action: 'add topic',
    //   value: {
    //     name: req.body.name,
    //     owner: req.body.owner,
    //     team: req.body.team,
    //     event: req.body.event,
    //   },
    //   req,
    // });

    let topic = new Topic({
      name: req.body.name,
      description: req.body.description,
      applicationType: req.body.applicationTypePrefix + req.body.applicationType,
      resourceType: req.body.resourceTypePrefix + req.body.resourceType,
      resourceName: req.body.resourceNamePrefix + req.body.resourceName,
      event: req.body.eventPrefix + req.body.event,
      destinationType: req.body.destinationType,
      team: req.body.team,
      owner: req.body.owner,
    });
    topic.save(function(err) {
      if (err) return next(err);
      res.redirect('/topics');
    });
  });

  app.get('/topics/delete/:id', function(req, res, next) {
    // knowledge.log({
    //   app: APP_NAME,
    //   action: 'delete topic',
    //   value: {
    //     topicId: req.params.id,
    //   },
    //   req,
    // });

    Topic.destroy(req.params.id, function(err) {
      if (err) return next(err);
      res.redirect('/topics');
    });
  });

  app.get('/topics/edit/:id', function(req, res, next) {
    // knowledge.log({
    //   app: APP_NAME,
    //   action: 'view.edit',
    //   req,
    // });

    Topic.get(req.params.id, function(err, topic) {
      if (err) return next(err);
      if (!topic) return next(new Error('no topic found'));

      //process the fields for expanded searches
      DEFAULT.forEach(function(field) {
        let prefix = '';
        let stripped = topic.attrs[field];
        SEARCHES.forEach(function(search) {
          if (topic.attrs[field].startsWith(search)) {
            prefix = search;
            stripped = stripped.substring(search.length).trim();
          }
        });

        topic.attrs[field] = {
          prefix: prefix,
          field: stripped,
        };
      });

      res.render('topic/form', {
        breadcrumbs: [{
            text: 'Topics',
            href: '/topics',
          }, {
            text: 'Edit Topic',
          },
        ],
        _csrf: req.csrfToken(),
        topic: topic.attrs,
        location: '/topics/edit',
        actionText: 'Update',
      });
    });
  });

  app.post('/topics/edit', function(req, res, next) {
    // knowledge.log({
    //   app: APP_NAME,
    //   action: 'edit topic',
    //   value: {
    //     topicId: req.body.id,
    //   },
    //   req,
    // });

    req.body.applicationType = req.body.applicationTypePrefix + req.body.applicationType;
    req.body.resourceType = req.body.resourceTypePrefix + req.body.resourceType;
    req.body.resourceName = req.body.resourceNamePrefix + req.body.resourceName;
    req.body.event = req.body.eventPrefix + req.body.event;

    delete req.body.applicationTypePrefix;
    delete req.body.resourceTypePrefix;
    delete req.body.resourceNamePrefix;
    delete req.body.eventPrefix;

    Topic.get(req.body.id, function(err, topic) {
      if (err) return next(err);
      if (!topic) return next(new Error('no topic found'));
      let changed = diff(topic.attrs, req.body);
      _.forEach(changed, function(value, key) {
        if (key === '_csrf') return;
        if (value === '') return;
        let updateObj = {};
        updateObj[key] = value;
        topic.set(updateObj);
      });

      topic.update(function(err) {
        if (err) return next(err);
        res.redirect('/topics');
      });
    });
  });
};
