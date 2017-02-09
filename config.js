'use strict';

const timezone = require('./timezone.json');

// const syncreq = require('sync-request');//NB only use this during deployment serverless stack

// function configureFromService(stage, service) {
//   let url = 'https://knowledge'
//           + (stage === 'staging' ? '-staging' : '')
//           + '.pointinside.com'
//           + '/apps/lambdas';
//   let res = syncreq('GET', url, {
//     qs: {
//       apiKey: ksConfig.apiKey,
//       requestor: 'serverless',
//       partnerName: service,
//     },
//   });
//   let resParsed = JSON.parse(res.getBody('utf8'));
//   return resParsed;
// }

function configure(stage, service) {
  let config = {
    topicsDB: service + '-topics',
    recordsDB: service + '-records',
    lambdaBasicExecutionRole: 'arn:aws:iam::' + process.env.ACCOUNT + ':role/LambdaBasicExecution',
    lambdaFullExecutionRole: 'arn:aws:iam::' + process.env.ACCOUNT + ':role/LambdaFullExecution',
    zoneOffset: timezone[process.env.TZ] || timezone.default,//yaml cannot process the region as a property
    home: 'manager',
  }

  if (stage === 'prod') {
    config.topicsDB += '-';
    config.recordsDB += '-';
    if (process.env.PRIMARY) {
      config.topicsDB += process.env.PRIMARY;
      config.recordsDB += process.env.PRIMARY;
    } else {
      config.topicsDB += 'prod';
      config.recordsDB += 'prod';
    }
  }

  return config;
}

module.exports = {
  configureDiabetes_Staging: configure.bind(null, 'staging', 'diabetes'),
  configureDiabetes_Prod: configure.bind(null, 'prod', 'diabetes'),
};
