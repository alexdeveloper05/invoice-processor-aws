import json
import os
import re

import boto3

DATA_WRITER_FUNCTION_NAME = os.environ["DATA_WRITER_FUNCTION_NAME"]

textract_client = boto3.client("textract")
lambda_client = boto3.client("lambda")

KEY_PATTERN = re.compile(r"^(?P<user_id>[^/]+)/(?P<ticket_id>[^./]+)\.[^.]+$")


def handler(event, context):
    for record in event.get("Records", []):
        message = json.loads(record["Sns"]["Message"])
        _handle_job(message)


def _handle_job(message):
    job_id = message["JobId"]
    status = message["Status"]
    bucket = message["DocumentLocation"]["S3Bucket"]
    key = message["DocumentLocation"]["S3ObjectName"]

    match = KEY_PATTERN.match(key)
    user_id = match.group("user_id") if match else "unknown"
    ticket_id = match.group("ticket_id") if match else key

    payload = {
        "bucket": bucket,
        "key": key,
        "userId": user_id,
        "ticketId": ticket_id,
    }

    if status in ("SUCCEEDED", "PARTIAL_SUCCESS"):
        payload["status"] = "PROCESSED"
        # One entry per expense Textract detected — usually one per page for a
        # multi-page invoice, or one per receipt if several were in one file.
        # Textract doesn't tell us which case we're in.
        payload["pages"] = [
            _extract_fields(document) for document in _get_all_expense_documents(job_id)
        ]
    else:
        payload["status"] = "FAILED"
        payload["error"] = f"Textract job {status.lower()}"

    lambda_client.invoke(
        FunctionName=DATA_WRITER_FUNCTION_NAME,
        InvocationType="Event",
        Payload=json.dumps(payload).encode("utf-8"),
    )


def _get_all_expense_documents(job_id):
    documents = []
    next_token = None

    while True:
        kwargs = {"JobId": job_id}
        if next_token:
            kwargs["NextToken"] = next_token

        response = textract_client.get_expense_analysis(**kwargs)
        documents.extend(response.get("ExpenseDocuments", []))

        next_token = response.get("NextToken")
        if not next_token:
            return documents


def _extract_fields(expense_document):
    fields = {}
    for summary_field in expense_document.get("SummaryFields", []):
        field_type = summary_field.get("Type", {}).get("Text")
        value = summary_field.get("ValueDetection", {}).get("Text")
        if field_type and value:
            fields[field_type] = value
    return fields
