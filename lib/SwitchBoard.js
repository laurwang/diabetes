'use strict';

class SwitchBoard {
  constructor() {
    this.LOG_URL = 'https://o8hh3zc6nf.execute-api.us-east-1.amazonaws.com/dev/logevent';
    this.request = require('request');
  }

  logEvent(args) {
    if (args.applicationType && args.resourceType && args.resourceName && args.event && args.value) {
      args.eventTimestamp = new Date().toISOString();

      if (!args.partnerName) {
        args.partnerName = 'multi';
      }

      return this.request({
        method: 'POST',
        uri: this.LOG_URL,
        headers: [
          {
            name: 'content-type',
            value: 'application/json',
          },
        ],
        body: args,
        json: true,
      });
    } else {
      throw new Error('Invalid argument. You must provide following attribute: event, value, applicationType, resourceType and resourceName');
    }
  }

}

module.exports = new SwitchBoard();
