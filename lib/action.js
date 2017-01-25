'use strict';

const vogels = require('vogels');
const joi = require('joi');
const uuid = require('node-uuid');

vogels.AWS.config.update({
  region: 'us-east-1',
});

const Action = vogels.define('Action', {
  timestamps: true,
  hashKey: 'topicId',
  rangeKey: 'id',

  schema: {
    destinationType: joi.string(),
    id: joi.string(),
    isOff: joi.boolean().default(false),
    owner: joi.string(),
    topicId: joi.string(),
    topicName: joi.string(),
    app: joi.string().empty('').optional(),
    body: joi.string().empty('').optional(),
    channel: joi.string().empty('').optional(),//for slack
    description: joi.string().empty('').optional(),
    lambda: joi.string().empty('').optional(),
    sender: joi.string().empty('').optional(),
    subject: joi.string().empty('').optional(),
    title: joi.string().optional(),
    url: joi.string().empty('').optional(),//for webhook and slack
  },

  tableName: 'web-app-switchboard-action',
});

Action.before('create', function(data, next) {
  if (!data.id) {
    data.id = uuid.v4();
  }

  return next(null, data);
});

module.exports = Action;
