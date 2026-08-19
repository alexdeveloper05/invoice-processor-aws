import json
import os
import re
import uuid
from urllib.parse import unquote_plus

import boto3

SNS_TOPIC_ARN = os.environ["TEXTRACT_SNS_TOPIC_ARN"]
SNS_ROLE_ARN = os.environ["TEXTRACT_SNS_ROLE_ARN"]
DATA_WRITER_FUNCTION_NAME = os.environ["DATA_WRITER_FUNCTION_NAME"]

textract_client = boto3.client("textract")
lambda_client = boto3.client("lambda")

# Tickets are uploaded as {cognito sub}/{uuid}.{ext} (see presigned-url/src/handler.py).
KEY_PATTERN = re.compile(r"^(?P<user_id>[^/]+)/(?P<ticket_id>[^./]+)\.[^.]+$")


def handler(event, context):
    for record in event.get("Records", []):
        bucket = record["s3"]["bucket"]["name"]
        key = unquote_plus(record["s3"]["object"]["key"])
        _start_analysis(bucket, key)


def _start_analysis(bucket, key):
    match = KEY_PATTERN.match(key)
    user_id = match.group("user_id") if match else "unknown"
    ticket_id = match.group("ticket_id") if match else key

    try:
        # Async because it's the only Textract mode that supports multi-page PDFs
        # (the synchronous AnalyzeExpense call is limited to a single page).
        # The result shows up later, via SNS, in textract-result-handler.
        textract_client.start_expense_analysis(
            DocumentLocation={"S3Object": {"Bucket": bucket, "Name": key}},
            NotificationChannel={
                "SNSTopicArn": SNS_TOPIC_ARN,
                "RoleArn": SNS_ROLE_ARN,
            },
            ClientRequestToken=str(uuid.uuid5(uuid.NAMESPACE_URL, f"{bucket}/{key}")),
        )
    except Exception as error:
        lambda_client.invoke(
            FunctionName=DATA_WRITER_FUNCTION_NAME,
            InvocationType="Event",
            Payload=_failure_payload(bucket, key, user_id, ticket_id, str(error)),
        )


def _failure_payload(bucket, key, user_id, ticket_id, error):
    return json.dumps(
        {
            "bucket": bucket,
            "key": key,
            "userId": user_id,
            "ticketId": ticket_id,
            "status": "FAILED",
            "error": error,
        }
    ).encode("utf-8")
