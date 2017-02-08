'use strict';

console.log('Loading function ' + process.env.AWS_LAMBDA_FUNCTION_NAME,
  ' using ', process.env.TOPICS, process.env.RECORDS, process.env.HOME);

const awsServerlessExpress = require('aws-serverless-express');
const app = require('./index');

const server = awsServerlessExpress.createServer(app);

exports.handler = (event, context) => awsServerlessExpress.proxy(server, event, context);
