import json
import os

import boto3
from boto3.dynamodb.conditions import Key

TABLE_NAME = os.environ["TICKETS_TABLE_NAME"]

table = boto3.resource("dynamodb").Table(TABLE_NAME)


def handler(event, context):
    claims = event.get("requestContext", {}).get("authorizer", {}).get("jwt", {}).get("claims", {})
    user_id = claims.get("sub")
    if not user_id:
        return _response(401, {"message": "Missing user identity"})

    response = table.query(KeyConditionExpression=Key("userId").eq(user_id))
    tickets = sorted(
        response.get("Items", []),
        key=lambda item: item.get("processedAt", 0),
        reverse=True,
    )

    return _response(200, {"tickets": tickets})


def _response(status_code, body):
    return {
        "statusCode": status_code,
        "headers": {"Content-Type": "application/json"},
        # default=str covers the Decimal type DynamoDB numbers come back as.
        "body": json.dumps(body, default=str),
    }
