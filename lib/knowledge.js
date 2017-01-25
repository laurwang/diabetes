'use strict';

const _ = require('lodash');
const request = require('request');
//const chalk = require('chalk');
const mm = require('./metrics-monkey');
const AWS = require('aws-sdk');
const dynamodb = new AWS.DynamoDB({
  region: 'us-east-1', // N. Virginia
  convertResponseTypes: true,
});
const dynamoDataAttrs = require('dynamodb-data-types').AttributeValue;

const ENV = process.env.NODE_ENV || 'development';

// Models
const Partner = require('../models/partnerModel');

// Hydrate models if we know content type
function hydrate(resource, collection) {
  switch (resource) {
    case 'partners':
      collection.forEach((partner, index) => {
        collection[index] = new Partner(partner);
      });
    break;
  }

  return collection;
}

// We need to find out where our knowledge service is, grab it from DDB
let cache;
function lookup(callback) {
  if (cache && cache.expiresAt >= Date.now()) {
    return callback(null, cache);
  }

  dynamodb.getItem({
    TableName: 'web-app-config',
    Key: {
      id: {
        S: `knowledge-service-${ENV}`,
      },
    },
  }, (err, config) => {
    if (err) return callback(err);

    config = dynamoDataAttrs.unwrap(config.Item);

    cache = config;

    config.expiresAt = Date.now() + (60 * 1000); // cache for one minute

    callback(null, config);
  });
}

function find(options, callback) {
  lookup((err, config) => {
    if (err) return callback(err);

    let requiredFields = [
      'resource',
      'resourceId',
    ];

    if (_.some(requiredFields, (field) => Object.keys(options).indexOf(field) < 0)) {
      return callback(new Error('Missing required field'));
    }

    if (!config.apiKeys || !config.apiKeys.length) {
      return callback(new Error('Knowledge: Failed to load API Keys'));
    }

    // Allow user to pass in querystring params we're unaware of
    let qs = _.merge({
        apiKey: config.apiKeys[0].KEY,
      }, options.qs);

    request({
      method: 'GET',
      url: [
        config.url,
        options.resource,
        options.resourceId,
      ].join('/'),
      qs,
      json: true,
    }, (err, response, body) => {
      if (err) return callback(err);

      if (response.statusCode !== 200) {
        let apiErr = new Error(`Knowledge Service Response Code
          ${response.statusCode}: ${body.message}`);
        apiErr.statusCode = response.statusCode;
        return callback(apiErr);
      }

      return callback(null, body);
    });
  });
}

function search(options, callback) {
  lookup((err, config) => {
    if (err) return callback(err);

    let requriedFields = [
      'resource',
      'filter',
    ];

    if (_.some(requriedFields, (field) => Object.keys(options).indexOf(field) < 0)) {
      return callback(new Error('Missing required field'));
    }

    request({
      method: 'GET',
      url: [
        config.url,
        options.resource,
      ].join('/'),
      qs: {
        apiKey: config.apiKeys[0].KEY,
        filter: options.filter,
        limit: options.limit || null,
        offset: options.offset || null,
      },
      json: true,
    }, function(err, response, body) {
      if (err) return callback(err);

      if (response.statusCode !== 200) {
        let apiErr = new Error(`Knowledge Service Response Code
          ${response.statusCode}: ${body && body.message || ''}`);
        apiErr.statusCode = response.statusCode;
        return callback(apiErr);
      }

      body = hydrate(options.resource, body);

      return callback(null, body);
    });
  });
}

/**
 * List all users the user has access too
 *
 * @param  {[type]} options [description]
 * @return {[type]}         [description]
 */
function listAll(options, callback) {
  lookup((err, config) => {
    if (err) return callback(err);

    let requriedFields = [
      'resource',
    ];

    if (_.some(requriedFields, (field) => Object.keys(options).indexOf(field) < 0)) {
      return callback(new Error('Missing required field'));
    }

    request({
      method: 'GET',
      url: [
        config.url,
        options.resource,
      ].join('/'),
      qs: {
        apiKey: config.apiKeys[0].KEY,
        limit: options.limit || null,
        offset: options.offset || null,
      },
      json: true,
    }, function(err, response, body) {
      if (err) return callback(err);

      if (response.statusCode !== 200) {
        let apiErr = new Error(`Knowledge Service Response Code
          ${response.statusCode}: ${body && body.message || ''}`);
        apiErr.statusCode = response.statusCode;
        return callback(apiErr);
      }

      body = hydrate(options.resource, body);

      return callback(null, body);
    });
  });
};

function log(event, cb) {
  lookup((err, config) => {
    // Callback is optional
    if (!cb) cb = () => {};

    if (err) return cb(err);

    // If passed in the request object, we'll extract the userId and userAgent
    if (event.req) {
      event.userAgent = event.req.headers['user-agent'];

      // key to be used in event log => user property
      let userAttrs = {
        userId: 'id',
        partner: 'activePartner',
        userRoles: 'roles',
        email: 'email',
      };

      for (var i in userAttrs) {
        event[i] = _.get(event.req.user, userAttrs[i], 'Unknown');
      }

      delete event.req;
    }

    let requiredAttr = [
      'app',
      'action',
      'email',
      'partner',
      'userId',
      'userAgent',
    ];

    let hasAll = requiredAttr.every((attr) => {
      return _.includes(Object.keys(event), attr);
    });

    if (!hasAll) return cb(new Error('Missing required attribute'));

    let e = {
      partnerName: 'PointInside',
      applicationType: 'webapps',
      resourceType: 'webAppEvent',
      resourceName: process.env.NODE_ENV || 'development',
      event: `${event.app}.${event.action}`,
      eventTimestamp: new Date().toISOString(),
      value: {
        userId: event.userId,
        email: event.email,
        userAgent: event.userAgent,
        roles: event.userRoles,
      },
    };

    // Add in any additonal properties they want to include
    _.merge(e.value, event.value);

    mm.log(e, cb);
  });
};

/**
 * Convience method to get an application configuration
 *
 * @param  {String}   app      Application name
 * @param  {String}   partner  Optional. Partner name.
 * @param  {Function} callback
 * @return {Object}            Configuration for that application
 */
function apps(app, partner, callback) {
  lookup((err, config) => {
    if (err) return callback(err);

    // Partner is optional, check if it's the cb instead
    if (typeof partner === 'function') {
      callback = partner;
      partner = null;
    }

    find({
      resource: 'apps',
      resourceId: app,
      qs: {
        partnerName: partner && partner.toLowerCase(),
      },
    }, callback);
  });
}

module.exports = {
  apps,
  find,
  listAll,
  lookup,
  log,
  search,
};
