'use strict';

const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, UpdateCommand } = require('@aws-sdk/lib-dynamodb');
const AWSXRay = require('aws-xray-sdk-core');

const client = AWSXRay.captureAWSv3Client(new DynamoDBClient({}));
const documentClient = DynamoDBDocumentClient.from(client);

exports.handler = async function (event, context) {
    const payload = JSON.parse(event.body);

    const availability = payload.petavailability === undefined ? "no" : "yes";
    
    const params = {
        TableName: process.env.TABLE_NAME,
        Key: {
            "pettype": payload.pettype,
            "petid": payload.petid
        },
        UpdateExpression: "set availability = :r",
        ExpressionAttributeValues: {
            ":r": availability
        },
        ReturnValues: "UPDATED_NEW"
    };

    try {
        await updatePetadoptionsTable(params);
        console.log(`Updated petid: ${payload.petid}, pettype: ${payload.pettype}, to availability: ${availability}`);
        return { "statusCode": 200, "body": JSON.stringify({ message: "success" }) };
    } catch (error) {
        console.error("Error updating pet adoption status:", error);
        return { "statusCode": 500, "body": JSON.stringify({ message: "Error updating pet adoption status" }) };
    }
};

async function updatePetadoptionsTable(params) {
    const command = new UpdateCommand(params);
    const result = await documentClient.send(command);
    console.log(JSON.stringify(result, null, 2));
}