import logger from '../logger';

process.env.PINO_LOG_LEVEL = "debug";
import {DynamoTools} from "../DynamoTools";
const sampleData = require("./sample-data.json");

const chai = require("chai");
const chaiAsPromised = require('chai-as-promised');
const expect = chai.expect;
chai.use(chaiAsPromised);

describe("dynamo tools", function() {
    let dynamoTools: DynamoTools;

    before(async () => {
        dynamoTools = new DynamoTools("dynamoo-test-db", {
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

    it("should seed some data", async () => {
        logger.debug(sampleData, "Seeding data");
        await dynamoTools.createTable(true);
        const p = dynamoTools.seedData(sampleData)
        expect(p).to.be.fulfilled;
    });

});
