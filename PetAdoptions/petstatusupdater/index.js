import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
  DynamoDBDocumentClient,
  UpdateCommand,
} from "@aws-sdk/lib-dynamodb";

const client = new DynamoDBClient({});
const dynamoClient = DynamoDBDocumentClient.from(client)

export const handler = async function (event, context, callback) {
  var payload = JSON.parse(event.body);
  var availability = "yes";
  if (payload.petavailability === void 0) {
    availability = "no";
  }

  const command = new UpdateCommand({
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
  });

  const response = await dynamoClient.send(command);
  console.log(response);
  console.log("Updated petid: " + payload.petid + ", pettype: " + payload.pettype + ", to availability: " + availability);

  return { "statusCode": 200, "body": "success" };
};
