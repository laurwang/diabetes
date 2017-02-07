# diabetes

How to Deploy
=============

**Install serverless**

  `npm install -g serverless`

**AWS Permissions**

If you have AdministratorAccess on your AWS account, everything will just work.  Otherwise, as you try to do your initialization, you will get errors indicating which roles you need to add to your profile.

**Create/update the configuration you plan to deploy**

In config.js (in the root of this repo), add the name of the dynamo tables and lambda role to the environment variables passed to the lambda.  Depending on your configure method, you may need to have done an npm install first in the root.

**Deploy Lambdas to staging or prod**

1. To deploy all lambdas, from the root

  a. run npm install

  b. set the account number as an environment variable and deploy, by typing

    `ACCOUNT=<AWS account number> serverless deploy -s staging|prod`

2. To deploy a single lambda function, from the root type

    `ACCOUNT=<AWS account number> serverless deploy function -f <nameOfFunction> -s staging|prod`

  See https://serverless.com/framework/docs/cli-reference/deploy/ for more options.  Not completely convinced this part works.


**Un-deploy Lambdas**

Use the AWS console for individual lambdas, until Serverless 1.2 has this functionality.  Currently, you can only remove stages or the entire service.  If removing through the AWS console, remember to remove first the endpoint, then the event, then the lambda, then the cloud formation.  It's best to avoid this because Serverless tucks away little artifacts *somewhere* such as a ServerlessDeploymentBucket in a mystery S3 location, which will block you from any further deployments to be made using the same name, unless you retain it forever (since you don't know where it is to delete manually).

To Create Your Own Stage for Development
=================================================

Clone the repo.  Go to the action group you want to deploy and run

  `serverless deploy -s <yourStageName> -r us-east-1`

When done developing, remove the stage.

  `serverless remove -s <yourStageName>`

Note that personal stages are treated as staging.
