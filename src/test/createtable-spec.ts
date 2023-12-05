import logger from "../logger";
logger.level = "debug";

import {DynamoTools} from "../DynamoTools";

const chai = require("chai");
const chaiAsPromised = require('chai-as-promised');
const expect = chai.expect;
chai.use(chaiAsPromised);

describe("dynamo tools", function() {
    let dynamoTools: DynamoTools;

    before(async () => {
        dynamoTools = new DynamoTools("unit-test-db", {
            endpoint: "http://localhost:4566",
            region: "us-east-1",
        });
    });

    after(async () => {
        await dynamoTools.deleteTable();
    });

    it("should create a table", async () => {
        console.log("Creating Table");
        const p = dynamoTools.createTable(true);
        expect(p).to.be.fulfilled;
    });
});