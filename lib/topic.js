'use strict';

const vogels = require('vogels');
const joi = require('joi');
const uuid = require('node-uuid');

vogels.AWS.config.update({
  region: process.env.SERVERLESS_REGION || 'us-east-1',
});

const Topic = vogels.define('Topic', {
  timestamps: true,
  hashKey: 'id',

  schema: {
    id: joi.string(),
    class: joi.string(),
    unit: joi.string().optional(),
    name: joi.string(),
    type: joi.string(),
    calories: joi.number().integer().optional(),
    display: joi.boolean().default(true),
  },

  tableName: process.env.TOPICS || 'diabetes-topics',
});

Topic.before('create', function(data, next) {
  if (!data.id) {
    data.id = uuid.v4();
  }

  return next(null, data);
});

module.exports = Topic;
