'use strict';

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
    home: 'manager',
  }
  if (stage.startsWith('prod')) {
    config.topicsDB += '-prod';
    config.recordsDB +='-prod';
  }

  return config;
}

module.exports = {
  configureDiabetes_Staging: configure.bind(null, 'staging', 'diabetes'),
  configureDiabetes_Production: configure.bind(null, 'production', 'diabetes'),
};
