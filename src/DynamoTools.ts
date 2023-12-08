/**
 * Utility for creating and deleting a Dynamo Table as well as seeding data to the table
 */
import dayjs from 'dayjs';
import defaultTableDefinition from "./default-tabledef.json";
import logger from "./logger";
import { CreateTableInput, DynamoDB, DynamoDBClientConfig } from '@aws-sdk/client-dynamodb';

/**
 * Used in the DynamoTestIntegration as a form of callback to update the Item being inserted into the table.
 * For example, you may choose to encrypt passwords for an Item that have come into the service as plain text.
 */
export interface DataCreatePlugin {
    beforeCreate(item: any): Promise<any>;
}

export type AWSCredentials = {
    accessKeyId: string,
    secretAccessKey: string,
}

/**
 * Local Dev options.
 */
export interface DynamoOptions {
    endpoint?: string,
    region?: string,
    credentials?: AWSCredentials,
}

/**
 * Allows you to simplify your Test Integrations and customize your DAOs to what you need.  This will
 * allow you to create a Dynamo Table for testing, seed data etc.
 */
export class DynamoTools {
    private dynamoDB: DynamoDB;

    /**
     * Constructs the Tools.
     *
     * @param tableName
     * @param options DynamoOptions optionally used for local development (ie local stack).
     *                Pass in an empty {} to use the defaults
     */
    constructor(protected readonly tableName: string, options?: DynamoOptions) {
        this.initLocal(options);
    }

    protected initLocal(options?: DynamoOptions) {
        const useLocal = process.env.LOCAL_DEV;
        let awsOptions: DynamoDBClientConfig = {
            region: "us-east-1"
        };
        if (options || useLocal) {
            awsOptions = {
                region: options.region || "us-east-1",
                endpoint: options.endpoint || "http://localhost:4566",
                credentials: options.credentials || {
                    accessKeyId: "accessKeyId",
                    secretAccessKey: "secretAccessKey"
                }
            }
        }
        this.dynamoDB = new DynamoDB(awsOptions);
    }

    async deleteTable() {
        const tableName = this.tableName;

        try {
            await this.getDynamoDb().deleteTable({
                TableName: tableName
            });
            logger.debug(`Deleted Table -> ${tableName}`);
        } catch (err) {
            logger.warn(`Tried to delete ${tableName} but it may not exist ${err}. Ignoring.`);
        }
    }

    replacePlaceholders(srcString: string): string {
        const replacements: any = {
            "%TABLENAME%" : this.tableName
        };

        return srcString.replace(/%\w+%/g, (all) => {
            return replacements[all] || all;
        });
    }

    public getDynamoDb() {
        return this.dynamoDB;
    }

    /**
     * Follows Alex Debrie's book on single table design using a pk/sk and "type".
     * Gives full flexibility to create access patterns but creates all
     * appropriate indexes etc to get you going.
     *
     * @param deleteTable true/false to delete the table before creating it
     * @param dynamoTableDefinition The AWS SDK parameter object structure to create your Dynamo Table.
     *
     * @returns The Result of the Created Table.
     */
    async createTable(deleteTable: boolean = false, dynamoTableDefinition?: CreateTableInput): Promise<any> {
        try {
            const tableName: string = this.tableName;

            let params;
            if (dynamoTableDefinition) {
                params = dynamoTableDefinition;
            } else {
                params = JSON.parse(this.replacePlaceholders(JSON.stringify(defaultTableDefinition)));
            }

            if (deleteTable) {
                await this.deleteTable();
            }

            let tableResult;
            try {
                tableResult = await this.getDynamoDb().createTable(params);
                logger.debug(`Table Created -> ${tableName}`);
            } catch (err) {
                logger.error(err,"Error creating DB.  DB may already exist");
            }

            return tableResult;
        } catch (err) {
            logger.error("Test Integration Table Setup error", err);
            throw err;
        }
    }

    /**
     * Allows you to seed your table for your tests
     *
     * @param items
     * @param plugin
     */
    public async seedData(items: any, plugin?: DataCreatePlugin) {
        const tableName = this.tableName;

        const batch: any = {
            RequestItems: {
                [tableName]: []
            }
        }

        const MAX_BATCH_SIZE = 25;  //https://docs.aws.amazon.com/AWSJavaScriptSDK/latest/AWS/DynamoDB.html#batchWriteItem-property
        for (const dataItem of items) {
            let item = dataItem;
            if (batch.RequestItems[tableName].length >= MAX_BATCH_SIZE) {
                await this.getDynamoDb().batchWriteItem(batch);
                batch.RequestItems[tableName] = [];
            }

            const now = dayjs();

            if (plugin) {
                const newItem = await plugin.beforeCreate(item);
                if (!newItem) {
                    logger.warn("Item was not returned from beforeCreate, ignoring updates.");
                } else {
                    item = newItem;
                }
            }

            let putRequest = {
                PutRequest: {
                    Item: {
                        cadt: {
                            "S": now.toISOString()
                        },
                        uadt: {
                            "S" : now.toISOString()
                        },
                        ...item,
                    }
                }
            }
            batch.RequestItems[tableName].push(putRequest);
        }

        // Include the last batch
        if (batch.RequestItems[tableName].length > 0) {
            try {
                await this.getDynamoDb().batchWriteItem(batch);
            } catch (err) {
                logger.error(err, "Failed Batch Write");
            }
        }

        logger.debug(`Finished Creating Data`);
    }
}