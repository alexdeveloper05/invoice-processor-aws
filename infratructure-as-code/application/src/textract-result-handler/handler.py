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
        payload["pages"] = [_extract_expense(document) for document in _get_all_expense_documents(job_id)]

        # Convenience top-level copies of the fields a company most likely wants
        # to query/filter on, taken from the first page. The full detail (every
        # field Textract found, plus line items) still lives in "pages".
        first_page_fields = payload["pages"][0]["fields"] if payload["pages"] else {}
        for target_key, textract_key in (
            ("vendorName", "VENDOR_NAME"),
            ("total", "TOTAL"),
            ("receiptDate", "INVOICE_RECEIPT_DATE"),
        ):
            if textract_key in first_page_fields:
                payload[target_key] = first_page_fields[textract_key]
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


def _extract_expense(expense_document):
    fields = {}
    for summary_field in expense_document.get("SummaryFields", []):
        field_type = summary_field.get("Type", {}).get("Text")
        value = summary_field.get("ValueDetection", {}).get("Text")
        if field_type and value:
            fields[field_type] = value

    # What was actually bought — item name, price, quantity, etc. Summary
    # fields alone only cover the receipt as a whole (vendor, total, date...).
    line_items = []
    for group in expense_document.get("LineItemGroups", []):
        for line_item in group.get("LineItems", []):
            item = {}
            for line_field in line_item.get("LineItemExpenseFields", []):
                field_type = line_field.get("Type", {}).get("Text")
                value = line_field.get("ValueDetection", {}).get("Text")
                if field_type and value:
                    item[field_type] = value
            if item:
                line_items.append(item)

    return {"fields": fields, "lineItems": line_items}
