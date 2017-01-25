'use strict';

const _ = require('lodash');
const diff = require('object-diff');
//const piAuth = require('@pi/auth');
const async = require('async');

const Action = require('../lib/action');
const Topic = require('../lib/topic');
//const knowledge = require('../lib/knowledge');

const APP_NAME = 'switchboard';
const SLACK = 'https://hooks.slack.com/services';
const HAS_SENDER = ['slack', 'email'];

//allows user to pass in email address or just the username part;
//only accepts the username part of addresses from the given domain
function extractEmailAcct(address, domain) {
  let temp = address.split('@');
  if (temp.length === 1 || (temp.length === 2 && temp[1].toLowerCase() === domain)) {
    return temp[0];
  }

  return '';
}

function processExtraSlackFields(reqBody) {
  if (reqBody.destinationType === 'slack') {
    //put together slack url, if entered
    if (reqBody.slack1 && reqBody.slack2 && reqBody.slack3) {
      reqBody.url = SLACK + '/' + reqBody.slack1 + '/' + reqBody.slack2 + '/' + reqBody.slack3;
    }

    if (reqBody.username) {
      reqBody.sender = reqBody.username;
    }
  }

  delete reqBody.slack1;
  delete reqBody.slack2;
  delete reqBody.slack3;
  delete reqBody.username;
}

module.exports = function(app) {
  //app.use('/switchboard', piAuth.authz);

  app.get('/switchboard', function(req, res, next) {
    // knowledge.log({
    //   app: APP_NAME,
    //   action: 'view',
    //   req,
    // });

    Action
      .scan()
      .loadAll()
      .exec(function(err, actions) {
        if (err) return next(err);
        res.render('switchboard/index', {
          breadcrumbs: [{
              text: 'Switchboard',
            },
          ],
          _csrf: req.csrfToken(),
          actions: actions.Items.map(function(action) {
            return action.attrs;
          }),
        });
      });
  });

  app.get('/switchboard/add', function(req, res, next) {
    // knowledge.log({
    //   app: APP_NAME,
    //   action: 'view.add',
    //   req,
    // });

    // knowledge.find({
    //   resource: 'apps',
    //   resourceId: APP_NAME.toLowerCase(),
    // }, (err, config) => {
    //   if (err) return cb(err);

      //NB only pointinside-domain emails can be sent.
      let defaultValues = {
        piEmail: extractEmailAcct(req.user.email, 'pointinside.com'),
        name: req.user.username,
        app: APP_NAME,
        slack: [SLACK],//.concat(config.slackDefault),
      };

      Topic
        .scan()
        .loadAll()
        .exec(function(err, topics) {
          if (err) return next(err);
          res.render('switchboard/form', {
            _csrf: req.csrfToken(),
            breadcrumbs: [{
                text: 'Switchboard',
                href: '/switchboard',
              }, {
                text: 'Add Action',
              },
            ],
            action: {},
            topics: topics.Items.map(function(topic) {
              return topic.attrs;
            }),

            location: '/switchboard/add',
            actionText: 'add',
            defaultValues: defaultValues,
          });
        });

    //});
  });

  app.post('/switchboard/add', function(req, res, next) {
    // knowledge.log({
    //   app: APP_NAME,
    //   action: 'add action',
    //   value: {
    //     title: req.body.title,
    //     topicId: req.body.topicId,
    //     topicName: req.body.topicName,
    //     destinationType: req.body.destinationType,
    //   },
    //   req,
    // });

    processExtraSlackFields(req.body);

    if (HAS_SENDER.indexOf(req.body.destinationType) === -1) {
      req.body.sender = '';
    }

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

  app.get('/switchboard/edit/:topicId/:id', function(req, res, next) {
    // knowledge.log({
    //   app: APP_NAME,
    //   action: 'view.edit',
    //   value: {
    //     topicId: req.params.topicId,
    //     actionId: req.params.id,
    //   },
    //   req,
    // });

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
        _csrf: req.csrfToken(),
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

  app.post('/switchboard/edit', function(req, res, next) {
    processExtraSlackFields(req.body);

    if (HAS_SENDER.indexOf(req.body.destinationType) === -1) {
      req.body.sender = '';
    }

    if (req.body.topicId === req.body.oldTopicId) {
      delete req.body.oldTopicId;

      // knowledge.log({
      //   app: APP_NAME,
      //   action: 'edit action',
      //   value: {
      //     topicId: req.body.topicId,
      //     actionId: req.body.id,
      //   },
      //   req,
      // });

      Action.get(req.body.topicId, req.body.id, function(err, action) {
        if (err) return next(err);
        if (!action) return next(new Error('no action found'));
        let changed = diff(action.attrs, req.body);
        _.forEach(changed, function(value, key) {
          if (key === '_csrf' || key === 'isOff') return;
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

      // knowledge.log({
      //   app: APP_NAME,
      //   action: 'replace action',
      //   value: {
      //     topicId: req.body.topicId,
      //     topicName: req.body.topicName,
      //     actionId: req.body.id,
      //     oldTopicId: oldTopicId,
      //   },
      //   req,
      // });

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

  app.get('/switchboard/delete/:topicId/:id', function(req, res, next) {
    // knowledge.log({
    //   app: APP_NAME,
    //   action: 'delete action',
    //   value: {
    //     topicId: req.params.topicId,
    //     actionId: req.params.id,
    //   },
    //   req,
    // });

    Action.destroy(req.params.topicId, req.params.id, function(err) {
      if (err) return next(err);
      res.redirect('/switchboard');
    });
  });

  app.get('/switchboard/turnOff/:topicId/:id', function(req, res, next) {
    Action.get(req.params.topicId, req.params.id, function(err, action) {
      if (err) return next(err);
      if (!action || !action.attrs) return next(new Error('No action with attributes found.'));

      // knowledge.log({
      //   app: APP_NAME,
      //   action: 'turn action ${action.attrs.isOff ? "on" : "off"}',
      //   value: {
      //     topicId: req.params.topicId,
      //     actionId: req.params.id,
      //   },
      //   req,
      // });

      console.log('previous setting for isOff: ', action.attrs.isOff);//assume nonexistent equals false for isOff
      let updateObj = {
        isOff: !action.attrs.isOff,
      };
      action.set(updateObj);

      action.update(function(err) {
        if (err) return next(err);
        res.redirect('/switchboard');
      });
    });
  });
};
