'use strict';

const vogels = require('vogels');
const joi = require('joi');
const uuid = require('node-uuid');

vogels.AWS.config.update({
  region: process.env.SERVERLESS_REGION || 'us-east-1',
});

const Action = vogels.define('Action', {
  timestamps: true,
  hashKey: 'date',
  rangeKey: 'id',

  schema: {
    date: joi.string().regex(/^[0-3][0-9]-[0-1][0-9]-[1-2][0-9]{3}$/),//TODO this is a bit ramshackle
    id: joi.string(),
    time: joi.number().integer(),//date can be constructed in local time from string then converted to unix time (UTC) and subtracted off to get number of milliseconds from start of local day
    //time: joi.date().timestamp('unix'), //NB this doesn't appear to work
    minute: joi.number().integer().min(0).max(59),
    hour: joi.number().integer().min(0).max(23),
    class: joi.string(),//Meal, Dosage, Reading
    quantity: joi.number().integer().min(1),
    mealCalories: joi.object().keys({
        protein: joi.number().integer(),
        starch: joi.number().integer(),
        veg: joi.number().integer(),
        treat: joi.number().integer(),
    }).optional(),
    mealFoods: joi.array().items(joi.string()).single().optional(),//id<space>calories
    type: joi.string().empty('').optional(),
    topicId: joi.string().empty('').optional(),
  },

  tableName: process.env.RECORDS || 'diabetes-records',
});

Action.before('create', function(data, next) {
  if (!data.id) {
    data.id = uuid.v4();
  }

  return next(null, data);
});

module.exports = Action;
