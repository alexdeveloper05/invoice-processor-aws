import json
import os
import uuid
from datetime import date, timedelta

import boto3
from botocore.config import Config
from botocore.exceptions import ClientError

ALLOWED_CONTENT_TYPES = {
    "image/jpeg": "jpg",
    "image/png": "png",
    "image/webp": "webp",
    "application/pdf": "pdf",
}

BUCKET_NAME = os.environ["WAREHOUSE_BUCKET_NAME"]
URL_EXPIRATION_SECONDS = int(os.environ.get("URL_EXPIRATION_SECONDS", "300"))
USAGE_TABLE_NAME = os.environ["USAGE_TABLE_NAME"]
DAILY_LIMIT = int(os.environ["DAILY_LIMIT"])

s3_client = boto3.client("s3", config=Config(signature_version="s3v4"))
dynamodb = boto3.resource("dynamodb")
usage_table = dynamodb.Table(USAGE_TABLE_NAME)


def handler(event, context):
    try:
        body = json.loads(event.get("body") or "{}")
    except json.JSONDecodeError:
        return _response(400, {"message": "Invalid JSON body"})

    content_type = body.get("contentType")
    if content_type not in ALLOWED_CONTENT_TYPES:
        return _response(400, {"message": "Unsupported content type"})

    claims = event.get("requestContext", {}).get("authorizer", {}).get("jwt", {}).get("claims", {})
    user_id = claims.get("sub")
    if not user_id:
        return _response(401, {"message": "Missing user identity"})

    if not _check_and_increment_usage(user_id):
        return _response(429, {"message": "Daily upload limit reached"})

    key = f"{user_id}/{uuid.uuid4()}.{ALLOWED_CONTENT_TYPES[content_type]}"

    upload_url = s3_client.generate_presigned_url(
        ClientMethod="put_object",
        Params={
            "Bucket": BUCKET_NAME,
            "Key": key,
            "ContentType": content_type,
        },
        ExpiresIn=URL_EXPIRATION_SECONDS,
    )

    return _response(200, {"uploadUrl": upload_url, "key": key})


def _check_and_increment_usage(user_id):
    today = date.today().isoformat()
    expires_at = int((date.today() + timedelta(days=2)).strftime("%s"))

    try:
        usage_table.update_item(
            Key={"userId": user_id, "date": today},
            UpdateExpression="SET #c = if_not_exists(#c, :zero) + :inc, expiresAt = :exp",
            ConditionExpression="attribute_not_exists(#c) OR #c < :limit",
            ExpressionAttributeNames={"#c": "count"},
            ExpressionAttributeValues={
                ":inc": 1, ":zero": 0, ":limit": DAILY_LIMIT, ":exp": expires_at
            },
        )
        return True
    except ClientError as e:
        if e.response["Error"]["Code"] == "ConditionalCheckFailedException":
            return False
        raise


def _response(status_code, body):
    return {
        "statusCode": status_code,
        "headers": {"Content-Type": "application/json"},
        "body": json.dumps(body),
    }
