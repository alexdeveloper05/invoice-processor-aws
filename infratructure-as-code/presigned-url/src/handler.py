import json
import os
import uuid

import boto3
from botocore.config import Config

ALLOWED_CONTENT_TYPES = {
    "image/jpeg": "jpg",
    "image/png": "png",
    "image/webp": "webp",
    "application/pdf": "pdf",
}

BUCKET_NAME = os.environ["WAREHOUSE_BUCKET_NAME"]
URL_EXPIRATION_SECONDS = int(os.environ.get("URL_EXPIRATION_SECONDS", "300"))

s3_client = boto3.client("s3", config=Config(signature_version="s3v4"))


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


def _response(status_code, body):
    return {
        "statusCode": status_code,
        "headers": {"Content-Type": "application/json"},
        "body": json.dumps(body),
    }
