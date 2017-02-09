'use strict';

console.log('Loading function ' + process.env.AWS_LAMBDA_FUNCTION_NAME,
  ' for ', process.env.SERVERLESS_STAGE, process.env.SERVERLESS_REGION,
  ' using ', process.env.TOPICS, process.env.RECORDS, process.env.HOME);
console.log('time offset passed ', 24 + (process.env.OFFSET ? parseInt(process.env.OFFSET, 10) : 0));

const awsServerlessExpress = require('aws-serverless-express');
const app = require('./index');

const server = awsServerlessExpress.createServer(app);

exports.handler = (event, context) => awsServerlessExpress.proxy(server, event, context);
