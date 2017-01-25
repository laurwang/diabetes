'use strict';

const _ = require('lodash');
const AWS = require('aws-sdk');
const s3 = new AWS.S3();
const async = require('async');

function listObjects(bucket, prefix, cb) {
  s3.listObjects({
    Bucket: bucket,
    Prefix: prefix,
  }, function(err, data) {
    if (err) console.log(err, err.stack);
    cb(data);
  });
};

function listDirectories(params, callback) {
  s3.listObjects({
    Bucket: params.bucket,
    Prefix: params.prefix,
    Delimiter: '/',
  }, function(err, data) {
    if (err) return callback(err);

    let directories = [];
    data.CommonPrefixes.forEach((item) => {
      directories.push(item.Prefix.replace(params.prefix, ''));
    });

    callback(null, directories);
  });
};

/**
 * Searches a given s3 path for children filenames that match a given string/regex
 * @param  {[type]}   params   [description]
 * @param  {Function} callback [description]
 * @return {[type]}            [description]
 */
function searchDirectory(params, callback) {
  s3.listObjects({
    Bucket: params.bucket,
    Delimiter: params.recursive ? '' : '/',
    Marker: params.marker || '',
    Prefix: params.prefix,
  }, function(err, data) {
    if (err) return callback(err);

    let matches = [];
    data.Contents.forEach((file) => {
      if (params.match.test(file.Key)) matches.push(file);
    });

    return callback(null, matches);
  });
};

function listBucketPrefixObjects(bucket, prefix, saveFn, callback) {
  s3.listObjects({
    Bucket: bucket,
    Prefix: prefix,
  }, function(err, data) {
    if (err) console.log(err, err.stack);
    saveFn(bucket, prefix, data);

    callback();
  });
};

function listBucketPrefixesObjects(bucket, prefixes, callback) {
  var objects = {};

  async.each(prefixes, function(p, cb) {
    s3.listObjects({
      Bucket: bucket,
      Prefix: p,
    }, function(err, data) {
      if (err) return cb(err);
      data.Contents = _.filter(data.Contents, function(d) {
        return d.Key !== p + '/';
      });

      objects[bucket + p] = data;
      cb();
    });
  },

  function(err) {
    if (err) return callback(err);

    callback(null, objects);
  });
};

function getSignedUrl(bucket, key, cb) {
  if (typeof cb !== 'function') throw Error('aws => getSignedUrl requires a callback function');

  s3.getSignedUrl('getObject', {
    Bucket: bucket,
    Key: key,
    Expires: 3600,
  }, function(err, url) {
    if (err) console.error(err);
    cb(url);
  });
};

function headObject(params, callback) {
  s3.headObject({
    Bucket: params.bucket,
    Key: params.key,
  }, callback);
};

/**
 * Downloads all objects in a given directory
 * @param  {[type]}   params   [description]
 * @param  {Function} callback [description]
 * @return {[type]}            [description]
 */
function getDirectory(params, callback) {
  s3.listObjects({
    Bucket: params.bucket,
    Prefix: params.prefix,
  }, function(err, data) {
    if (err) return callback(err);

    getObject({
      bucket: params.bucket,
      key: data.Contents.map(object => object.Key),
    }, callback);
  });
}

function getObject(params, callback) {
  // Caller can either recieve a stream or a callback with an S3 object
  if (params.stream) {
    let object = s3.getObject({
      Bucket: params.bucket,
      Key: params.key,
    }).createReadStream();

    return callback(null, object);
  }

  // If not using a stream, user can pass in multiple objects to fetch
  if (!Array.isArray(params.key)) params.key = [params.key];

  async.parallel(params.key.map((key) => {
    return s3.getObject.bind(s3, {
      Bucket: params.bucket,
      Key: key,
    });
  }), function(err, data) {
    if (err) return callback(err);

    // To preserve backwards compatibility, if only one result, return it alone
    if (data.length === 1) return callback(null, data[0]);

    callback(null, data);
  });
};

function upload(params, callback) {
  // Required Options
  var options = {
    Bucket: params.bucket,
    Key: params.key,
    Body: params.body,
  };

  // Optional params
  // More can be added at
  // docs.aws.amazon.com/AWSJavaScriptSDK/latest/AWS/S3.html#putObject-property
  options = _(options).assign({
    ContentType: params.contentType,
    ACL: params.acl,
  })
  .omit(_.isNil)
  .omit(_.isUndefined)
  .value();

  s3.upload(options, callback);
};

module.exports = {
  getDirectory,
  getObject,
  getSignedUrl,
  listBucketPrefixObjects,
  listBucketPrefixesObjects,
  listDirectories,
  listObjects,
  headObject,
  searchDirectory,
  upload,
};
