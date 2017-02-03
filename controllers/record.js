'use strict';

const _ = require('lodash');
const diff = require('object-diff');
const async = require('async');

const Action = require('../lib/action');
const Topic = require('../lib/topic');

const APP_NAME = 'record';

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

    //to convert to (UTC) milliseconds at local start of day
    //  let temp = req.query.date.split('-');
    //  let time = new Date(parseInt(temp[2], 10), parseInt(temp[1], 10) - 1, parseInt(temp[0], 10));

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

          location: '/record/add',
          actionText: 'Add',
          app: APP_NAME,
        });
      });
  });

  app.post('/record/add', function(req, res, next) {
    let action = new Action({
      title: req.body.title,
      description: req.body.description,
      topicId: req.body.topicId,
      topicName: req.body.topicName,
      destinationType: req.body.destinationType,
      url: req.body.url,
      lambda: req.body.lambda,
      body: req.body.body,
      subject: req.body.subject,
      sender: req.body.sender,
      owner: req.body.owner,
      isOff: false,
      app: req.body.app,
      channel: req.body.channel,
    });
    action.save(function(err) {
      if (err) return next(err);
      res.redirect('/switchboard');
    });
  });

  app.get('/record/edit/:class/:date/:id', function(req, res, next) {

    let actionToPassIn;
    let topicsToPassIn;

    //NB only pointinside-domain emails can be sent.
    let defaultValues = {
      piEmail: extractEmailAcct(req.user.email, 'pointinside.com'),
      name: req.user.username,
      app: APP_NAME,
      slack: ['', '', '', ''],
    };

    async.parallel([
      function getTopics(cb) {
        Topic
          .scan()
          .loadAll()
          .exec(function(err, topics) {
            if (err) return cb(err);

            if (!topics) {
              topicsToPassIn = {};
            }

            topicsToPassIn = topics.Items.map(function(topic) {
              return topic.attrs;
            });

            cb();
          });
      },

      function getActions(cb) {
        Action.get(req.params.topicId, req.params.id, function(err, action) {
          if (err) return cb(err);

          if (!action) return cb(new Error('no action found'));

          actionToPassIn = action.attrs;
          cb();
        });
      },
    ], function(err) {
      if (err) return next(err);
      if (actionToPassIn.destinationType === 'slack' && actionToPassIn.url) {
        let temptemp = actionToPassIn.url.replace(SLACK + '/', '').split('/');
        if (temptemp.length === (defaultValues.slack.length - 1)) {
          temptemp.forEach(function(part, index) {
            defaultValues.slack[index + 1] = part;
          });
        }else {
          console.log('Unexpected splitting of url for this slack action.  Skipping display info.');
        }
      };

      res.render('switchboard/form', {
        //_csrf: req.csrfToken(),
        breadcrumbs: [{
            text: 'Switchboard',
            href: '/switchboard',
          }, {
            text: 'Edit Action',
          },
        ],
        action: actionToPassIn,
        topics: topicsToPassIn,
        location: '/switchboard/edit',
        actionText: 'update',
        defaultValues: defaultValues,
      });
    });
  });

  app.post('/record/edit', function(req, res, next) {

    if (req.body.topicId === req.body.oldTopicId) {
      delete req.body.oldTopicId;

      Action.get(req.body.topicId, req.body.id, function(err, action) {
        if (err) return next(err);
        if (!action) return next(new Error('no action found'));
        let changed = diff(action.attrs, req.body);
        _.forEach(changed, function(value, key) {
          //if (key === '_csrf' || key === 'isOff') return;
          if (value === '') return;//won't let you blank something that's been populated, just end up with what was previously there
          let updateObj = {};
          updateObj[key] = value;
          action.set(updateObj);
        });

        action.update(function(err) {
          if (err) return next(err);
          res.redirect('/switchboard');
        });
      });
    } else {
      let oldTopicId = req.body.oldTopicId;
      delete req.body.oldTopicId;

      let action = new Action({
        id: req.body.id,
        title: req.body.title,
        description: req.body.description,
        topicId: req.body.topicId,
        topicName: req.body.topicName,
        destinationType: req.body.destinationType,
        url: req.body.url,
        lambda: req.body.lambda,
        body: req.body.body,
        subject: req.body.subject,
        sender: req.body.sender,
        owner: req.body.owner,
        isOff: req.body.isOff == 'true' ? true : false,
        app: req.body.app,
        channel: req.body.channel,
      });
      action.save(function(err) {
        if (err) return next(err);
        Action.destroy(oldTopicId, req.body.id, function(err) {
          if (err) return next(err);
          res.redirect('/switchboard');
        });
      });
    }

  });

  app.get('/record/delete/:date/:id', function(req, res, next) {
    Action.destroy(req.params.date, req.params.id, function(err) {
      if (err) return next(err);
      res.redirect('/record');
    });
  });
};
