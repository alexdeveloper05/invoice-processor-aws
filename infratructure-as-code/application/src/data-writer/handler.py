import os
import time

import boto3

TABLE_NAME = os.environ["TICKETS_TABLE_NAME"]

table = boto3.resource("dynamodb").Table(TABLE_NAME)


def handler(event, context):
    item = {
        "userId": event["userId"],
        "ticketId": event["ticketId"],
        "bucket": event["bucket"],
        "key": event["key"],
        "status": event["status"],
        "processedAt": int(time.time()),
    }

    if event["status"] == "PROCESSED":
        item["pages"] = event.get("pages", [])
        for key in ("vendorName", "total", "receiptDate"):
            if key in event:
                item[key] = event[key]
    else:
        item["error"] = event.get("error", "Unknown error")

    table.put_item(Item=item)
