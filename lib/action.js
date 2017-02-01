'use strict';

const vogels = require('vogels');
const joi = require('joi');
const uuid = require('node-uuid');

vogels.AWS.config.update({
  region: 'us-east-1',
});

const Action = vogels.define('Action', {
  timestamps: true,
  hashKey: 'day',
  rangeKey: 'time',

  schema: {
    time: joi.string(),
    class: joi.string(),
    day: joi.string().regex(/^[0-3][0-9]$/),//01-31, basically
    //mealCalories: some object,
    //mealFoods: some array,
    quantity: joi.number().integer(),
    insulinType: joi.string().empty('').optional(),
    insulinId: joi.string().empty('').optional(),
  },

  tableName: 'diabetes-actions',
});

// Action.before('create', function(data, next) {
//   if (!data.id) {
//     data.id = uuid.v4();
//   }

//   return next(null, data);
// });

module.exports = Action;
