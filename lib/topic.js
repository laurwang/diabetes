'use strict';

const vogels = require('vogels');
const joi = require('joi');
const uuid = require('node-uuid');

vogels.AWS.config.update({
  region: 'us-east-1',
});

const Action = vogels.define('Topic', {
  timestamps: true,
  hashKey: 'id',

  schema: {
    id: joi.string(),
    applicationType: joi.string(),
    resourceType: joi.string(),
    resourceName: joi.string(),
    event: joi.string(),
    name: joi.string(),
    description: joi.string().empty('').optional(),
    owner: joi.string(),
    team: joi.string(),
  },

  tableName: 'web-app-topic',
});

Action.before('create', function(data, next) {
  if (!data.id) {
    data.id = uuid.v4();
  }

  return next(null, data);
});

module.exports = Action;
